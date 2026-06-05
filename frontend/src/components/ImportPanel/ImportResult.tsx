/**
 * ImportResult Component
 * 
 * 显示资产批量导入结果，包含成功/失败状态、统计数据和错误报告下载功能。
 * 
 * @description
 * - 根据 SWARM-2025-Q2-P2-006 规格实现
 * - 支持同步导入（≤1000条）和异步导入任务（>1000条）的结果展示
 * - 提供导入统计数据（总数、成功数、失败数）
 * - 支持错误报告下载
 * 
 * @example
 * ```tsx
 * <ImportResult
 *   taskId="task_123"
 *   status="completed"
 *   total={500}
 *   success={480}
 *   failed={20}
 *   errors={errorRows}
 *   onDownloadReport={() => downloadErrorReport()}
 * />
 * ```
 */

import React, { useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import {
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  FileSpreadsheet,
} from 'lucide-react';

// ============================================================================
// Types / Interfaces
// ============================================================================

/** 导入任务状态枚举 */
export type ImportTaskStatus = 
  | 'pending'      // 待处理
  | 'processing'  // 处理中
  | 'completed'   // 已完成
  | 'failed'      // 失败
  | 'partial';    // 部分成功

/** 单行错误信息 */
export interface ImportError {
  row: number;
  field: string;
  value: string;
  error: string;
}

/** ImportResult 组件属性 */
export interface ImportResultProps {
  /** 任务ID */
  taskId: string;
  /** 导入状态 */
  status: ImportTaskStatus;
  /** 总记录数 */
  total: number;
  /** 成功记录数 */
  success: number;
  /** 失败记录数 */
  failed: number;
  /** 错误详情列表（最多显示前50条） */
  errors?: ImportError[];
  /** 进度百分比（异步任务时使用，0-100） */
  progress?: number;
  /** 错误报告下载URL */
  reportUrl?: string;
  /** 错误报告下载回调 */
  onDownloadReport?: () => void;
  /** 状态变更回调 */
  onStatusChange?: (status: ImportTaskStatus) => void;
  /** 额外的CSS类名 */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** 状态配置映射 */
const STATUS_CONFIG: Record<
  ImportTaskStatus,
  { label: string; variant: 'default' | 'success' | 'destructive' | 'warning' | 'secondary'; icon: React.ElementType }
> = {
  pending: { label: '待处理', variant: 'secondary', icon: Clock },
  processing: { label: '处理中', variant: 'default', icon: Clock },
  completed: { label: '已完成', variant: 'success', icon: CheckCircle2 },
  failed: { label: '失败', variant: 'destructive', icon: XCircle },
  partial: { label: '部分成功', variant: 'warning', icon: AlertCircle },
};

/** 最大显示错误条数 */
const MAX_DISPLAY_ERRORS = 50;

// ============================================================================
// Component
// ============================================================================

export const ImportResult: React.FC<ImportResultProps> = ({
  taskId,
  status,
  total,
  success,
  failed,
  errors = [],
  progress,
  reportUrl,
  onDownloadReport,
  onStatusChange,
  className = '',
}) => {
  // -------------------------------------------------------------------------
  // Derived State
  // -------------------------------------------------------------------------
  
  /** 成功率百分比 */
  const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : '0.0';
  
  /** 显示的错误列表（限制条数） */
  const displayErrors = errors.slice(0, MAX_DISPLAY_ERRORS);
  
  /** 是否有更多错误未显示 */
  const hasMoreErrors = errors.length > MAX_DISPLAY_ERRORS;
  
  /** 当前状态配置 */
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  // -------------------------------------------------------------------------
  // Event Handlers
  // -------------------------------------------------------------------------

  /**
   * 处理错误报告下载
   * 
   * @description
   * 触发错误报告下载流程，支持通过URL下载或回调方式
   */
  const handleDownloadReport = useCallback(() => {
    if (onDownloadReport) {
      onDownloadReport();
      return;
    }
    
    if (reportUrl) {
      // 创建临时链接触发下载
      const link = document.createElement('a');
      link.href = reportUrl;
      link.download = `import_error_report_${taskId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [onDownloadReport, reportUrl, taskId]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Card className={`import-result ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg font-medium">
              导入结果
            </CardTitle>
          </div>
          <Badge variant={statusConfig.variant} className="gap-1.5">
            <StatusIcon className="h-3.5 w-3.5" />
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 进度条（处理中状态显示） */}
        {status === 'processing' && progress !== undefined && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">导入进度</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* 统计信息 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatItem
            label="总记录数"
            value={total}
            description="导入文件总行数"
          />
          <StatItem
            label="成功"
            value={success}
            variant="success"
            description={`成功率 ${successRate}%`}
          />
          <StatItem
            label="失败"
            value={failed}
            variant={failed > 0 ? 'destructive' : 'default'}
            description={failed > 0 ? '请查看错误详情' : '-'}
          />
          <StatItem
            label="任务ID"
            value={taskId}
            isText
            description="用于查询任务详情"
          />
        </div>

        {/* 错误列表 */}
        {failed > 0 && displayErrors.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              错误详情（显示前 {MAX_DISPLAY_ERRORS} 条）
            </h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">行号</th>
                    <th className="px-3 py-2 text-left font-medium">字段</th>
                    <th className="px-3 py-2 text-left font-medium">错误值</th>
                    <th className="px-3 py-2 text-left font-medium">错误信息</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayErrors.map((error, index) => (
                    <tr key={index} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-muted-foreground">
                        {error.row}
                      </td>
                      <td className="px-3 py-2 font-medium">{error.field}</td>
                      <td className="px-3 py-2 font-mono max-w-[150px] truncate">
                        {error.value || '(空)'}
                      </td>
                      <td className="px-3 py-2 text-destructive">
                        {error.error}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMoreErrors && (
              <p className="text-sm text-muted-foreground">
                还有 {errors.length - MAX_DISPLAY_ERRORS} 条错误未显示...
              </p>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        {failed > 0 && (reportUrl || onDownloadReport) && (
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadReport}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              下载错误报告
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ============================================================================
// Sub-Components
// ============================================================================

interface StatItemProps {
  label: string;
  value: string | number;
  description?: string;
  variant?: 'default' | 'success' | 'destructive';
  isText?: boolean;
}

const StatItem: React.FC<StatItemProps> = ({
  label,
  value,
  description,
  variant = 'default',
  isText = false,
}) => {
  const valueColorClass = {
    default: 'text-foreground',
    success: 'text-green-600 dark:text-green-500',
    destructive: 'text-red-600 dark:text-red-500',
  }[variant];

  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${valueColorClass} ${isText ? 'text-base truncate' : ''}`}>
        {isText ? String(value).substring(0, 20) : value}
      </p>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
};

// ============================================================================
// Export
// ============================================================================

export default ImportResult;
