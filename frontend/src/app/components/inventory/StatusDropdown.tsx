import React, { useCallback, useMemo } from 'react';
import { Select, Tag } from 'antd';
import type { SelectProps } from 'antd';

/**
 * 实盘状态枚举 —— 对应单条资产在盘点执行过程中的盘点结果。
 *
 * 业务语义：
 *   - UNCHECKED: 未盘（默认初始态）
 *   - CHECKED:   已盘（账实相符）
 *   - SURPLUS:   盘盈（账面无，实盘有）
 *   - SHORTAGE:  盘亏（账面有，实盘无）
 *
 * @see ATB-04 资产清单逐条与批量确认
 * @see ATB-05 盘盈盘亏汇总
 */
export enum InventoryCheckStatus {
  UNCHECKED = 'unchecked',
  CHECKED = 'checked',
  SURPLUS = 'surplus',
  SHORTAGE = 'shortage',
}

/**
 * 状态选项的形状定义，用于自定义或默认选项列表。
 */
export interface StatusOption {
  /** 显示文本 */
  label: string;
  /** 选项值 */
  value: string;
  /** Ant Design Tag 颜色 token */
  color: string;
}

/**
 * 默认实盘状态选项配置。
 * 遵循 ATB-04 / ATB-05 中描述的四种实盘状态。
 */
export const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { label: '未盘', value: InventoryCheckStatus.UNCHECKED, color: 'default' },
  { label: '已盘', value: InventoryCheckStatus.CHECKED, color: 'success' },
  { label: '盘盈', value: InventoryCheckStatus.SURPLUS, color: 'blue' },
  { label: '盘亏', value: InventoryCheckStatus.SHORTAGE, color: 'error' },
];

/**
 * 构建状态值 → 配置的快速查找映射。
 * @param options - 选项列表
 * @returns 以 value 为 key 的 Record
 */
function buildConfigMap(options: StatusOption[]): Record<string, StatusOption> {
  const map: Record<string, StatusOption> = {};
  for (const opt of options) {
    map[opt.value] = opt;
  }
  return map;
}

/**
 * StatusDropdown 属性接口。
 *
 * 设计原则（SPEC 组件化约束）：
 *   - 内部状态高内聚：组件自行管理 Select 的展开/收起状态。
 *   - 对外暴露标准 onChange 事件：`(value, option) => void`，
 *     与 Ant Design Select 的 onChange 签名兼容，
 *     同时 option 为当前选中的 StatusOption 对象。
 */
export interface StatusDropdownProps {
  /** 当前选中的状态值（受控模式） */
  value?: string;

  /**
   * 状态变更回调。
   * @param value  - 新选中的状态值
   * @param option - 对应的 StatusOption 配置对象
   */
  onChange?: (value: string, option: StatusOption) => void;

  /**
   * 自定义状态选项列表。
   * 不传时使用 DEFAULT_STATUS_OPTIONS（未盘/已盘/盘盈/盘亏）。
   */
  options?: StatusOption[];

  /** 是否禁用交互 */
  disabled?: boolean;

  /**
   * 渲染模式：
   *   - 'select': 可交互的下拉选择器（用于盘点执行中的状态编辑）
   *   - 'tag':    只读 Tag 标签展示（用于表格内的只读预览或汇总面板）
   * @default 'select'
   */
  displayMode?: 'select' | 'tag';

  /** 透传给 Select / Tag 的自定义样式 */
  style?: React.CSSProperties;

  /** 自定义 CSS 类名 */
  className?: string;

  /** 选择框占位文本 */
  placeholder?: string;

  /** 尺寸，默认跟随全局 ConfigProvider */
  size?: SelectProps['size'];

  /** 下拉菜单弹出位置 */
  placement?: SelectProps['placement'];

  /** 是否允许清除已选值，默认 false */
  allowClear?: boolean;
}

/**
 * StatusDropdown —— 实盘状态下拉选择组件。
 *
 * 遵循 SPEC「组件化约束」：
 *   - 被封装为独立的高复用性组件；
 *   - 内部状态高内聚（自行管理 Select popup 展开/收起）；
 *   - 对外暴露标准 `onChange` 事件。
 *
 * 支持两种显示模式（displayMode）：
 *   1. `select` 模式：渲染 Ant Design Select，用于盘点执行工作台的可编辑表格中。
 *   2. `tag` 模式：渲染只读 Tag，用于差异汇总面板或表格的只读列。
 *
 * @example
 * ```tsx
 * // 可编辑模式
 * <StatusDropdown
 *   value={asset.checkStatus}
 *   onChange={(val, opt) => handleStatusChange(asset.id, val, opt)}
 * />
 *
 * // 只读 Tag 模式
 * <StatusDropdown
 *   value={asset.checkStatus}
 *   displayMode="tag"
 * />
 *
 * // 自定义选项
 * <StatusDropdown
 *   value={status}
 *   options={[
 *     { label: '待处理', value: 'pending', color: 'warning' },
 *     { label: '已完成', value: 'done', color: 'success' },
 *   ]}
 *   onChange={handleChange}
 * />
 * ```
 */
export const StatusDropdown: React.FC<StatusDropdownProps> = ({
  value,
  onChange,
  options = DEFAULT_STATUS_OPTIONS,
  disabled = false,
  displayMode = 'select',
  style,
  className,
  placeholder = '请选择状态',
  size,
  placement,
  allowClear = false,
}) => {
  /** 构建 value → config 的快速查找映射 */
  const configMap = useMemo(() => buildConfigMap(options), [options]);

  /** 获取当前值对应的配置，找不到时返回 fallback */
  const currentConfig = useMemo(() => {
    if (value && configMap[value]) {
      return configMap[value];
    }
    return null;
  }, [value, configMap]);

  /**
   * 状态变更处理器。
   * 将 Ant Design Select 的原始 onChange 转换为组件标准 onChange 签名。
   */
  const handleChange = useCallback(
    (selectedValue: string) => {
      if (onChange) {
        const matchedOption = configMap[selectedValue] ?? {
          label: selectedValue,
          value: selectedValue,
          color: 'default',
        };
        onChange(selectedValue, matchedOption);
      }
    },
    [onChange, configMap],
  );

  // ─── Tag 只读模式 ───
  if (displayMode === 'tag') {
    const tagLabel = currentConfig?.label ?? value ?? '-';
    const tagColor = currentConfig?.color ?? 'default';

    return (
      <Tag
        color={tagColor}
        className={className}
        style={{ margin: 0, ...style }}
        data-testid="status-tag"
      >
        {tagLabel}
      </Tag>
    );
  }

  // ─── Select 下拉选择模式 ───
  const selectOptions = useMemo(
    () =>
      options.map((opt) => ({
        label: opt.label,
        value: opt.value,
      })),
    [options],
  );

  return (
    <Select
      value={value}
      onChange={handleChange}
      options={selectOptions}
      disabled={disabled}
      placeholder={placeholder}
      allowClear={allowClear}
      size={size}
      placement={placement}
      className={className}
      style={{ minWidth: 120, ...style }}
      popupMatchSelectWidth={false}
      listHeight={200}
      data-testid="status-select"
    />
  );
};

StatusDropdown.displayName = 'StatusDropdown';

export default StatusDropdown;