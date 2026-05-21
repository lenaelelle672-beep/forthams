/**
 * @file RetirementRouter.tsx
 * @description 资产退役流程路由配置
 * 
 * 功能模块：
 * - 资产退役申请列表
 * - 退役申请详情与创建
 * - 审批流程页面
 * - 状态机流转控制
 * 
 * @SWARM-502 资产报废/退役流程
 */

import React, { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRetirementPermissions } from '@/app/composables/useApprovalPermission';
import RetirementListPage from './RetirementListPage';
import RetirementDetailPage from './RetirementDetailPage';
import RetirementApprovalPage from './RetirementApprovalPage';

/**
 * 资产退役状态枚举
 * 对应状态机状态定义
 */
export enum RetirementStatus {
  /** 草稿状态 - 可编辑 */
  DRAFT = 'DRAFT',
  /** 待审批状态 - 等待审批人处理 */
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  /** 已批准状态 - 审批通过待执行 */
  APPROVED = 'APPROVED',
  /** 已驳回状态 - 审批未通过 */
  REJECTED = 'REJECTED',
  /** 已撤回状态 - 用户主动撤回 */
  CANCELLED = 'CANCELLED',
  /** 已退役状态 - 流程完结 */
  RETIRED = 'RETIRED',
}

/**
 * 状态转换事件枚举
 * 定义所有合法的状态转换触发事件
 */
export enum RetirementEvent {
  /** 提交申请 */
  SUBMIT = 'SUBMIT',
  /** 批准申请 */
  APPROVE = 'APPROVE',
  /** 驳回申请 */
  REJECT = 'REJECT',
  /** 撤回申请 */
  WITHDRAW = 'WITHDRAW',
  /** 执行退役 */
  EXECUTE = 'EXECUTE',
  /** 修订重提 */
  REVISE = 'REVISE',
}

/**
 * 状态转换规则映射表
 * 定义状态机的转换规则
 */
export const RETIREMENT_STATE_TRANSITIONS: Record<RetirementStatus, {
  allowedEvents: RetirementEvent[];
  nextStatus: Partial<Record<RetirementEvent, RetirementStatus>>;
}> = {
  [RetirementStatus.DRAFT]: {
    allowedEvents: [RetirementEvent.SUBMIT, RetirementEvent.WITHDRAW],
    nextStatus: {
      [RetirementEvent.SUBMIT]: RetirementStatus.PENDING_APPROVAL,
      [RetirementEvent.WITHDRAW]: RetirementStatus.CANCELLED,
    },
  },
  [RetirementStatus.PENDING_APPROVAL]: {
    allowedEvents: [RetirementEvent.APPROVE, RetirementEvent.REJECT, RetirementEvent.WITHDRAW],
    nextStatus: {
      [RetirementEvent.APPROVE]: RetirementStatus.APPROVED,
      [RetirementEvent.REJECT]: RetirementStatus.REJECTED,
      [RetirementEvent.WITHDRAW]: RetirementStatus.CANCELLED,
    },
  },
  [RetirementStatus.APPROVED]: {
    allowedEvents: [RetirementEvent.EXECUTE],
    nextStatus: {
      [RetirementEvent.EXECUTE]: RetirementStatus.RETIRED,
    },
  },
  [RetirementStatus.REJECTED]: {
    allowedEvents: [RetirementEvent.REVISE],
    nextStatus: {
      [RetirementEvent.REVISE]: RetirementStatus.DRAFT,
    },
  },
  [RetirementStatus.CANCELLED]: {
    allowedEvents: [],
    nextStatus: {},
  },
  [RetirementStatus.RETIRED]: {
    allowedEvents: [],
    nextStatus: {},
  },
};

/**
 * 状态显示配置
 * 用于UI展示
 */
export const STATUS_DISPLAY_CONFIG: Record<RetirementStatus, {
  labelKey: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
  [RetirementStatus.DRAFT]: {
    labelKey: 'retirement.status.draft',
    color: 'text-gray-500',
    bgColor: 'bg-blue-50',
    icon: 'edit',
  },
  [RetirementStatus.PENDING_APPROVAL]: {
    labelKey: 'retirement.status.pending',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    icon: 'clock',
  },
  [RetirementStatus.APPROVED]: {
    labelKey: 'retirement.status.approved',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: 'check',
  },
  [RetirementStatus.REJECTED]: {
    labelKey: 'retirement.status.rejected',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: 'x',
  },
  [RetirementStatus.CANCELLED]: {
    labelKey: 'retirement.status.cancelled',
    color: 'text-gray-400',
    bgColor: 'bg-blue-50',
    icon: 'minus',
  },
  [RetirementStatus.RETIRED]: {
    labelKey: 'retirement.status.retired',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: 'archive',
  },
};

