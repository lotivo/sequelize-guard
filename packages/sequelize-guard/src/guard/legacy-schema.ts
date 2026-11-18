import type { Model, ModelStatic, Sequelize } from 'sequelize';
import type { GuardModels } from '../sequelize-models';

const timestampNames = ['createdAt', 'updatedAt', 'deletedAt'] as const;

/** Check legacy table structure before sync can alter any existing table. */
export async function inspectLegacySchema(
  sequelize: Sequelize,
  models: GuardModels,
  suppliedUser: boolean,
  completedSyncModels: ReadonlySet<string> = new Set(),
): Promise<boolean> {
  const query = sequelize.getQueryInterface();
  const entries = (
    Object.entries(models) as [string, ModelStatic<Model>][]
  ).filter(([name]) => !suppliedUser || name !== 'GuardUser');
  const present = await Promise.all(
    entries.map(async ([, model]) => query.tableExists(model.getTableName())),
  );
  if (!present.some(Boolean)) return false;
  if (
    present.some((exists) => !exists) &&
    present.some(
      (exists, index) => exists && !completedSyncModels.has(entries[index][0]),
    )
  ) {
    throw new Error('Incomplete legacy Guard schema; refusing synchronization');
  }

  // All six legacy tables exist. Check required columns before Sequelize.sync
  // gets a chance to mutate a coincidentally named application table.
  for (const [index, [, model]] of entries.entries()) {
    if (!present[index]) continue;
    const columns = await query.describeTable(model.getTableName());
    const tableName = model.getTableName();
    const tableLabel =
      typeof tableName === 'string' ? tableName : tableName.tableName;
    for (const [attributeName, attribute] of Object.entries(
      model.getAttributes(),
    )) {
      if (
        timestampNames.includes(
          attributeName as (typeof timestampNames)[number],
        )
      ) {
        const snake = attributeName.replace(
          /[A-Z]/g,
          (letter) => `_${letter.toLowerCase()}`,
        );
        const field = columns[attributeName] ? attributeName : snake;
        if (!columns[field]) {
          throw new Error(
            `Incompatible legacy Guard table ${tableLabel}: missing ${attributeName}`,
          );
        }
        if (field !== attributeName) {
          // Published migrations used snake_case while published sync used camelCase.
          model.rawAttributes[attributeName].field = field;
          (
            model as ModelStatic<Model> & { refreshAttributes(): void }
          ).refreshAttributes();
        }
        continue;
      }
      const field = attribute.field ?? attributeName;
      const column = columns[field];
      if (!column || (attribute.primaryKey && !column.primaryKey)) {
        throw new Error(
          `Incompatible legacy Guard table ${tableLabel}: missing or invalid ${field}`,
        );
      }
      const expected = String(attribute.type).toUpperCase();
      if (
        (/^INTEGER/.test(expected) && !/INT/i.test(column.type)) ||
        (/^(VARCHAR|STRING|TEXT)/.test(expected) &&
          !/CHAR|TEXT|CITEXT/i.test(column.type))
      ) {
        throw new Error(
          `Incompatible legacy Guard table ${tableLabel}: invalid ${field} type`,
        );
      }
    }
  }
  return true;
}

/** Defer inspection until first use when sync:false promises database-free ready. */
export function installLegacyCompatibility(
  sequelize: Sequelize,
  models: GuardModels,
  suppliedUser: boolean,
): void {
  let inspection: Promise<boolean> | undefined;
  const ensure = async () => {
    inspection ??= inspectLegacySchema(sequelize, models, suppliedUser);
    try {
      if (!(await inspection)) inspection = undefined;
    } catch (error) {
      inspection = undefined;
      throw error;
    }
  };
  for (const [name, model] of Object.entries(models) as [
    string,
    ModelStatic<Model>,
  ][]) {
    if (suppliedUser && name === 'GuardUser') continue;
    model.addHook('beforeFind', ensure);
    model.addHook('beforeCreate', ensure);
    model.addHook('beforeBulkCreate', ensure);
    model.addHook('beforeUpdate', ensure);
    model.addHook('beforeDestroy', ensure);
  }
}
