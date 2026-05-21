/**
 * @file components/ui/PageHeader.tsx
 * @description 页面标题区（标题 + 面包屑 + 操作按钮区）
 */

import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between mb-6', className)}>
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-[#94a3b8] mb-1.5">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="w-3 h-3" />}
                {crumb.href ? (
                  <a href={crumb.href} className="hover:text-[#3b82f6] transition-colors">
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-[#64748b]">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
        <h1 className="text-2xl font-semibold text-[#0f172a]">{title}</h1>
        {subtitle && (
          <p className="text-sm text-[#64748b] mt-1">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 ml-6">{actions}</div>
      )}
    </div>
  );
}
