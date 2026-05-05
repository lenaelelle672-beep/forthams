/**
 * FieldDiffView Component
 * 
 * 字段变更 Diff 视图组件 - 展示 @Auditable 注解字段的变更详情
 * 
 * @description
 * - 渲染字段级变更对比视图
 * - 旧值使用红色背景高亮 (#fee2e2)
 * - 新值使用绿色背景高亮 (#dcfce7)
 * 
 * @spec SWARM-051 - Phase 4.2: 前端审计日志可视化集成
 * @test TC-051-03 - @Auditable 字段变更 Diff 展示
 * 
 * @example
 * ```tsx
 * <FieldDiffView changedFields={[
 *   { field: 'name', displayName: '资产名称', oldValue: '旧名称', newValue: '新名称' },
 *   { field: 'status', displayName: '资产状态', oldValue: '在用', newValue: '闲置' }
 * ]} />
 * ```
 */

import React from 'react';

/**
 * 变更字段数据结构
 * @interface ChangedField
 */
export interface ChangedField {
  /** @Auditable 注解字段名 */
  field: string;
  /** 前端展示名 */
  displayName: string;
  /** 变更前的值 */
  oldValue: unknown;
  /** 变更后的值 */
  newValue: unknown;
}

/**
 * FieldDiffView Props
 * @interface FieldDiffViewProps
 */
export interface FieldDiffViewProps {
  /** 变更字段列表 */
  changedFields: ChangedField[];
  /** 自定义类名 */
  className?: string;
  /** 是否显示字段名 */
  showFieldName?: boolean;
}

/**
 * 格式化字段值用于展示
 * 
 * @param value - 字段值
 * @returns 格式化后的字符串
 */
const formatFieldValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '空';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

/**
 * 单个字段 Diff 渲染组件
 * 
 * @param field - 变更字段数据
 * @param showFieldName - 是否显示字段名
 */
const FieldDiffItem: React.FC<{
  field: ChangedField;
  showFieldName: boolean;
}> = ({ field, showFieldName }) => {
  const oldValueFormatted = formatFieldValue(field.oldValue);
  const newValueFormatted = formatFieldValue(field.newValue);
  const hasChange = field.oldValue !== field.newValue;

  return (
    <div 
      className="field-diff-item mb-3 p-3 rounded-md bg-gray-50 border border-gray-200"
      data-testid="field-diff-item"
    >
      {showFieldName && (
        <div className="field-diff-label text-sm font-medium text-gray-700 mb-2">
          {field.displayName}
          <span className="ml-2 text-xs text-gray-400">({field.field})</span>
        </div>
      )}
      
      <div className="field-diff-values flex flex-col gap-2">
        {/* 旧值 */}
        <div className="flex items-start gap-2">
          <span className="text-xs font-semibold text-red-600 uppercase w-12 flex-shrink-0">
            旧值:
          </span>
          <span 
            className="diff-old-value px-2 py-1 rounded text-sm font-mono bg-red-100 text-red-800"
            style={{ backgroundColor: '#fee2e2' }}
            data-testid="diff-old-value"
          >
            {oldValueFormatted}
          </span>
        </div>
        
        {/* 新值 */}
        <div className="flex items-start gap-2">
          <span className="text-xs font-semibold text-green-600 uppercase w-12 flex-shrink-0">
            新值:
          </span>
          <span 
            className="diff-new-value px-2 py-1 rounded text-sm font-mono bg-green-100 text-green-800"
            style={{ backgroundColor: '#dcfce7' }}
            data-testid="diff-new-value"
          >
            {newValueFormatted}
          </span>
        </div>
      </div>

      {/* 无变化指示器 */}
      {!hasChange && (
        <div className="mt-2 text-xs text-gray-500 italic">
          (值未变化)
        </div>
      )}
    </div>
  );
};

/**
 * FieldDiffView Component
 * 
 * 字段变更 Diff 视图组件
 * 
 * @param props - FieldDiffViewProps
 * @returns React 组件
 */
const FieldDiffView: React.FC<FieldDiffViewProps> = ({
  changedFields,
  className = '',
  showFieldName = true,
}) => {
  // 空数据检查
  if (!changedFields || changedFields.length === 0) {
    return (
      <div 
        className={`field-diff-view-empty text-gray-500 text-sm ${className}`}
        data-testid="field-diff-empty"
      >
        暂无字段变更
      </div>
    );
  }

  return (
    <div 
      className={`field-diff-view ${className}`}
      data-testid="field-diff-view"
    >
      <div className="field-diff-header mb-3">
        <h4 className="text-sm font-semibold text-gray-700">
          字段变更详情
          <span className="ml-2 text-xs text-gray-400">
            ({changedFields.length} 项)
          </span>
        </h4>
      </div>
      
      <div className="field-diff-list">
        {changedFields.map((field, index) => (
          <FieldDiffItem 
            key={`${field.field}-${index}`}
            field={field}
            showFieldName={showFieldName}
          />
        ))}
      </div>
    </div>
  );
};

export default FieldDiffView;