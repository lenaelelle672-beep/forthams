/**
 * @module StatusDropdown
 * @description 实盘状态下拉选择原子组件，用于资产盘点执行页面中
 *              单条资产记录的实盘状态快速切换。
 *
 * 设计原则：
 * - 内部状态高内聚，对外暴露标准 `onChange` 事件
 * - 可直接嵌入 Ant Design Table 可编辑单元格或独立表单
 * - 不负责持久化，状态变更由父组件 / Store 统一处理
 */
import React, { useMemo, useCallback } from 'react';
import { Select } from 'antd';
import type { SelectProps } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons';

// ---------------------------------------------------------------------------
// 1. 类型 & 枚举
// ---------------------------------------------------------------------------

/**
 * 实盘状态枚举 — 资产在盘点过程中的实际盘点状态。
 *
 * | 值        | 含义                   |
 * |-----------|------------------------|
 * | PENDING   | 未盘（尚未执行盘点）    |
 * | CHECKED   | 已盘（账实相符）        |
 * | SURPLUS   | 盘盈（账面无，实盘有）  |
 * | SHORTAGE  | 盘亏（账面有，实盘无）  |
 * | ABNORMAL  | 异常（盘点发现异常）    |
 */
export enum InventoryScanStatus {
  PENDING = 'PENDING',
  CHECKED = 'CHECKED',
  SURPLUS = 'SURPLUS',
  SHORTAGE = 'SHORTAGE',
  ABNORMAL = 'ABNORMAL',
}

/** 单条状态的展示配置 */
interface StatusDisplayConfig {
  /** 中文标签 */
  label: string;
  /** 文字颜色 */
  color: string;
  /** Ant Design Tag 颜色值 */
  tagColor: string;
  /** 前置图标 */
  icon: React.ReactNode;
}

// ---------------------------------------------------------------------------
// 2. 状态展示配置（集中管理，便于后续国际化）
// ---------------------------------------------------------------------------

const STATUS_DISPLAY_CONFIG: Record<InventoryScanStatus, StatusDisplayConfig> = {
  [InventoryScanStatus.PENDING]: {
    label: '未盘',
    color: '#8c8c8c',
    tagColor: 'default',
    icon: <ClockCircleOutlined />,
  },
  [InventoryScanStatus.CHECKED]: {
    label: '已盘',
    color: '#52c41a',
    tagColor: 'success',
    icon: <CheckCircleOutlined />,
  },
  [InventoryScanStatus.SURPLUS]: {
    label: '盘盈',
    color: '#1890ff',
    tagColor: 'processing',
    icon: <PlusCircleOutlined />,
  },
  [InventoryScanStatus.SHORTAGE]: {
    label: '盘亏',
    color: '#ff4d4f',
    tagColor: 'error',
    icon: <MinusCircleOutlined />,
  },
  [InventoryScanStatus.ABNORMAL]: {
    label: '异常',
    color: '#faad14',
    tagColor: 'warning',
    icon: <ExclamationCircleOutlined />,
  },
};

// ---------------------------------------------------------------------------
// 3. 组件 Props
// ---------------------------------------------------------------------------

export interface StatusDropdownProps {
  /** 当前实盘状态（受控值） */
  value?: InventoryScanStatus;
  /** 状态变更回调，签名与标准表单控件一致 */
  onChange?: (value: InventoryScanStatus) => void;
  /** 是否禁用选择 */
  disabled?: boolean;
  /** 选择框宽度，默认 120px */
  width?: number | string;
  /** 选择框尺寸 */
  size?: 'small' | 'middle' | 'large';
  /** 透传样式 */
  style?: React.CSSProperties;
  /** 透传类名 */
  className?: string;
  /** 可选的状态白名单，不传则展示全部状态 */
  availableStatuses?: InventoryScanStatus[];
  /** 透传给 Select 的其他属性 */
  selectProps?: Partial<SelectProps>;
}

// ---------------------------------------------------------------------------
// 4. 组件实现
// ---------------------------------------------------------------------------

/**
 * StatusDropdown — 实盘状态下拉选择组件
 *
 * @example
 * ```tsx
 * <StatusDropdown
 *   value={asset.scanStatus}
 *   onChange={(newStatus) => handleStatusChange(asset.id, newStatus)}
 * />
 * ```
 *
 * 在 Ant Design Table 中作为可编辑单元格使用：
 * ```tsx
 * const columns = [
 *   {
 *     title: '实盘状态',
 *     dataIndex: 'scanStatus',
 *     render: (status: InventoryScanStatus, record) => (
 *       <StatusDropdown
 *         value={status}
 *         onChange={(v) => updateAssetStatus(record.id, v)}
 *       />
 *     ),
 *   },
 * ];
 * ```
 */
export const StatusDropdown: React.FC<StatusDropdownProps> = ({
  value = InventoryScanStatus.PENDING,
  onChange,
  disabled = false,
  width = 120,
  size = 'small',
  style,
  className,
  availableStatuses,
  selectProps,
}) => {
  // ---------- 构建下拉选项 ----------
  const options = useMemo<SelectProps['options']>(() => {
    const statuses = availableStatuses ?? Object.values(InventoryScanStatus);
    return statuses.map((statusKey) => {
      const config = STATUS_DISPLAY_CONFIG[statusKey];
      return {
        value: statusKey,
        // 选项内容：图标 + 文字
        label: (
          <span
            role="option-content"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {config.icon}
            <span>{config.label}</span>
          </span>
        ),
      };
    });
  }, [availableStatuses]);

  // ---------- 选中值渲染（带颜色和图标） ----------
  const labelRender = useCallback(
    (option: { value: unknown; label: React.ReactNode }) => {
      const config = STATUS_DISPLAY_CONFIG[option.value as InventoryScanStatus];
      if (!config) return option.label;
      return (
        <span
          style={{
            color: config.color,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 500,
          }}
        >
          {config.icon}
          {config.label}
        </span>
      );
    },
    [],
  );

  // ---------- 变更处理 ----------
  const handleChange = useCallback(
    (newValue: InventoryScanStatus) => {
      if (newValue !== value) {
        onChange?.(newValue);
      }
    },
    [value, onChange],
  );

  return (
    <Select<InventoryScanStatus>
      value={value}
      onChange={handleChange}
      options={options}
      labelRender={labelRender}
      disabled={disabled}
      size={size}
      variant="borderless"
      style={{ width, ...style }}
      className={className}
      popupMatchSelectWidth={false}
      listHeight={240}
      aria-label="实盘状态选择"
      data-testid="status-dropdown"
      {...selectProps}
    />
  );
};

StatusDropdown.displayName = 'StatusDropdown';

export default StatusDropdown;