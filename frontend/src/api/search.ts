/**
 * @file api/search.ts
 * @description 全局搜索 API — 对接后端 SearchController
 *
 * @see backend/src/main/java/com/ams/controller/SearchController.java
 */

import http from '@/utils/http';
import type { ApiResponse } from '@/types/common';

// ── 响应类型定义 ──────────────────────────────────────────────────────────────

/** 搜索结果项（对应后端 SearchResultDTO） */
export interface SearchResult {
  id: number;
  type: 'asset' | 'workorder' | 'vendor';
  title: string;
  subtitle: string;
  path: string;
}

// ── API ───────────────────────────────────────────────────────────────────────

/** 全局搜索 */
export const globalSearch = (
  keyword: string,
  type: 'all' | 'asset' | 'workorder' | 'vendor' = 'all',
  limit = 10,
) =>
  http.get<ApiResponse<SearchResult[]>>('/search', {
    params: { keyword, type, limit },
  });
