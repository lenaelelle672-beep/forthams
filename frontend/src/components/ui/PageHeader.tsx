/**
 * @file components/ui/PageHeader.tsx
 * @description 页面标题区（标题 + 面包屑 + 操作按钮区）
 * 增加装饰线（左侧 3px 品牌色条）和渐变文字效果选项
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
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  className?: string;
  /** 启用渐变文字效果 */
  gradientTitle?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  description,
  breadcrumbs,
  actions,
  className,
  gradientTitle = false,
}: PageHeaderProps) {
  const supportingText = subtitle ?? description;

  return (
    <div
      className={cn(
        'relative mb-6 flex flex-col gap-4 overflow-hidden rounded-[var(--surface-radius-lg)] border border-[var(--surface-border)] bg-[linear-gradient(135deg,var(--surface-card-raised)_0%,var(--surface-card-muted)_100%)] p-5 shadow-[var(--shadow-card)] ring-1 ring-white/70',
        'before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-200/80 before:to-transparent',
        'sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      {/* 左侧装饰线 — 品牌色条 */}
      <div
        aria-hidden="true"
        className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full bg-gradient-to-b from-[var(--brand-primary)] via-[var(--brand-secondary)] to-[var(--brand-accent)]"
      />

      <div className="relative min-w-0 pl-4">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-[#94a3b8] mb-1.5">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="w-3 h-3" />}
                {crumb.href ? (
                  <a href={crumb.href} className="hover:text-[#1d4ed8] transition-colors">
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-[#64748b]">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
        {gradientTitle ? (
          <h1 className="text-2xl font-bold tracking-[-0.02em] bg-gradient-to-r from-[var(--brand-primary)] via-[var(--brand-secondary)] to-[var(--brand-accent)] bg-clip-text text-transparent">
            {title}
          </h1>
        ) : (
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-[var(--surface-heading)]">{title}</h1>
        )}
        {supportingText && (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--surface-muted-text)]">{supportingText}</p>
        )}
      </div>
      {actions && (
        <div className="relative flex flex-wrap items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-white/70 p-1.5 shadow-[var(--shadow-control)] sm:ml-6">{actions}</div>
      )}
    </div>
  );
}
