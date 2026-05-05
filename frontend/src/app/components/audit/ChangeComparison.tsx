/**
 * ChangeComparison Component
 * 
 * @fileoverview 字段变更对比展示组件，用于展示审计日志中字段变更的前后值对比
 * @component
 * 
 * @description 
 * 该组件根据 SWARM-051 规格文档 ATB-3.2 定义开发，
 * 支持展示字段变更前后的值对比，包括：
 * - 旧值显示为红色并带删除线
 * - 新值显示为绿色并加粗
 * - 日期字段格式化后对比
 * - 金额字段添加千分位分隔符
 * 
 * @usage
 * ```tsx
 * <ChangeComparison
 *   fieldName="originalValue"
 *   oldValue="10000"
 *   newValue="15000"
 *   fieldType="currency"
 * />
 * ```
 * 
 * @module audit/components
 */

import React, { useMemo } from 'react';
import { cn } from '../../components/ui/utils';

/**
 * 字段类型枚举
 * 定义支持的字段类型，用于格式化展示
 */
export enum FieldType {
  /** 普通文本类型 */
  TEXT = 'text',
  /** 日期类型 */
  DATE = 'date',
  /** 日期时间类型 */
  DATETIME = 'datetime',
  /** 货币金额类型 */
  CURRENCY = 'currency',
  /** 数值类型 */
  NUMBER = 'number',
  /** 百分比类型 */
  PERCENTAGE = 'percentage',
  /** 布尔类型 */
  BOOLEAN = 'boolean',
  /** 枚举/状态类型 */
  ENUM = 'enum',
}

/**
 * 变更方向枚举
 * 用于标记值的增加或减少
 */
export enum ChangeDirection {
  /** 值增加 */
  INCREASE = 'increase',
  /** 值减少 */
  DECREASE = 'decrease',
  /** 值不变 */
  UNCHANGED = 'unchanged',
  /** 新增（旧值为空） */
  CREATED = 'created',
  /** 删除（新值为空） */
  DELETED = 'deleted',
}

/**
 * ChangeComparison 组件属性接口
 */
export interface ChangeComparisonProps {
  /**
   * 字段名称
   * 用于展示字段的标签名称
   */
  fieldName: string;
  
  /**
   * 字段的旧值（变更前的值）
   * 如果为 null 或 undefined 表示该字段是新建的
   */
  oldValue?: string | number | null;
  
  /**
   * 字段的新值（变更后的值）
   * 如果为 null 或 undefined 表示该字段被删除
   */
  newValue?: string | number | null;
  
  /**
   * 字段类型
   * 用于决定值的格式化方式
   * @default FieldType.TEXT
   */
  fieldType?: FieldType;
  
  /**
   * 是否为 @Auditable 标记的字段
   * 决定是否显示特殊高亮效果
   * @default false
   */
  isAuditable?: boolean;
  
  /**
   * 是否显示字段名称标签
   * @default true
   */
  showLabel?: boolean;
  
  /**
   * 是否显示变更方向指示器
   * @default true
   */
  showDirection?: boolean;
  
  /**
   * 自定义类名
   */
  className?: string;
  
  /**
   * 日期格式化模板（当 fieldType 为 DATE 或 DATETIME 时生效）
   * @default 'YYYY-MM-DD'
   */
  dateFormat?: string;
  
  /**
   * 货币符号（当 fieldType 为 CURRENCY 时生效）
   * @default '¥'
   */
  currencySymbol?: string;
  
  /**
   * 小数位数（当 fieldType 为 CURRENCY 或 NUMBER 时生效）
   * @default 2
   */
  decimalPlaces?: number;
  
  /**
   * 布尔值的显示文本配置
   */
  booleanLabels?: {
    true: string;
    false: string;
  };
  
  /**
   * 枚举值的显示映射
   * key 为枚举值，value 为显示文本
   */
  enumLabels?: Record<string, string>;
}

/**
 * 格式化值的内部函数类型
 */
type FormatterFn = (value: string | number | null | undefined) => string;