/**
 * 检查是否允许特定状态转换
 * @param currentStatus 当前状态
 * @param event 转换事件
 * @returns 是否允许转换
 */
export function canTransition(
  currentStatus: RetirementStatus,
  event: RetirementEvent
): boolean {
  const transitions = RETIREMENT_STATE_TRANSITIONS[currentStatus];
  return transitions?.allowedEvents.includes(event) ?? false;
}

/**
 * 获取状态转换后的目标状态
 * @param currentStatus 当前状态
 * @param event 转换事件
 * @returns 目标状态，如果不允许转换则返回null
 */
export function getNextStatus(
  currentStatus: RetirementStatus,
  event: RetirementEvent
): RetirementStatus | null {
  const transitions = RETIREMENT_STATE_TRANSITIONS[currentStatus];
  return transitions?.nextStatus[event] ?? null;
}

/**
 * 资产退役流程路由组件
 * 提供完整的路由配置和权限控制
 * 
 * @example
 * ```tsx
 * <RetirementRouter />
 * ```
 */
const RetirementRouter: React.FC = () => {
  const { t } = useTranslation();
  const { 
    canViewList, 
    canCreate, 
    canApprove,
    canExecute 
  } = useRetirementPermissions();

  /**
   * 路由配置
   * 根据用户权限动态生成路由
   */
  const routeConfig = useMemo(() => ({
    list: {
      path: '/retirement',
      component: RetirementListPage,
      requiredPermissions: ['retirement:view'],
    },
    detail: {
      path: '/retirement/:id',
      component: RetirementDetailPage,
      requiredPermissions: ['retirement:view'],
    },
    create: {
      path: '/retirement/create/:assetId?',
      component: RetirementDetailPage,
      requiredPermissions: ['retirement:create'],
    },
    approval: {
      path: '/retirement/:id/approval',
      component: RetirementApprovalPage,
      requiredPermissions: ['retirement:approve'],
    },
  }), []);

  /**
   * 状态机帮助函数
   * 用于在组件中执行状态转换
   */
  const stateMachineHelpers = useMemo(() => ({
    isDraft: (status: RetirementStatus) => status === RetirementStatus.DRAFT,
    isPending: (status: RetirementStatus) => status === RetirementStatus.PENDING_APPROVAL,
    isApproved: (status: RetirementStatus) => status === RetirementStatus.APPROVED,
    isRetired: (status: RetirementStatus) => status === RetirementStatus.RETIRED,
    isCancelled: (status: RetirementStatus) => status === RetirementStatus.CANCELLED,
    isRejected: (status: RetirementStatus) => status === RetirementStatus.REJECTED,
    
    /** 是否可以提交 */
    canSubmit: (status: RetirementStatus) => canTransition(status, RetirementEvent.SUBMIT),
    /** 是否可以批准 */
    canApprove: (status: RetirementStatus) => canTransition(status, RetirementEvent.APPROVE),
    /** 是否可以驳回 */
    canReject: (status: RetirementStatus) => canTransition(status, RetirementEvent.REJECT),
    /** 是否可以撤回 */
    canWithdraw: (status: RetirementStatus) => canTransition(status, RetirementEvent.WITHDRAW),
    /** 是否可以执行退役 */
    canExecuteRetirement: (status: RetirementStatus) => canTransition(status, RetirementEvent.EXECUTE),
    /** 是否可以修订重提 */
    canRevise: (status: RetirementStatus) => canTransition(status, RetirementEvent.REVISE),
  }), []);

  return (
    <Routes>
      {/* 退役申请列表 */}
      <Route
        index
        element={
          canViewList ? (
            <RetirementListPage />
          ) : (
            <Navigate to="/unauthorized" replace />
          )
        }
      />

      {/* 创建退役申请 */}
      <Route
        path="create"
        element={
          canCreate ? (
            <RetirementDetailPage mode="create" />
          ) : (
            <Navigate to="/unauthorized" replace />
          )
        }
      />

      {/* 退役申请详情 */}
      <Route
        path=":id"
        element={
          canViewList ? (
            <RetirementDetailPage mode="view" />
          ) : (
            <Navigate to="/unauthorized" replace />
          )
        }
      />

      {/* 审批页面 */}
      <Route
        path=":id/approval"
        element={
          canApprove ? (
            <RetirementApprovalPage />
          ) : (
            <Navigate to="/unauthorized" replace />
          )
        }
      />
    </Routes>
  );
};

export default RetirementRouter;

// 导出状态机和常量供其他模块使用
export {
  RetirementStatus,
  RetirementEvent,
  RETIREMENT_STATE_TRANSITIONS,
  STATUS_DISPLAY_CONFIG,
  canTransition,
  getNextStatus,
};