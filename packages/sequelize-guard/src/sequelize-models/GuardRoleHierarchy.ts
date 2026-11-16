import { DataTypes } from 'sequelize';
import type { Model, ModelAttributes } from 'sequelize';
import {
  BaseModelType,
  getTableName,
  ModelClassNameMap,
} from './types/ModelType';
import type { GuardModelInitParams } from './types/types';

type RoleHierarchy = Model<{ id: number; revision: number; ownership: string }>;

export function initRoleHierarchy({
  sequelize,
  options,
}: GuardModelInitParams) {
  const type = BaseModelType.RoleHierarchy;
  return sequelize.define<RoleHierarchy>(
    ModelClassNameMap[type],
    getRoleHierarchySchema(),
    {
      tableName: getTableName(type, options),
      timestamps: false,
      paranoid: false,
      version: false,
    },
  );
}

export function getRoleHierarchySchema(): ModelAttributes<RoleHierarchy> {
  return {
    id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
    revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ownership: { type: DataTypes.TEXT, allowNull: false },
  };
}
