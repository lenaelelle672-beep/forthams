/**
 * @module AuditLogFilterBar
 * @description 审计日志筛选工具栏组件，支持时间范围、操作类型、操作人 ID 等多维筛选。
 * 操作类型选项由后端 /api/v1/audit-log/meta 动态下发，前端禁止硬编码。
 *
 * 对应 SPEC: ATB-05 筛选器联动与数据刷新
 *
 * @since SWARM-030
 */

import React, { useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Search, RotateCcw, AlertTriangle } from 'lucide-react';
import {
  type AuditLogFilters,
  type ActionTypeOption,
  type PaginationParams,
} from '../../hooks/useAuditLogs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 筛选栏组件属性 */
export interface AuditLogFilterBarProps {
  /** 当前筛选器状态 */
  filters: AuditLogFilters;
  /** 更新筛选器 */
  onUpdateFilters: (patch: Partial<AuditLogFilters>) => void;
  /** 重置筛选器 */
  onResetFilters: () => void;
  /** 分页参数 */
  pagination: PaginationParams;
  /** 更新分页 */
  onSetPagination: (params: Partial<PaginationParams>) => void;
  /** 操作类型选项（来自 meta 接口） */
  actionTypeOptions: ActionTypeOption[];
  /** 所属模块选项（来自 meta 接口或静态配置） */
  moduleOptions?: ModuleOption[];
  /** 触发全量查询 */
  onFetchAll: () => Promise<void>;
  /** 加载状态 */
  loading?: boolean;
  /** 时间跨度是否超过 90 天 */
  isTimeRangeExceeded?: boolean;
}

/** 所属模块选项 */
export interface ModuleOption {
  /** 模块枚举值 */
  value: string;
  /** 模块显示标签 */
  label: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AuditLogFilterBar — 审计日志筛选工具栏
 *
 * 提供时间范围选择（原生日期输入）、操作类型下拉、操作人 ID 输入等筛选控件。
 * 点击"查询"按钮后，联动刷新列表与趋势图表。
 *
 * @param props 组件属性
 * @returns React 组件
 *
 * @example
 * ```tsx
 * const { filters, updateFilters, resetFilters, fetchAll, ... } = useAuditLogs(token);
 * <AuditLogFilterBar
 *   filters={filters}
 *   onUpdateFilters={updateFilters}
 *   onResetFilters={resetFilters}
 *   onFetchAll={fetchAll}
 *   actionTypeOptions={actionTypeOptions}
 *   loading={listLoading || trendLoading}
 * />
 * ```
 */
const AuditLogFilterBar: React.FC<AuditLogFilterBarProps> = ({
  filters,
  onUpdateFilters,
  onResetFilters,
  pagination,
  onSetPagination,
  actionTypeOptions,
  moduleOptions = [],
  onFetchAll,
  loading = false,
  isTimeRangeExceeded = false,
}) => {
  /**
   * 处理查询按钮点击
   */
  const handleSearch = useCallback(() => {
    onSetPagination({ page: 1 });
    onFetchAll();
  }, [onSetPagination, onFetchAll]);

  /**
   * 处理重置按钮点击
   */
  const handleReset = useCallback(() => {
    onResetFilters();
    onSetPagination({ page: 1 });
  }, [onResetFilters, onSetPagination]);

  /**
   * 格式化 Date 为 input[type=date] 所需的 YYYY-MM-DD 字符串
   *
   * @param date Date 对象或 null
   * @returns YYYY-MM-DD 字符串或空字符串
   */
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return (
    <Card>
      <CardContent className="py-4">
        {/* 时间跨度越界警告 */}
        {isTimeRangeExceeded && (
          <div
            className="flex items-center gap-2 mb-3 p-2 bg-destructive/10 text-destructive text-sm rounded-md"
            data-testid="filter-error-message"
          >
            <AlertTriangle className="size-4 shrink-0" />
            <span>查询时间跨度不得超过 90 天，请缩小时间范围</span>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          {/* 起始时间 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">起始时间</label>
            <Input
              type="date"
              data-testid="filter-start-time"
              value={formatDateForInput(filters.start_time)}
              onChange={(e) => {
                const val = e.target.value;
                onUpdateFilters({
                  start_time: val ? new Date(val + 'T00:00:00') : null,
                });
              }}
              disabled={loading}
              className="w-[160px]"
            />
          </div>

          {/* 结束时间 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">结束时间</label>
            <Input
              type="date"
              data-testid="filter-end-time"
              value={formatDateForInput(filters.end_time)}
              onChange={(e) => {
                const val = e.target.value;
                onUpdateFilters({
                  end_time: val ? new Date(val + 'T23:59:59') : null,
                });
              }}
              disabled={loading}
              className="w-[160px]"
            />
          </div>

          {/* 操作类型 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">操作类型</label>
            <Select
              value={filters.action_type || '__all__'}
              onValueChange={(val) => {
                onUpdateFilters({ action_type: val === '__all__' ? '' : val });
              }}
            >
              <SelectTrigger
                className="w-[160px]"
                disabled={loading}
                data-testid="filter-action-type"
              >
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部类型</SelectItem>
                {actionTypeOptions.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    data-testid={`filter-action-type-option-${opt.value}`}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 所属模块 — ATB-02 多维组合筛选 */}
          {moduleOptions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">所属模块</label>
              <Select
                value={filters.module || '__all__'}
                onValueChange={(val) => {
                  onUpdateFilters({ module: val === '__all__' ? '' : val });
                }}
              >
                <SelectTrigger
                  className="w-[160px]"
                  disabled={loading}
                  data-testid="filter-module"
                >
                  <SelectValue placeholder="全部模块" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部模块</SelectItem>
                  {moduleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 操作人 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">操作人</label>
            <Input
              placeholder="输入操作人"
              data-testid="filter-operator"
              value={filters.operator_id}
              onChange={(e) => onUpdateFilters({ operator_id: e.target.value })}
              disabled={loading}
              className="w-[160px]"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button
              onClick={handleSearch}
              disabled={loading || isTimeRangeExceeded}
              size="sm"
              data-testid="filter-query-btn"
            >
              <Search className="size-4 mr-1" />
              查询
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={loading}
              size="sm"
            >
              <RotateCcw className="size-4 mr-1" />
              重置
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

AuditLogFilterBar.displayName = 'AuditLogFilterBar';

export default AuditLogFilterBar;
export { AuditLogFilterBar };