/**
 * 日期格式化函数
 * 
 * @param value - 待格式化的日期值
 * @param format - 格式化模板
 * @returns 格式化后的日期字符串
 * 
 * @example
 * formatDate('2024-01-15T10:30:00', 'YYYY-MM-DD') // '2024-01-15'
 * formatDate('2024-01-15T10:30:00', 'YYYY-MM-DD HH:mm') // '2024-01-15 10:30'
 */
const formatDate = (value: string | number | null | undefined, format: string): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const date = typeof value === 'number' 
    ? new Date(value) 
    : new Date(value);

  if (isNaN(date.getTime())) {
    return String(value);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

/**
 * 货币格式化函数
 * 
 * @param value - 待格式化的金额值
 * @param symbol - 货币符号
 * @param decimals - 小数位数
 * @returns 格式化后的货币字符串
 * 
 * @example
 * formatCurrency(10000, '¥', 2) // '¥10,000.00'
 * formatCurrency(1500000, '$', 0) // '$1,500,000'
 */
const formatCurrency = (
  value: string | number | null | undefined,
  symbol: string = '¥',
  decimals: number = 2
): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return String(value);
  }

  const formatted = numValue.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${symbol}${formatted}`;
};

/**
 * 数值格式化函数
 * 
 * @param value - 待格式化的数值
 * @param decimals - 小数位数
 * @returns 格式化后的数值字符串
 * 
 * @example
 * formatNumber(1234567, 2) // '1,234,567.00'
 */
const formatNumber = (
  value: string | number | null | undefined,
  decimals: number = 2
): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return String(value);
  }

  return numValue.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * 百分比格式化函数
 * 
 * @param value - 待格式化的百分比值（0-1 之间的小数或 0-100 的整数）
 * @param decimals - 小数位数
 * @returns 格式化后的百分比字符串
 */
const formatPercentage = (
  value: string | number | null | undefined,
  decimals: number = 2
): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return String(value);
  }

  // 如果值大于1，认为是百分比的原始值（如 50 表示 50%）
  const percentage = numValue > 1 ? numValue : numValue * 100;

  return `${percentage.toFixed(decimals)}%`;
};

/**
 * 布尔值格式化函数
 * 
 * @param value - 待格式化的布尔值
 * @param labels - 自定义显示标签
 * @returns 格式化后的布尔字符串
 */
const formatBoolean = (
  value: string | number | null | undefined,
  labels: { true: string; false: string } = { true: '是', false: '否' }
): string => {
  if (value === null || value === undefined) {
    return '-';
  }

  const boolValue = typeof value === 'string' 
    ? value.toLowerCase() === 'true' || value === '1'
    : Boolean(value);

  return boolValue ? labels.true : labels.false;
};

/**
 * 枚举值格式化函数
 * 
 * @param value - 待格式化的枚举值
 * @param labels - 枚举标签映射
 * @returns 格式化后的枚举字符串
 */
const formatEnum = (
  value: string | number | null | undefined,
  labels?: Record<string, string>
): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const stringValue = String(value);
  
  if (labels && labels[stringValue]) {
    return labels[stringValue];
  }

  return stringValue;
};

/**
 * 根据字段类型获取格式化函数
 * 
 * @param fieldType - 字段类型
 * @param options - 格式化选项
 * @returns 格式化函数
 */
const getFormatter = (
  fieldType: FieldType,
  options: {
    dateFormat?: string;
    currencySymbol?: string;
    decimalPlaces?: number;
    booleanLabels?: { true: string; false: string };
    enumLabels?: Record<string, string>;
  }
): FormatterFn => {
  switch (fieldType) {
    case FieldType.DATE:
      return (value) => formatDate(value, options.dateFormat || 'YYYY-MM-DD');
    
    case FieldType.DATETIME:
      return (value) => formatDate(value, options.dateFormat || 'YYYY-MM-DD HH:mm:ss');
    
    case FieldType.CURRENCY:
      return (value) => formatCurrency(value, options.currencySymbol, options.decimalPlaces);
    
    case FieldType.NUMBER:
      return (value) => formatNumber(value, options.decimalPlaces);
    
    case FieldType.PERCENTAGE:
      return (value) => formatPercentage(value, options.decimalPlaces);
    
    case FieldType.BOOLEAN:
      return (value) => formatBoolean(value, options.booleanLabels);
    
    case FieldType.ENUM:
      return (value) => formatEnum(value, options.enumLabels);
    
    case FieldType.TEXT:
    default:
      return (value) => {
        if (value === null || value === undefined || value === '') {
          return '-';
        }
        return String(value);
      };
  }
};

/**
 * 计算变更方向
 * 
 * @param oldValue - 旧值
 * @param newValue - 新值
 * @param fieldType - 字段类型
 * @returns 变更方向枚举
 */
const calculateDirection = (
  oldValue: string | number | null | undefined,
  newValue: string | number | null | undefined,
  fieldType: FieldType
): ChangeDirection => {
  // 处理空值情况
  if ((oldValue === null || oldValue === undefined || oldValue === '') && 
      (newValue !== null && newValue !== undefined && newValue !== '')) {
    return ChangeDirection.CREATED;
  }
  
  if ((oldValue !== null && oldValue !== undefined && oldValue !== '') && 
      (newValue === null || newValue === undefined || newValue === '')) {
    return ChangeDirection.DELETED;
  }

  if (oldValue === newValue) {
    return ChangeDirection.UNCHANGED;
  }

  // 数值类型的比较
  if ([FieldType.NUMBER, FieldType.CURRENCY, FieldType.PERCENTAGE].includes(fieldType)) {
    const oldNum = typeof oldValue === 'string' ? parseFloat(oldValue) : oldValue;
    const newNum = typeof newValue === 'string' ? parseFloat(newValue!) : newValue;
    
    if (!isNaN(oldNum as number) && !isNaN(newNum as number)) {
      return (newNum as number) > (oldNum as number) 
        ? ChangeDirection.INCREASE 
        : ChangeDirection.DECREASE;
    }
  }

  return ChangeDirection.UNCHANGED;
};

/**
 * 获取变更方向的显示文本
 * 
 * @param direction - 变更方向
 * @returns 显示文本和样式类名
 */
const getDirectionDisplay = (
  direction: ChangeDirection
): { text: string; className: string; icon: string } => {
  switch (direction) {
    case ChangeDirection.INCREASE:
      return { text: '增加', className: 'change-direction-increase', icon: '↑' };
    case ChangeDirection.DECREASE:
      return { text: '减少', className: 'change-direction-decrease', icon: '↓' };
    case ChangeDirection.CREATED:
      return { text: '新增', className: 'change-direction-created', icon: '+' };
    case ChangeDirection.DELETED:
      return { text: '删除', className: 'change-direction-deleted', icon: '-' };
    case ChangeDirection.UNCHANGED:
    default:
      return { text: '', className: '', icon: '' };
  }
};

/**
 * 获取字段类型的中文名称
 * 
 * @param fieldType - 字段类型
 * @returns 中文名称
 */
const getFieldTypeName = (fieldType: FieldType): string => {
  const typeNames: Record<FieldType, string> = {
    [FieldType.TEXT]: '文本',
    [FieldType.DATE]: '日期',
    [FieldType.DATETIME]: '日期时间',
    [FieldType.CURRENCY]: '金额',
    [FieldType.NUMBER]: '数值',
    [FieldType.PERCENTAGE]: '百分比',
    [FieldType.BOOLEAN]: '布尔',
    [FieldType.ENUM]: '枚举',
  };
  return typeNames[fieldType] || '文本';
};

/**
 * ChangeComparison 组件
 * 
 * @description
 * 用于展示字段变更前后值对比的主组件。
 * 支持多种字段类型的格式化展示，包括：
 * - 日期、日期时间：支持自定义格式化模板
 * - 货币：支持货币符号、千分位分隔符
 * - 数值：支持小数位数控制
 * - 百分比：自动转换并显示百分号
 * - 布尔：支持自定义显示文本
 * - 枚举：支持值到显示文本的映射
 * 
 * @param props - ChangeComparisonProps
 * @returns React.ReactElement
 * 
 * @example
 * // 基础用法
 * <ChangeComparison
 *   fieldName="资产名称"
 *   oldValue="Dell Laptop"
 *   newValue="HP Laptop"
 * />
 * 
 * @example
 * // 货币类型
 * <ChangeComparison
 *   fieldName="资产原值"
 *   oldValue={10000}
 *   newValue={15000}
 *   fieldType={FieldType.CURRENCY}
 *   currencySymbol="¥"
 * />
 * 
 * @example
 * // 日期类型
 * <ChangeComparison
 *   fieldName="购置日期"
 *   oldValue="2023-01-15T00:00:00Z"
 *   newValue="2024-03-20T00:00:00Z"
 *   fieldType={FieldType.DATE}
 *   dateFormat="YYYY-MM-DD"
 * />
 * 
 * @example
 * // @Auditable 字段
 * <ChangeComparison
 *   fieldName="资产状态"
 *   oldValue="IN_USE"
 *   newValue="IDLE"
 *   isAuditable={true}
 * />
 */
const ChangeComparison: React.FC<ChangeComparisonProps> = ({
  fieldName,
  oldValue,
  newValue,
  fieldType = FieldType.TEXT,
  isAuditable = false,
  showLabel = true,
  showDirection = true,
  className,
  dateFormat = 'YYYY-MM-DD',
  currencySymbol = '¥',
  decimalPlaces = 2,
  booleanLabels = { true: '是', false: '否' },
  enumLabels,
}) => {
  // 获取格式化函数
  const formatter = useMemo(
    () => getFormatter(fieldType, { dateFormat, currencySymbol, decimalPlaces, booleanLabels, enumLabels }),
    [fieldType, dateFormat, currencySymbol, decimalPlaces, booleanLabels, enumLabels]
  );

  // 格式化旧值和新值
  const formattedOldValue = useMemo(() => formatter(oldValue), [formatter, oldValue]);
  const formattedNewValue = useMemo(() => formatter(newValue), [formatter, newValue]);

  // 计算变更方向
  const direction = useMemo(
    () => calculateDirection(oldValue, newValue, fieldType),
    [oldValue, newValue, fieldType]
  );

  // 获取方向显示信息
  const directionDisplay = useMemo(() => getDirectionDisplay(direction), [direction]);

  // 判断是否有变更
  const hasChanged = useMemo(() => {
    return oldValue !== newValue && 
           !((oldValue === null || oldValue === undefined || oldValue === '') && 
             (newValue === null || newValue === undefined || newValue === ''));
  }, [oldValue, newValue]);

  // 判断是否为空值（新建或删除）
  const isCreated = direction === ChangeDirection.CREATED;
  const isDeleted = direction === ChangeDirection.DELETED;

  return (
    <div
      className={cn(
        'change-comparison',
        {
          'change-comparison--auditable': isAuditable,
          'change-comparison--changed': hasChanged,
          'change-comparison--created': isCreated,
          'change-comparison--deleted': isDeleted,
        },
        className
      )}
    >
      {/* 字段名称标签 */}
      {showLabel && (
        <div className="change-comparison__label">
          <span className="change-comparison__field-name">{fieldName}</span>
          {isAuditable && (
            <span className="change-comparison__auditable-badge" title="@Auditable 标记字段">
              审计
            </span>
          )}
          <span className="change-comparison__field-type" title={`字段类型: ${getFieldTypeName(fieldType)}`}>
            [{getFieldTypeName(fieldType)}]
          </span>
        </div>
      )}

      {/* 值对比区域 */}
      <div className="change-comparison__values">
        {/* 旧值 */}
        <span
          className={cn(
            'change-comparison__old-value',
            {
              'change-comparison__old-value--deleted': hasChanged || isCreated,
              'change-comparison__old-value--empty': isCreated,
            }
          )}
        >
          {isCreated ? (
            <span className="change-comparison__empty-indicator">（无）</span>
          ) : (
            formattedOldValue
          )}
        </span>

        {/* 箭头指示 */}
        <span className="change-comparison__arrow">
          {hasChanged ? '→' : '='}
        </span>

        {/* 新值 */}
        <span
          className={cn(
            'change-comparison__new-value',
            {
              'change-comparison__new-value--added': hasChanged || isDeleted,
              'change-comparison__new-value--empty': isDeleted,
            }
          )}
        >
          {isDeleted ? (
            <span className="change-comparison__empty-indicator">（无）</span>
          ) : (
            formattedNewValue
          )}
        </span>

        {/* 变更方向指示器 */}
        {showDirection && hasChanged && directionDisplay.text && (
          <span className={cn('change-comparison__direction', directionDisplay.className)}>
            <span className="change-comparison__direction-icon">{directionDisplay.icon}</span>
            <span className="change-comparison__direction-text">{directionDisplay.text}</span>
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * ChangeComparisonDisplay 组件
 * 
 * @description
 * 简化版的变更对比展示组件，仅显示值的变化，不显示额外的元信息。
 * 适用于表格行内展示等紧凑布局场景。
 * 
 * @param props - ChangeComparisonDisplayProps
 * @returns React.ReactElement
 */
export interface ChangeComparisonDisplayProps {
  oldValue?: string | number | null;
  newValue?: string | number | null;
  fieldType?: FieldType;
  className?: string;
  dateFormat?: string;
  currencySymbol?: string;
  decimalPlaces?: number;
}

const ChangeComparisonDisplay: React.FC<ChangeComparisonDisplayProps> = ({
  oldValue,
  newValue,
  fieldType = FieldType.TEXT,
  className,
  dateFormat = 'YYYY-MM-DD',
  currencySymbol = '¥',
  decimalPlaces = 2,
}) => {
  const formatter = useMemo(
    () => getFormatter(fieldType, { dateFormat, currencySymbol, decimalPlaces }),
    [fieldType, dateFormat, currencySymbol, decimalPlaces]
  );

  const formattedOldValue = useMemo(() => formatter(oldValue), [formatter, oldValue]);
  const formattedNewValue = useMemo(() => formatter(newValue), [formatter, newValue]);

  const hasChanged = oldValue !== newValue && 
                     !((oldValue === null || oldValue === undefined || oldValue === '') && 
                       (newValue === null || newValue === undefined || newValue === ''));

  if (!hasChanged) {
    return (
      <span className={cn('change-comparison-display', className)}>
        {formattedNewValue}
      </span>
    );
  }

  return (
    <span className={cn('change-comparison-display', className)}>
      <span className="change-comparison-display__old">{formattedOldValue}</span>
      <span className="change-comparison-display__arrow">→</span>
      <span className="change-comparison-display__new">{formattedNewValue}</span>
    </span>
  );
};

/**
 * FieldChangeList 组件
 * 
 * @description
 * 批量展示多个字段变更的容器组件。
 * 用于在审计日志详情中展示一组相关的字段变更。
 * 
 * @param props - FieldChangeListProps
 * @returns React.ReactElement
 */
export interface FieldChangeListProps {
  changes: Array<{
    fieldName: string;
    oldValue?: string | number | null;
    newValue?: string | number | null;
    fieldType?: FieldType;
    isAuditable?: boolean;
  }>;
  showLabel?: boolean;
  showDirection?: boolean;
  className?: string;
  dateFormat?: string;
  currencySymbol?: string;
  decimalPlaces?: number;
}

const FieldChangeList: React.FC<FieldChangeListProps> = ({
  changes,
  showLabel = true,
  showDirection = true,
  className,
  dateFormat = 'YYYY-MM-DD',
  currencySymbol = '¥',
  decimalPlaces = 2,
}) => {
  return (
    <div className={cn('field-change-list', className)}>
      {changes.map((change, index) => (
        <ChangeComparison
          key={`${change.fieldName}-${index}`}
          fieldName={change.fieldName}
          oldValue={change.oldValue}
          newValue={change.newValue}
          fieldType={change.fieldType || FieldType.TEXT}
          isAuditable={change.isAuditable}
          showLabel={showLabel}
          showDirection={showDirection}
          dateFormat={dateFormat}
          currencySymbol={currencySymbol}
          decimalPlaces={decimalPlaces}
        />
      ))}
    </div>
  );
};

// 导出组件及类型
export {
  ChangeComparison,
  ChangeComparisonDisplay,
  FieldChangeList,
  formatDate,
  formatCurrency,
  formatNumber,
  formatPercentage,
  formatBoolean,
  formatEnum,
  getFormatter,
  calculateDirection,
  getDirectionDisplay,
};

export default ChangeComparison;