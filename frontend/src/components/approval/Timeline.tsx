/**
 * Timeline Component - 审批时间线展示组件
 * 
 * 用于工单详情页展示完整的审批历史时间线
 * 支持展示提交、通过、驳回等多种审批动作
 * 
 * @package frontend/src/components/approval
 */

import React from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/** 审批动作类型枚举 */
export enum ApprovalAction {
  SUBMIT = 'submit',
  APPROVE = 'approve',
  REJECT = 'reject',
  RESUBMIT = 'resubmit',
}

/** 时间线节点数据模型 */
export interface TimelineNode {
  /** 节点唯一标识 */
  id: string;
  /** 审批动作类型 */
  action: ApprovalAction;
  /** 操作人 ID */
  operatorId: number;
  /** 操作人姓名 */
  operatorName: string;
  /** 操作时间 */
  operatedAt: Date;
  /** 审批意见/备注 */
  comment?: string;
  /** 驳回原因（仅驳回时） */
  rejectionReason?: string;
  /** 是否为当前状态节点 */
  isCurrent?: boolean;
}

/** Timeline 组件 Props */
export interface TimelineProps {
  /** 时间线节点列表 */
  nodes: TimelineNode[];
  /** 是否加载中 */
  loading?: boolean;
  /** 空状态文案 */
  emptyText?: string;
  /** 自定义类名 */
  className?: string;
}

/** 动作类型到中文描述的映射 */
const ACTION_LABELS: Record<ApprovalAction, string> = {
  [ApprovalAction.SUBMIT]: '提交',
  [ApprovalAction.APPROVE]: '通过',
  [ApprovalAction.REJECT]: '驳回',
  [ApprovalAction.RESUBMIT]: '重新提交',
};

/** 动作类型对应的图标样式类名 */
const ACTION_ICONS: Record<ApprovalAction, string> = {
  [ApprovalAction.SUBMIT]: 'text-blue-500',
  [ApprovalAction.APPROVE]: 'text-green-500',
  [ApprovalAction.REJECT]: 'text-red-500',
  [ApprovalAction.RESUBMIT]: 'text-yellow-500',
};

/**
 * 审批时间线组件
 * 
 * @param props - TimelineProps
 * @returns React.ReactElement
 */
export const Timeline: React.FC<TimelineProps> = ({
  nodes,
  loading = false,
  emptyText = '暂无审批记录',
  className = '',
}) => {
  /**
   * 格式化操作时间
   * @param date - Date 对象
   * @returns 格式化后的时间字符串
   */
  const formatDate = (date: Date): string => {
    return format(new Date(date), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
  };

  /**
   * 获取动作标签
   * @param action - 动作类型
   * @returns 中文标签
   */
  const getActionLabel = (action: ApprovalAction): string => {
    return ACTION_LABELS[action] || action;
  };

  /**
   * 获取动作图标类名
   * @param action - 动作类型
   * @returns CSS 类名字符串
   */
  const getActionIconClass = (action: ApprovalAction): string => {
    return ACTION_ICONS[action] || 'text-gray-500';
  };

  /**
   * 渲染单个时间线节点
   * @param node - 时间线节点数据
   * @param index - 节点索引
   * @returns React.ReactElement
   */
  const renderNode = (node: TimelineNode, index: number): React.ReactElement => {
    const isLast = index === nodes.length - 1;
    
    return (
      <div 
        key={node.id} 
        className="timeline-node relative pl-8 pb-6"
        data-testid="timeline-node"
      >
        {/* 连接线 */}
        {!isLast && (
          <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-gray-200" />
        )}
        
        {/* 节点圆点 */}
        <div 
          className={`absolute left-0 top-1 w-6 h-6 rounded-full border-2 border-white 
            ${getActionIconClass(node.action)} bg-current flex items-center justify-center
            ${node.isCurrent ? 'ring-2 ring-offset-2 ring-current' : ''}`}
        >
          <span className="text-white text-xs font-bold">
            {getActionLabel(node.action).charAt(0)}
          </span>
        </div>

        {/* 节点内容 */}
        <div className="ml-4">
          <div className="flex items-center gap-2 mb-1">
            <span 
              className="font-medium text-gray-900"
              data-testid="action"
            >
              {getActionLabel(node.action)}
            </span>
            {node.isCurrent && (
              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                当前状态
              </span>
            )}
          </div>
          
          <div className="text-sm text-gray-600">
            <span data-testid="operator">{node.operatorName}</span>
            <span className="mx-2">·</span>
            <span data-testid="time">{formatDate(node.operatedAt)}</span>
          </div>

          {/* 审批意见 */}
          {node.comment && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
              <span className="text-gray-500">意见：</span>
              {node.comment}
            </div>
          )}

          {/* 驳回原因 */}
          {node.rejectionReason && (
            <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
              <span className="font-medium">驳回原因：</span>
              {node.rejectionReason}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 加载状态
  if (loading) {
    return (
      <div className={`timeline-loading ${className}`} data-testid="timeline-loading">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded" />
          <div className="h-12 bg-gray-200 rounded" />
          <div className="h-12 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  // 空状态
  if (!nodes || nodes.length === 0) {
    return (
      <div 
        className={`timeline-empty text-center py-8 text-gray-500 ${className}`}
        data-testid="timeline-empty"
      >
        {emptyText}
      </div>
    );
  }

  // 时间线主体
  return (
    <div 
      className={`timeline-container ${className}`}
      data-testid="approval-timeline"
    >
      {nodes.map((node, index) => renderNode(node, index))}
    </div>
  );
};

/**
 * 获取审批时间线的反向顺序（最新在前）
 * @param nodes - 原始节点列表
 * @returns 反转后的节点列表
 */
export const getReversedTimeline = (nodes: TimelineNode[]): TimelineNode[] => {
  return [...nodes].reverse();
};

/**
 * 获取指定动作类型的时间线节点
 * @param nodes - 节点列表
 * @param action - 审批动作类型
 * @returns 匹配的节点列表
 */
export const filterTimelineByAction = (
  nodes: TimelineNode[], 
  action: ApprovalAction
): TimelineNode[] => {
  return nodes.filter(node => node.action === action);
};

export default Timeline;