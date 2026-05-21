/**
 * ApprovalChain Component
 * 
 * 审批链可视化组件 - 展示线性三级审批链路
 * 支持状态流转显示、审批进度追踪、多级审批节点展示
 * 
 * @module ApprovalChain
 * @description SWARM-002 资产报废/退役流程 - 审批链可视化组件
 * @since 1.0.0
 * 
 * @see {@link https://wiki.ams.internal/swarms/swarm-002|SWARM-002 Specification}
 * 
 * @example
 * ```tsx
 * <ApprovalChain
 *   approvalSteps={[
 *     { level: 'L1', status: 'PENDING', approver: 'John Doe', createdAt: new Date() },
 *     { level: 'L2', status: 'PENDING', approver: null, createdAt: null },
 *     { level: 'L3', status: 'PENDING', approver: null, createdAt: null }
 *   ]}
 *   currentStatus="PENDING_APPROVAL_L1"
 *   requesterName="Alice"
 *   assetValue={75000}
 * />
 * ```
 */

import React from 'react';
import { Card, Badge, Avatar, Tooltip, Progress } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, UserOutlined, SafetyCertificateOutlined, CrownOutlined } from '@ant-design/icons';

/**
 * 审批层级枚举
 * 对应 SWARM-002 规格中的三级审批链路
 */
export enum ApprovalLevel {
  L1 = 'L1',
  L2 = 'L2',
  L3 = 'L3'
}

/**
 * 审批状态枚举
 */
export enum ApprovalStepStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SKIPPED = 'SKIPPED'
}

/**
 * 报废流程状态枚举
 * 对应状态机 6 状态流转
 */
export enum RetirementStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  PENDING_APPROVAL_L1 = 'PENDING_APPROVAL_L1',
  PENDING_APPROVAL_L2 = 'PENDING_APPROVAL_L2',
  PENDING_APPROVAL_L3 = 'PENDING_APPROVAL_L3',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  DISPOSED = 'DISPOSED'
}

/**
 * 审批步骤数据接口
 */
export interface ApprovalStep {
  /** 审批层级 */
  level: ApprovalLevel;
  /** 审批状态 */
  status: ApprovalStepStatus;
  /** 审批人名称 */
  approver?: string | null;
  /** 审批人ID */
  approverId?: string | null;
  /** 创建时间 */
  createdAt?: Date | null;
  /** 审批时间 */
  approvedAt?: Date | null;
  /** 审批意见 */
  comment?: string | null;
}

/**
 * 资产价值等级
 */
export enum AssetValueTier {
  LOW = 'LOW',      // < 10000
  MEDIUM = 'MEDIUM', // 10000 - 50000
  HIGH = 'HIGH'     // > 50000
}

/**
 * 计算资产价值等级
 * @param value - 资产价值
 * @returns 资产价值等级
 */
export function calculateAssetValueTier(value: number): AssetValueTier {
  if (value < 10000) return AssetValueTier.LOW;
  if (value <= 50000) return AssetValueTier.MEDIUM;
  return AssetValueTier.HIGH;
}

/**
 * 审批链组件属性接口
 */
