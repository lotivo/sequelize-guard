import { randomBytes } from 'node:crypto';
import { Sequelize } from 'sequelize';
import { expect, it, onTestFinished } from 'vitest';
import { SequelizeGuard } from '../index';

it('uses committed writer policy for direct membership and grants', async () => {
  const url = process.env.SEQUELIZE_GUARD_TEST_DATABASE_URL;
  if (!url || !/^(postgres(ql)?|mysql):/.test(url)) {
    throw new Error(
      'Set SEQUELIZE_GUARD_TEST_DATABASE_URL to an isolated PostgreSQL or MySQL database',
    );
  }
  const sequelize = new Sequelize(url, { logging: false });
  onTestFinished(() => sequelize.close());
  const guard = new SequelizeGuard(sequelize, {
    prefix: `guard_auth_${randomBytes(4).toString('hex')}_`,
    sync: true,
  });
  await guard.ready;
  const user = await guard.makeUser();
  const { role } = await guard.makeRole('reader');
  await user.addRole!(role.id);
  const [permission] = await guard.createPerms('document', 'read');
  const { RolePermission, RoleUser } = guard.models();

  expect(await user.can!('read document')).toBe(false);
  await RolePermission.create({
    role_id: role.id,
    permission_id: permission.id,
  });
  expect(await user.can!('read document')).toBe(true);
  expect(await user.isA!('reader')).toBe(true);
  await RolePermission.destroy({ where: { role_id: role.id } });
  expect(await user.can!('read document')).toBe(false);
  await RoleUser.destroy({ where: { user_id: user.id } });
  expect(await user.isA!('reader')).toBe(false);
});
