/**
 * StatusBadge Component - 资产报废/退役流程状态展示组件
 * 
 * @description 用于展示资产报废请求的当前状态，支持多级审批状态流转可视化
 * @module components/StatusBadge
 * @since 1.0.0
 * 
 * @see {@link https://spec.example.com/SWARM-002|SWARM-002 资产报废/退役流程规格}
 * 
 * 支持的状态类型:
 * - DRAFT: 草稿状态（初始状态）
 * - SUBMITTED: 已提交待审批
 * - PENDING_APPROVAL_L1: 一级审批中
 * - PENDING_APPROVAL_L2: 二级审批中
 * - PENDING_APPROVAL_L3: 三级审批中
 * - APPROVED: 审批通过
 * - REJECTED: 审批拒绝
 * - DISPOSED: 已退役完成
 * 
 * ATB 覆盖率:
 * - ATB-005-01: 查询当前进度
 * - ATB-005-02: 进度可视化数据结构
 * - ATB-005-03: 已完成请求进度
 * - ATB-005-04: 被拒绝请求进度
 */

import React from 'react';
import { cn } from '@/utils/cn';

/**
 * 资产报废流程状态枚举
 * @since 1.0.0
 */
export type RetirementStatus = 
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_APPROVAL_L1'
  | 'PENDING_APPROVAL_L2'
  | 'PENDING_APPROVAL_L3'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISPOSED';

/**
 * 进度追踪数据结构
 * @since 1.0.0
 */
export interface ProgressInfo {
  current_step: number;
  total_steps: number;
  pending_approvers: string[];
  progress_status: 'PENDING' | 'COMPLETED' | 'REJECTED';
}

/**
 * StatusBadge 组件属性
 * @since 1.0.0
 */
export interface StatusBadgeProps {
  /** 当前状态值 */
  status: RetirementStatus | string | undefined | null;
  /** 是否显示进度指示器 */
  showProgress?: boolean;
  /** 进度信息（可选） */
  progressInfo?: ProgressInfo;
  /** 自定义类名 */
  className?: string;
  /** 是否显示状态描述 */
  showLabel?: boolean;
  /** 资产ID（用于 Graphify 知识图谱关联） */
  assetId?: string;
}

/**
 * 状态配置映射表
 * @since 1.0.0
 */
const STATUS_CONFIG: Record<RetirementStatus, {
  label: string;
  color: 'default' | 'blue' | 'yellow' | 'green' | 'red' | 'purple';
  icon: string;
  bgClass: string;
  textClass: string;
}> = {
  DRAFT: {
    label: '草稿',
    color: 'default',
    icon: '📝',
    bgClass: 'bg-blue-50',
    textClass: 'text-gray-700',
  },
  SUBMITTED: {
    label: '已提交',
    color: 'blue',
    icon: '📤',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
  },
  PENDING_APPROVAL_L1: {
    label: '一级审批中',
    color: 'yellow',
    icon: '⏳',
    bgClass: 'bg-yellow-100',
    textClass: 'text-yellow-700',
  },
  PENDING_APPROVAL_L2: {
    label: '二级审批中',
    color: 'yellow',
    icon: '⏳',
    bgClass: 'bg-yellow-100',
    textClass: 'text-yellow-700',
  },
  PENDING_APPROVAL_L3: {
    label: '三级审批中',
    color: 'yellow',
    icon: '⏳',
    bgClass: 'bg-yellow-100',
    textClass: 'text-yellow-700',
  },
  APPROVED: {
    label: '已通过',
    color: 'green',
    icon: '✅',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
  },
  REJECTED: {
    label: '已拒绝',
    color: 'red',
    icon: '❌',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
  },
  DISPOSED: {
    label: '已退役',
    color: 'purple',
    icon: '🗑️',
    bgClass: 'bg-purple-100',
    textClass: 'text-purple-700',
  },
};

/**
 * 获取审批级别描述
 * @since 1.0.0
 * @param status - 当前状态
 * @returns 审批级别描述
 */
function getApprovalLevel(status: RetirementStatus | string | undefined | null): string {
  // ATB-BC-001, ATB-BC-002: 防御性检查 - 处理空值和 undefined 输入
  if (!status || typeof status !== 'string') {
    return '';
  }

  const statusUpper = status.toUpperCase();
  
  if (statusUpper.includes('L1')) {
    return '一级审批';
  } else if (statusUpper.includes('L2')) {
    return '二级审批';
  } else if (statusUpper.includes('L3')) {
    return '三级审批';
  }
  
  return '';
}

/**
 * 获取状态配置
 * @since 1.0.0
 * @performance 时间复杂度 O(1)，空间复杂度 O(1)
 * @param status - 当前状态
 * @returns 状态配置对象
 */
function getStatusConfig(status: RetirementStatus | string | undefined | null): typeof STATUS_CONFIG['DRAFT'] {
  // ATB-BC-001: 防御性检查 - 处理空值和 undefined 输入
  if (!status || typeof status !== 'string') {
    return STATUS_CONFIG['DRAFT'];
  }

  // ATB-BC-002: 防御性检查 - 处理未知状态
  const statusUpper = status.toUpperCase() as RetirementStatus;
  return STATUS_CONFIG[statusUpper] || STATUS_CONFIG['DRAFT'];
}

/**
 * 验证进度信息
 * @since 1.0.0
 * @performance 时间复杂度 O(1)，空间复杂度 O(1)
 * @param progressInfo - 进度信息对象
 * @returns 是否有效
 */
