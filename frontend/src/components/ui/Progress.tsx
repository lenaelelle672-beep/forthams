/**
 * @file components/ui/Progress.tsx
 * @description Progress 进度条组件 — Radix UI Progress 原生封装
 */

import * as React from 'react';
import * as RadixProgress from '@radix-ui/react-progress';
import { cn } from '@/utils/cn';

export interface ProgressProps extends React.ComponentPropsWithoutRef<typeof RadixProgress.Root> {
  value?: number;
  max?: number;
}

export const Progress = React.forwardRef<React.ElementRef<typeof RadixProgress.Root>, ProgressProps>(
  ({ className, value = 0, max = 100, ...props }, ref) => {
    const pct = Math.min(Math.max((value / max) * 100, 0), 100);
    return (
      <RadixProgress.Root
        ref={ref}
        className={cn('relative h-2 w-full overflow-hidden rounded-full bg-[#f1f5f9]', className)}
        value={value}
        max={max}
        {...props}
      >
        <RadixProgress.Indicator
          className="h-full w-full flex-1 rounded-full bg-[#3b82f6] transition-all duration-300 ease-in-out"
          style={{ transform: `translateX(-${100 - pct}%)` }}
        />
      </RadixProgress.Root>
    );
  },
);
Progress.displayName = 'Progress';
