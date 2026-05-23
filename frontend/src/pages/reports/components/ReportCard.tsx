/**
 * @file pages/reports/components/ReportCard.tsx
 * @description 报表卡片组件 — 展示报表图标、标题、描述、更新日期
 * 遵循 forthAMS Design System 设计令牌
 */

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Card } from '@/components/ui/Card';

export interface ReportCardData {
  /** 报表唯一标识 */
  id: string;
  /** 报表图标 */
  icon: LucideIcon;
  /** 报表标题 */
  title: string;
  /** 报表描述 */
  description: string;
  /** 最近更新日期 */
  updatedAt: string;
  /** 所属分类 */
  category: string;
  /** 图表类型（用于 ChartPreview） */
  chartType?: 'bar' | 'pie' | 'area' | 'table';
}

interface ReportCardProps {
  report: ReportCardData;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ReportCard({ report, selected, onClick, className }: ReportCardProps) {
  const { icon: Icon, title, description, updatedAt } = report;

  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-all duration-200 hover:shadow-md',
        selected && 'ring-2 ring-[#3b82f6] border-blue-200',
        className,
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-[#3b82f6]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#0f172a] truncate">{title}</h3>
          <p className="text-xs text-[#64748b] mt-1 line-clamp-2">{description}</p>
          <p className="text-[10px] text-[#94a3b8] mt-2">
            更新于 {updatedAt}
          </p>
        </div>
      </div>
    </Card>
  );
}
