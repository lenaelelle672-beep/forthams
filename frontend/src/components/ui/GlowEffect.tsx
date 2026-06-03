/**
 * @file components/ui/GlowEffect.tsx
 * @description 流光效果组件 — CSS 渐变动画 + 边框发光 + 呼吸动画
 * 支持 color / intensity / animated 等 props，使用 motion AnimatePresence
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/utils/cn';

export interface GlowEffectProps {
  /** 光晕颜色，默认品牌蓝 */
  color?: string;
  /** 光晕强度 0-1，默认 0.6 */
  intensity?: number;
  /** 是否启用动画 */
  animated?: boolean;
  /** 动画模式：pulse 脉冲 | breathe 呼吸 | shimmer 流光 */
  mode?: 'pulse' | 'breathe' | 'shimmer';
  /** 子元素 */
  children: React.ReactNode;
  className?: string;
}

export function GlowEffect({
  color = 'rgba(29, 78, 216',
  intensity = 0.6,
  animated = true,
  mode = 'pulse',
  children,
  className,
}: GlowEffectProps) {
  const glowColor = `${color}, ${intensity})`;
  const glowColorMid = `${color}, ${intensity * 0.5})`;
  const glowColorWeak = `${color}, ${intensity * 0.2})`;

  const pulseKeyframes = {
    boxShadow: [
      `0 0 8px ${glowColorWeak}, 0 0 20px ${glowColorWeak}`,
      `0 0 16px ${glowColor}, 0 0 40px ${glowColorMid}`,
      `0 0 8px ${glowColorWeak}, 0 0 20px ${glowColorWeak}`,
    ],
  };

  const breatheKeyframes = {
    opacity: [0.6, 1, 0.6],
    scale: [1, 1.02, 1],
  };

  const shimmerStyle = {
    background: `linear-gradient(90deg, transparent 0%, ${glowColorMid} 50%, transparent 100%)`,
    backgroundSize: '200% 100%',
  };

  return (
    <AnimatePresence>
      <div className={cn('relative block', className)}>
        {mode === 'shimmer' ? (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={shimmerStyle}
            animate={
              animated
                ? {
                    backgroundPosition: ['200% center', '-200% center'],
                  }
                : undefined
            }
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ) : (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-[2px] rounded-[inherit]"
            style={{ opacity: 0 }}
            animate={
              animated
                ? mode === 'pulse'
                  ? pulseKeyframes
                  : breatheKeyframes
                : undefined
            }
            transition={{
              duration: mode === 'pulse' ? 2 : 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
        {children}
      </div>
    </AnimatePresence>
  );
}

/**
 * GlowBorder — 边框发光装饰组件
 * 用于包裹任意元素，添加持续或 hover 触发的发光边框
 */
export interface GlowBorderProps {
  color?: string;
  intensity?: number;
  hoverOnly?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function GlowBorder({
  color = 'rgba(29, 78, 216',
  intensity = 0.5,
  hoverOnly = false,
  children,
  className,
}: GlowBorderProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const showGlow = hoverOnly ? isHovered : true;

  return (
    <div
      className={cn('relative rounded-[inherit]', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence>
        {showGlow && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-[1px] rounded-[inherit]"
            style={{
              border: `1px solid ${color}, ${intensity * 0.8})`,
              boxShadow: `0 0 12px ${color}, ${intensity * 0.3})`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}
