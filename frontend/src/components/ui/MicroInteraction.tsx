/**
 * @file components/ui/MicroInteraction.tsx
 * @description 微交互组件集
 * - MagneticWrapper: 磁性吸附效果（鼠标靠近时元素微微偏移）
 * - BouncePress: 弹性按压效果
 * - SpringReveal: 弹性出现动画（stagger children）
 * - ParallaxFloat: 视差浮动效果
 * - ScaleOnHover: 悬浮微放大
 * 都使用 motion spring 配置，尊重 prefers-reduced-motion
 */

import * as React from 'react';
import { motion, type HTMLMotionProps, useReducedMotion } from 'motion/react';
import { cn } from '@/utils/cn';

/* ── spring 默认配置 ── */
const SPRING_CONFIG = { type: 'spring' as const, stiffness: 300, damping: 24, mass: 0.8 };
const SPRING_GENTLE = { type: 'spring' as const, stiffness: 200, damping: 28, mass: 1 };

/* ── MagneticWrapper ── */
export interface MagneticWrapperProps extends HTMLMotionProps<'div'> {
  /** 磁力强度（px 偏移量），默认 12 */
  strength?: number;
}

export function MagneticWrapper({
  children,
  strength = 12,
  className,
  ...props
}: MagneticWrapperProps) {
  const prefersReducedMotion = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent) => {
      if (prefersReducedMotion || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distX = e.clientX - centerX;
      const distY = e.clientY - centerY;
      const factor = Math.min(1, Math.sqrt(distX * distX + distY * distY) / 150);
      setPosition({
        x: (distX / (rect.width / 2)) * strength * factor,
        y: (distY / (rect.height / 2)) * strength * factor,
      });
    },
    [strength, prefersReducedMotion],
  );

  const handleMouseLeave = React.useCallback(() => {
    setPosition({ x: 0, y: 0 });
  }, []);

  return (
    <motion.div
      ref={ref}
      className={cn('block', className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={SPRING_GENTLE}
      style={{ willChange: prefersReducedMotion ? 'auto' : 'transform' }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ── BouncePress ── */
export interface BouncePressProps extends HTMLMotionProps<'div'> {
  /** 按压缩放比例，默认 0.95 */
  scale?: number;
}

export function BouncePress({
  children,
  scale = 0.95,
  className,
  ...props
}: BouncePressProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={cn('cursor-pointer', className)}
      whileTap={prefersReducedMotion ? undefined : { scale }}
      transition={SPRING_CONFIG}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ── SpringReveal ── */
export interface SpringRevealProps {
  children: React.ReactNode;
  className?: string;
  /** 每个子元素延迟增量（ms），默认 60 */
  staggerDelay?: number;
  /** 是否在可见时触发 */
  once?: boolean;
}

export function SpringReveal({
  children,
  className,
  staggerDelay = 60,
  once = true,
}: SpringRevealProps) {
  const prefersReducedMotion = useReducedMotion();
  const childrenArray = React.Children.toArray(children);

  return (
    <div className={className}>
      {childrenArray.map((child, i) => (
        <motion.div
          key={i}
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={
            prefersReducedMotion
              ? undefined
              : { opacity: 1, y: 0 }
          }
          viewport={{ once }}
          transition={{
            ...SPRING_CONFIG,
            delay: i * staggerDelay * 0.001,
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

/* ── ParallaxFloat ── */
export interface ParallaxFloatProps {
  children: React.ReactNode;
  className?: string;
  /** 浮动幅度（px），默认 10 */
  amplitude?: number;
  /** 浮动周期（s），默认 3 */
  duration?: number;
}

export function ParallaxFloat({
  children,
  className,
  amplitude = 10,
  duration = 3,
}: ParallaxFloatProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={cn('inline-flex', className)}
      animate={{
        y: [0, -amplitude, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
}

/* ── ScaleOnHover ── */
export interface ScaleOnHoverProps extends HTMLMotionProps<'div'> {
  /** hover 放大比例，默认 1.03 */
  scale?: number;
}

export function ScaleOnHover({
  children,
  scale = 1.03,
  className,
  ...props
}: ScaleOnHoverProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={cn('block', className)}
      whileHover={prefersReducedMotion ? undefined : { scale }}
      transition={SPRING_CONFIG}
      {...props}
    >
      {children}
    </motion.div>
  );
}
