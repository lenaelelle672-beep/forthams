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

/* ------------------------------------------------------------------ */
/*  批量导入相关类型                                                     */
/* ------------------------------------------------------------------ */

/**
 * 导入解析行数据
 *
 * @description POST /api/assets/import/parse 返回的单行解析结果
 */
export interface ImportParsedRow {
  /** 行号 */
  rowNumber: number;
  /** 资产名称 */
  name: string;
  /** 分类编码 */
  categoryCode: string;
  /** 状态编码 */
  statusCode: string;
  /** 位置编码 */
  locationCode: string;
  /** 购置日期 */
  purchaseDate: string;
  /** 原值 */
  originalValue: number;
  /** 分类名称（可选） */
  categoryName?: string;
  /** 状态名称（可选） */
  statusName?: string;
  /** 位置名称（可选） */
  locationName?: string;
}

/**
 * 导入解析错误
 *
 * @description 行级校验错误信息
 */
export interface ImportParseError {
  /** 行号 */
  rowNumber: number;
  /** 出错字段 */
  field: string;
  /** 错误信息 */
  message: string;
}

/**
 * 导入解析响应
 *
 * @description POST /api/assets/import/parse 返回的整体结构
 */
export interface ImportParseResponse {
  /** 解析会话 ID（用于 commit 阶段） */
  parseId: string;
  /** 解析后的行数据 */
  rows: ImportParsedRow[];
  /** 行级错误列表 */
  errors: ImportParseError[];
}

/**
 * 导入提交响应
 *
 * @description POST /api/assets/import/commit 返回的结果
 */
export interface ImportCommitResponse {
  /** 是否成功 */
  success: boolean;
  /** 成功导入条数 */
  importedCount: number;
  /** 失败条数 */
  failedCount: number;
}

/**
 * 分类树节点
 *
 * @description GET /api/asset-categories/tree 返回的树形结构
 */
export interface CategoryTreeNode {
  /** 节点键 */
  key: string;
  /** 节点标题 */
  title: string;
  /** 节点值 */
  value: string;
  /** 子节点 */
  children?: CategoryTreeNode[];
}

/**
 * 位置级联节点
 *
 * @description GET /api/asset-locations/cascade 返回的级联结构
 */
export interface LocationCascadeNode {
  /** 节点值 */
  value: string;
  /** 节点标签 */
  label: string;
  /** 子节点 */
  children?: LocationCascadeNode[];
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
   * 类型化分页查询 — 供 AssetDisposalPicker 及处置表单使用。
   * 调用 GET /assets/list，参数至少包含 keyword / page / pageSize。
   *
   * @param keyword  - 搜索关键词（可选）
   * @param page     - 页码（从 1 开始）
   * @param pageSize - 每页条数（建议 10-20）
   * @param extra   - 额外过滤参数（status, categoryId 等）
   * @returns 分页结果
   */
  searchPaged(keyword: string | undefined, page: number, pageSize: number, extra?: Record<string, unknown>) {
    return api.get<PagedResult<AssetRecord>>("/assets/list", {
      params: {
        keyword: keyword || undefined,
        page,
        pageSize,
        ...extra,
      },
    });
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

  /**
   * 上传并解析导入文件
   *
   * @description 上传 .xlsx 文件至后端解析接口，返回行级数据与错误。
   * 使用 apiClient 直接获取响应，绕过 api 层的 ApiResponse 解包。
   *
   * @param formData - 包含 file 字段的 FormData
   * @returns 解析结果（行数据 + 错误列表 + parseId）
   */
  importParse(formData: FormData): Promise<ImportParseResponse> {
    return apiClient
      .post<ImportParseResponse>('/assets/import/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data);
  },

  /**
   * 确认提交导入
   *
   * @description 携带 parseId 提交确认导入，后端执行实际写入。
   *
   * @param parseId - 解析阶段返回的会话 ID
   * @param correctedRows - 用户修正后的行数据（可选）
   * @returns 提交结果（成功/失败条数）
   */
  importCommit(
    parseId: string,
    correctedRows?: ImportParsedRow[],
  ): Promise<ImportCommitResponse> {
    return apiClient
      .post<ImportCommitResponse>('/assets/import/commit', {
        parseId,
        correctedRows,
      })
      .then((res) => res.data);
  },

  /**
   * 下载导入模板
   *
   * @description 调用后端模板下载接口，返回 Blob 文件流。
   *
   * @param format - 文件格式，默认 xlsx
   * @returns Axios 响应（Blob 数据在 response.data 中）
   */
  importTemplate(format: string = 'xlsx') {
    return apiClient.get('/assets/import/template', {
      params: { format },
      responseType: 'blob',
    });
  },

  /**
   * 获取资产分类树
   *
   * @description 返回树形分类结构，用于导入/导出页面的分类选择器。
   *
   * @returns 分类树节点列表
   */
  getCategoryTree(): Promise<CategoryTreeNode[]> {
    return api.get<CategoryTreeNode[]>('/asset-categories/tree');
  },

  /**
   * 获取位置级联数据
   *
   * @description 返回级联位置结构，用于导入/导出页面的位置选择器。
   *
   * @returns 位置级联节点列表
   */
  getLocationCascade(): Promise<LocationCascadeNode[]> {
    return api.get<LocationCascadeNode[]>('/asset-locations/cascade');
  },
};
