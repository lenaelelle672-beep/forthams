import { api, apiClient } from "../utils/api";

export interface AssetRecord {
  id: number;
  assetCode?: string;
  assetName?: string;
  categoryName?: string;
  locationName?: string;
  departmentName?: string;
  status?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  [key: string]: unknown;
}

export interface PagedResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

/**
 * 资产列表查询参数
 *
 * @description 资产列表查询和导出共享的参数结构
 */
export interface AssetListQueryParams {
  /** 搜索关键词 */
  keyword?: string;
  /** 资产状态过滤 */
  status?: string;
  /** 分类 ID 过滤 */
  categoryId?: string;
  /** 部门 ID 过滤 */
  departmentId?: string;
  /** 页码（从 1 开始） */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
}

/**
 * 资产导出参数
 *
 * @description 资产列表导出 API 的查询参数，携带所有过滤条件
 */
export interface AssetExportParams {
  /** 搜索关键词 */
  keyword?: string;
  /** 资产状态过滤 */
  status?: string;
  /** 分类过滤 */
  categoryId?: string;
  /** 部门过滤 */
  departmentId?: string;
  /** 当前页码 */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
  [key: string]: unknown;
}

export const assetService = {
  /**
   * 获取资产分页列表
   *
   * @param params - 查询参数（keyword, status, categoryId, departmentId, page, pageSize）
   * @returns 分页结果
   */
  list(params?: Record<string, unknown>) {
    return api.get<PagedResult<AssetRecord>>("/assets/list", { params });
  },

  /**
   * 根据 ID 获取资产详情（含扩展属性）
   *
   * @param id - 资产 ID
   * @returns 资产记录（含 metadata 等扩展字段）
   */
  getById(id: number | string) {
    return api.get<AssetRecord>(`/assets/${id}`);
  },

  /**
   * 根据 ID 获取资产详情（别名 → getById）
   *
   * @description 兼容 useAssetById hook 及退役模块中通过 getAssetById 方法的调用。
   * 返回包装后的 `{ data: AssetRecord }` 结构，与 useAssetById 消费端一致。
   *
   * @param id - 资产 ID
   * @returns 包含 data 字段的资产记录
   */
  async getAssetById(id: number | string): Promise<{ data: AssetRecord }> {
    const record = await api.get<AssetRecord>(`/assets/${id}`);
    return { data: record };
  },

  /**
   * 获取指定资产的折旧计划
   *
   * @param id - 资产 ID
   * @returns 折旧计划详情；若资产无折旧数据则可能返回空 details
   */
  getDepreciationSchedule(id: number | string) {
    return api.get<Record<string, unknown>>(`/assets/${id}/depreciation-schedule`);
  },

  /**
   * 获取指定资产的关联工单列表
   *
   * @param id - 资产 ID
   * @param params - 分页与筛选参数
   * @returns 分页工单结果
   */
  getWorkOrders(id: number | string, params?: Record<string, unknown>) {
    return api.get<PagedResult<Record<string, unknown>>>('/workorders', {
      params: { assetId: id, ...params },
    });
  },

  /**
   * 获取指定资产的处置历史
   *
   * @param id - 资产 ID
   * @param params - 分页参数
   * @returns 处置历史记录
   */
  getDisposalHistory(id: number | string, params?: Record<string, unknown>) {
    return api.get<{ records: Record<string, unknown>[]; total: number }>(
      `/assets/${id}/disposal-history`,
      { params },
    );
  },

  /**
   * 获取指定资产的维保记录
   *
   * @param id - 资产 ID
   * @param params - 查询参数
   * @returns 维保记录列表
   */
  getMaintenanceRecords(id: number | string, params?: Record<string, unknown>) {
    return api.get<PagedResult<Record<string, unknown>>>('/maintenance/list', {
      params: { assetId: id, ...params },
    });
  },

  /**
   * 创建资产
   *
   * @param payload - 资产创建数据
   * @returns 创建的资产记录
   */
  create(payload: Record<string, unknown>) {
    return api.post<AssetRecord>("/assets", payload);
  },

  /**
   * 更新资产
   *
   * @param id - 资产 ID
   * @param payload - 更新数据
   * @returns 更新后的资产记录
   */
  update(id: number | string, payload: Record<string, unknown>) {
    return api.put<AssetRecord>(`/assets/${id}`, payload);
  },

  /**
   * 删除资产
   *
   * @param id - 资产 ID
   */
  delete(id: number | string) {
    return api.delete<string>(`/assets/${id}`);
  },

  /**
   * 导出资产列表
   *
   * @description 携带当前过滤参数调用后端导出 API，由后端生成文件流。
   * 前端只负责触发浏览器下载，不允许前端本地生成文件。
   * 使用 apiClient 直接获取 Blob 响应，避免 api 层的 ApiResponse 解包。
   *
   * @param params - 导出过滤参数
   * @returns Axios 响应（Blob 数据在 response.data 中）
   */
  export(params?: AssetExportParams) {
    return apiClient.get('/assets/export', {
      params,
      responseType: 'blob',
    });
  },
};
