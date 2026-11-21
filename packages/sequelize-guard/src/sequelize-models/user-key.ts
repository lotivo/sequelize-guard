import {
  DataTypes,
  type AbstractDataType,
  type Sequelize,
} from 'sequelize';
import type { GuardInternalOptions } from '../types';

export interface UserKey {
  attribute: string;
  column: string;
  type: AbstractDataType;
}

export function guardUserKey(
  sequelize: Sequelize,
  options: GuardInternalOptions,
  explicitUserPk?: string,
): UserKey {
  const { UserModel, userPk } = options;
  if (!UserModel) {
    if (explicitUserPk !== undefined && userPk !== 'id')
      throw new Error(
        'userPk must be id when using the built-in guard user model',
      );
    return { attribute: 'id', column: 'id', type: new DataTypes.INTEGER() };
  }
  const model = UserModel;
  if (model.sequelize !== sequelize || model.primaryKeyAttributes.length !== 1)
    throw new Error(
      'UserModel must belong to this Sequelize instance and have one primary key',
    );
  const attribute = model.primaryKeyAttribute;
  const key = model.getAttributes()[attribute];
  if (!key) throw new Error('UserModel primary key is not initialized');
  const column = key.field || attribute;
  if (explicitUserPk !== undefined && userPk !== attribute && userPk !== column)
    throw new Error(
      `userPk must identify the supplied UserModel primary key "${attribute}"`,
    );
  const { type } = key;
  if (
    !(
      type instanceof DataTypes.INTEGER ||
      type instanceof DataTypes.STRING ||
      type instanceof DataTypes.UUID
    )
  )
    throw new Error(
      'UserModel primary key must use INTEGER, STRING, CHAR, or UUID',
    );
  return { attribute, column, type };
}
