/**
 * @file pages/report/components/ReportCard.tsx
 * @description 预定义报表卡片组件
 *
 * 每个卡片展示一个报表模板：标题、描述、最后更新时间、操作按钮。
 */
import * as React from 'react';

import { Eye, Download } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export interface ReportCardProps {
  /** 报表标题 */
  title: string;
  /** 报表描述 */
  description: string;
  /** 最后更新时间 */
  lastUpdated: string;
  /** 图标 */
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  /** 图标颜色 */
  iconColor?: string;
  /** 查看回调 */
  onView?: () => void;
  /** 导出回调 */
  onExport?: () => void;
  className?: string;
}

export function ReportCard({
  title,
  description,
  lastUpdated,
  icon: Icon,
  iconColor = '#3b82f6',
  onView,
  onExport,
  className,
}: ReportCardProps) {
  return (
    <Card className={cn('transition-shadow hover:shadow-md', className)}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {Icon && (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ backgroundColor: `${iconColor}15` }}
            >
              <Icon className="w-5 h-5" style={{ color: iconColor }} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-[#0f172a] mb-1">{title}</h4>
            <p className="text-xs text-[#64748b] leading-relaxed line-clamp-2">{description}</p>
            <p className="text-[11px] text-[#94a3b8] mt-2">
              更新于 {lastUpdated}
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="px-5 py-3 border-t border-[#edf2f7] flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onView}
          className="gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" />
          查看
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          className="gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          导出
        </Button>
      </CardFooter>
    </Card>
  );
}
