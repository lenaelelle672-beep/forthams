/**
 * @file components/ui/Card.tsx
 * @description 企业级卡片组件 — 支持 default / stat / media / action / glass 变体
 * 遵循 forthAMS Design System：品牌色 token、差异化阴影和圆角、hover 微动效
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const cardVariants = cva(
  // base
  'group/card relative border transition-[border-color,box-shadow,transform,background-color] duration-200 ease-out motion-reduce:transition-none',
  {
    variants: {
      variant: {
        default:
          'border-[var(--surface-border)] rounded-[var(--surface-radius)] bg-[color:var(--surface-card-raised)] shadow-[var(--shadow-card)] ring-1 ring-white/70 hover:border-[var(--surface-border-strong)] hover:shadow-[var(--shadow-card-hover)]',
        stat: [
          'border-l-[3px] border-l-[var(--brand-primary)] rounded-[var(--radius-md)]',
          'bg-[color:var(--surface-card-raised)] shadow-[var(--shadow-card)]',
          'hover:shadow-[var(--shadow-card-hover)] hover:scale-[1.02]',
          'motion-reduce:hover:scale-100',
          'p-6',
        ].join(' '),
        media: [
          'rounded-[var(--radius-md)] overflow-hidden',
          'border-[var(--surface-border-subtle)] bg-white',
          'shadow-[0_2px_8px_rgba(0,0,0,0.04)]',
          'hover:shadow-[var(--shadow-card-hover)]',
        ].join(' '),
        action: [
          'rounded-[var(--surface-radius)] border-[var(--surface-border)]',
          'bg-[color:var(--surface-card-raised)] shadow-[var(--shadow-card)]',
          'hover:shadow-[var(--shadow-floating)] hover:-translate-y-1',
          'motion-reduce:hover:translate-y-0',
          'cursor-pointer',
        ].join(' '),
        glass: [
          'rounded-[var(--radius-lg)]',
          'bg-white/70 backdrop-blur-xl border-white/30',
          'dark:bg-slate-900/70 dark:border-white/10',
          'shadow-[0_8px_32px_rgba(0,0,0,0.06)]',
          'hover:bg-white/80 hover:shadow-[0_12px_40px_rgba(0,0,0,0.1)]',
          'dark:hover:bg-slate-900/80',
        ].join(' '),
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="card"
      className={cn(cardVariants({ variant, className }))}
      {...props}
    >
      {children}
    </div>
  );
});

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex items-center justify-between gap-3 border-b border-[var(--surface-line)] bg-gradient-to-r from-white to-[var(--surface-card-muted)]/70 px-5 py-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-base font-semibold tracking-tight text-[var(--surface-heading)]', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm leading-6 text-[var(--surface-muted-text)]', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="card-content" className={cn('p-5 text-[#1f2937]', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center border-t border-[var(--surface-line)] bg-[color:var(--surface-card-muted)]/80 px-5 py-3', className)}
      {...props}
    >
      {children}
    </div>
  );
}
