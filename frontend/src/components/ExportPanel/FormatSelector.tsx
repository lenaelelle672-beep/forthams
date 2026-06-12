/**
 * ExportPanel/FormatSelector.tsx
 * 
 * 导出格式选择器组件
 * SWARM-2025-Q2-P2-006 资产批量导入导出功能
 * 
 * 功能:
 * - 支持 CSV/Excel 格式选择
 * - 支持筛选条件（分类、状态、时间范围）
 * - 触发导出下载，文件名含时间戳
 */

import { useState, useCallback } from 'react';
import { Button } from '@/app/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Calendar } from '@/app/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { CalendarIcon, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { format as formatDate } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type ExportFormat = 'csv' | 'xlsx';

export interface ExportFilters {
  assetType?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface FormatSelectorProps {
  /** 导出格式变更回调 */
  onFormatChange?: (format: ExportFormat) => void;
  /** 导出触发回调 */
  onExport?: (format: ExportFormat, filters: ExportFilters) => Promise<void>;
  /** 是否禁用 */
  disabled?: boolean;
  /** 初始格式 */
  defaultFormat?: ExportFormat;
}

const ASSET_TYPES = [
  { value: '', label: '全部类型' },
  { value: 'EQUIPMENT', label: '设备' },
  { value: 'FURNITURE', label: '家具' },
  { value: 'VEHICLE', label: '车辆' },
  { value: 'IT_HARDWARE', label: 'IT硬件' },
  { value: 'OTHER', label: '其他' },
];

const ASSET_STATUSES = [
  { value: '', label: '全部状态' },
  { value: 'ACTIVE', label: '在用' },
  { value: 'INACTIVE', label: '停用' },
  { value: 'MAINTENANCE', label: '维护中' },
  { value: 'RETIRED', label: '已退役' },
];

export function FormatSelector({
  onFormatChange,
  onExport,
  disabled = false,
  defaultFormat = 'csv',
}: FormatSelectorProps) {
  const [format, setFormat] = useState<ExportFormat>(defaultFormat);
  const [filters, setFilters] = useState<ExportFilters>({});
  const [isExporting, setIsExporting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState<'start' | 'end' | null>(null);

  /** 处理格式变更 */
  const handleFormatChange = useCallback(
    (newFormat: ExportFormat) => {
      setFormat(newFormat);
      onFormatChange?.(newFormat);
    },
    [onFormatChange]
  );

  /** 处理筛选条件变更 */
  const handleFilterChange = useCallback(
    (key: keyof ExportFilters, value: string | Date | undefined) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  /** 处理导出请求 */
  const handleExport = useCallback(async () => {
    if (isExporting || disabled) return;

    setIsExporting(true);
    try {
      // 生成带时间戳的文件名
      const timestamp = formatDate(new Date(), 'yyyyMMdd_HHmmss');
      const filename = `asset_export_${timestamp}.${format === 'csv' ? 'csv' : 'xlsx'}`;

      // 记录导出的文件名（用于测试断言）
      console.info(`[Export] Starting export: ${filename}`, { format, filters });

      if (onExport) {
        await onExport(format, filters);
      } else {
        // 默认导出逻辑：触发 API 下载
        const params = new URLSearchParams({
          format,
          ...(filters.assetType && { asset_type: filters.assetType }),
          ...(filters.status && { status: filters.status }),
          ...(filters.startDate && {
            start_date: formatDate(filters.startDate, 'yyyy-MM-dd'),
          }),
          ...(filters.endDate && {
            end_date: formatDate(filters.endDate, 'yyyy-MM-dd'),
          }),
        });

        const response = await fetch(`/api/v1/assets/export?${params}`);
        if (!response.ok) {
          throw new Error(`Export failed: ${response.statusText}`);
        }

        // 创建下载链接
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      toast.success(`导出成功`, {
        description: `文件已保存为 ${filename}`,
      });
    } catch (error) {
      console.error('[Export] Export failed:', error);
      toast.error('导出失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    } finally {
      setIsExporting(false);
    }
  }, [format, filters, onExport, disabled, isExporting]);

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg bg-background">
      {/* 格式选择区域 */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground">导出格式:</span>
        
        {/* CSV 选项 */}
        <button
          type="button"
          data-testid="format-csv"
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md border transition-colors',
            format === 'csv'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-muted'
          )}
          onClick={() => handleFormatChange('csv')}
          disabled={disabled}
        >
          <FileText className="w-4 h-4" />
          <span className="text-sm">CSV</span>
        </button>

        {/* Excel 选项 */}
        <button
          type="button"
          data-testid="format-xlsx"
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md border transition-colors',
            format === 'xlsx'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-muted'
          )}
          onClick={() => handleFormatChange('xlsx')}
          disabled={disabled}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span className="text-sm">Excel</span>
        </button>
      </div>

      {/* 筛选条件区域 */}
      <div className="flex flex-wrap items-center gap-4">
        {/* 资产类型筛选 */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">资产类型:</label>
          <Select
            value={filters.assetType || ''}
            onValueChange={(value) => handleFilterChange('assetType', value || undefined)}
            disabled={disabled}
          >
            <SelectTrigger className="w-32" data-testid="filter-asset-type">
              <SelectValue placeholder="全部类型" />
            </SelectTrigger>
            <SelectContent>
              {ASSET_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 资产状态筛选 */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">资产状态:</label>
          <Select
            value={filters.status || ''}
            onValueChange={(value) => handleFilterChange('status', value || undefined)}
            disabled={disabled}
          >
            <SelectTrigger className="w-32" data-testid="filter-status">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              {ASSET_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 开始日期筛选 */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">开始日期:</label>
          <Popover
            open={calendarOpen === 'start'}
            onOpenChange={(open) => setCalendarOpen(open ? 'start' : null)}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-40 justify-start text-left font-normal',
                  !filters.startDate && 'text-muted-foreground'
                )}
                data-testid="filter-start-date"
                disabled={disabled}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.startDate ? formatDate(filters.startDate, 'yyyy-MM-dd') : '选择日期'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.startDate}
                onSelect={(date) => {
                  handleFilterChange('startDate', date);
                  setCalendarOpen(null);
                }}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* 结束日期筛选 */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">结束日期:</label>
          <Popover
            open={calendarOpen === 'end'}
            onOpenChange={(open) => setCalendarOpen(open ? 'end' : null)}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-40 justify-start text-left font-normal',
                  !filters.endDate && 'text-muted-foreground'
                )}
                data-testid="filter-end-date"
                disabled={disabled}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.endDate ? formatDate(filters.endDate, 'yyyy-MM-dd') : '选择日期'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.endDate}
                onSelect={(date) => {
                  handleFilterChange('endDate', date);
                  setCalendarOpen(null);
                }}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* 导出按钮 */}
      <div className="flex justify-end">
        <Button
          type="button"
          data-testid="export-button"
          onClick={handleExport}
          disabled={disabled || isExporting}
          className="gap-2"
        >
          {isExporting ? (
            <>
              <span className="animate-spin">⟳</span>
              <span>导出中...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>导出数据</span>
            </>
          )}
        </Button>
      </div>

      {/* 导出状态提示（用于测试） */}
      {isExporting && (
        <div
          className="text-sm text-muted-foreground"
          data-testid="export-status"
        >
          正在生成 {format.toUpperCase()} 文件，请稍候...
        </div>
      )}
    </div>
  );
}

export default FormatSelector;
