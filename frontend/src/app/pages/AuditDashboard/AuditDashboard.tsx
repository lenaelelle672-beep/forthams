/**
 * AuditDashboard - 操作日志审计仪表板主页面组件
 *
 * 聚合全量审计数据，提供多维筛选（时间范围、操作类型、操作人）与趋势图表展示，
 * 实现操作轨迹的透明化与可度量。
 *
 * 核心功能：
 * - 多维筛选器（时间范围、操作类型、操作人）
 * - 审计日志数据表格（分页、排序）
 * - 操作趋势折线图（自适应时间粒度：≤7天按小时，8-30天按天，>30天按周）
 * - KPI 概览卡片
 *
 * 边界约束：
 * - 权限：仅 admin / auditor 角色可访问，无权限时展示 403 拦截页
 * - 时间跨度：单次查询不超过 90 天，超出时前端拦截并提示
 * - 分页：单页上限 100 条，默认 50 条
 * - 时区：前端本地时区展示，API 交互强制使用 UTC（ISO 8601）
 * - 操作类型：由后端 /api/v1/audit-log/meta 动态下发，禁止硬编码
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FilterBar } from './components/FilterBar/FilterBar';
import { AuditTable } from './components/AuditTable/AuditTable';
import { TrendChart } from './components/TrendChart/TrendChart';
import { KpiCards } from './components/KpiCards/KpiCards';
import { useAuditData } from './hooks/useAuditData';
import { auditApi } from './services/auditApi';
import type {
  AuditLogFilter,
  ActionTypeMeta,
  AuditLogQueryParams,
  AuditTrendQueryParams,
} from './types/audit.types';
import styles from './AuditDashboard.module.css';

/** 单次查询最大时间跨度（天） */
const MAX_TIME_SPAN_DAYS = 90;

/** 默认分页大小 */
const DEFAULT_PAGE_SIZE = 50;

/** 分页大小上限 */
const MAX_PAGE_SIZE = 100;

/** 默认查询时间范围（最近 7 天） */
const DEFAULT_LOOKBACK_DAYS = 7;

/**
 * 计算趋势图表的时间粒度
 *
 * 根据查询时间范围自适应：
 * - ≤7 天：按小时聚合
 * - 8-30 天：按天聚合
 * - >30 天：按周聚合
 *
 * @param startTime - 查询开始时间
 * @param endTime - 查询结束时间
 * @returns 粒度标识 'hour' | 'day' | 'week'
 */
function computeTrendGranularity(
  startTime: Date,
  endTime: Date
): 'hour' | 'day' | 'week' {
  const diffMs = endTime.getTime() - startTime.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays <= 7) return 'hour';
  if (diffDays <= 30) return 'day';
  return 'week';
}

/**
 * 将本地 Date 对象转换为 UTC ISO 8601 字符串
 *
 * 前端统一使用本地时区展示，API 交互强制使用 UTC。
 *
 * @param date - 本地时间 Date 对象
 * @returns UTC ISO 8601 格式字符串（如 "2025-01-15T08:00:00.000Z"）
 */
function toUTCISOString(date: Date): string {
  return date.toISOString();
}

/**
 * 校验时间跨度是否在允许范围内（≤90 天）
 *
 * @param startTime - 查询开始时间
 * @param endTime - 查询结束时间
 * @returns true 表示跨度合法，false 表示超限
 */
function isTimeSpanValid(startTime: Date, endTime: Date): boolean {
  const diffMs = endTime.getTime() - startTime.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= MAX_TIME_SPAN_DAYS;
}

/**
 * 检查当前用户是否具有审计仪表板访问权限
 *
 * 仅 admin 或 auditor 角色可访问，对应 ATB-04 权限拦截要求。
 * 从 localStorage / sessionStorage 读取用户信息判断角色。
 *
 * @returns true 表示有权限，false 表示无权限
 */
