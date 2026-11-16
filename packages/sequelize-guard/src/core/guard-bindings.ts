import type { Model, ModelStatic, Sequelize } from 'sequelize';
import {
  sequelizeOptions,
  storageTableKey,
} from '../sequelize-models/guard-tables';

/** Capture values, never freeze application-owned Sequelize objects. */
export function captureGuardBindings(
  sequelize: Sequelize,
  models: ModelStatic<Model>[],
): () => void {
  const identities = new WeakMap<object, number>();
  let nextIdentity = 0;
  // Do not execute defaults or serialize function bodies/circular Sequelize graphs.
  const serialize = (
    value: unknown,
    ancestors = new Set<object>(),
  ): unknown => {
    if (
      typeof value === 'function' ||
      (typeof value === 'object' && value !== null && ancestors.has(value))
    ) {
      if (!identities.has(value)) identities.set(value, ++nextIdentity);
      return ['identity', identities.get(value)];
    }
    if (value instanceof Date) return ['date', value.toISOString()];
    if (typeof value === 'bigint') return ['bigint', value.toString()];
    if (value === null || typeof value !== 'object') return value;
    const nested = new Set(ancestors).add(value);
    if (Array.isArray(value))
      return value.map((item) => serialize(item, nested));
    return Object.keys(value)
      .sort()
      .map((key) => [
        key,
        serialize((value as Record<string, unknown>)[key], nested),
      ]);
  };
  const metadata = (model: ModelStatic<Model>) =>
    JSON.stringify(serialize(modelBinding(sequelize, model)));
  const routing = () => {
    const { define, schema, quoteIdentifiers } = sequelizeOptions(sequelize);
    return JSON.stringify([
      schema,
      quoteIdentifiers,
      ...[
        'schema',
        'schemaDelimiter',
        'timestamps',
        'paranoid',
        'underscored',
        'freezeTableName',
        'createdAt',
        'updatedAt',
        'deletedAt',
      ].map((name) => define?.[name as keyof typeof define]),
    ]);
  };
  const initialRouting = routing();
  const bindings = models.map((model) => ({
    model,
    name: model.name,
    metadata: metadata(model),
  }));
  return () => {
    if (routing() !== initialRouting) {
      throw new Error(
        'Guard Sequelize schema defaults changed after initialization',
      );
    }
    for (const { model, name, metadata: original } of bindings) {
      if (
        model.sequelize !== sequelize ||
        sequelize.models[name] !== model ||
        metadata(model) !== original
      ) {
        throw new Error(
          `Guard model binding changed after initialization: ${name}`,
        );
      }
    }
  };
}

function modelBinding(
  sequelize: Sequelize,
  model: ModelStatic<Model>,
): unknown[] {
  const { timestamps, paranoid, createdAt, updatedAt, deletedAt } =
    model.options;
  return [
    storageTableKey(sequelize, model.getTableName()),
    model.primaryKeyAttributes,
    timestamps,
    paranoid,
    createdAt,
    updatedAt,
    deletedAt,
    model.options.indexes,
    Object.entries(model.getAttributes()).map(([name, attribute]) => [
      name,
      attribute.field,
      attribute.type.toString({}),
      attribute.primaryKey,
      attribute.allowNull,
      attribute.defaultValue,
      attribute.autoIncrement,
      attribute.unique,
      attribute.onDelete,
      attribute.onUpdate,
      referenceBinding(sequelize, attribute.references),
    ]),
  ];
}

function referenceBinding(
  sequelize: Sequelize,
  reference: ReturnType<
    ModelStatic<Model>['getAttributes']
  >[string]['references'],
): unknown {
  if (!reference || typeof reference === 'string') return reference;
  const target = reference.model;
  const table =
    typeof target === 'function'
      ? (target as ModelStatic<Model>).getTableName()
      : target;
  return [
    table && storageTableKey(sequelize, table),
    reference.key,
    reference.deferrable,
  ];
}
