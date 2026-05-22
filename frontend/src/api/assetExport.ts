/**
 * @module assetExport
 * @description 资产导出 API 层封装
 * 对标 SPEC: SWARM-P2-006-FE — 资产批量导入导出前端（导出部分）
 *
 * 提供资产条件导出、分类树获取、位置级联数据获取等 API 调用，
 * 以及 Blob 下载工具函数与导出文件名生成。
 */

import http from '@/utils/http';

// ===================== 类型定义 =====================

/**
 * 导出筛选条件
 * 对应 POST /api/assets/export 请求体
 */
export interface ExportFilters {
  /** 资产分类编码列表 */
  categoryCodes: string[];
  /** 资产状态编码列表 */
  statusCodes: string[];
  /** 存放位置编码列表 */
  locationCodes: string[];
}

/**
 * 分类树节点
 * 对应 GET /api/categories/tree 返回结构
 */
export interface CategoryTreeNode {
  /** 分类编码 */
  code: string;
  /** 分类名称 */
  name: string;
  /** 子分类 */
  children?: CategoryTreeNode[];
}

/**
 * 位置级联选项
 * 对应 GET /api/locations/cascade 返回结构
 */
export interface LocationCascadeOption {
  /** 位置编码 */
  code: string;
  /** 位置名称 */
  name: string;
  /** 子级位置 */
  children?: LocationCascadeOption[];
}

// ===================== API 调用函数 =====================

/**
 * 按条件导出资产台账为 Excel 文件
 *
 * 调用 POST /api/assets/export，以 Blob 方式接收文件流。
 * 响应 Content-Type 为 application/octet-stream。
 *
 * @param filters - 导出筛选条件（分类、状态、位置）
 * @returns Promise<Blob> Excel 文件的 Blob 对象
 */
export const exportAssets = async (filters: ExportFilters): Promise<Blob> => {
  const response = await http.post<Blob>('/assets/export', filters, {
    responseType: 'blob',
  });
  return response as any;
};

/**
 * 获取资产分类树形数据
 *
 * 调用 GET /api/categories/tree，
 * 用于导出筛选面板的 TreeSelect 组件数据源。
 *
 * @returns Promise<CategoryTreeNode[]> 分类树节点数组
 */
export const getCategoryTree = async (): Promise<CategoryTreeNode[]> => {
  const response = await http.get<CategoryTreeNode[]>(
    '/categories/tree',
  );
  return response as any;
};

/**
 * 获取存放位置级联数据
 *
 * 调用 GET /api/locations/cascade，
 * 用于导出筛选面板的 Cascader 组件数据源（省/市/区级联）。
 *
 * @returns Promise<LocationCascadeOption[]> 位置级联选项数组
 */
export const getLocationCascade = async (): Promise<LocationCascadeOption[]> => {
  const response = await http.get<LocationCascadeOption[]>(
    '/locations/cascade',
  );
  return response as any;
};

// ===================== 工具函数 =====================

/**
 * 生成导出文件名
 *
 * 格式：资产台账_YYYYMMDD_HHmmss.xlsx
 * 时间戳取前端当前时间。
 *
 * @returns 符合规格的导出文件名字符串
 */
export const generateExportFilename = (): string => {
  const now = new Date();
  const pad = (n: number): string => n.toString().padStart(2, '0');
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `资产台账_${datePart}_${timePart}.xlsx`;
};

// NOTE: downloadBlob → @/utils/fileDownloader (canonical)

// ===================== 导出筛选相关常量 =====================

/**
 * 资产状态选项（硬编码，对应 ATB-014 中的多选 Select 选项）
 * 选项：在用、闲置、维修中、报废
 */
export const ASSET_STATUS_OPTIONS = [
  { label: '在用', value: 'in_use' },
  { label: '闲置', value: 'idle' },
  { label: '维修中', value: 'maintenance' },
  { label: '报废', value: 'retired' },
] as const;