function validateProgressInfo(progressInfo: ProgressInfo | undefined | null): progressInfo is ProgressInfo {
  // ATB-BC-001: 防御性检查 - 处理空值和 undefined 输入
  if (!progressInfo || typeof progressInfo !== 'object') {
    return false;
  }

  // ATB-BC-003: 验证必需字段
  const { current_step, total_steps, pending_approvers, progress_status } = progressInfo;
  
  if (typeof current_step !== 'number' || typeof total_steps !== 'number') {
    return false;
  }
  
  if (!Array.isArray(pending_approvers)) {
    return false;
  }
  
  if (!['PENDING', 'COMPLETED', 'REJECTED'].includes(progress_status)) {
    return false;
  }
  
  return true;
}

/**
 * StatusBadge Component
 * 
 * 用于展示资产报废请求的当前状态，支持多级审批状态流转可视化
 * 
 * @example
 * ```tsx
 * <StatusBadge status="PENDING_APPROVAL_L1" />
 * <StatusBadge status="APPROVED" showProgress progressInfo={progressData} />
 * ```
 * 
 * @since 1.0.0
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showProgress = false,
  progressInfo,
  className,
  showLabel = true,
  assetId,
}) => {
  // ATB-BC-001: 防御性检查 - 处理空值和 undefined 输入
  const config = getStatusConfig(status);
  const approvalLevel = getApprovalLevel(status);

  // ATB-005-02: 进度可视化数据结构验证
  const isValidProgress = showProgress && validateProgressInfo(progressInfo);

  // Graphify 知识图谱关联节点 ID
  const graphifyNodeId = assetId ? `asset-${assetId}` : undefined;

  return (
    <div className={cn('inline-flex flex-col gap-1', className)}>
      {/* ATB-005-01: 查询当前进度 - 状态徽章 */}
      <div
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
          config.bgClass,
          config.textClass
        )}
        // Graphify 知识图谱节点关联属性
        data-graphify-node-id={graphifyNodeId}
        data-graphify-node-type="retirement_status"
        data-status={status}
      >
        <span className="text-base">{config.icon}</span>
        {showLabel && (
          <span className="whitespace-nowrap">
            {approvalLevel || config.label}
          </span>
        )}
      </div>

      {/* ATB-005-02: 进度可视化数据结构 */}
      {showProgress && isValidProgress && progressInfo && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {/* 当前步骤指示 */}
          <span className="font-medium">
            {progressInfo.current_step}/{progressInfo.total_steps}
          </span>
          
          {/* 进度条 */}
          <div className="flex-1 h-1.5 bg-blue-50 rounded-full overflow-hidden min-w-16">
            <div
              className={cn(
                'h-full transition-all duration-300',
                progressInfo.progress_status === 'REJECTED' ? 'bg-red-500' :
                progressInfo.progress_status === 'COMPLETED' ? 'bg-green-500' : 'bg-yellow-500'
              )}
              style={{
                width: `${(progressInfo.current_step / progressInfo.total_steps) * 100}%`
              }}
            />
          </div>

          {/* 待审批人提示 */}
          {progressInfo.progress_status === 'PENDING' && progressInfo.pending_approvers.length > 0 && (
            <span className="text-yellow-600">
              等待: {progressInfo.pending_approvers.join(', ')}
            </span>
          )}

          {/* ATB-005-03: 已完成请求进度 */}
          {progressInfo.progress_status === 'COMPLETED' && (
            <span className="text-green-600">已完成</span>
          )}

          {/* ATB-005-04: 被拒绝请求进度 */}
          {progressInfo.progress_status === 'REJECTED' && (
            <span className="text-red-600">已拒绝</span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 快捷函数：创建进度信息对象
 * @since 1.0.0
 * @performance 时间复杂度 O(1)，空间复杂度 O(1)
 * @param currentStep - 当前步骤
 * @param totalSteps - 总步骤数
 * @param pendingApprovers - 待审批人列表
 * @param status - 进度状态
 * @returns ProgressInfo 对象
 */
export function createProgressInfo(
  currentStep: number,
  totalSteps: number,
  pendingApprovers: string[] = [],
  status: 'PENDING' | 'COMPLETED' | 'REJECTED' = 'PENDING'
): ProgressInfo {
  // ATB-BC-001: 防御性检查 - 处理空数组
  const validApprovers = Array.isArray(pendingApprovers) ? pendingApprovers : [];
  
  return {
    current_step: Math.max(0, currentStep),
    total_steps: Math.max(1, totalSteps),
    pending_approvers: validApprovers,
    progress_status: status,
  };
}

/**
 * 快捷函数：根据状态获取进度步骤数
 * @since 1.0.0
 * @performance 时间复杂度 O(1)，空间复杂度 O(1)
 * @param status - 当前状态
 * @returns 对应的步骤数
 */
export function getStepFromStatus(status: RetirementStatus | string | undefined | null): number {
  // ATB-BC-001: 防御性检查 - 处理空值和 undefined 输入
  if (!status || typeof status !== 'string') {
    return 0;
  }

  const statusUpper = status.toUpperCase();
  
  switch (statusUpper) {
    case 'SUBMITTED':
      return 0;
    case 'PENDING_APPROVAL_L1':
      return 1;
    case 'PENDING_APPROVAL_L2':
      return 2;
    case 'PENDING_APPROVAL_L3':
      return 3;
    case 'APPROVED':
    case 'REJECTED':
      return statusUpper === 'APPROVED' ? 3 : 0;
    case 'DISPOSED':
      return 4;
    default:
      return 0;
  }
}

/**
 * 快捷函数：获取总步骤数
 * @since 1.0.0
 * @constant
 */
export const TOTAL_APPROVAL_STEPS = 3;

/**
 * 导出组件和工具函数
 * @since 1.0.0
 */
export default StatusBadge;
