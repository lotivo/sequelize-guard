import { createHash } from 'node:crypto';
import {
  QueryTypes,
  type Model,
  type ModelStatic,
  type QueryOptions,
  type Sequelize,
} from 'sequelize';
import type { RoleMemberships } from '../guard/RoleMemberships';
import type { GuardInternalOptions } from '../types';
import { guardIndexes } from './guard-indexes';
import {
  guardTable,
  physicalTableKey,
  scopedGuardTable,
  storageTableKey,
  validateGuardTables,
} from './guard-tables';
import { getGuardRoleUserSchema } from './GuardRoleUser';
import type { RoleUserModel } from './GuardRoleUser';
import { AssociationModelType, BaseModelType } from './types/ModelType';
import { modelKey } from './user-key';
import { modelOptions } from './utils';

export function roleHolderTables(
  sequelize: Sequelize,
  options: GuardInternalOptions,
) {
  const role = guardTable(sequelize, options, BaseModelType.Roles);
  const registrations = Object.entries(options.roleHolders).map(
    ([type, model]) => {
      if (!/^[a-z][a-z0-9_]*$/.test(type)) {
        throw new TypeError(`Invalid registered role holder type "${type}"`);
      }
      if (sequelize.models[model?.name] !== model) {
        throw new TypeError(
          `Role holder "${type}" must be a registered model of this Sequelize instance`,
        );
      }
      const key = modelKey(sequelize, model, `Role holder "${type}"`);
      // Reusing a registration name for another model must never expose the first model's grants.
      const binding = JSON.stringify([
        storageTableKey(sequelize, key.table),
        key.column,
        key.type.toString({}),
      ]);
      const digest = createHash('sha256')
        .update(binding)
        .digest('hex')
        .slice(0, 24);
      const tableName = roleHolderTablePrefix(options) + type + '_' + digest;
      return {
        type,
        model,
        key,
        tableName,
        table: scopedGuardTable(sequelize, tableName),
        attributes: getGuardRoleUserSchema({
          roleReference: { model: role, key: 'id' },
          userReference: { model: key.table, key: key.column },
          userType: key.type,
        }),
        indexes: guardIndexes(AssociationModelType.RoleUser, tableName),
      };
    },
  );
  if (registrations.length) {
    validateGuardTables(
      sequelize,
      options,
      registrations.map(({ table }) => table),
      registrations.map(({ key }) => key.table),
    );
  }
  return registrations;
}

export function initRoleHolders(
  sequelize: Sequelize,
  options: GuardInternalOptions,
  registrations: ReturnType<typeof roleHolderTables>,
): ReadonlyMap<object, RoleMemberships> {
  const holders = new Map<object, RoleMemberships>();
  for (const { model, type, tableName, attributes, indexes } of registrations) {
    const links = sequelize.define<RoleUserModel>(
      holderModelName(type),
      attributes,
      {
        ...modelOptions(options, tableName),
        charset: model.options.charset,
        collate: model.options.collate,
        indexes,
      },
    );
    holders.set(model, { members: model, links });
  }
  return holders;
}

export function assertAvailableHolderModelNames(
  sequelize: Sequelize,
  registrations: ReturnType<typeof roleHolderTables>,
): void {
  const applicationTables = new Set(
    sequelize.modelManager.models.map((model) =>
      physicalTableKey(sequelize, model.getTableName()),
    ),
  );
  for (const { type, table, tableName } of registrations) {
    if (sequelize.models[holderModelName(type)]) {
      throw new Error(
        `Guard role holder junction model "${holderModelName(type)}" already exists`,
      );
    }
    if (applicationTables.has(physicalTableKey(sequelize, table))) {
      throw new Error(
        `Guard role holder junction "${tableName}" conflicts with a registered application table`,
      );
    }
  }
}

export async function assertRoleHolderTables(
  sequelize: Sequelize,
  models: Iterable<ModelStatic<Model>>,
  options: QueryOptions,
): Promise<void> {
  for (const model of models) {
    if (
      !(await sequelize
        .getQueryInterface()
        .tableExists(model.getTableName(), { ...options, useMaster: true }))
    ) {
      throw new Error(
        `Create the registered role holder table for "${model.name}" before setting up the guard`,
      );
    }
  }
}

export async function assertCompleteRoleHolderConfiguration(
  sequelize: Sequelize,
  options: GuardInternalOptions,
  queryOptions: QueryOptions,
): Promise<void> {
  const scoped = scopedGuardTable(sequelize, roleHolderTablePrefix(options));
  const writer = { ...queryOptions, useMaster: true };
  const tables =
    sequelize.getDialect() === 'postgres'
      ? (
          await sequelize.query<{ table_name: string }>(
            "SELECT table_name AS table_name FROM information_schema.tables WHERE table_schema = $schema AND table_type = 'BASE TABLE'",
            {
              ...writer,
              bind: {
                schema: typeof scoped === 'string' ? 'public' : scoped.schema,
              },
              type: QueryTypes.SELECT,
            },
          )
        ).map(({ table_name }) => table_name)
      : await sequelize.getQueryInterface().showAllTables(writer);
  const normalize = (name: string) =>
    sequelize.getDialect() === 'postgres' ? name : name.toLowerCase();
  const prefix = normalize(
    typeof scoped === 'string' ? scoped : scoped.tableName,
  );
  const declared = new Set(
    roleHolderTables(sequelize, options).map(({ table }) =>
      normalize(typeof table === 'string' ? table : table.tableName),
    ),
  );
  for (const table of tables) {
    const name = normalize(table);
    if (name.startsWith(prefix) && !declared.has(name)) {
      throw new Error(
        `Specify the registered model for existing role holder table "${table}"`,
      );
    }
  }
}

function roleHolderTablePrefix(options: GuardInternalOptions): string {
  return `${options.prefix}role_holder_`;
}

function holderModelName(type: string): string {
  return `GuardRoleHolder_${type}`;
}
