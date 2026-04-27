/**
 * @file FieldChangeDiff.tsx
 * @description 字段变更差异展示组件 - 用于可视化审计日志中的字段变更对比
 * @module components/audit/FieldChangeDiff
 * 
 * 功能说明:
 * - 展示字段变更前后的值对比
 * - 高亮显示被@Auditable标记的字段变更
 * - 支持不同类型数据的格式化展示（日期、金额、文本等）
 */

import React, { useMemo } from 'react';
import { Tooltip } from 'antd';
import { 
  DeleteOutlined, 
  PlusOutlined, 
  MinusOutlined,
  InfoCircleOutlined 
} from '@ant-design/icons';
import styles from './FieldChangeDiff.module.css';

/**
 * 字段变更数据类型定义
 */
export interface FieldChangeDiffData {
  /** 字段名称 */
  fieldName: string;
  /** 字段显示名称（中文） */
  fieldLabel?: string;
  /** 变更前的值 */
  oldValue: string | number | null;
  /** 变更后的值 */
  newValue: string | number | null;
  /** 是否为@Auditable标记的字段 */
  isAuditable?: boolean;
  /** 字段类型，用于格式化 */
  fieldType?: 'text' | 'date' | 'number' | 'currency' | 'status' | 'boolean';
  /** 变更原因（可选） */
  changeReason?: string;
}

/**
 * FieldChangeDiff 组件Props
 */
export interface FieldChangeDiffProps {
  /** 字段变更数据 */
  data: FieldChangeDiffData;
  /** 是否显示标签（默认true） */
  showLabel?: boolean;
  /** 是否显示变更原因（默认false） */
  showReason?: boolean;
  /** 高亮样式主题：default | highlight | subtle */
  highlightTheme?: 'default' | 'highlight' | 'subtle';
  /** 自定义类名 */
  className?: string;
}

/**
 * 值格式化工具函数
 * 
 * @param value - 需要格式化的值
 * @param fieldType - 字段类型
 * @returns 格式化后的字符串
 */
const formatValue = (
  value: string | number | null | undefined,
  fieldType?: FieldChangeDiffData['fieldType']
): string => {
  if (value === null || value === undefined || value === '') {
    return '(空)';
  }

  switch (fieldType) {
    case 'date':
      // 格式化日期为 YYYY-MM-DD 格式
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
        }
      } catch {
        return String(value);
      }
      return String(value);

    case 'currency':
      // 格式化金额，添加千分位分隔符和货币符号
      const num = typeof value === 'string' ? parseFloat(value) : value;
      if (!isNaN(num)) {
        return `¥${num.toLocaleString('zh-CN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`;
      }
      return String(value);

    case 'number':
      // 格式化数字，添加千分位分隔符
      const numVal = typeof value === 'string' ? parseFloat(value) : value;
      if (!isNaN(numVal)) {
        return numVal.toLocaleString('zh-CN');
      }
      return String(value);

    case 'boolean':
      // 格式化布尔值
      return value ? '是' : '否';

    case 'status':
      // 状态值保持原样，由调用方确保状态名称可读
      return String(value);

    case 'text':
    default:
      return String(value);
  }
};

/**
 * 判断变更类型
 * 
 * @param oldValue - 旧值
 * @param newValue - 新值
 * @returns 变更类型：'added' | 'removed' | 'modified' | 'unchanged'
 */
const getChangeType = (
  oldValue: string | number | null | undefined,
  newValue: string | number | null | undefined
): 'added' | 'removed' | 'modified' | 'unchanged' => {
  const isOldEmpty = oldValue === null || oldValue === undefined || oldValue === '';
  const isNewEmpty = newValue === null || newValue === undefined || newValue === '';

  if (isOldEmpty && !isNewEmpty) return 'added';
  if (!isOldEmpty && isNewEmpty) return 'removed';
  if (String(oldValue) !== String(newValue)) return 'modified';
  return 'unchanged';
};

