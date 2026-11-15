import { createHash } from 'node:crypto';
import type { ModelIndexesOptions } from 'sequelize';
import {
  AssociationModelType,
  BaseModelType,
  type ModelType,
} from './types/ModelType';

type GuardIndex = ModelIndexesOptions & { fields: string[] };

export function guardIndexes(type: ModelType, tableName: string): GuardIndex[] {
  const index = (fields: string[], unique = false): GuardIndex => {
    const name = [tableName, ...fields].join('_');
    return {
      name:
        Buffer.byteLength(name) <= 63
          ? name
          : `guard_idx_${createHash('sha256').update(name).digest('hex').slice(0, 32)}`,
      fields,
      unique,
    };
  };
  switch (type) {
    case BaseModelType.Roles:
      return [index(['parent_id'])];
    case AssociationModelType.RolePermission:
      return [
        index(['role_id', 'permission_id'], true),
        index(['permission_id']),
      ];
    case AssociationModelType.RoleUser:
      return [index(['role_id', 'user_id'], true), index(['user_id'])];
    default:
      return [];
  }
}
