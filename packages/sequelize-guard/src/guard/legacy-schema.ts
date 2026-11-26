import type { Model, ModelStatic, QueryOptions, Sequelize } from 'sequelize';
import {
  legacyTimestampFields,
  type LegacyTimestampAttribute,
  type LegacyTimestampMapping,
} from '../core/guard-bindings';
import type { GuardModels } from '../sequelize-models';

export interface LegacySchemaOptions {
  suppliedUser: boolean;
  acceptTimestamps: (mappings: LegacyTimestampMapping[]) => void;
  completedSyncModels: ReadonlySet<string>;
}

function isLegacyTimestamp(
  attribute: string,
): attribute is LegacyTimestampAttribute {
  return Object.hasOwn(legacyTimestampFields, attribute);
}

/** Check legacy table structure before sync can alter any existing table. */
export async function inspectLegacySchema(
  sequelize: Sequelize,
  models: GuardModels,
  { suppliedUser, acceptTimestamps, completedSyncModels }: LegacySchemaOptions,
): Promise<boolean> {
  const query = sequelize.getQueryInterface();
  const readOptions: QueryOptions = { useMaster: true, transaction: null };
  const entries = (
    Object.entries(models) as [string, ModelStatic<Model>][]
  ).filter(([name]) => !suppliedUser || name !== 'GuardUser');
  const tables = entries.map(([name, model]) => ({
    name,
    model,
    table: model.getTableName(),
  }));
  const present = await Promise.all(
    tables.map(({ table }) => query.tableExists(table, readOptions)),
  );
  if (!present.some(Boolean)) {
    acceptTimestamps([]);
    return false;
  }
  if (
    present.some((exists) => !exists) &&
    present.some(
      (exists, index) => exists && !completedSyncModels.has(tables[index].name),
    )
  ) {
    throw new Error('Incomplete legacy Guard schema; refusing synchronization');
  }

  const mappings: LegacyTimestampMapping[] = [];
  for (const [index, { model, table }] of tables.entries()) {
    if (!present[index]) continue;
    const columns = await query.describeTable(table, readOptions);
    const tableLabel = typeof table === 'string' ? table : table.tableName;
    for (const [name, attribute] of Object.entries(model.getAttributes())) {
      let field = attribute.field ?? name;
      if (
        isLegacyTimestamp(name) &&
        field === name &&
        !Object.hasOwn(columns, field) &&
        Object.hasOwn(columns, legacyTimestampFields[name])
      ) {
        field = legacyTimestampFields[name];
        mappings.push({ model, attribute: name });
      }
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
          !/CHAR|TEXT|CITEXT/i.test(column.type)) ||
        (isLegacyTimestamp(name) && !/^(DATE|TIMESTAMP)/i.test(column.type))
      ) {
        throw new Error(
          `Incompatible legacy Guard table ${tableLabel}: invalid ${field} type`,
        );
      }
    }
  }
  // Apply the plan only after every existing table and column has passed.
  acceptTimestamps(mappings);
  return true;
}

/** Defer inspection until first use when sync:false promises database-free ready. */
export function installLegacyCompatibility(
  sequelize: Sequelize,
  models: GuardModels,
  options: LegacySchemaOptions,
): void {
  let inspection: Promise<boolean> | undefined;
  const ensure = async () => {
    inspection ??= inspectLegacySchema(sequelize, models, options);
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
    if (options.suppliedUser && name === 'GuardUser') continue;
    model.addHook('beforeFind', ensure);
    model.addHook('beforeCreate', ensure);
    model.addHook('beforeBulkCreate', ensure);
    model.addHook('beforeUpdate', ensure);
    model.addHook('beforeDestroy', ensure);
    model.addHook('beforeRestore', ensure);
  }
}