/**
 * 获取变更类型图标
 * 
 * @param changeType - 变更类型
 * @returns React.ReactNode 图标组件
 */
const getChangeTypeIcon = (changeType: 'added' | 'removed' | 'modified' | 'unchanged'): React.ReactNode => {
  switch (changeType) {
    case 'added':
      return <PlusOutlined className={styles.iconAdded} />;
    case 'removed':
      return <MinusOutlined className={styles.iconRemoved} />;
    case 'modified':
      return <DeleteOutlined className={styles.iconModified} />;
    default:
      return null;
  }
};

/**
 * 获取变更类型描述
 * 
 * @param changeType - 变更类型
 * @returns 变更类型描述文本
 */
const getChangeTypeLabel = (changeType: 'added' | 'removed' | 'modified' | 'unchanged'): string => {
  switch (changeType) {
    case 'added':
      return '新增';
    case 'removed':
      return '删除';
    case 'modified':
      return '修改';
    default:
      return '未变';
  }
};

/**
 * FieldChangeDiff 组件
 * 
 * 用于展示字段变更前后的差异对比，支持：
 * - 文本、数字、日期、金额等类型数据的格式化展示
 * - 新增、删除、修改三种变更类型的高亮显示
 * - @Auditable字段的特殊标记
 * - 可选的变更原因展示
 * 
 * @example
 * ```tsx
 * <FieldChangeDiff 
 *   data={{
 *     fieldName: 'originalValue',
 *     fieldLabel: '资产原值',
 *     oldValue: 10000,
 *     newValue: 15000,
 *     isAuditable: true,
 *     fieldType: 'currency'
 *   }}
 *   highlightTheme="highlight"
 * />
 * ```
 */
const FieldChangeDiff: React.FC<FieldChangeDiffProps> = ({
  data,
  showLabel = true,
  showReason = false,
  highlightTheme = 'default',
  className = ''
}) => {
  const {
    fieldName,
    fieldLabel,
    oldValue,
    newValue,
    isAuditable = false,
    fieldType = 'text',
    changeReason
  } = data;

  /**
   * 计算变更类型
   */
  const changeType = useMemo(() => {
    return getChangeType(oldValue, newValue);
  }, [oldValue, newValue]);

  /**
   * 格式化后的值
   */
  const formattedOldValue = useMemo(() => {
    return formatValue(oldValue, fieldType);
  }, [oldValue, fieldType]);

  const formattedNewValue = useMemo(() => {
    return formatValue(newValue, fieldType);
  }, [newValue, fieldType]);

  /**
   * 判断是否为有意义的变更（实际发生了值的变化）
   */
  const hasActualChange = changeType !== 'unchanged';

  /**
   * 生成组件类名
   */
  const componentClassName = useMemo(() => {
    const classes = [styles.fieldChangeDiff];
    
    if (hasActualChange) {
      classes.push(styles[`change_${changeType}`]);
    }
    
    if (isAuditable) {
      classes.push(styles.auditable);
    }
    
    if (highlightTheme !== 'default') {
      classes.push(styles[`theme_${highlightTheme}`]);
    }
    
    if (className) {
      classes.push(className);
    }
    
    return classes.join(' ');
  }, [hasActualChange, changeType, isAuditable, highlightTheme, className]);

  /**
   * 渲染字段标签
   */
  const renderLabel = () => {
    if (!showLabel) return null;
    
    return (
      <div className={styles.fieldLabel}>
        <span className={styles.labelText}>
          {fieldLabel || fieldName}
        </span>
        {isAuditable && (
          <Tooltip title="此字段变更将被审计记录">
            <InfoCircleOutlined className={styles.auditableIcon} />
          </Tooltip>
        )}
      </div>
    );
  };

  /**
   * 渲染变更值对比
   */
  const renderValueComparison = () => {
    if (!hasActualChange) {
      return (
        <span className={styles.unchangedValue}>
          {formattedNewValue}
        </span>
      );
    }

    return (
      <div className={styles.valueComparison}>
        <span className={styles.oldValue}>
          {formattedOldValue}
        </span>
        <span className={styles.arrow}>→</span>
        <span className={styles.newValue}>
          {formattedNewValue}
        </span>
      </div>
    );
  };

  /**
   * 渲染变更类型标签
   */
  const renderChangeTypeTag = () => {
    if (!hasActualChange) return null;
    
    return (
      <span className={styles[`changeTag_${changeType}`]}>
        {getChangeTypeIcon(changeType)}
        <span>{getChangeTypeLabel(changeType)}</span>
      </span>
    );
  };

  /**
   * 渲染变更原因
   */
  const renderChangeReason = () => {
    if (!showReason || !changeReason) return null;
    
    return (
      <div className={styles.changeReason}>
        <span className={styles.reasonLabel}>变更原因：</span>
        <span className={styles.reasonText}>{changeReason}</span>
      </div>
    );
  };

  return (
    <div className={componentClassName}>
      {renderLabel()}
      <div className={styles.changeContent}>
        {renderChangeTypeTag()}
        {renderValueComparison()}
      </div>
      {renderChangeReason()}
    </div>
  );
};

