/**
 * @file api/asset.ts
 * @description 资产管理 API — 全项目唯一资产接口定义
 *
 * 所有调用走 utils/http.ts 统一实例。
 * 对应后端：AssetController (/assets)、AssetCategoryController (/categories)
 */

import http from '@/utils/http';
import type {
  ApiResponse,
  PaginatedResponse,
} from '@/types/common';
import type {
  Asset,
  AssetListItem,
  AssetListQuery,
  AssetCategory,
  CreateAssetRequest,
  UpdateAssetRequest,
  DashboardStats,
  AssetValueTrend,
  DeptAssetDistribution,
  DepreciationScheduleItem,
} from '@/types/asset';

// ── 资产 CRUD ─────────────────────────────────────────────────────────────────

/** 获取资产列表（分页） */
export const getAssetList = (params?: AssetListQuery) =>
  http.get<PaginatedResponse<AssetListItem>>('/assets', { params });

/** 获取资产详情 */
export const getAssetById = (id: number) =>
  http.get<ApiResponse<Asset>>(`/assets/${id}`);

/** 新建资产 */
export const createAsset = (data: CreateAssetRequest) =>
  http.post<ApiResponse<Asset>>('/assets', data);

/** 更新资产 */
export const updateAsset = ({ id, ...data }: UpdateAssetRequest) =>
  http.put<ApiResponse<Asset>>(`/assets/${id}`, data);

/** 删除资产 */
export const deleteAsset = (id: number) =>
  http.delete<ApiResponse<void>>(`/assets/${id}`);

// ── 资产批量操作 ──────────────────────────────────────────────────────────────

/** 获取导入模板 */
export const getImportTemplate = () =>
  http.get('/assets/import/template', { responseType: 'blob' });

/** 解析导入文件（第一步：预览） */
export const parseImportFile = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return http.post<ApiResponse<{ parseId: string; rows: unknown[] }>>(
    '/assets/import/parse',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
};

/** 确认提交导入（第二步：写入） */
export const commitImport = (parseId: string, rows: unknown[]) =>
  http.post<ApiResponse<{ importedCount: number; failedCount: number }>>(
    '/assets/import/commit',
    { parseId, rows },
  );

/** 导出资产列表 */
export const exportAssets = (
  filters: Pick<AssetListQuery, 'categoryId' | 'status' | 'deptId' | 'keyword'>,
) =>
  http.post('/assets/export', filters, { responseType: 'blob' });

// ── 资产分类 ──────────────────────────────────────────────────────────────────

/** 获取分类树 */
export const getCategoryTree = () =>
  http.get<ApiResponse<AssetCategory[]>>('/categories/tree');

/** 新建分类 */
export const createCategory = (data: { categoryName: string; parentId?: number | null }) =>
  http.post<ApiResponse<AssetCategory>>('/categories', data);

/** 更新分类 */
export const updateCategory = (id: number, data: Partial<AssetCategory>) =>
  http.put<ApiResponse<AssetCategory>>(`/categories/${id}`, data);

/** 删除分类 */
export const deleteCategory = (id: number) =>
  http.delete<ApiResponse<void>>(`/categories/${id}`);

// ── 折旧排期 ──────────────────────────────────────────────────────────────────

/** 获取资产折旧排期 */
export const getDepreciationSchedule = (assetId: number) =>
  http.get<ApiResponse<DepreciationScheduleItem[]>>(
    `/assets/${assetId}/depreciation-schedule`,
  );

// ── 仪表板统计 ────────────────────────────────────────────────────────────────

/** 获取仪表板核心统计 */
export const getDashboardStats = () =>
  http.get<ApiResponse<DashboardStats>>('/dashboard/stats');

/** 获取资产价值趋势（days: 最近多少天，默认 30） */
export const getAssetValueTrends = (days = 30) =>
  http.get<ApiResponse<AssetValueTrend[]>>('/dashboard/trends', {
    params: { days },
  });

/** 获取部门资产分布 */
export const getDeptDistribution = () =>
  http.get<ApiResponse<DeptAssetDistribution[]>>('/dashboard/dept-distribution');

/** 获取维保统计 */
export const getMaintenanceStats = () =>
  http.get<ApiResponse<Record<string, unknown>>>('/dashboard/maintenance-stats');

/** 获取待审批数量 */
export const getPendingApprovalsCount = () =>
  http.get<ApiResponse<number>>('/dashboard/pending-approvals');