function hasAuditPermission(): boolean {
  try {
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');
    if (!userStr) return false;
    const user = JSON.parse(userStr);
    const roles: string[] = user?.roles || [];
    return roles.some(
      (role: string) => role === 'admin' || role === 'auditor'
    );
  } catch {
    return false;
  }
}

/**
 * 生成默认时间范围（最近 N 天）
 *
 * @param lookbackDays - 回溯天数
 * @returns [startTime, endTime] 元组
 */
function getDefaultTimeRange(lookbackDays: number = DEFAULT_LOOKBACK_DAYS): [Date, Date] {
  const endTime = new Date();
  const startTime = new Date();
  startTime.setDate(startTime.getDate() - lookbackDays);
  startTime.setHours(0, 0, 0, 0);
  return [startTime, endTime];
}

/**
 * AuditDashboard 操作日志审计仪表板主组件
 *
 * 组装筛选器、数据表格、趋势图表与 KPI 卡片，
 * 接入路由守卫与权限校验，实施联调与边界状态处理。
 *
 * @example
 * ```tsx
 * // 在路由配置中使用
 * <Route path="/dashboard/audit-log" element={<AuditDashboard />} />
 * ```
 */
export const AuditDashboard: React.FC = () => {
  /** 权限状态 */
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [permissionChecked, setPermissionChecked] = useState<boolean>(false);

  /** 筛选器状态 */
  const [filter, setFilter] = useState<AuditLogFilter>(() => {
    const [defaultStart, defaultEnd] = getDefaultTimeRange();
    return {
      startTime: defaultStart,
      endTime: defaultEnd,
      actionType: '',
      operatorId: '',
    };
  });

  /** 分页状态 */
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  /** 操作类型元数据（动态从 API 获取，禁止硬编码） */
  const [actionTypes, setActionTypes] = useState<ActionTypeMeta[]>([]);

  /** 前端校验错误提示 */
  const [validationError, setValidationError] = useState<string>('');

  /** 是否已执行过首次查询 */
  const initialQueryDone = useRef<boolean>(false);

  /** 使用审计数据 hook 管理列表、趋势、KPI 数据 */
  const {
    auditLogs,
    trendData,
    kpiData,
    total,
    loading,
    error: apiError,
    fetchAuditLogs,
    fetchTrendData,
    fetchKpiData,
  } = useAuditData();

  /**
   * 初始化权限检查
   *
   * 组件挂载时从本地存储读取用户角色，判断是否有审计仪表板访问权限。
   * 无权限时展示 403 拦截页，不发起任何审计日志数据请求。
   */
  useEffect(() => {
    const permitted = hasAuditPermission();
    setHasPermission(permitted);
    setPermissionChecked(true);
  }, []);

  /**
   * 获取操作类型元数据
   *
   * 从 /api/v1/audit-log/meta 动态获取操作类型枚举，
   * 前端禁止硬编码操作类型，需动态渲染筛选项。
   * 仅在权限校验通过后执行。
   */
  useEffect(() => {
    if (!hasPermission) return;

    auditApi
      .fetchMeta()
      .then((meta) => {
        if (meta?.actionTypes) {
          setActionTypes(meta.actionTypes);
        }
      })
      .catch((err: unknown) => {
        console.error('[AuditDashboard] 获取操作类型元数据失败:', err);
      });
  }, [hasPermission]);

  /**
   * 计算趋势图表的时间粒度
   *
   * 根据当前筛选器的时间范围自适应计算：
   * - ≤7天 → hour
   * - 8-30天 → day
   * - >30天 → week
   */
  const trendGranularity = useMemo<'hour' | 'day' | 'week'>(() => {
    if (filter.startTime && filter.endTime) {
      return computeTrendGranularity(filter.startTime, filter.endTime);
    }
    return 'day';
  }, [filter.startTime, filter.endTime]);

  /**
   * 构建列表查询参数
   *
   * 将筛选器状态转换为 API 查询参数，处理：
   * - 时间本地→UTC 转换
   * - 空值过滤
   * - 分页参数
   *
   * @returns API 查询参数对象
   */
  const buildListQueryParams = useCallback((): AuditLogQueryParams => {
    return {
      start_time: filter.startTime ? toUTCISOString(filter.startTime) : undefined,
      end_time: filter.endTime ? toUTCISOString(filter.endTime) : undefined,
      action_type: filter.actionType || undefined,
      operator_id: filter.operatorId || undefined,
      page,
      size: Math.min(pageSize, MAX_PAGE_SIZE),
    };
  }, [filter, page, pageSize]);

  /**
   * 构建趋势查询参数
   *
   * @returns 趋势 API 查询参数对象，包含粒度信息
   */
  const buildTrendQueryParams = useCallback((): AuditTrendQueryParams => {
    return {
      start_time: filter.startTime ? toUTCISOString(filter.startTime) : undefined,
      end_time: filter.endTime ? toUTCISOString(filter.endTime) : undefined,
      action_type: filter.actionType || undefined,
      operator_id: filter.operatorId || undefined,
      granularity: trendGranularity,
    };
  }, [filter, trendGranularity]);

  /**
   * 执行查询操作
   *
   * 校验时间跨度（≤90天），转换时区后发起 API 请求。
   * 同时刷新列表数据、趋势数据和 KPI 数据。
   * 查询成功后清除校验错误提示。
   */
  const handleQuery = useCallback(() => {
    // 校验时间范围跨度
    if (filter.startTime && filter.endTime) {
      if (!isTimeSpanValid(filter.startTime, filter.endTime)) {
        setValidationError(
          `查询时间跨度不得超过 ${MAX_TIME_SPAN_DAYS} 天，请缩小查询范围`
        );
        return;
      }
    }

    // 校验开始时间不能晚于结束时间
    if (filter.startTime && filter.endTime) {
      if (filter.startTime.getTime() > filter.endTime.getTime()) {
        setValidationError('开始时间不能晚于结束时间');
        return;
      }
    }

    setValidationError('');

    const listParams = buildListQueryParams();
    const trendParams = buildTrendQueryParams();

    // 获取审计日志列表
    fetchAuditLogs(listParams);

    // 获取趋势数据（需要有效的时间范围）
    if (listParams.start_time && listParams.end_time) {
      fetchTrendData(trendParams);
    }

    // 获取 KPI 概览数据
    fetchKpiData(listParams);
  }, [
    filter,
    buildListQueryParams,
    buildTrendQueryParams,
    fetchAuditLogs,
    fetchTrendData,
    fetchKpiData,
  ]);

  /**
   * 首次加载自动查询
   *
   * 权限校验通过后，使用默认时间范围自动触发首次查询，
   * 确保页面进入后即展示数据。
   */
  useEffect(() => {
    if (hasPermission && !initialQueryDone.current) {
      initialQueryDone.current = true;
      handleQuery();
    }
  }, [hasPermission, handleQuery]);

  /**
   * 处理筛选器变更
   *
   * 更新筛选条件并清除之前的校验错误。
   * 注意：筛选变更不会自动触发查询，需用户点击"查询"按钮。
   *
   * @param newFilter - 部分更新的筛选条件
   */
  const handleFilterChange = useCallback(
    (newFilter: Partial<AuditLogFilter>) => {
      setFilter((prev) => ({ ...prev, ...newFilter }));
      setValidationError('');
    },
    []
  );

  /**
   * 处理分页变更
   *
   * 更新分页参数后自动重新查询。
   * 强制限制每页条数不超过上限 100。
   *
   * @param newPage - 新页码（从 1 开始）
   * @param newSize - 新每页条数（可选）
   */
  const handlePageChange = useCallback(
    (newPage: number, newSize?: number) => {
      setPage(newPage);
      if (newSize !== undefined) {
        setPageSize(Math.min(newSize, MAX_PAGE_SIZE));
      }
    },
    []
  );

  /**
   * 处理表格排序变更
   *
   * 排序变更后重新触发查询以获取排序后的数据。
   *
   * @param _field - 排序字段名
   * @param _order - 排序方向 'asc' | 'desc'
   */
  const handleSortChange = useCallback(
    (_field: string, _order: 'asc' | 'desc') => {
      handleQuery();
    },
    [handleQuery]
  );

  /**
   * 处理筛选器重置
   *
   * 将筛选条件恢复为默认值（最近 7 天），并重新查询。
   */
  const handleReset = useCallback(() => {
    const [defaultStart, defaultEnd] = getDefaultTimeRange();
    setFilter({
      startTime: defaultStart,
      endTime: defaultEnd,
      actionType: '',
      operatorId: '',
    });
    setPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
    setValidationError('');
  }, []);

  /**
   * 合并展示的错误信息
   *
   * 优先展示前端校验错误，其次展示 API 返回的错误。
   */
  const displayError = validationError || apiError || '';

  // ─── 渲染：权限检查加载态 ───
  if (!permissionChecked) {
    return (
      <div className={styles.dashboardContainer} data-testid="audit-dashboard-loading">
        <div className={styles.loadingState}>
          <span className={styles.loadingSpinner} aria-hidden="true" />
          <p>正在验证权限...</p>
        </div>
      </div>
    );
  }

  // ─── 渲染：无权限 403 拦截页 ───
  if (!hasPermission) {
    return (
      <div className={styles.dashboardContainer} data-testid="audit-dashboard-forbidden">
        <div className={styles.forbiddenState}>
          <h2>403 - 无访问权限</h2>
          <p>
            您没有访问审计日志仪表板的权限。
            如需访问，请联系管理员获取
            <strong> admin </strong>或<strong> auditor </strong>角色。
          </p>
        </div>
      </div>
    );
  }

  // ─── 渲染：主仪表板 ───
  return (
    <div className={styles.dashboardContainer} data-testid="audit-dashboard">
      {/* 页面标题区 */}
      <header className={styles.dashboardHeader}>
        <h1 className={styles.dashboardTitle}>操作日志审计</h1>
        <p className={styles.dashboardSubtitle}>
          聚合全量审计数据，支持多维筛选与趋势分析
        </p>
      </header>

      {/* KPI 概览卡片 */}
      <section className={styles.kpiSection} aria-label="关键指标概览">
        <KpiCards data={kpiData} loading={loading} />
      </section>

      {/* 筛选器区域 */}
      <section className={styles.filterSection} aria-label="筛选条件">
        <FilterBar
          filter={filter}
          actionTypes={actionTypes}
          onFilterChange={handleFilterChange}
          onQuery={handleQuery}
          onReset={handleReset}
          loading={loading}
          maxTimeSpanDays={MAX_TIME_SPAN_DAYS}
        />
      </section>

      {/* 错误提示（校验错误 + API 错误） */}
      {displayError && (
        <div className={styles.errorMessage} role="alert" data-testid="audit-dashboard-error">
          <span className={styles.errorIcon} aria-hidden="true">⚠</span>
          {displayError}
        </div>
      )}

      {/* 趋势折线图 */}
      <section className={styles.chartSection} aria-label="操作趋势图表">
        <h2 className={styles.sectionTitle}>
          操作趋势
          {filter.startTime && filter.endTime && (
            <span className={styles.granularityLabel}>
              （粒度：{trendGranularity === 'hour' ? '小时' : trendGranularity === 'day' ? '天' : '周'}）
            </span>
          )}
        </h2>
        <TrendChart
          data={trendData}
          granularity={trendGranularity}
          loading={loading}
        />
      </section>

      {/* 审计日志数据表格 */}
      <section className={styles.tableSection} aria-label="审计日志列表">
        <h2 className={styles.sectionTitle}>
          审计日志
          {total > 0 && (
            <span className={styles.totalLabel}>
              共 {total} 条记录
            </span>
          )}
        </h2>
        <AuditTable
          data={auditLogs}
          total={total}
          page={page}
          pageSize={pageSize}
          loading={loading}
          onPageChange={handlePageChange}
          onSortChange={handleSortChange}
        />
      </section>
    </div>
  );
};

export default AuditDashboard;