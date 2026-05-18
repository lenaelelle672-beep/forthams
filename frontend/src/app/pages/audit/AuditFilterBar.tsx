/**
 * @module AuditFilterBar
 * @description 审计日志筛选工具栏页面组件，支持按用户、操作类型和时间范围筛选。
 *
 * 提供多维筛选控件：
 * - 操作人 ID 输入框
 * - 操作类型下拉选择（动态从 meta API 获取）
 * - 时间范围选择器（起止日期）
 *
 * 对应 SPEC: SWARM-060 Audit Log Dashboard Page
 * - ATB-01: 多维筛选与分页
 * - ATB-05: 筛选器联动与数据刷新
 *
 * @since SWARM-060
 */

import React, { useCallback } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Search, RotateCcw, AlertTriangle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 操作类型选项 */
export interface ActionTypeOption {
  /** 操作类型枚举值 */
  value: string;
  /** 操作类型显示标签 */
  label: string;
}

/** 所属模块选项 */
export interface ModuleOption {
  /** 模块枚举值 */
  value: string;
  /** 模块显示标签 */
  label: string;
}

/** 筛选器状态 */
export interface AuditFilterState {
  /** 操作人 ID */
  operator_id: string;
  /** 操作类型 */
  action_type: string;
  /** 起始时间 ISO 字符串 */
  start_time: string;
  /** 结束时间 ISO 字符串 */
  end_time: string;
}

/** 筛选栏组件属性 */
export interface AuditFilterBarProps {
  /** 当前筛选器状态 */
  filters: AuditFilterState;
  /** 更新筛选器回调 */
  onFiltersChange: (filters: AuditFilterState) => void;
  /** 操作类型选项（来自 meta 接口动态下发） */
  actionTypeOptions: ActionTypeOption[];
  /** 加载状态 */
  loading?: boolean;
  /** 时间范围是否越界 */
  isTimeRangeExceeded?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 默认筛选器状态 */
const DEFAULT_FILTERS: AuditFilterState = {
  operator_id: '',
  action_type: '',
  start_time: '',
  end_time: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AuditFilterBar — 审计日志筛选工具栏页面组件
 *
 * 提供操作人、操作类型和时间范围多维筛选，支持联动查询。
 *
 * @param props 组件属性
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <AuditFilterBar
 *   filters={filterState}
 *   onFiltersChange={setFilterState}
 *   actionTypeOptions={[{ value: 'LOGIN', label: '登录' }]}
 * />
 * ```
 */
export const AuditFilterBar: React.FC<AuditFilterBarProps> = ({
  filters,
  onFiltersChange,
  actionTypeOptions,
  loading = false,
  isTimeRangeExceeded = false,
}) => {
  /**
   * 更新单个筛选字段
   *
   * @param field 字段名
   * @param value 新值
   */
  const handleFieldChange = useCallback(
    (field: keyof AuditFilterState) => (value: string) => {
      onFiltersChange({ ...filters, [field]: value });
    },
    [filters, onFiltersChange]
  );

  /**
   * 重置所有筛选器为默认值
   */
  const handleReset = useCallback(() => {
    onFiltersChange({ ...DEFAULT_FILTERS });
  }, [onFiltersChange]);

  return (
    <Card data-testid="audit-filter-bar">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* 操作人 ID */}
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <label className="text-sm font-medium text-muted-foreground">
              操作人 ID
            </label>
            <Input
              placeholder="输入操作人 ID"
              value={filters.operator_id}
              onChange={(e) => handleFieldChange('operator_id')(e.target.value)}
              disabled={loading}
              data-testid="filter-operator-id"
            />
          </div>

          {/* 操作类型 */}
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <label className="text-sm font-medium text-muted-foreground">
              操作类型
            </label>
            <Select
              value={filters.action_type || '__all__'}
              onValueChange={(val) =>
                handleFieldChange('action_type')(val === '__all__' ? '' : val)
              }
              disabled={loading}
            >
              <SelectTrigger data-testid="filter-action-type">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部类型</SelectItem>
                {actionTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 起始时间 */}
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <label className="text-sm font-medium text-muted-foreground">
              起始时间
            </label>
            <Input
              type="datetime-local"
              value={filters.start_time ? filters.start_time.slice(0, 16) : ''}
              onChange={(e) => {
                const val = e.target.value;
                handleFieldChange('start_time')(val ? new Date(val).toISOString() : '');
              }}
              disabled={loading}
              data-testid="filter-start-time"
            />
          </div>

          {/* 结束时间 */}
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <label className="text-sm font-medium text-muted-foreground">
              结束时间
            </label>
            <Input
              type="datetime-local"
              value={filters.end_time ? filters.end_time.slice(0, 16) : ''}
              onChange={(e) => {
                const val = e.target.value;
                handleFieldChange('end_time')(val ? new Date(val).toISOString() : '');
              }}
              disabled={loading}
              data-testid="filter-end-time"
            />
          </div>

          {/* 重置按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={loading}
            data-testid="filter-reset"
          >
            <RotateCcw className="size-4 mr-1" />
            重置
          </Button>
        </div>

        {/* 时间范围越界警告 */}
        {isTimeRangeExceeded && (
          <div
            className="flex items-center gap-2 mt-3 text-sm text-destructive"
            data-testid="time-range-warning"
            role="alert"
          >
            <AlertTriangle className="size-4" />
            查询时间跨度不得超过 90 天，请缩小时间范围
          </div>
        )}
      </CardContent>
    </Card>
  );
};

AuditFilterBar.displayName = 'AuditFilterBar';

export default AuditFilterBar;
