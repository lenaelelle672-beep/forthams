import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { AuditLog } from '@/types/audit.types';
import type { GraphifyNode } from '@/components/audit/GraphifyKnowledgeGraph';
import { useAuditLog } from './useAuditLog';

interface UseAuditLogsOptions {
  autoLoad?: boolean;
  pageSize?: number;
}

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface UseAuditLogsReturn {
  auditLogs: AuditLog[];
  loading: boolean;
  error: string | null;
  pagination: PaginationState;
  hasMore: boolean;
  loadAuditLogs: (assetId: string, page?: number) => Promise<void>;
  refresh: (assetId: string) => Promise<void>;
  loadMore: (assetId: string) => Promise<void>;
  exportAuditLogs: (assetId: string, format?: 'json' | 'csv') => Promise<string>;
  filterAuditLogs: (filters: AuditLogFilters) => AuditLog[];
  generateGraphifyNodes: (auditLogs: AuditLog[]) => GraphifyNode[];
}

export interface AuditLogFilters {
  operationType?: string;
  startDate?: Date;
  endDate?: Date;
  operator?: string;
  keyword?: string;
}

export function useAuditLogs(
  assetId: string,
  options: UseAuditLogsOptions = {}
): UseAuditLogsReturn {
  const { autoLoad = true, pageSize: initialPageSize = 20 } = options;

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: initialPageSize,
    total: 0,
  });
  const [currentFilters, setCurrentFilters] = useState<AuditLogFilters>({});

  const currentAssetIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const hasMore = useMemo(() => {
    const { page, pageSize, total } = pagination;
    return page * pageSize < total;
  }, [pagination]);

  async function loadAuditLogsInner(
    targetAssetId: string,
    page: number = 1
  ): Promise<void> {
    if (!targetAssetId) {
      setError('资产ID不能为空');
      return;
    }

    setLoading(true);
    setError(null);
    currentAssetIdRef.current = targetAssetId;

    try {
      const response = await fetchAuditLogs(
        targetAssetId,
        page,
        pagination.pageSize
      );

      if (!mountedRef.current) return;

      if (page === 1) {
        setAuditLogs(response.data);
      } else {
        setAuditLogs((prev) => [...prev, ...response.data]);
      }

      setPagination((prev) => ({
        page,
        pageSize: prev.pageSize,
        total: response.total,
      }));
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : '加载审计日志失败');
      console.error('Failed to load audit logs:', err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }

  const loadAuditLogs = useCallback(
    (targetAssetId: string, page?: number) =>
      loadAuditLogsInner(targetAssetId, page),
    [pagination.pageSize]
  );

  const refresh = useCallback(
    async (targetAssetId: string) => {
      await loadAuditLogsInner(targetAssetId, 1);
    },
    [pagination.pageSize]
  );

  const loadMore = useCallback(
    async (targetAssetId: string) => {
      if (!hasMore || loading) return;
      await loadAuditLogsInner(targetAssetId, pagination.page + 1);
    },
    [hasMore, loading, pagination.page, pagination.pageSize]
  );

  const exportAuditLogs = useCallback(
    async (targetAssetId: string, format: 'json' | 'csv' = 'json') => {
      if (!targetAssetId) {
        throw new Error('资产ID不能为空');
      }

      const allLogs = await fetchAllAuditLogs(targetAssetId);

      if (format === 'json') {
        return JSON.stringify(allLogs, null, 2);
      }

      const headers = ['时间', '操作类型', '操作人', '变更内容'];
      const rows = allLogs.map((log) => [
        log.timestamp,
        log.operationType,
        log.operator,
        JSON.stringify(log.changes),
      ]);

      return [headers.join(','), ...rows.map((row) => row.join(','))].join(
        '\n'
      );
    },
    []
  );

  const filterAuditLogs = useCallback(
    (newFilters: AuditLogFilters): AuditLog[] => {
      setCurrentFilters(newFilters);

      let result = [...auditLogs];

      if (newFilters.operationType) {
        result = result.filter(
          (log) => log.operationType === newFilters.operationType
        );
      }

      if (newFilters.startDate) {
        const startTime = newFilters.startDate.getTime();
        result = result.filter(
          (log) => new Date(log.timestamp).getTime() >= startTime
        );
      }

      if (newFilters.endDate) {
        const endTime = newFilters.endDate.getTime();
        result = result.filter(
          (log) => new Date(log.timestamp).getTime() <= endTime
        );
      }

      if (newFilters.operator) {
        result = result.filter((log) =>
          log.operator.toLowerCase().includes(newFilters.operator!.toLowerCase())
        );
      }

      if (newFilters.keyword) {
        const keyword = newFilters.keyword.toLowerCase();
        result = result.filter((log) => {
          const changeStr = JSON.stringify(log.changes).toLowerCase();
          return (
            log.operationType.toLowerCase().includes(keyword) ||
            log.operator.toLowerCase().includes(keyword) ||
            changeStr.includes(keyword)
          );
        });
      }

      return result;
    },
    [auditLogs]
  );

  function generateGraphifyNodes(logs: AuditLog[]): GraphifyNode[] {
    if (!logs || logs.length === 0) {
      const nodes: GraphifyNode[] = [];
      if (assetId) {
        nodes.push({
          id: `asset-${assetId}`,
          type: 'asset',
          label: '资产',
          properties: {
            assetId: assetId,
          },
        });
      }
      return nodes;
    }

    const nodes: GraphifyNode[] = [];
    const nodeIdSet = new Set<string>();

    if (assetId) {
      const assetNodeId = `asset-${assetId}`;
      nodes.push({
        id: assetNodeId,
        type: 'asset',
        label: '资产',
        properties: {
          assetId: assetId,
        },
      });
      nodeIdSet.add(assetNodeId);
    }

    for (const log of logs) {
      if (log.changes) {
        if (typeof log !== 'object' || !log.id) {
          continue;
        }

        for (const [fieldName, change] of Object.entries(log.changes)) {
          if (!fieldName || typeof fieldName !== 'string') {
            continue;
          }

          if (!change || typeof change !== 'object') {
            continue;
          }

          const nodeId = `change-${log.id}-${fieldName}`;

          if (nodeIdSet.has(nodeId)) {
            continue;
          }

          const node: GraphifyNode = {
            id: nodeId,
            type: 'change',
            label: getFieldLabel(fieldName),
            properties: {
              fieldName,
              oldValue: (change as { oldValue?: unknown }).oldValue,
              newValue: (change as { newValue?: unknown }).newValue,
              timestamp: log.timestamp,
              operator: log.operator,
            },
          };

          nodes.push(node);
          nodeIdSet.add(nodeId);
        }

        if (log.operator) {
          const operatorNodeId = `operator-${log.operator}`;

          if (!nodeIdSet.has(operatorNodeId)) {
            nodes.push({
              id: operatorNodeId,
              type: 'operator',
              label: log.operator,
              properties: {
                name: log.operator,
              },
            });
            nodeIdSet.add(operatorNodeId);
          }
        }
      }
    }

    nodeIdSet.clear();

    return nodes;
  }

  function getFieldLabel(fieldName: string): string {
    const fieldLabels: Record<string, string> = {
      name: '资产名称',
      status: '资产状态',
      location: '存放地点',
      category: '资产类别',
      purchaseDate: '购买日期',
      purchasePrice: '购买价格',
      serialNumber: '序列号',
      manufacturer: '制造商',
      model: '型号',
      department: '所属部门',
      assignedTo: '使用人',
      description: '描述',
      notes: '备注',
    };

    return fieldLabels[fieldName] || fieldName;
  }

  async function fetchAuditLogs(
    targetAssetId: string,
    page: number,
    pageSize: number
  ): Promise<{ data: AuditLog[]; total: number }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          data: [],
          total: 0,
        });
      }, 500);
    });
  }

  async function fetchAllAuditLogs(
    targetAssetId: string
  ): Promise<AuditLog[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([]);
      }, 500);
    });
  }

  useEffect(() => {
    if (autoLoad && assetId) {
      loadAuditLogsInner(assetId);
    }
  }, [autoLoad, assetId]);

  return {
    auditLogs,
    loading,
    error,
    pagination,
    hasMore,
    loadAuditLogs,
    refresh,
    loadMore,
    exportAuditLogs,
    filterAuditLogs,
    generateGraphifyNodes,
  };
}

export type { AuditLog, GraphifyNode };
