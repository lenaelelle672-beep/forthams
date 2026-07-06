/**
 * @file components/ThemeToggle.tsx
 * @description 三态主题切换按钮 — light → dark → system 循环切换
 *
 * 使用 Sun / Moon / Monitor 图标指示当前模式，
 * 点击按 light → dark → system 顺序循环。
 */

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/utils/cn';

/** 各模式对应的图标和提示文字 */
const MODE_CONFIG = {
  light: { icon: Sun, label: '亮色模式', next: '切换到深色模式', nextMode: 'dark' as const },
  dark:  { icon: Moon, label: '深色模式', next: '切换到跟随系统', nextMode: 'system' as const },
  system: { icon: Monitor, label: '跟随系统', next: '切换到亮色模式', nextMode: 'light' as const },
} as const;

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { mode, setMode } = useTheme();
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  const handleClick = () => {
    setMode(config.nextMode);
  };

  return (
    <button
      onClick={handleClick}
      aria-label={config.next}
      title={`${config.label}（点击${config.next}）`}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-xl',
        'text-slate-500 transition-colors duration-200',
        'hover:bg-slate-100 hover:text-slate-700',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200',
        'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
        'dark:focus-visible:ring-blue-800',
        className,
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
