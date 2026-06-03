/**
 * @file components/ui/MagicCard.tsx
 * @description 魔玻璃卡片组件 — 磨砂玻璃效果 + 边框微光 + hover 流光动画
 * 使用 motion 实现流畅动效，支持 glass/glow/gradient 三种变体
 */

import * as React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const magicCardVariants = cva(
  'relative overflow-hidden rounded-[var(--radius-lg)] border transition-colors',
  {
    variants: {
      variant: {
        glass: [
          'bg-white/70 backdrop-blur-xl border-white/20',
          'dark:bg-slate-900/70 dark:border-white/10',
          'shadow-[0_8px_32px_rgba(0,0,0,0.06)]',
        ].join(' '),
        glow: [
          'bg-white border-[var(--brand-primary)]/20',
          'dark:bg-slate-900 dark:border-[var(--brand-primary)]/30',
          'shadow-[0_0_20px_rgba(29,78,216,0.08)]',
        ].join(' '),
        gradient: [
          'text-white border-transparent',
          'bg-gradient-to-br from-[var(--brand-primary)] via-[var(--brand-secondary)] to-[var(--brand-accent)]',
          'shadow-[0_8px_32px_rgba(29,78,216,0.2)]',
        ].join(' '),
      },
      size: {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'glass',
      size: 'md',
    },
  },
);

export interface MagicCardProps
  extends HTMLMotionProps<'div'>,
    VariantProps<typeof magicCardVariants> {
  /** 是否显示流光动画 */
  shimmer?: boolean;
  /** 自定义光晕颜色（仅 glow 变体有效） */
  glowColor?: string;
}

export const MagicCard = React.forwardRef<HTMLDivElement, MagicCardProps>(
  function MagicCard(
    { className, variant, size, shimmer = false, glowColor, children, ...props },
    ref,
  ) {
    const [isHovered, setIsHovered] = React.useState(false);

    return (
      <motion.div
        ref={ref}
        className={cn(magicCardVariants({ variant, size, className }))}
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 24,
          mass: 0.8,
        }}
        {...props}
      >
        {/* 顶部光泽线 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-60"
        />

        {/* 微光效果 */}
        {variant === 'glow' && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-[100%] rounded-full"
            style={{
              background: glowColor
                ? `radial-gradient(circle at 50% 50%, ${glowColor}40, transparent 60%)`
                : 'radial-gradient(circle at 50% 50%, rgba(29,78,216,0.15), transparent 60%)',
            }}
            animate={{
              opacity: isHovered ? 1 : 0,
              scale: isHovered ? 1.2 : 1,
            }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        )}

        {/* 流光动画 */}
        {shimmer && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
            }}
            animate={
              isHovered
                ? { backgroundPosition: ['200% center', '-200% center'] }
                : { backgroundPosition: '200% center' }
            }
            transition={{
              duration: 1.2,
              repeat: isHovered ? Infinity : 0,
              ease: 'linear',
            }}
          />
        )}

        {/* 内容 */}
        <div className="relative z-10">{children as React.ReactNode}</div>

        {/* gradient 变体的暗色叠加 */}
        {variant === 'gradient' && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black/10"
          />
        )}
      </motion.div>
    );
  },
);

MagicCard.displayName = 'MagicCard';
