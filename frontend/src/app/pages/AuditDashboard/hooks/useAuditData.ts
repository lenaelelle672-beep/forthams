import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  fetchAuditLogList,
  fetchAuditTrend,
  fetchAuditMeta,
} from '../services/auditApi';
import type {
  AuditLogItem,
  AuditLogListResponse,
  AuditTrendDataPoint,
  AuditTrendResponse,
  AuditMetaResponse,
  AuditLogListParams,
  AuditTrendParams,
} from '../types/audit.types';

interface AuditLogFilter {
  startTime: Date;
  endTime: Date;
  actionType: string;
  operatorId: string;
}

interface KpiData {
  totalOperations: number;
  uniqueOperators: number;
  criticalActions: number;
  topActionType: string;
}

export function useAuditData(
  startTimeOverride?: string,
  endTimeOverride?: string
) {
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [trendData, setTrendData] = useState<AuditTrendDataPoint[]>([]);
  const [kpiData, setKpiData] = useState<KpiData | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionTypes, setActionTypes] = useState<{ value: string; label: string }[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchAuditLogs = useCallback(
    async (filter: AuditLogFilter, page: number = 1, pageSize: number = 50) => {
      setLoading(true);
      setError(null);
      try {
        const params: AuditLogListParams = {
          startTime: filter.startTime,
          endTime: filter.endTime,
          actionType: filter.actionType || undefined,
          operatorId: filter.operatorId || undefined,
          page,
          size: pageSize,
        };
        const response: AuditLogListResponse = await fetchAuditLogList(params);
        if (!mountedRef.current) return;
        setAuditLogs(response.items || []);
        setTotal(response.total || 0);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : '获取审计日志失败');
        setAuditLogs([]);
        setTotal(0);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    []
  );

  const fetchTrendData = useCallback(
    async (filter: AuditLogFilter) => {
      setTrendLoading(true);
      setTrendError(null);
      try {
        const params: AuditTrendParams = {
          startTime: filter.startTime,
          endTime: filter.endTime,
          actionType: filter.actionType || undefined,
          operatorId: filter.operatorId || undefined,
        };
        const response: AuditTrendResponse = await fetchAuditTrend(params);
        if (!mountedRef.current) return;
        setTrendData(response.dataPoints || []);
      } catch (err) {
        if (!mountedRef.current) return;
        const msg = err instanceof Error ? err.message : '获取趋势数据失败';
        setTrendError(msg);
        setTrendData([]);
      } finally {
        if (mountedRef.current) setTrendLoading(false);
      }
    },
    []
  );

  const fetchKpiData = useCallback(async (filter: AuditLogFilter) => {
    try {
      const kpi: KpiData = {
        totalOperations: 0,
        uniqueOperators: 0,
        criticalActions: 0,
        topActionType: '',
      };
      const params: AuditLogListParams = {
        startTime: filter.startTime,
        endTime: filter.endTime,
        page: 1,
        size: 1,
      };
      const response = await fetchAuditLogList(params);
      kpi.totalOperations = response.total || 0;
      if (mountedRef.current) setKpiData(kpi);
    } catch {
      if (mountedRef.current) setKpiData(null);
    }
  }, []);

  useEffect(() => {
    if (startTimeOverride && endTimeOverride) {
      const start = new Date(startTimeOverride);
      const end = new Date(endTimeOverride);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        fetchTrendData({ startTime: start, endTime: end, actionType: '', operatorId: '' });
      }
    }
  }, [startTimeOverride, endTimeOverride, fetchTrendData]);

  const returnType = useMemo(() => {
    if (startTimeOverride !== undefined && endTimeOverride !== undefined) {
      return {
        trendData,
        trendLoading,
        trendError,
      } as const;
    }
    return {
      auditLogs,
      trendData,
      kpiData,
      total,
      loading,
      error,
      fetchAuditLogs,
      fetchTrendData,
      fetchKpiData,
    } as const;
  }, [
    startTimeOverride,
    endTimeOverride,
    auditLogs,
    trendData,
    kpiData,
    total,
    loading,
    error,
    trendLoading,
    trendError,
    fetchAuditLogs,
    fetchTrendData,
    fetchKpiData,
  ]);

  return returnType;
}

export default useAuditData;
