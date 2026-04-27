/**
 * FieldChangeHighlight Component
 * 
 * 字段变更高亮组件 - 用于展示 @Auditable 注解标记的字段变更
 * 支持高亮显示、渐隐动画、变更标签等功能
 * 
 * @module audit/components
 * @requires React
 * @requires antd
 */

import React, { useEffect, useState } from 'react';
import { Tag, Tooltip } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import './FieldChangeHighlight.css';

/**
 * 字段变更数据接口
 */
export interface FieldChangeData {
  /** 字段名称 */
  fieldName: string;
  /** 旧值 */
  oldValue: string | null;
  /** 新值 */
  newValue: string | null;
  /** 是否为 @Auditable 标记的字段 */
  isAuditable: boolean;
  /** 字段中文名称（可选） */
  fieldLabel?: string;
}

/**
 * FieldChangeHighlight 组件属性接口
 */
export interface FieldChangeHighlightProps {
  /** 字段变更数据 */
  data: FieldChangeData;
  /** 高亮持续时间（毫秒），默认 3000ms */
  highlightDuration?: number;
  /** 是否显示变更标签 */
  showChangeTag?: boolean;
  /** 是否启用渐隐动画 */
  enableFadeAnimation?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 字段变更高亮组件
 * 
 * 功能说明：
 * 1. 被 @Auditable 标记的字段在变更后显示高亮背景
 * 2. 高亮状态持续指定时间后渐隐
 * 3. 字段旁边显示"已变更"标签
 * 4. 支持旧值（新值）对比展示
 * 
 * @example
 * ```tsx
 * <FieldChangeHighlight
 *   data={{
 *     fieldName: 'assetName',
 *     fieldLabel: '资产名称',
 *     oldValue: '旧名称',
 *     newValue: '新名称',
 *     isAuditable: true
 *   }}
 * />
 * ```
 * 
 * @param props - 组件属性
 * @returns React 组件
 */
export const FieldChangeHighlight: React.FC<FieldChangeHighlightProps> = ({
  data,
  highlightDuration = 3000,
  showChangeTag = true,
  enableFadeAnimation = true,
  className = ''
}) => {
  // 高亮状态
  const [isHighlighted, setIsHighlighted] = useState(false);
  // 渐隐状态
  const [isFading, setIsFading] = useState(false);

  // 初始化高亮状态
  useEffect(() => {
    if (data.isAuditable && data.oldValue !== data.newValue) {
      setIsHighlighted(true);
      setIsFading(false);

      // 如果启用了渐隐动画
      if (enableFadeAnimation && highlightDuration > 0) {
        const fadeTimer = setTimeout(() => {
          setIsFading(true);
        }, highlightDuration);

        const clearTimer = setTimeout(() => {
          setIsHighlighted(false);
          setIsFading(false);
        }, highlightDuration + 500); // 渐隐动画 500ms

        return () => {
          clearTimeout(fadeTimer);
          clearTimeout(clearTimer);
        };
      }
    }
  }, [data, highlightDuration, enableFadeAnimation]);

  // 非 @Auditable 字段不显示任何提示
  if (!data.isAuditable) {
    return null;
  }

  // 计算样式
  const getContainerClass = () => {
    let classes = ['field-change-highlight'];
    if (isHighlighted) classes.push('highlighted');
    if (isFading) classes.push('fading');
    if (className) classes.push(className);
    return classes.join(' ');
  };

  // 格式化显示值
  const formatValue = (value: string | null): string => {
    if (value === null || value === undefined) {
      return '-';
    }
    return value;
  };

  // 判断是否有变更
  const hasChange = data.oldValue !== data.newValue;

  return (
    <div className={getContainerClass()} data-field={data.fieldName}>
      {/* 字段标签 */}
      <span className="field-label">
        {data.fieldLabel || data.fieldName}
      </span>

      {/* 变更内容 */}
      <div className="field-change-content">
        {/* 旧值 */}
        {data.oldValue !== null && (
          <span className="old-value" title={`旧值: ${formatValue(data.oldValue)}`}>
            {formatValue(data.oldValue)}
          </span>
        )}

        {/* 箭头指示 */}
        {hasChange && (
          <span className="change-arrow">→</span>
        )}

        {/* 新值 */}
        <span className="new-value" title={`新值: ${formatValue(data.newValue)}`}>
          {formatValue(data.newValue)}
        </span>

        {/* 变更标签 */}
        {showChangeTag && hasChange && (
          <Tag 
            color="orange" 
            className="change-tag"
            icon={<ExclamationCircleOutlined />}
          >
            已变更
          </Tag>
        )}
      </div>

      {/* 悬停提示 */}
      <Tooltip title={`字段: ${data.fieldName}`}>
        <ExclamationCircleOutlined className="field-tooltip-icon" />
      </Tooltip>
    </div>
  );
};

/**
 * 批量渲染字段变更列表
 * 
 * @param changes - 字段变更数据数组
 * @param props - FieldChangeHighlight 的其他属性
 * @returns React 元素数组
 */
export const renderFieldChanges = (
  changes: FieldChangeData[],
  props?: Omit<FieldChangeHighlightProps, 'data'>
): React.ReactNode[] => {
  return changes.map((change, index) => (
    <FieldChangeHighlight
      key={`${change.fieldName}-${index}`}
      data={change}
      {...props}
    />
  ));
};

export default FieldChangeHighlight;