/**
 * @file components/shared/TimeRangeSelector.tsx
 * @description 统一时间范围选择器 — 4 快捷 tab + 自定义 popover
 *
 * 集成（gai2 W16 edit / IMP-4 状态对齐 / AR-4 facade 模式）：
 * - 主数据源：useSpatialTime() 双向绑定 URL searchParams（URL 为真源）
 * - facade 层：useSpatialStoreActions().setTimeRange() 等价于 setSpatialTime（消费方可二选一）
 * - 4 快捷 tab：日（近 7 天）、周（近 12 周）、月（近 12 月）、年（近 5 年）
 * - 自定义区间通过 Popover + 两个日期 input 选择
 * - 与 W15 useSpatialStore 协同：URL 唯一真源，store 派生，避免双重真源竞态
 */
import React, { useMemo, useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/Popover';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useSpatialTime } from './SpatialTimeContext';
import { useSpatialStoreActions } from '@/stores/useSpatialStore';
import { cn } from '@/utils/cn';

type PeriodType = 'day' | 'week' | 'month' | 'year' | 'custom';

interface TimeRangeSelectorProps {
  className?: string;
}

const PERIOD_TABS: Array<{ key: PeriodType; label: string }> = [
  { key: 'day', label: '日' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
  { key: 'year', label: '年' },
];

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeRange(period: PeriodType): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case 'day':
      start.setDate(end.getDate() - 6);
      break;
    case 'week':
      start.setDate(end.getDate() - 7 * 11);
      break;
    case 'month':
      start.setMonth(end.getMonth() - 11);
      start.setDate(1);
      break;
    case 'year':
      start.setFullYear(end.getFullYear() - 4);
      start.setMonth(0);
      start.setDate(1);
      break;
  }
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({ className }) => {
  const { query, setSpatialTime, resetSpatialTime } = useSpatialTime();
  // AR-4 facade: useSpatialStoreActions 等价封装 setTimeRange / reset，消费方可二选一
  const { setTimeRange, reset: resetFromStore } = useSpatialStoreActions();
  const [customOpen, setCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState(query.startDate || '');
  const [customEnd, setCustomEnd] = useState(query.endDate || '');

  const activePeriod = (query.periodType as PeriodType) || 'month';
  const isCustom = activePeriod === 'custom' || (!query.periodType && (query.startDate || query.endDate));

  const handleTabClick = (period: PeriodType) => {
    const { startDate, endDate } = computeRange(period);
    setSpatialTime({
      periodType: period,
      startDate,
      endDate,
    });
    setCustomOpen(false);
  };

  const handleCustomApply = () => {
    if (!customStart || !customEnd) return;
    setSpatialTime({
      periodType: 'custom',
      startDate: customStart,
      endDate: customEnd,
    });
    setCustomOpen(false);
  };

  const handleReset = () => {
    resetSpatialTime();
    setCustomOpen(false);
  };

  const rangeLabel = useMemo(() => {
    if (query.startDate && query.endDate) {
      return `${query.startDate} ~ ${query.endDate}`;
    }
    if (query.periodType) {
      const { startDate, endDate } = computeRange(query.periodType as PeriodType);
      return `${startDate} ~ ${endDate}`;
    }
    return '近 12 月';
  }, [query.startDate, query.endDate, query.periodType]);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="inline-flex rounded-lg border border-[#e5e7eb] overflow-hidden bg-white">
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTabClick(tab.key)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors border-r last:border-r-0 border-[#e5e7eb]',
              activePeriod === tab.key && !isCustom
                ? 'bg-[#3b82f6] text-white'
                : 'bg-white text-[#64748b] hover:bg-gray-50',
            )}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustomOpen((v) => !v)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium transition-colors',
            isCustom ? 'bg-[#3b82f6] text-white' : 'bg-white text-[#64748b] hover:bg-gray-50',
          )}
        >
          自定义
        </button>
      </div>

      <span className="text-xs text-[#64748b] tabular-nums hidden sm:inline">{rangeLabel}</span>

      {customOpen && (
        <Popover
          open={customOpen}
          onOpenChange={setCustomOpen}
        >
          <PopoverTrigger asChild>
            <span className="hidden" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[#0f172a]">
              <Calendar className="w-4 h-4" />
              自定义时间范围
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-[#64748b]">开始日期</label>
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-[#64748b]">结束日期</label>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setCustomOpen(false)}>
                取消
              </Button>
              <Button size="sm" onClick={handleCustomApply} disabled={!customStart || !customEnd}>
                应用
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {(query.startDate || query.periodType) && (
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-[#64748b] hover:text-[#0f172a] inline-flex items-center gap-1"
          title="清除时间筛选"
        >
          <X className="w-3 h-3" />清除
        </button>
      )}
    </div>
  );
};

export default TimeRangeSelector;
