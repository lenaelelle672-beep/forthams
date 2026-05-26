/**
 * @file api/auth.ts
 * @description 认证 API — 登录、登出、用户信息
 *
 * 对应后端：AuthController (/auth)
 */

import http from '@/utils/http';
import type { LoginRequest, LoginResponse, CurrentUser } from '@/types/common';

/** 登录 */
export const login = (data: LoginRequest) =>
  http.post<LoginResponse>('/auth/login', data);

/** 登出 */
export const logout = () =>
  http.post<void>('/auth/logout');

/** 获取当前用户信息 */
export const getCurrentUser = () =>
  http.get<CurrentUser>('/auth/me');

/** 刷新 Token */
export const refreshToken = (token: string) =>
  http.post<{ token: string }>('/auth/refresh', { token });
