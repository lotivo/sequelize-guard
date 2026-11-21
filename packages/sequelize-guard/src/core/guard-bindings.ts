import type { Model, ModelStatic, Options, Sequelize } from 'sequelize';

export const legacyTimestampFields = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
} as const;

export type LegacyTimestampAttribute = keyof typeof legacyTimestampFields;

export interface LegacyTimestampMapping {
  model: ModelStatic<Model>;
  attribute: LegacyTimestampAttribute;
}

/** Capture the schema routing and model metadata used when the guard was created. */
export function captureGuardBindings(
  sequelize: Sequelize,
  models: ModelStatic<Model>[],
) {
  const routing = () => {
    const options = (
      sequelize as Sequelize & {
        readonly options: Options & {
          searchPath?: string;
          dialectOptions?: { prependSearchPath?: boolean };
        };
      }
    ).options;
    const define = options.define as Record<string, unknown> | undefined;
    return JSON.stringify([
      options.schema,
      options.quoteIdentifiers,
      options.searchPath,
      options.dialectOptions?.prependSearchPath,
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
      ].map((name) => define?.[name]),
    ]);
  };
  const binding = (model: ModelStatic<Model>) =>
    JSON.stringify([
      model.getTableName(),
      model.options.tableName,
      model.options.schema,
      model.primaryKeyAttributes,
      model.options.timestamps,
      model.options.paranoid,
      model.options.indexes,
      Object.entries(model.getAttributes()).map(([name, attribute]) => [
        name,
        attribute.type.toString({}),
        attribute.primaryKey,
        attribute.allowNull,
        attribute.autoIncrement,
        attribute.unique,
      ]),
    ]);
  const originalRouting = routing();
  const bound = models.map((model) => ({
    model,
    name: model.name,
    binding: binding(model),
    fields: new Map(
      Object.entries(model.getAttributes()).map(([attribute, data]) => [
        attribute,
        data.field,
      ]),
    ),
  }));
  const assert = () => {
    if (routing() !== originalRouting)
      throw new Error(
        'Guard Sequelize schema defaults changed after initialization',
      );
    for (const { model, name, binding: original, fields } of bound) {
      if (
        model.sequelize !== sequelize ||
        sequelize.models[name] !== model ||
        binding(model) !== original ||
        Object.entries(model.getAttributes()).some(
          ([attribute, data]) => fields.get(attribute) !== data.field,
        )
      )
        throw new Error(
          `Guard model binding changed after initialization: ${name}`,
        );
    }
  };

  const acceptLegacyTimestamps = (mappings: LegacyTimestampMapping[]) => {
    assert();
    const updates = mappings.map(({ model, attribute }) => {
      const fields = bound.find((entry) => entry.model === model)?.fields;
      const data = model.rawAttributes[attribute];
      if (
        !fields ||
        !data ||
        fields.get(attribute) !== attribute ||
        data.field !== attribute
      ) {
        throw new Error(
          `Unexpected legacy timestamp binding for ${model.name}.${attribute}`,
        );
      }
      return { model, attribute, fields, data };
    });
    const changedModels = new Set(updates.map(({ model }) => model));
    const refresh = () => {
      for (const model of changedModels) {
        (
          model as ModelStatic<Model> & { refreshAttributes(): void }
        ).refreshAttributes();
      }
    };

    for (const { attribute, fields, data } of updates) {
      data.field = legacyTimestampFields[attribute];
      fields.set(attribute, data.field);
    }
    try {
      refresh();
      assert();
    } catch (error) {
      for (const { attribute, fields, data } of updates) {
        data.field = attribute;
        fields.set(attribute, attribute);
      }
      refresh();
      throw error;
    }
  };

  return { assert, acceptLegacyTimestamps };
}
