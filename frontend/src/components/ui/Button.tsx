/**
 * @file components/ui/Button.tsx
 * @description 企业级按钮组件
 * 5 个 variant：primary / secondary / ghost / destructive / outline
 * 使用 motion 添加 press 弹性动画
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'motion/react';
import { cn } from '@/utils/cn';

export const buttonVariants = cva(
  // base
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold tracking-[-0.01em] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--surface-ring)] focus-visible:shadow-[var(--shadow-focus)] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none',
  {
    variants: {
      variant: {
        default:
          'bg-[#1d4ed8] text-white shadow-sm shadow-blue-500/25 hover:bg-[#1e40af] hover:shadow-md hover:shadow-blue-500/25',
        primary:
          'bg-[#1d4ed8] text-white shadow-sm shadow-blue-500/20 hover:bg-[#1e40af] hover:shadow-md hover:shadow-blue-500/20',
        secondary:
          'border border-[var(--surface-border)] bg-[color:var(--surface-card-muted)] text-[#374151] shadow-[var(--shadow-control)] hover:border-[var(--surface-border-strong)] hover:bg-[var(--surface-active)]',
        ghost:
          'text-[#374151] hover:bg-[#f1f5f9] hover:text-[#0f172a] hover:shadow-sm',
        destructive:
          'bg-[#ef4444] text-white shadow-sm shadow-red-500/20 hover:bg-[#dc2626] hover:shadow-md hover:shadow-red-500/20',
        outline:
          'border-2 border-[var(--surface-border)] bg-white text-[#374151] shadow-[var(--shadow-control)] hover:border-[#1d4ed8] hover:bg-[var(--surface-hover)] hover:text-[#1d4ed8]',
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
  /** 禁用动画（默认启用 press 弹性效果） */
  disableAnimation?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, disableAnimation, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const classes = cn(buttonVariants({ variant, size, className }));

    if (asChild) {
      return (
        <Comp
          ref={ref}
          disabled={disabled || loading}
          className={classes}
          {...props}
        >
          {loading && (
            <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current motion-reduce:animate-none" />
          )}
          {children}
        </Comp>
      );
    }

    return (
      <motion.button
        ref={ref}
        disabled={disabled || loading}
        className={classes}
        whileTap={disableAnimation ? undefined : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        {...(props as unknown as React.ComponentProps<typeof motion.button>)}
      >
        {loading && (
          <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current motion-reduce:animate-none" />
        )}
        {children}
      </motion.button>
    );
  },
);
Button.displayName = 'Button';
