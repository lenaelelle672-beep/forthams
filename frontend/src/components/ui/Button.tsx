/**
 * @file components/ui/Button.tsx
 * @description 企业级按钮组件
 * 4 个 variant：primary / secondary / ghost / destructive
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

export const buttonVariants = cva(
  // base
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-[#3b82f6] text-white shadow-sm shadow-blue-500/20 hover:bg-[#2563eb]',
        secondary:
          'bg-[#f1f5f9] text-[#374151] hover:bg-[#e2e8f0] border border-[#e5e7eb]',
        ghost:
          'text-[#374151] hover:bg-[#f1f5f9] hover:text-[#0f172a]',
        destructive:
          'bg-[#ef4444] text-white hover:bg-[#dc2626] shadow-sm shadow-red-500/20',
        outline:
          'border border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f8fafc]',
      },
      size: {
        sm:   'h-7  px-3   text-xs',
        md:   'h-8  px-4',
        lg:   'h-10 px-6',
        icon: 'h-8  w-8  p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size:    'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {loading && (
          <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current" />
        )}
        {children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
