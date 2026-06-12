/**
 * @file components/ui/Input.tsx
 * @description 统一输入框组件
 */

import * as React from 'react';
import { cn } from '@/utils/cn';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, prefix, suffix, id, ...props }, ref) => {
    const inputId = id || React.useId();
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#374151]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefix && (
            <span className="absolute left-3 text-[#94a3b8] flex items-center">{prefix}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full h-9 rounded-lg border text-sm bg-white transition-all placeholder:text-[#94a3b8]',
              'focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]',
              error ? 'border-red-300 focus:ring-red-200' : 'border-[#e5e7eb]',
              prefix && 'pl-9',
              suffix && 'pr-9',
              !prefix && !suffix && 'px-3',
              className,
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 text-[#94a3b8] flex items-center">{suffix}</span>
          )}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-[#94a3b8]">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';
