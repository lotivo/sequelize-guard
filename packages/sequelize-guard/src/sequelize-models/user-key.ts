import {
  DataTypes,
  type AbstractDataType,
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
  if (
    UserModel.sequelize !== sequelize ||
    UserModel.primaryKeyAttributes.length !== 1
  ) {
    throw new Error(
      'UserModel must belong to this Sequelize instance and have one primary key',
    );
  }
  const attribute = UserModel.primaryKeyAttribute;
  const { field, type } = UserModel.getAttributes()[attribute];
  const column = field || attribute;
  if (userPk !== undefined && userPk !== attribute && userPk !== column) {
    throw new Error(
      `userPk must identify the supplied UserModel primary key "${attribute}"`,
    );
  }
  if (
    !(
      type instanceof DataTypes.INTEGER ||
      type instanceof DataTypes.BIGINT ||
      type instanceof DataTypes.STRING ||
      type instanceof DataTypes.CHAR ||
      type instanceof DataTypes.UUID
    )
  ) {
    throw new Error(
      'UserModel primary key must use INTEGER, BIGINT, STRING, CHAR, or UUID',
    );
  }
  return { attribute, column, type, table: UserModel.getTableName() };
}
