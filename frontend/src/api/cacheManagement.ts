import { api } from '../app/utils/api';

export interface CacheNamespaceStatus {
  namespace: string;
  displayName: string;
  observable: boolean;
  reason: string;
  entryCount: number;
  empty: boolean;
  lastRefreshTime?: string | null;
}

export interface CacheRefreshResult {
  namespace: string;
  status: 'CLEARED' | 'CLEARED_EMPTY' | 'NOT_FOUND' | 'UNSUPPORTED' | 'FAILED' | string;
  success: boolean;
  message: string;
  clearedEntries: number;
  refreshedAt?: string | null;
}

const SYSTEM_CACHE_NAMESPACES_BASE = '/system/cache/namespaces';
const SYSTEM_CACHE_REFRESH_ALL = '/system/cache/refresh';

export function listCacheNamespaces() {
  return api.get<CacheNamespaceStatus[]>(SYSTEM_CACHE_NAMESPACES_BASE);
}

export function refreshCacheNamespace(namespace: string) {
  return api.post<CacheRefreshResult>(`${SYSTEM_CACHE_NAMESPACES_BASE}/${encodeURIComponent(namespace)}/refresh`);
}

export function refreshAllCacheNamespaces() {
  return api.post<CacheRefreshResult[]>(SYSTEM_CACHE_REFRESH_ALL);
}
