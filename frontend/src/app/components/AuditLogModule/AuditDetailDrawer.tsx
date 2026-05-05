/**
 * AuditDetailDrawer Component
 * 
 * 审计详情抽屉组件 - 用于展示资产变更的完整审计轨迹信息
 * 
 * 功能特性:
 * - 展示审计记录的完整变更明细
 * - 高亮标记 @Auditable 注解的字段变更
 * - 支持变更前后的对比展示
 * - 可折叠展开的变更详情
 * 
 * @module AuditLogModule
 * @category Components
 * @subcategory Audit
 * 
 * @example
 * ```tsx
 * <AuditDetailDrawer
 *   auditLog={selectedAuditLog}
 *   open={isDrawerOpen}
 *   onClose={handleClose}
 * />
 * ```
 */

import React, { useState, useCallback } from 'react';
import { Drawer, Badge, Tag, Descriptions, Collapse, Timeline, Typography, Tooltip } from 'antd';
import {
  CloseOutlined,
  UserOutlined,
  ClockCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  EyeOutlined,
  ExportOutlined,
  InfoCircleOutlined,
  CheckCircleFilled,
  WarningFilled
} from '@ant-design/icons';
import type { DescriptionsProps } from 'antd';
import type { CollapseProps } from 'antd';
import type { AuditLog, FieldChange } from '../../types/audit.types';
import styles from './AuditDetailDrawer.module.css';

const { Text, Title, Paragraph } = Typography;
const { Panel } = Collapse;

/**
 * 操作类型到图标和颜色的映射
 */
const OPERATION_CONFIG = {
  CREATE: { icon: <PlusOutlined />, color: '#52c41a', label: '创建' },
  UPDATE: { icon: <EditOutlined />, color: '#1890ff', label: '更新' },
  DELETE: { icon: <DeleteOutlined />, color: '#ff4d4f', label: '删除' },
  VIEW: { icon: <EyeOutlined />, color: '#8c8c8c', label: '查看' },
  EXPORT: { icon: <ExportOutlined />, color: '#722ed1', label: '导出' }
} as const;

/**
 * 获取操作类型配置
 */
const getOperationConfig = (operation: string) => {
  return OPERATION_CONFIG[operation as keyof typeof OPERATION_CONFIG] || {
    icon: <InfoCircleOutlined />,
    color: '#8c8c8c',
    label: operation
  };
};

/**
 * 判断字段是否为 @Auditable 标记字段
 */
const isAuditableField = (change: FieldChange): boolean => {
  return change.auditable === true;
};

/**
 * 格式化时间戳
 */
const formatTimestamp = (timestamp: string | Date): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

/**
 * 字段变化描述项属性
 */
interface FieldChangeItemProps {
  change: FieldChange;
}

/**
 * 字段变化描述组件
 * 展示单个字段的变更前后对比
 */
const FieldChangeItem: React.FC<FieldChangeItemProps> = ({ change }) => {
  const isAuditable = isAuditableField(change);
  
  return (
    <div 
      className={`${styles.fieldChangeItem} ${isAuditable ? styles.auditableHighlight : ''}`}
      data-auditable={isAuditable}
    >
      <div className={styles.fieldHeader}>
        <Text strong className={styles.fieldName}>
          {change.field}
        </Text>
        {isAuditable && (
          <Tooltip title="此字段变更将被审计追踪">
            <Badge 
              count="审计字段" 
              style={{ backgroundColor: '#faad14' }}
              size="small"
            />
          </Tooltip>
        )}
      </div>
      <div className={styles.fieldValues}>
        <div className={styles.valueBox}>
          <Text type="secondary" className={styles.valueLabel}>变更前</Text>
          <Text delete className={styles.oldValue}>
            {change.oldValue ?? '(空)'}
          </Text>
        </div>
        <div className={styles.arrow}>→</div>
        <div className={styles.valueBox}>
          <Text type="secondary" className={styles.valueLabel}>变更后</Text>
          <Text className={styles.newValue}>
            {change.newValue ?? '(空)'}
          </Text>
        </div>
      </div>
    </div>
  );
};

/**
 * 变更历史时间线组件
 */
interface ChangeTimelineProps {
  changes: FieldChange[];
}

/**
 * 变更历史时间线组件
 * 以时间线形式展示所有字段变更
 */
const ChangeTimeline: React.FC<ChangeTimelineProps> = ({ changes }) => {
  const timelineItems = changes.map((change, index) => {
    const isAuditable = isAuditableField(change);
    return {
      key: `${change.field}-${index}`,
      color: isAuditable ? 'orange' : 'blue',
      dot: isAuditable ? <WarningFilled /> : <CheckCircleFilled />,
      children: (
        <div className={styles.timelineItem}>
          <div className={styles.timelineField}>
            <Text strong>{change.field}</Text>
            {isAuditable && (
              <Tag color="warning" className={styles.auditableTag}>@Auditable</Tag>
            )}
          </div>
          <Paragraph className={styles.timelineChange}>
            {change.oldValue ?? '(空)'} → {change.newValue ?? '(空)'}
          </Paragraph>
        </div>
      )
    };
  });

  return (
    <Timeline items={timelineItems} className={styles.changeTimeline} />
  );
};