export interface ApprovalChainProps {
  /** 审批步骤列表 */
  approvalSteps: ApprovalStep[];
  /** 当前流程状态 */
  currentStatus: RetirementStatus;
  /** 申请人名称 */
  requesterName?: string;
  /** 申请人ID */
  requesterId?: string;
  /** 资产价值（用于判断是否需要增强审批） */
  assetValue?: number;
  /** 当前用户ID（用于判断是否可审批） */
  currentUserId?: string;
  /** 是否显示增强审批标记 */
  showEnhancedApproval?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 审批链组件
 * 
 * 展示线性三级审批链路，支持状态流转显示、审批进度追踪
 * 
 * @param props - ApprovalChainProps
 * @returns React 组件
 * 
 * @performance 渲染性能优化，使用 React.memo 避免不必要的重渲染
 * @since 1.0.0
 */
const ApprovalChain: React.FC<ApprovalChainProps> = React.memo(({
  approvalSteps,
  currentStatus,
  requesterName,
  requesterId,
  assetValue,
  currentUserId,
  showEnhancedApproval = true,
  className
}) => {
  /**
   * 获取审批层级图标
   * @param level - 审批层级
   * @returns 图标组件
   */
  const getLevelIcon = (level: ApprovalLevel) => {
    switch (level) {
      case ApprovalLevel.L1:
        return <UserOutlined />;
      case ApprovalLevel.L2:
        return <SafetyCertificateOutlined />;
      case ApprovalLevel.L3:
        return <CrownOutlined />;
      default:
        return <UserOutlined />;
    }
  };

  /**
   * 获取审批状态图标
   * @param status - 审批状态
   * @returns 图标组件
   */
  const getStatusIcon = (status: ApprovalStepStatus) => {
    switch (status) {
      case ApprovalStepStatus.APPROVED:
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case ApprovalStepStatus.REJECTED:
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case ApprovalStepStatus.PENDING:
        return <ClockCircleOutlined style={{ color: '#faad14' }} />;
      case ApprovalStepStatus.SKIPPED:
        return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#faad14' }} />;
    }
  };

  /**
   * 获取审批状态徽章颜色
   * @param status - 审批状态
   * @returns 颜色字符串
   */
  const getStatusColor = (status: ApprovalStepStatus): string => {
    switch (status) {
      case ApprovalStepStatus.APPROVED:
        return 'success';
      case ApprovalStepStatus.REJECTED:
        return 'error';
      case ApprovalStepStatus.PENDING:
        return 'warning';
      case ApprovalStepStatus.SKIPPED:
        return 'default';
      default:
        return 'default';
    }
  };

  /**
   * 获取审批层级标签
   * @param level - 审批层级
   * @returns 标签文本
   */
  const getLevelLabel = (level: ApprovalLevel): string => {
    switch (level) {
      case ApprovalLevel.L1:
        return '一级审批';
      case ApprovalLevel.L2:
        return '二级审批';
      case ApprovalLevel.L3:
        return '三级审批';
      default:
        return '未知审批';
    }
  };

  /**
   * 获取审批角色名称
   * @param level - 审批层级
   * @returns 角色名称
   */
  const getApproverRoleName = (level: ApprovalLevel): string => {
    switch (level) {
      case ApprovalLevel.L1:
        return '资产管理员 L1';
      case ApprovalLevel.L2:
        return '资产管理员 L2';
      case ApprovalLevel.L3:
        return '管理员';
      default:
        return '未知角色';
    }
  };

  /**
   * 判断是否为当前激活的审批节点
   * @param level - 审批层级
   * @returns 是否激活
   */
  const isActiveStep = (level: ApprovalLevel): boolean => {
    switch (level) {
      case ApprovalLevel.L1:
        return currentStatus === RetirementStatus.PENDING_APPROVAL_L1;
      case ApprovalLevel.L2:
        return currentStatus === RetirementStatus.PENDING_APPROVAL_L2;
      case ApprovalLevel.L3:
        return currentStatus === RetirementStatus.PENDING_APPROVAL_L3;
      default:
        return false;
    }
  };

  /**
   * 计算审批进度百分比
   * @returns 进度百分比
   */
  const calculateProgress = (): number => {
    const totalSteps = approvalSteps.length;
    const approvedSteps = approvalSteps.filter(
      step => step.status === ApprovalStepStatus.APPROVED
    ).length;
    return Math.round((approvedSteps / totalSteps) * 100);
  };

  /**
   * 格式化日期时间
   * @param date - 日期对象
   * @returns 格式化字符串
   */
  const formatDateTime = (date: Date | null | undefined): string => {
    if (!date) return '-';
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * 判断是否为高价值资产（>50000）
   * @returns 是否高价值
   */
  const isHighValueAsset = (): boolean => {
    if (!assetValue) return false;
    return assetValue > 50000;
  };

  /**
   * 判断是否显示增强审批提示
   * @returns 是否显示
   */
  const shouldShowEnhancedApproval = (): boolean => {
    return showEnhancedApproval && isHighValueAsset();
  };

  /**
   * 获取增强审批提示文本
   * @returns 提示文本
   */
  const getEnhancedApprovalText = (): string => {
    if (isHighValueAsset()) {
      return `高价值资产（¥${assetValue?.toLocaleString()}），需强化审批流程`;
    }
    return '';
  };

  /**
   * 渲染单个审批步骤
   * @param step - 审批步骤数据
   * @param index - 步骤索引
   * @returns React 节点
   */
  const renderApprovalStep = (step: ApprovalStep, index: number) => {
    const isActive = isActiveStep(step.level);
    const isCompleted = step.status === ApprovalStepStatus.APPROVED;
    const isRejected = step.status === ApprovalStepStatus.REJECTED;

    return (
      <div
        key={step.level}
        className={`approval-step ${isActive ? 'approval-step--active' : ''} ${isCompleted ? 'approval-step--completed' : ''} ${isRejected ? 'approval-step--rejected' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          marginBottom: index < approvalSteps.length - 1 ? 24 : 0,
          position: 'relative'
        }}
      >
        {/* 连接线 */}
        {index < approvalSteps.length - 1 && (
          <div
            style={{
              position: 'absolute',
              left: 20,
              top: 40,
              width: 2,
              height: 24,
              backgroundColor: isCompleted ? '#52c41a' : '#d9d9d9'
            }}
          />
        )}

        {/* 状态图标 */}
        <Tooltip title={step.status}>
          <Avatar
            size={40}
            icon={getLevelIcon(step.level)}
            style={{
              backgroundColor: isActive ? '#1890ff' : isCompleted ? '#52c41a' : isRejected ? '#ff4d4f' : '#d9d9d9',
              flexShrink: 0
            }}
          />
        </Tooltip>

        {/* 步骤信息 */}
        <div style={{ marginLeft: 12, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 500 }}>{getLevelLabel(step.level)}</span>
            {getStatusIcon(step.status)}
            <Badge status={getStatusColor(step.status) as any} text={step.status} />
            {isActive && <Badge status="processing" text="待审批" />}
          </div>

          <div style={{ marginTop: 4, color: '#666', fontSize: 12 }}>
            <span>角色: {getApproverRoleName(step.level)}</span>
          </div>

          <div style={{ marginTop: 4, fontSize: 13 }}>
            {step.approver ? (
              <span>审批人: {step.approver}</span>
            ) : (
              <span style={{ color: '#999' }}>待指派</span>
            )}
          </div>

          <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
            <span>
              {step.approvedAt
                ? `审批时间: ${formatDateTime(step.approvedAt)}`
                : step.createdAt
                  ? `创建时间: ${formatDateTime(step.createdAt)}`
                  : ''}
            </span>
          </div>

          {step.comment && (
            <div style={{ marginTop: 8, padding: 8, backgroundColor: '#ffffff', borderRadius: 4, fontSize: 12 }}>
              <strong>审批意见:</strong> {step.comment}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card
      className={`approval-chain ${className || ''}`}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>审批链路</span>
          {shouldShowEnhancedApproval() && (
            <Badge count="增强审批" style={{ backgroundColor: '#ff4d4f' }} />
          )}
        </div>
      }
      extra={
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: '#999' }}>
            申请人: {requesterName || '未知'}
          </span>
        </div>
      }
    >
      {/* 增强审批提示 */}
      {shouldShowEnhancedApproval() && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            backgroundColor: '#fff2e8',
            border: '1px solid #ffbb96',
            borderRadius: 4,
            fontSize: 13,
            color: '#ad6800'
          }}
        >
          <CrownOutlined style={{ marginRight: 8 }} />
          {getEnhancedApprovalText()}
        </div>
      )}

      {/* 进度条 */}
      <Progress
        percent={calculateProgress()}
        status={currentStatus === RetirementStatus.REJECTED ? 'exception' : 'active'}
        strokeColor={currentStatus === RetirementStatus.REJECTED ? '#ff4d4f' : '#52c41a'}
        style={{ marginBottom: 24 }}
      />

      {/* 当前状态 */}
      <div style={{ marginBottom: 16 }}>
        <Badge
          status={
            currentStatus === RetirementStatus.APPROVED || currentStatus === RetirementStatus.DISPOSED
              ? 'success'
              : currentStatus === RetirementStatus.REJECTED
                ? 'error'
                : 'processing'
          }
          text={
            <span style={{ fontWeight: 500 }}>
              当前状态: {
                currentStatus === RetirementStatus.DRAFT ? '草稿'
                : currentStatus === RetirementStatus.SUBMITTED ? '已提交'
                : currentStatus === RetirementStatus.PENDING_APPROVAL_L1 ? '待一级审批'
                : currentStatus === RetirementStatus.PENDING_APPROVAL_L2 ? '待二级审批'
                : currentStatus === RetirementStatus.PENDING_APPROVAL_L3 ? '待三级审批'
                : currentStatus === RetirementStatus.APPROVED ? '已批准'
                : currentStatus === RetirementStatus.REJECTED ? '已拒绝'
                : currentStatus === RetirementStatus.DISPOSED ? '已退役'
                : '未知'
              }
            </span>
          }
        />
      </div>

      {/* 审批步骤列表 */}
      <div className="approval-steps">
        {approvalSteps.map((step, index) => renderApprovalStep(step, index))}
      </div>

      {/* 状态流转说明 */}
      <div style={{ marginTop: 24, padding: 12, backgroundColor: '#f8fafc', borderRadius: 4 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
          <strong>状态流转规则:</strong>
        </div>
        <div style={{ fontSize: 11, color: '#999', lineHeight: 1.8 }}>
          <div>DRAFT → SUBMITTED → PENDING_L1 → PENDING_L2 → PENDING_L3 → APPROVED → DISPOSED</div>
          <div style={{ marginTop: 4 }}>
            <span style={{ color: '#ff4d4f' }}>注意: </span>
            任一审批节点拒绝(REJECTED)将终止整个流程
          </div>
        </div>
      </div>

      {/* 错误码提示 */}
      <div style={{ marginTop: 12, fontSize: 11, color: '#999' }}>
        <div>UNAUTHORIZED_APPROVER (403): 未授权审批人</div>
        <div>ALREADY_APPROVED (409): 已审批</div>
        <div>SELF_APPROVAL_FORBIDDEN (403): 禁止自审批</div>
      </div>
    </Card>
  );
});

/**
 * 导出审批链组件
 */
export default ApprovalChain;

/**
 * 导出类型和枚举供外部使用
 */
export type { ApprovalChainProps, ApprovalStep };
export { ApprovalLevel, ApprovalStepStatus, RetirementStatus, AssetValueTier };
export { calculateAssetValueTier };