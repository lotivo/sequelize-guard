import {
  DataTypes,
  type AbstractDataType,
  type Model,
  type ModelStatic,
  type Sequelize,
  type TableName,
} from 'sequelize';
import type { GuardInternalOptions } from '../types';
import { guardTable } from './guard-tables';
import { BaseModelType } from './types/ModelType';

export interface UserKey {
  attribute: string;
  column: string;
  type: AbstractDataType;
  table: TableName;
}

export function guardUserKey(
  sequelize: Sequelize,
  { UserModel, userPk, ...options }: GuardInternalOptions,
): UserKey {
  if (!UserModel) {
    if (userPk !== undefined && userPk !== 'id') {
      throw new Error(
        'userPk must be id when using the built-in guard user model',
      );
    }
    return {
      attribute: 'id',
      column: 'id',
      type: new DataTypes.INTEGER(),
      table: guardTable(
        sequelize,
        { UserModel, userPk, ...options },
        BaseModelType.Users,
      ),
    };
  }
  const key = modelKey(sequelize, UserModel, 'UserModel');
  const { attribute, column } = key;
  if (userPk !== undefined && userPk !== attribute && userPk !== column) {
    throw new Error(
      `userPk must identify the supplied UserModel primary key "${attribute}"`,
    );
  }
  return key;
}

export function modelKey(
  sequelize: Sequelize,
  model: ModelStatic<Model>,
  name: string,
): UserKey {
  if (
    model?.sequelize !== sequelize ||
    model.primaryKeyAttributes.length !== 1
  ) {
    throw new Error(
      `${name} must belong to this Sequelize instance and have one primary key`,
    );
  }
  const attribute = model.primaryKeyAttribute;
  const { field, type } = model.getAttributes()[attribute];
  if (sequelize.getDialect() === 'sqlite' && type instanceof DataTypes.BIGINT) {
    throw new Error(
      `SQLite ${name} primary keys must fit JavaScript safe integers; use INTEGER, STRING, or UUID`,
    );
  }
  if (
    !(
      type instanceof DataTypes.INTEGER ||
      type instanceof DataTypes.STRING ||
      type instanceof DataTypes.UUID
    )
  ) {
    throw new Error(
      `${name} primary key must use INTEGER, BIGINT, STRING, CHAR, or UUID`,
    );
  }
  return {
    attribute,
    column: field || attribute,
    type,
    table: model.getTableName(),
  };
}
