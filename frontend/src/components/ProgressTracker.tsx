/**
 * ProgressTracker Component
 * 资产报废流程进度追踪组件
 * 
 * 用于展示资产报废/退役流程中的各阶段进度状态
 * 支持状态: DRAFT -> PENDING_APPROVAL -> APPROVED -> IN_RETIREMENT -> RETIRED
 * 
 * @component
 * @example
 * <ProgressTracker
 *   currentStatus="PENDING_APPROVAL"
 *   stages={['创建申请', '审批中', '已批准', '执行退役', '已完成']}
 *   onStageClick={(stage) => console.log(stage)}
 * />
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './ProgressTracker.css';

export interface StageConfig {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'pending' | 'error';
  timestamp?: string;
  operator?: string;
}

export interface ProgressTrackerProps {
  /** 当前状态 */
  currentStatus: string;
  /** 阶段配置列表 */
  stages: StageConfig[];
  /** 阶段点击回调 */
  onStageClick?: (stage: StageConfig) => void;
  /** 是否显示时间戳 */
  showTimestamp?: boolean;
  /** 是否显示操作人 */
  showOperator?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 状态映射到阶段索引
 * 资产报废流程状态流转:
 * - DRAFT: 0 (草稿)
 * - PENDING_APPROVAL: 1 (待审批)
 * - APPROVED: 2 (已批准)
 * - IN_RETIREMENT: 3 (执行退役中)
 * - RETIRED: 4 (已完成)
 */
const STATUS_TO_INDEX: Record<string, number> = {
  'DRAFT': 0,
  'PENDING_APPROVAL': 1,
  'APPROVED': 2,
  'IN_RETIREMENT': 3,
  'RETIRED': 4,
  // 兼容旧状态
  'ACTIVE': 0,
  'PENDING_RETIRE': 1,
  'IN_USE': 0,
};

/**
 * 获取状态对应的阶段索引
 * @param status - 当前状态
 * @returns 阶段索引
 */
export function getStatusStageIndex(status: string): number {
  return STATUS_TO_INDEX[status] ?? 0;
}

/**
 * 获取状态对应的样式类名
 * @param status - 当前状态
 * @returns CSS类名
 */
export function getStatusClassName(status: string): string {
  const classMap: Record<string, string> = {
    'DRAFT': 'status-draft',
    'PENDING_APPROVAL': 'status-pending',
    'APPROVED': 'status-approved',
    'IN_RETIREMENT': 'status-in-progress',
    'RETIRED': 'status-completed',
    'ACTIVE': 'status-active',
    'PENDING_RETIRE': 'status-pending-retire',
    'IN_USE': 'status-in-use',
    'REJECTED': 'status-rejected',
  };
  return classMap[status] ?? 'status-default';
}

/**
 * ProgressTracker 组件
 * 展示资产报废流程的进度追踪
 */
