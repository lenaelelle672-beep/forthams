/**
 * @file utils/http.ts
 * @description 统一 HTTP 客户端 — 全项目唯一 Axios 实例
 *
 * 规则：
 * - 所有 API 调用必须使用此实例，禁止在其他文件中 axios.create()
 * - 禁止在此文件中定义业务类型（业务类型在 types/ 目录）
 * - Token 从 localStorage 读取，key: 'auth_token'
 * - 401 → 清除 token，跳转 /login
 * - 响应拦截器直接返回 response.data（解包一层）
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from 'axios';

type UnwrappedHttpClient = Omit<AxiosInstance, 'request' | 'get' | 'delete' | 'head' | 'options' | 'post' | 'put' | 'patch'> & {
  request<T = unknown, R = T, D = unknown>(config: AxiosRequestConfig<D>): Promise<R>;
  get<T = unknown, R = T, D = unknown>(url: string, config?: AxiosRequestConfig<D>): Promise<R>;
  delete<T = unknown, R = T, D = unknown>(url: string, config?: AxiosRequestConfig<D>): Promise<R>;
  head<T = unknown, R = T, D = unknown>(url: string, config?: AxiosRequestConfig<D>): Promise<R>;
  options<T = unknown, R = T, D = unknown>(url: string, config?: AxiosRequestConfig<D>): Promise<R>;
  post<T = unknown, R = T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R>;
  put<T = unknown, R = T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R>;
  patch<T = unknown, R = T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R>;
};

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
}) as UnwrappedHttpClient;

// ── 请求拦截器：注入 Bearer Token ────────────────────────────────────────────
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── 响应拦截器：解包 data，统一错误处理 ─────────────────────────────────────
http.interceptors.response.use(
  // 成功响应：直接返回 response.data（即 ApiResponse<T>）
  (response: AxiosResponse) => response.data,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;

    if (status === 401) {
      // Token 失效或未登录 → 清除本地状态，跳转登录页
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('user_info');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_info');
      window.location.href = '/login';
    } else if (status === 403) {
      console.warn('[HTTP 403] 无权限访问:', error.config?.url);
    } else if (status >= 500) {
      console.error('[HTTP 5xx] 服务端错误:', status, message);
    }

    return Promise.reject(error);
  },
);

export default http;
