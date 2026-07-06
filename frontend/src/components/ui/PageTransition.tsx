/**
 * @file components/ui/PageTransition.tsx
 * @description 页面过渡动画组件 — 淡入 + 轻微上移
 * 纯 React + CSS transition 实现，无外部依赖
 */

import * as React from 'react';
import { cn } from '@/utils/cn';

export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={cn('transition-all duration-300 ease-out', className)}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(4px)',
      }}
    >
      {children}
    </div>
  );
}
