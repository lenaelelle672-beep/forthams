/**
 * @file components/ui/ErrorState.tsx
 * @description 统一错误状态占位组件
 * 支持：错误标题、描述、重试按钮
 */

import * as React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = '加载失败',
  description = '数据加载出现异常，请稍后重试',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7 text-red-500" />
      </div>
      <h3 className="text-base font-medium text-[#374151] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[#94a3b8] max-w-sm mb-4">{description}</p>
      )}
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="md">
          <RefreshCw className="w-4 h-4 mr-1.5" />
          重试
        </Button>
      )}
    </div>
  );
}
