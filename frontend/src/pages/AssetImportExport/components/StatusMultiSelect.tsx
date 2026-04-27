import React, { useMemo } from 'react';
import { Select, Tag } from 'antd';
import type { SelectProps } from 'antd';

/**
 * 资产状态选项定义
 * 硬编码选项，与 ATB-014 规格对齐：
 * - 在用、闲置、维修中、报废
 */
const STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '在用', value: 'in_use' },
  { label: '闲置', value: 'idle' },
  { label: '维修中', value: 'maintenance' },
  { label: '报废', value: 'scrapped' },
];

/**
 * 状态码 → 颜色映射，用于多选标签渲染
 */
const STATUS_COLOR_MAP: Record<string, string> = {
  in_use: 'green',
  idle: 'orange',
  maintenance: 'blue',
  scrapped: 'red',
};

/**
 * StatusMultiSelect 属性接口
 *
 * @property value - 当前选中的状态码数组（受控模式）
 * @property onChange - 选中值变化回调
 * @property placeholder - 占位文案，默认「请选择资产状态」
 * @property disabled - 是否禁用
 */
export interface StatusMultiSelectProps {
  /** 当前选中的状态码数组 */
  value?: string[];
  /** 选中值变化时的回调函数 */
  onChange?: (value: string[]) => void;
  /** 占位提示文案 */
  placeholder?: string;
  /** 是否禁用选择器 */
  disabled?: boolean;
}

/**
 * StatusMultiSelect — 资产状态多选组件
 *
 * 用于导出筛选面板（ExportFilterPanel / ExportFilterForm）中的资产状态维度筛选。
 * 基于 Ant Design Select mode="multiple" 封装，提供硬编码的四个资产状态选项。
 *
 * @example
 * ```tsx
 * <StatusMultiSelect
 *   value={selectedStatuses}
 *   onChange={setSelectedStatuses}
 * />
 * ```
 *
 * @see ATB-014 — 检查「资产状态」选择器为多选 Select 组件，选项含：在用、闲置、维修中、报废
 */
const StatusMultiSelect: React.FC<StatusMultiSelectProps> = ({
  value,
  onChange,
  placeholder = '请选择资产状态',
  disabled = false,
}) => {
  /**
   * 自定义 tagRender，为每个选中项渲染带颜色的 Tag
   */
  const tagRender: SelectProps['tagRender'] = useMemo(
    () => (props: Parameters<NonNullable<SelectProps['tagRender']>>[0]) => {
      const { label, closable, onClose } = props;
      const colorValue =
        STATUS_COLOR_MAP[String(props.value)] ?? 'default';

      return (
        <Tag
          color={colorValue}
          closable={closable}
          onClose={onClose}
          style={{ marginRight: 3 }}
        >
          {label}
        </Tag>
      );
    },
    [],
  );

  return (
    <Select
      mode="multiple"
      allowClear
      showSearch={false}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      options={STATUS_OPTIONS}
      tagRender={tagRender}
      style={{ width: '100%' }}
      maxTagCount="responsive"
      aria-label="资产状态筛选"
    />
  );
};

StatusMultiSelect.displayName = 'StatusMultiSelect';

export default StatusMultiSelect;