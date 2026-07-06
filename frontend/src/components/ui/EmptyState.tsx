/**
 * @file components/ui/EmptyState.tsx
 * @description 统一空数据占位组件
 * 支持多场景变体（default/asset/approval/inventory），含进入动画
 */

import * as React from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { Inbox, Package, ClipboardCheck, ScanLine } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from './Button';

type EmptyStateVariant = 'default' | 'asset' | 'approval' | 'inventory';

interface VariantConfig {
  icon: LucideIcon;
  title: string;
  description: string;
  iconBg: string;
  iconColor: string;
}

const VARIANT_MAP: Record<EmptyStateVariant, VariantConfig> = {
  default: {
    icon: Inbox,
    title: '暂无数据',
    description: '当前没有可显示的数据',
    iconBg: 'bg-[#f1f5f9]',
    iconColor: 'text-[#94a3b8]',
  },
  asset: {
    icon: Package,
    title: '暂无资产',
    description: '未找到符合条件的资产记录，请调整筛选条件或新建资产',
    iconBg: 'bg-blue-50',
    iconColor: 'text-[#1d4ed8]',
  },
  approval: {
    icon: ClipboardCheck,
    title: '暂无审批',
    description: '当前没有待处理的审批事项',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  inventory: {
    icon: ScanLine,
    title: '暂无盘点记录',
    description: '尚未创建盘点任务，点击下方按钮开始',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
};

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  /** 场景变体 */
  variant?: EmptyStateVariant;
}

export function EmptyState({
  icon: customIcon,
  title: customTitle,
  description: customDescription,
  action,
  className,
  variant = 'default',
}: EmptyStateProps) {
  const config = VARIANT_MAP[variant];
  const Icon = customIcon ?? config.icon;
  const title = customTitle ?? config.title;
  const description = customDescription ?? config.description;

  return (
    <motion.div
      className={cn('flex flex-col items-center justify-center py-16 text-center', className)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div
        className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center mb-4',
          config.iconBg,
        )}
      >
        <Icon className={cn('w-7 h-7', config.iconColor)} />
      </div>
      <h3 className="text-base font-medium text-[#374151] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[#94a3b8] max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} size="md">
          {action.label}
        </Button>
      )}
    </motion.div>
  );
}
