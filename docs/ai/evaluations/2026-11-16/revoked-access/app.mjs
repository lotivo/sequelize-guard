import { Sequelize } from 'sequelize';
import { SequelizeGuard } from 'sequelize-guard';

export async function existingApplication() {
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });
  const guard = new SequelizeGuard(sequelize);
  await guard.ready;
  const user = await guard.makeUser();
  await guard.allow('reader', 'read', 'document');
  await guard.assignRole(user, 'reader');
  async function authorize(permission = 'read document') {
    return guard.userCan(user, permission);
  }
  return { sequelize, guard, user, authorize };
}
