import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

interface AuditLogEntry {
  id: string;
  operationType?: string;
  operation?: string;
  operator?: string;
  timestamp: string;
  changes?: Record<string, unknown>;
  description?: string;
  [key: string]: unknown;
}

interface UseAuditLogsOptions {
  assetId: string;
  timeRange?: { startTime?: string; endTime?: string };
  operationType?: string;
  page?: number;
  pageSize?: number;
}

interface UseAuditLogsReturn {
  logs: AuditLogEntry[];
  isLoading: boolean;
  loading: boolean;
  error: string | null;
  pagination: PaginationState;
  hasMore: boolean;
  isFetching: boolean;
  refetch: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  data: {
    data: AuditLogEntry[];
    pagination: PaginationState;
  } | null;
}

export function useAuditLogs(
  arg: string | UseAuditLogsOptions
): UseAuditLogsReturn {
  const assetId = typeof arg === 'string' ? arg : arg?.assetId || '';
  const timeRange = typeof arg === 'object' ? arg.timeRange : undefined;
  const operationType = typeof arg === 'object' ? arg.operationType : undefined;
  const initialPage = typeof arg === 'object' ? arg.page || 1 : 1;
  const initialPageSize = typeof arg === 'object' ? arg.pageSize || 20 : 20;

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    page: initialPage,
    pageSize: initialPageSize,
    total: 0,
  });
  const [isFetching, setIsFetching] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchLogs = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    setIsFetching(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('assetId', assetId);
      params.set('page', String(pagination.page));
      params.set('pageSize', String(pagination.pageSize));
      if (timeRange?.startTime) params.set('startTime', timeRange.startTime);
      if (timeRange?.endTime) params.set('endTime', timeRange.endTime);
      if (operationType) params.set('operationType', operationType);

      const resp = await fetch(`/api/v1/audit-logs?${params.toString()}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const result = await resp.json();

      if (!mountedRef.current) return;
      const items = result?.data?.items || result?.items || [];
      const total = result?.data?.total ?? result?.total ?? 0;
      setLogs(items);
      setPagination((prev) => ({ ...prev, total }));
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : '加载审计日志失败');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setIsFetching(false);
      }
    }
  }, [assetId, pagination.page, pagination.pageSize, timeRange, operationType]);

  useEffect(() => {
    if (assetId) {
      fetchLogs();
    }
  }, [assetId]);

  const hasMore = useMemo(
    () => pagination.page * pagination.pageSize < pagination.total,
    [pagination]
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
    await fetchLogs();
  }, [hasMore, loading, fetchLogs]);

  const refetch = useCallback(async () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    await fetchLogs();
  }, [fetchLogs]);

  const data = useMemo(
    () => ({
      data: logs,
      pagination,
    }),
    [logs, pagination]
  );

  return {
    logs,
    isLoading: loading,
    loading,
    error,
    pagination,
    hasMore,
    isFetching,
    refetch,
    refresh: refetch,
    loadMore,
    data,
  };
}

export default useAuditLogs;