/**
 * 审计详情抽屉组件属性
 */
export interface AuditDetailDrawerProps {
  /** 审计日志数据 */
  auditLog: AuditLog | null;
  /** 抽屉是否打开 */
  open: boolean;
  /** 抽屉关闭回调 */
  onClose: () => void;
  /** 抽屉宽度 */
  width?: number | string;
  /** 是否显示变更详情折叠面板 */
  showCollapseDetails?: boolean;
  /** 额外操作按钮 */
  extraActions?: React.ReactNode;
  /** 加载状态 */
  loading?: boolean;
}

/**
 * AuditDetailDrawer - 审计详情抽屉组件
 * 
 * 用于在资产详情页面展示完整的审计轨迹信息，
 * 包括操作人、操作时间、变更内容等。
 * 
 * @component
 * @example
 * ```tsx
 * // 基础用法
 * <AuditDetailDrawer
 *   auditLog={selectedLog}
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 * />
 * 
 * // 带额外操作
 * <AuditDetailDrawer
 *   auditLog={selectedLog}
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   extraActions={
 *     <Button onClick={handleExport}>导出报告</Button>
 *   }
 * />
 * ```
 */
export const AuditDetailDrawer: React.FC<AuditDetailDrawerProps> = ({
  auditLog,
  open,
  onClose,
  width = 600,
  showCollapseDetails = true,
  extraActions,
  loading = false
}) => {
  const [activeKeys, setActiveKeys] = useState<string[]>(['basic', 'changes']);

  /**
   * 处理折叠面板变化
   */
  const handleCollapseChange: CollapseProps['onChange'] = useCallback((keys) => {
    setActiveKeys(keys as string[]);
  }, []);

  /**
   * 获取操作类型配置
   */
  const operationConfig = auditLog 
    ? getOperationConfig(auditLog.operation) 
    : null;

  /**
   * 基本信息描述项配置
   */
  const basicInfoItems: DescriptionsProps['items'] = auditLog ? [
    {
      key: 'operation',
      label: '操作类型',
      children: (
        <Tag icon={operationConfig?.icon} color={operationConfig?.color}>
          {operationConfig?.label}
        </Tag>
      )
    },
    {
      key: 'operator',
      label: '操作人',
      children: (
        <span className={styles.operator}>
          <UserOutlined /> {auditLog.operator}
        </span>
      )
    },
    {
      key: 'timestamp',
      label: '操作时间',
      children: (
        <span className={styles.timestamp}>
          <ClockCircleOutlined /> {formatTimestamp(auditLog.timestamp)}
        </span>
      )
    },
    {
      key: 'ipAddress',
      label: 'IP地址',
      children: auditLog.ipAddress || '未知'
    },
    {
      key: 'userAgent',
      label: '用户代理',
      span: 2,
      children: auditLog.userAgent || '未知'
    }
  ] : [];

  /**
   * 变更详情折叠面板配置
   */
  const collapseItems: CollapseProps['items'] = [
    {
      key: 'basic',
      label: (
        <span className={styles.collapsePanelHeader}>
          <InfoCircleOutlined /> 基本信息
        </span>
      ),
      children: (
        <Descriptions 
          column={2} 
          items={basicInfoItems}
          className={styles.basicDescriptions}
          bordered
          size="small"
        />
      )
    },
    {
      key: 'changes',
      label: (
        <span className={styles.collapsePanelHeader}>
          <EditOutlined /> 变更明细 ({auditLog?.changes?.length || 0} 项)
        </span>
      ),
      children: auditLog?.changes && auditLog.changes.length > 0 ? (
        <div className={styles.changesContainer}>
          {/* 变更摘要 */}
          <div className={styles.changesSummary}>
            <Title level={5} className={styles.sectionTitle}>变更摘要</Title>
            <div className={styles.fieldChangesGrid}>
              {auditLog.changes.map((change, index) => (
                <FieldChangeItem key={`${change.field}-${index}`} change={change} />
              ))}
            </div>
          </div>
          
          {/* 变更时间线 */}
          <div className={styles.changesTimeline}>
            <Title level={5} className={styles.sectionTitle}>变更历史</Title>
            <ChangeTimeline changes={auditLog.changes} />
          </div>
        </div>
      ) : (
        <div className={styles.emptyChanges}>
          <Text type="secondary">无变更明细</Text>
        </div>
      )
    },
    ...(auditLog?.additionalInfo ? [{
      key: 'additional',
      label: (
        <span className={styles.collapsePanelHeader}>
          <InfoCircleOutlined /> 附加信息
        </span>
      ),
      children: (
        <div className={styles.additionalInfo}>
          <pre className={styles.jsonPre}>
            {JSON.stringify(auditLog.additionalInfo, null, 2)}
          </pre>
        </div>
      )
    }] : [])
  ];

  /**
   * 渲染抽屉头部
   */
  const renderHeader = () => (
    <div className={styles.drawerHeader}>
      <div className={styles.headerLeft}>
        <Badge 
          status={loading ? 'processing' : 'success'} 
          text={
            <Title level={4} className={styles.drawerTitle}>
              审计详情
            </Title>
          }
        />
        {auditLog && (
          <Text type="secondary" className={styles.auditId}>
            ID: {auditLog.id}
          </Text>
        )}
      </div>
      <div className={styles.headerRight}>
        {extraActions}
        <Tooltip title="关闭">
          <button 
            className={styles.closeButton}
            onClick={onClose}
            aria-label="关闭"
          >
            <CloseOutlined />
          </button>
        </Tooltip>
      </div>
    </div>
  );

  /**
   * 渲染抽屉内容
   */
  const renderContent = () => {
    if (!auditLog) {
      return (
        <div className={styles.emptyState}>
          <InfoCircleOutlined className={styles.emptyIcon} />
          <Text type="secondary">暂无审计详情</Text>
        </div>
      );
    }

    if (loading) {
      return (
        <div className={styles.loadingState}>
          <Text type="secondary">加载中...</Text>
        </div>
      );
    }

    return (
      <div className={styles.drawerContent}>
        {/* 操作摘要卡片 */}
        <div className={styles.operationSummary}>
          <div className={styles.summaryIcon} style={{ color: operationConfig?.color }}>
            {operationConfig?.icon}
          </div>
          <div className={styles.summaryInfo}>
            <Text strong className={styles.summaryOperation}>
              {operationConfig?.label} 操作
            </Text>
            <Text type="secondary" className={styles.summaryMeta}>
              {auditLog.operator} · {formatTimestamp(auditLog.timestamp)}
            </Text>
          </div>
          <div className={styles.summaryBadge}>
            {auditLog.changes?.filter(isAuditableField).length > 0 && (
              <Badge 
                count={`${auditLog.changes.filter(isAuditableField).length} 个审计字段`}
                style={{ backgroundColor: '#faad14' }}
              />
            )}
          </div>
        </div>

        {/* 折叠详情面板 */}
        {showCollapseDetails && (
          <Collapse 
            activeKey={activeKeys}
            onChange={handleCollapseChange}
            items={collapseItems}
            className={styles.detailCollapse}
            defaultActiveKey={['basic', 'changes']}
            expandIconPosition="end"
          />
        )}
      </div>
    );
  };

  return (
    <Drawer
      title={renderHeader()}
      placement="right"
      width={width}
      open={open}
      onClose={onClose}
      className={styles.auditDetailDrawer}
      maskClosable={true}
      destroyOnClose={true}
      styles={{
        body: { padding: 0 },
        header: { display: 'none' }
      }}
    >
      {renderContent()}
    </Drawer>
  );
};

