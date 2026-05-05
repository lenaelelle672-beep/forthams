/**
 * AuditLogEntry Component
 * 
 * SWARM-051 Phase 3: 组件层 (Component)
 * 职责：单条审计日志卡片渲染
 * 
 * @description 
 * 负责展示单条审计日志条目，包含操作类型、操作人、时间戳、变更字段等信息。
 * 支持展开/折叠状态，用于查看详细的字段变更 Diff 视图。
 * 
 * @requirements
 * - TC-051-02: 审计日志面板渲染
 * - TC-051-03: @Auditable 字段变更 Diff 展示
 * 
 * @module AuditLogPanel
 */

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, User, Clock, Edit3, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { AuditLogEntry as AuditLogEntryType, ChangedField } from '../../types/audit.types';
import './AuditLogEntry.css';

/**
 * 操作类型到图标和颜色的映射配置
 */
const OPERATION_CONFIG = {
  CREATE: {
    icon: Plus,
    color: 'bg-green-100 text-green-800 border-green-200',
    label: '创建'
  },
  UPDATE: {
    icon: Edit3,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    label: '更新'
  },
  DELETE: {
    icon: Trash2,
    color: 'bg-red-100 text-red-800 border-red-200',
    label: '删除'
  }
} as const;

/**
 * 字段变更 Diff 视图组件
 * 
 * @description 展示单个字段的变更详情
 * @requirement TC-051-03: @Auditable 字段变更 Diff 展示
 * - 旧值使用红色背景高亮 (#fee2e2)
 * - 新值使用绿色背景高亮 (#dcfce7)
 * 
 * @param changedField - 变更字段数据
 */
interface FieldDiffViewProps {
  changedField: ChangedField;
}

/**
 * 渲染字段值的辅助函数
 * 处理不同类型的值展示
 */
const renderFieldValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '<空>';
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

/**
 * 字段变更 Diff 视图组件
 * 
 * @requirement TC-051-03: @Auditable 字段变更 Diff 展示
 * 展示字段级 Diff 视图，旧值使用红色背景高亮，新值使用绿色背景高亮
 */
const FieldDiffView: React.FC<FieldDiffViewProps> = ({ changedField }) => {
  const { field, displayName, oldValue, newValue } = changedField;
  const hasChange = oldValue !== newValue;

  return (
    <div className="field-diff-view" data-testid="field-diff-view">
      <div className="field-name">
        <span className="field-label">{displayName || field}</span>
        <span className="field-key">({field})</span>
      </div>
      
      <div className="field-values">
        <div className="diff-value-container">
          <span className="diff-label">旧值:</span>
          <span 
            className={`diff-old-value ${hasChange ? 'has-change' : ''}`}
            style={hasChange ? { backgroundColor: '#fee2e2' } : {}}
            data-testid="diff-old-value"
          >
            {renderFieldValue(oldValue)}
          </span>
        </div>
        
        <div className="diff-arrow">→</div>
        
        <div className="diff-value-container">
          <span className="diff-label">新值:</span>
          <span 
            className={`diff-new-value ${hasChange ? 'has-change' : ''}`}
            style={hasChange ? { backgroundColor: '#dcfce7' } : {}}
            data-testid="diff-new-value"
          >
            {renderFieldValue(newValue)}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * AuditLogEntry 组件 Props 接口
 */
export interface AuditLogEntryProps {
  /** 审计日志条目数据 */
  log: AuditLogEntryType;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * AuditLogEntry 组件
 * 
 * @description 单条审计日志卡片组件
 * 
 * @requirement TC-051-02: 审计日志面板渲染
 * 每条日志应显示: 操作类型、操作人、时间戳、变更字段
 * 
 * @example
 * ```tsx
 * <AuditLogEntry 
 *   log={auditLogData}
 *   defaultExpanded={false}
 *   onExpand={(expanded) => console.log('Expanded:', expanded)}
 * />
 * ```
 */
const AuditLogEntry: React.FC<AuditLogEntryProps> = ({
  log,
  defaultExpanded = false,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const {
    eventId,
    operation,
    operator,
    timestamp,
    changedFields = [],
    assetType
  } = log;

  const operationConfig = OPERATION_CONFIG[operation] || OPERATION_CONFIG.UPDATE;
  const OperationIcon = operationConfig.icon;

  // 格式化时间戳
  const formattedTime = React.useMemo(() => {
    try {
      const date = new Date(timestamp);
      return format(date, 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
    } catch {
      return timestamp;
    }
  }, [timestamp]);

  // 切换展开状态
  const toggleExpand = React.useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // 生成事件唯一标识
  const entryTestId = React.useMemo(() => {
    return `audit-log-entry-${eventId}`;
  }, [eventId]);

  return (
    <div 
      className={`audit-log-entry ${className}`}
      data-testid={entryTestId}
      data-operation={operation.toLowerCase()}
    >
      <Card className="audit-log-card">
        <CardContent className="audit-log-card-content">
          {/* 日志头部信息 */}
          <div className="audit-log-header" onClick={toggleExpand} role="button" tabIndex={0}>
            {/* 操作类型 Badge */}
            <div className="audit-log-operation">
              <Badge className={operationConfig.color} variant="outline">
                <OperationIcon className="operation-icon" size={14} />
                <span>{operationConfig.label}</span>
              </Badge>
              {assetType && (
                <Badge variant="secondary" className="asset-type-badge">
                  {assetType}
                </Badge>
              )}
            </div>

            {/* 操作人和时间 */}
            <div className="audit-log-meta">
              <div className="meta-item" data-testid="operator">
                <User size={14} className="meta-icon" />
                <span>{operator || '系统'}</span>
              </div>
              <div className="meta-item" data-testid="timestamp">
                <Clock size={14} className="meta-icon" />
                <span>{formattedTime}</span>
              </div>
            </div>

            {/* 展开/折叠按钮 */}
            {changedFields.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="expand-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand();
                }}
                data-testid="view-diff-btn"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? '收起变更详情' : '查看变更详情'}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp size={16} />
                    <span>收起</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    <span>查看变更 ({changedFields.length})</span>
                  </>
                )}
              </Button>
            )}
          </div>

          {/* 变更字段详情 (可展开) */}
          {isExpanded && changedFields.length > 0 && (
            <div 
              className="audit-log-changes"
              data-testid="audit-log-changes"
            >
              <div className="changes-divider">
                <span>字段变更详情</span>
              </div>
              <div className="changed-fields-list">
                {changedFields.map((field, index) => (
                  <FieldDiffView 
                    key={`${field.field}-${index}`} 
                    changedField={field}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 无变更字段时的提示 */}
          {isExpanded && changedFields.length === 0 && (
            <div className="audit-log-no-changes" data-testid="no-changes">
              <span>此操作未包含字段变更</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * AuditLogEntry 组件导出
 * 包含主组件和子组件供外部使用
 */
export { AuditLogEntry, FieldDiffView };
export default AuditLogEntry;