/**
 * FieldChangeDiffList 组件 - 批量展示多个字段变更
 */
export interface FieldChangeDiffListProps {
  /** 字段变更数据列表 */
  changes: FieldChangeDiffData[];
  /** 是否显示标签（默认true） */
  showLabel?: boolean;
  /** 是否显示变更原因（默认false） */
  showReason?: boolean;
  /** 高亮样式主题 */
  highlightTheme?: 'default' | 'highlight' | 'subtle';
  /** 自定义类名 */
  className?: string;
}

/**
 * FieldChangeDiffList 组件
 * 
 * 用于批量展示多个字段变更，内部使用FieldChangeDiff组件渲染每个变更项。
 * 支持对变更列表进行排序（按变更类型或字段名称）。
 * 
 * @example
 * ```tsx
 * <FieldChangeDiffList
 *   changes={[
 *     { fieldName: 'name', oldValue: '资产A', newValue: '资产B' },
 *     { fieldName: 'value', oldValue: 1000, newValue: 2000, fieldType: 'currency' }
 *   ]}
 *   showReason
 * />
 * ```
 */
export const FieldChangeDiffList: React.FC<FieldChangeDiffListProps> = ({
  changes,
  showLabel = true,
  showReason = false,
  highlightTheme = 'default',
  className = ''
}) => {
  /**
   * 按变更类型排序的变更列表
   * 优先级：modified > added > removed > unchanged
   */
  const sortedChanges = useMemo(() => {
    const priorityMap: Record<string, number> = {
      modified: 1,
      added: 2,
      removed: 3,
      unchanged: 4
    };

    return [...changes].sort((a, b) => {
      const typeA = getChangeType(a.oldValue, a.newValue);
      const typeB = getChangeType(b.oldValue, b.newValue);
      return (priorityMap[typeA] || 5) - (priorityMap[typeB] || 5);
    });
  }, [changes]);

  /**
   * 仅显示有实际变更的项
   */
  const filteredChanges = useMemo(() => {
    return sortedChanges.filter(change => {
      const type = getChangeType(change.oldValue, change.newValue);
      return type !== 'unchanged';
    });
  }, [sortedChanges]);

  if (filteredChanges.length === 0) {
    return (
      <div className={`${styles.emptyState} ${className || ''}`}>
        暂无字段变更记录
      </div>
    );
  }

  return (
    <div className={`${styles.diffList} ${className || ''}`}>
      {filteredChanges.map((change, index) => (
        <FieldChangeDiff
          key={`${change.fieldName}_${index}`}
          data={change}
          showLabel={showLabel}
          showReason={showReason}
          highlightTheme={highlightTheme}
        />
      ))}
    </div>
  );
};

export default FieldChangeDiff;