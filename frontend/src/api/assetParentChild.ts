/**
 * @file api/assetParentChild.ts
 * @description 资产父子关系独立 API 模块
 *
 * 提供父子关系的 CRUD、树形查询、循环引用校验等接口调用方法。
 * 对应后端：AssetParentChildController (/assets/{assetId}/relations)
 */

import http from '@/utils/http';
import type { ApiResponse } from '@/types/common';
import type {
  AssetParentChild,
  AddRelationRequest,
  RelationVO,
  RelationTreeNode,
} from '@/types/asset';

/**
 * 获取子资产关联列表（带资产名称等补充信息）。
 */
export const getRelations = (assetId: number) =>
  http.get<ApiResponse<RelationVO[]>>(`/assets/${assetId}/relations`);

/**
 * 添加父子关系（自动进行循环引用校验和租户隔离校验）。
 */
export const createRelation = (assetId: number, data: AddRelationRequest) =>
  http.post<ApiResponse<AssetParentChild>>(`/assets/${assetId}/relations`, data);

/**
 * 删除父子关系。
 */
export const deleteRelation = (assetId: number, relationId: number) =>
  http.delete<ApiResponse<void>>(`/assets/${assetId}/relations/${relationId}`);

/**
 * 获取父子关系树结构（以指定资产为根）。
 */
export const getAssetTree = (assetId: number) =>
  http.get<ApiResponse<RelationTreeNode[]>>(`/assets/${assetId}/relations/tree`);

/**
 * 更新父子关系（扩展功能，当前后端未实现，为兼容性预留）。
 */
export const updateRelation = (assetId: number, relationId: number, data: Partial<AddRelationRequest>) =>
  http.put<ApiResponse<AssetParentChild>>(`/assets/${assetId}/relations/${relationId}`, data);