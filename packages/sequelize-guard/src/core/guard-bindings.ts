import type { Model, ModelStatic, Options, Sequelize } from 'sequelize';

/** Capture the schema routing and model metadata used when the guard was created. */
export function captureGuardBindings(
  sequelize: Sequelize,
  models: ModelStatic<Model>[],
): () => void {
  const routing = () => {
    const options = (sequelize as Sequelize & { readonly options: Options })
      .options;
    const define = options.define as Record<string, unknown> | undefined;
    return JSON.stringify([
      options.schema,
      options.quoteIdentifiers,
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
        attribute.field,
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
  }));
  return () => {
    if (routing() !== originalRouting)
      throw new Error(
        'Guard Sequelize schema defaults changed after initialization',
      );
    for (const { model, name, binding: original } of bound) {
      if (
        model.sequelize !== sequelize ||
        sequelize.models[name] !== model ||
        binding(model) !== original
      )
        throw new Error(
          `Guard model binding changed after initialization: ${name}`,
        );
    }
  };
}