/**
 * 审计详情抽屉触发器组件
 * 用于在其他组件中快速打开审计详情抽屉
 */
export interface AuditDetailDrawerTriggerProps {
  /** 审计日志数据 */
  auditLog: AuditLog;
  /** 子元素 */
  children: React.ReactNode;
  /** 额外属性传递给触发元素 */
  triggerProps?: React.HTMLAttributes<HTMLElement>;
  /** 抽屉宽度 */
  drawerWidth?: number | string;
  /** 点击回调 */
  onClick?: (auditLog: AuditLog) => void;
}

/**
 * AuditDetailDrawerTrigger - 审计详情抽屉触发器组件
 * 
 * 包装任意元素，点击后打开审计详情抽屉
 * 
 * @component
 * @example
 * ```tsx
 * <AuditDetailDrawerTrigger auditLog={log}>
 *   <Button>查看详情</Button>
 * </AuditDetailDrawerTrigger>
 * ```
 */
export const AuditDetailDrawerTrigger: React.FC<AuditDetailDrawerTriggerProps> = ({
  auditLog,
  children,
  triggerProps,
  drawerWidth,
  onClick
}) => {
  const [open, setOpen] = useState(false);

  const handleClick = useCallback(() => {
    onClick?.(auditLog);
    setOpen(true);
  }, [auditLog, onClick]);

  return (
    <>
      <div 
        onClick={handleClick}
        {...triggerProps}
        style={{ cursor: 'pointer', ...triggerProps?.style }}
      >
        {children}
      </div>
      <AuditDetailDrawer
        auditLog={auditLog}
        open={open}
        onClose={() => setOpen(false)}
        width={drawerWidth}
      />
    </>
  );
};

export default AuditDetailDrawer;