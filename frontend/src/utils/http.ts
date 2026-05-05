import axios, {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';

/**
 * 基础数据模型 - TypeScript Interfaces
 * 根据 SPEC Phase 3 第1阶段要求定义，支撑盘点任务列表、执行详情、差异汇总的数据流转。
 */

/** 盘点任务 — 对应 ATB-01 表格列：任务名称 / 盘点范围 / 状态 / 创建时间 / 完成进度 */
export interface ITask {
  id: string;
  name: string;
  scope: string;
  status: 'draft' | 'in_progress' | 'completed' | 'approved';
  progress: number; // 0-100 完成进度百分比
  createdAt: string; // 创建时间（ISO 格式）
  creatorId: string;
  locationIds: string[];
  categoryIds?: string[];
  startTime?: string;
  endTime?: string;
}

/**
 * 盘点资产明细行 — 对应 ATB-04 表格可编辑行
 * inventoryStatus 为实盘状态，由前端 StatusDropdown 组件控制变更
 */
export interface IAssetItem {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  currentLocation: string;
  bookStatus: 'in_stock' | 'damaged' | 'lost'; // 账面状态
  inventoryStatus: 'pending' | 'scanned' | 'surplus' | 'shortage'; // 实盘状态
  remark?: string; // 备注列
}

/**
 * 盘点汇总统计 — 对应 ATB-03 顶部看板五个统计卡片
 * progressPercentage 可由前端根据 scannedCount / totalAssets 聚合计算
 */
export interface IInventorySummary {
  totalAssets: number; // 总资产数
  scannedCount: number; // 已盘
  unscannedCount: number; // 未盘
  surplusCount: number; // 盘盈
  shortageCount: number; // 盘亏
  progressPercentage: number; // 进度百分比
}

/** 通用分页响应结构 */
export interface IPaginatedResponse<T> {
  data: T[];
  total: number;
}

/** 批量状态更新请求体 — 对应 ATB-04 批量确认交互 */
export interface IBatchStatusUpdate {
  assetIds: string[];
  inventoryStatus: IAssetItem['inventoryStatus'];
  remark?: string;
}

/** 提交核准请求体 — 对应 ATB-05 一键提交核准 */
export interface IApproveRequest {
  taskId: string;
  summary: IInventorySummary;
}

/**
 * Axios 实例配置与拦截器封装
 * - baseURL 读取环境变量，默认 /api 前缀
 * - 请求拦截器注入 Bearer Token
 * - 响应拦截器统一解包 data 并处理 401/5xx 错误
 */
const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
});

// 请求拦截器：注入认证 Token（符合 SPEC 权限控制规范）
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：统一错误处理与数据解包，简化业务代码调用逻辑
http.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  (error) => {
    const status = error.response?.status;
    console.error(`[HTTP Error] ${status}:`, error.response?.data || error.message);

    if (status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    } else if (status && status >= 500) {
      console.error('Server error, please try again later.');
    }

    return Promise.reject(error);
  }
);

/**
 * API 请求函数封装 — SPEC 第1阶段「基础数据模型与 API 对接层」
 *
 * 覆盖：任务列表拉取、任务创建、资产明细获取（分页）、批量状态变更、盘点结果提交、核准提交
 */
export const inventoryApi = {
  /** 获取盘点任务列表（支持分页、状态筛选） */
  getTasks: (params?: Record<string, unknown>) =>
    http.get<IPaginatedResponse<ITask>>('/inventory/tasks', { params }),

  /** 创建新盘点任务（前端不持久化主数据，必须走后端） */
  createTask: (data: Partial<ITask>) =>
    http.post<ITask>('/inventory/tasks', data),

  /** 获取特定任务详情及汇总统计 */
  getTaskDetails: (taskId: string) =>
    http.get<{ task: ITask; summary: IInventorySummary }>(`/inventory/tasks/${taskId}`),

  /**
   * 获取盘点资产明细列表（支持分页参数，满足 SPEC 对虚拟滚动 / 分页加载的性能要求）
   * 单次超过 200 条时前端应启用虚拟滚动
   */
  getAssetItems: (taskId: string, params?: Record<string, unknown>) =>
    http.get<IPaginatedResponse<IAssetItem>>(`/inventory/tasks/${taskId}/assets`, { params }),

  /** 批量更新资产实盘状态 — 对应 ATB-04 批量确认 */
  batchUpdateStatus: (taskId: string, payload: IBatchStatusUpdate) =>
    http.put<{ updated: number }>(`/inventory/tasks/${taskId}/assets/status`, payload),

  /** 提交盘点结果（单条或多条资产确认） */
  submitInventoryResult: (taskId: string, items: Partial<IAssetItem>[]) =>
    http.post<ITask>(`/inventory/tasks/${taskId}/submit`, { items }),

  /** 提交核准 — 对应 ATB-05 一键提交核准，触发 POST /api/inventory/approve */
  submitApproval: (payload: IApproveRequest) =>
    http.post<{ approved: boolean }>('/inventory/approve', payload),
};

export default http;