export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  currentStatus,
  stages,
  onStageClick,
  showTimestamp = true,
  showOperator = false,
  className = '',
}) => {
  const { t } = useTranslation();
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);

  // 计算当前阶段的索引
  const currentIndex = getStatusStageIndex(currentStatus);

  /**
   * 处理阶段点击事件
   * @param stage - 被点击的阶段配置
   */
  const handleStageClick = useCallback((stage: StageConfig) => {
    if (onStageClick && stage.status !== 'pending') {
      onStageClick(stage);
    }
  }, [onStageClick]);

  /**
   * 获取阶段样式类名
   * @param stage - 阶段配置
   * @param index - 阶段索引
   * @returns CSS类名字符串
   */
  const getStageClassName = (stage: StageConfig, index: number): string => {
    const classes = ['progress-stage'];
    
    if (stage.status === 'completed') {
      classes.push('stage-completed');
    } else if (stage.status === 'current') {
      classes.push('stage-current');
    } else if (stage.status === 'error') {
      classes.push('stage-error');
    } else {
      classes.push('stage-pending');
    }

    // 添加已完成的连接线类名
    if (index < currentIndex) {
      classes.push('stage-connected');
    }

    return classes.join(' ');
  };

  /**
   * 渲染阶段节点
   * @param stage - 阶段配置
   * @param index - 阶段索引
   * @returns React节点
   */
  const renderStageNode = (stage: StageConfig, index: number): React.ReactNode => {
    const nodeClass = getStageClassName(stage, index);
    
    return (
      <div 
        key={stage.id}
        className={`${nodeClass} ${className}`}
        onClick={() => handleStageClick(stage)}
        onMouseEnter={() => setHoveredStage(stage.id)}
        onMouseLeave={() => setHoveredStage(null)}
        data-testid={`progress-stage-${stage.id}`}
        role="button"
        tabIndex={stage.status !== 'pending' ? 0 : -1}
        aria-label={`${stage.label}: ${t(`retirement.status.${stage.status}`)}`}
      >
        {/* 阶段圆点 */}
        <div className="stage-node">
          {stage.status === 'completed' && (
            <svg className="check-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
            </svg>
          )}
          {stage.status === 'error' && (
            <svg className="error-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
            </svg>
          )}
          {stage.status === 'current' && (
            <div className="pulse-dot" />
          )}
        </div>

        {/* 连接线 */}
        {index < stages.length - 1 && (
          <div className={`stage-connector ${index < currentIndex ? 'connector-completed' : ''}`} />
        )}

        {/* 阶段信息 */}
        <div className="stage-info">
          <span className="stage-label">{stage.label}</span>
          
          {showTimestamp && stage.timestamp && (
            <span className="stage-timestamp">{stage.timestamp}</span>
          )}
          
          {showOperator && stage.operator && (
            <span className="stage-operator">{stage.operator}</span>
          )}

          {/* 工具提示 */}
          {hoveredStage === stage.id && (
            <div className="stage-tooltip">
              <span className="tooltip-status">{t(`retirement.status.${stage.status}`)}</span>
              {stage.timestamp && (
                <span className="tooltip-time">{stage.timestamp}</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div 
      className="progress-tracker-container"
      data-testid="progress-tracker"
      role="progressbar"
      aria-valuenow={currentIndex}
      aria-valuemin={0}
      aria-valuemax={stages.length - 1}
      aria-label={`${t('retirement.progress.current')}: ${t(`retirement.status.${currentStatus}`)}`}
    >
      <div className="progress-tracker">
        {stages.map((stage, index) => renderStageNode(stage, index))}
      </div>
      
      {/* 进度百分比 */}
      <div className="progress-percentage">
        {Math.round((currentIndex / (stages.length - 1)) * 100)}%
      </div>
    </div>
  );
};

/**
 * 快捷组件: 资产报废流程进度条
 * 使用默认的报废流程阶段配置
 */
export const RetirementProgressTracker: React.FC<{
  currentStatus: string;
  onStageClick?: (stage: StageConfig) => void;
}> = ({ currentStatus, onStageClick }) => {
  const { t } = useTranslation();
  
  const defaultStages: StageConfig[] = [
    { id: 'draft', label: t('retirement.stages.draft'), status: 'pending' },
    { id: 'approval', label: t('retirement.stages.approval'), status: 'pending' },
    { id: 'approved', label: t('retirement.stages.approved'), status: 'pending' },
    { id: 'executing', label: t('retirement.stages.executing'), status: 'pending' },
    { id: 'completed', label: t('retirement.stages.completed'), status: 'pending' },
  ];

  // 根据当前状态更新阶段状态
  const currentIndex = getStatusStageIndex(currentStatus);
  const updatedStages = defaultStages.map((stage, index) => {
    let status: StageConfig['status'] = 'pending';
    
    if (index < currentIndex) {
      status = 'completed';
    } else if (index === currentIndex) {
      status = 'current';
    }

    return { ...stage, status };
  });

  return (
    <ProgressTracker
      currentStatus={currentStatus}
      stages={updatedStages}
      onStageClick={onStageClick}
      showTimestamp={true}
      showOperator={true}
    />
  );
};

export default ProgressTracker;