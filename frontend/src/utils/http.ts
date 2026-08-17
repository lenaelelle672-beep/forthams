import axios, {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { clearAuthStorage, getToken } from '@/utils/auth';

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
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

let sessionRevokeInFlight: Promise<void> | null = null;

function revokeCurrentSession(): Promise<void> {
  const token = getToken();
  if (!token) {
    return Promise.resolve();
  }
  if (sessionRevokeInFlight) {
    return sessionRevokeInFlight;
  }
  sessionRevokeInFlight = fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .catch(() => undefined)
    .then(() => undefined)
    .finally(() => {
      sessionRevokeInFlight = null;
    });
  return sessionRevokeInFlight;
}

type ResultEnvelope<T = unknown> = {
  code: number;
  message?: string;
  data: T;
};

function isResultEnvelope(value: unknown): value is ResultEnvelope {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'code' in value &&
    'data' in value,
  );
}

// Axios executes request interceptors in reverse registration order. Register
// this first so it runs after the credential injector and keeps public login
// and registration requests free of stale Authorization headers.
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const requestUrl = config.url ?? '';
    const isPublicAuthRequest =
      requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');
    if (isPublicAuthRequest && config.headers) {
      config.headers.delete('Authorization');
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 请求拦截器：注入认证 Token（符合 SPEC 权限控制规范）
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：统一错误处理与数据解包，简化业务代码调用逻辑
http.interceptors.response.use(
  (response: AxiosResponse) => {
    const payload = response.data;

    if (isResultEnvelope(payload)) {
      if (payload.code !== 200) {
        throw new Error(payload.message || '请求失败');
      }

      return payload.data;
    }

    return payload;
  },
  (error) => {
    const status = error.response?.status;
    if (status === 403) {
      console.warn(`[HTTP Warning] ${status}:`, error.response?.data || error.message);
    } else {
      console.error(`[HTTP Error] ${status}:`, error.response?.data || error.message);
    }

    if (status === 401) {
      const requestUrl = error.config?.url ?? '';
      const isLoginRequest = requestUrl.includes('/auth/login');
      const isLogoutRequest = requestUrl.includes('/auth/logout');
      const isOnLoginPage =
        typeof window !== 'undefined' && window.location.pathname === '/login';

      const finishUnauthorized = () => {
        clearAuthStorage();
        localStorage.removeItem('ams_auth_token');
        localStorage.removeItem('ams_auth_user');
        if (!isLoginRequest && !isOnLoginPage) {
          window.location.href = '/login?expired=1';
        }
      };

      if (!isLoginRequest && !isLogoutRequest) {
        return revokeCurrentSession().finally(finishUnauthorized).then(() => Promise.reject(error));
      }
      finishUnauthorized();
    } else if (status && status >= 500) {
      console.error('Server error, please try again later.');
    }

    // 403 has no backend message → give callers a clear, displayable reason so
    // UI can catch and surface it (we intentionally avoid a global Toaster
    // here; callers decide how to present permission errors).
    const message =
      status === 403
        ? error.response?.data?.message || '没有权限执行此操作'
        : error.response?.data?.message || error.message || '请求失败';
    const nextError = new Error(message) as Error & {
      status?: number;
      response?: typeof error.response;
    };
    nextError.status = status;
    nextError.response = error.response;
    return Promise.reject(nextError);
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
