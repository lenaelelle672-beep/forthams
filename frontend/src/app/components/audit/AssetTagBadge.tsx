/**
 * AssetTagBadge Component
 * 
 * @description
 * 资产标签徽章组件，用于在资产详情页面和审计日志中展示资产标签信息。
 * 支持多种标签类型渲染，具有良好的可访问性和视觉反馈。
 * 
 * @module components/audit/AssetTagBadge
 * @version 1.0.0
 * @author SWARM-051 Frontend Team
 * @since Iteration 2 - SWARM-051
 * 
 * @features
 * - 支持多种标签类型（primary, success, warning, danger, info, default）
 * - 支持可选的关闭按钮交互
 * - 支持自定义尺寸（小、中、大）
 * - 支持禁用状态
 * - 支持 tooltip 展示完整标签名（当标签名过长时）
 * - 与 Ant Design Badge 组件无缝集成
 * 
 * @usage
 * ```tsx
 * // 基础用法
 * <AssetTagBadge tag="固定资产" />
 * 
 * // 带类型
 * <AssetTagBadge tag="重要设备" type="warning" />
 * 
 * // 可关闭
 * <AssetTagBadge tag="待审核" closable onClose={handleClose} />
 * 
 * // 多个标签
 * <div className="flex gap-2">
 *   {tags.map(tag => <AssetTagBadge key={tag.id} tag={tag.name} type={tag.type} />)}
 * </div>
 * ```
 */

import React, { useCallback, useMemo } from 'react';
import { Tag, Tooltip, Badge } from 'antd';
import { 
  CloseCircleOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  TagOutlined
} from '@ant-design/icons';
import type { TagProps } from 'antd';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * 标签类型枚举
 * 定义了所有支持的资产标签类型
 */
export enum AssetTagType {
  /** 主要标签 - 蓝色 */
  PRIMARY = 'primary',
  /** 成功标签 - 绿色 */
  SUCCESS = 'success',
  /** 警告标签 - 橙色 */
  WARNING = 'warning',
  /** 危险标签 - 红色 */
  DANGER = 'danger',
  /** 信息标签 - 浅蓝 */
  INFO = 'info',
  /** 默认标签 - 灰色 */
  DEFAULT = 'default'
}

/**
 * 标签尺寸枚举
 */
export enum AssetTagSize {
  /** 小尺寸 */
  SMALL = 'small',
  /** 中尺寸（默认） */
  MEDIUM = 'medium',
  /** 大尺寸 */
  LARGE = 'large'
}

/**
 * 资产标签数据结构
 */
export interface AssetTag {
  /** 标签ID */
  id?: string;
  /** 标签名称 */
  name: string;
  /** 标签类型 */
  type?: AssetTagType;
  /** 标签颜色（自定义颜色，覆盖type） */
  color?: string;
  /** 是否可关闭 */
  closable?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否显示计数 */
  showCount?: boolean;
  /** 计数数值 */
  count?: number;
  /** 额外样式类 */
  className?: string;
}

/**
 * AssetTagBadge 组件属性
 */
export interface AssetTagBadgeProps {
  /** 标签名称 */
  tag: string;
  /** 标签类型 */
  type?: AssetTagType;
  /** 自定义颜色 */
  color?: string;
  /** 标签尺寸 */
  size?: AssetTagSize;
  /** 是否可关闭 */
  closable?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否显示计数 */
  showCount?: boolean;
  /** 计数数值 */
  count?: number;
  /** 关闭按钮点击回调 */
  onClose?: (tag: string) => void;
  /** 点击事件回调 */
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  /** tooltip 显示的最大字符数 */
  tooltipMaxLength?: number;
  /** 额外样式类 */
  className?: string;
  /** 额外样式 */
  style?: React.CSSProperties;
  /** 测试ID */
  'data-testid'?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * 标签尺寸到 Ant Design Tag 尺寸的映射
 */
const SIZE_MAP: Record<AssetTagSize, TagProps['size']> = {
  [AssetTagSize.SMALL]: 'small',
  [AssetTagSize.MEDIUM]: undefined,
  [AssetTagSize.LARGE]: 'large'
};

/**
 * 类型对应的默认颜色
 */
const TYPE_COLORS: Record<AssetTagType, string> = {
  [AssetTagType.PRIMARY]: '#1890ff',
  [AssetTagType.SUCCESS]: '#52c41a',
  [AssetTagType.WARNING]: '#faad14',
  [AssetTagType.DANGER]: '#ff4d4f',
  [AssetTagType.INFO]: '#13c2c2',
  [AssetTagType.DEFAULT]: '#d9d9d9'
};

/**
 * 类型对应的图标
 */
const TYPE_ICONS: Partial<Record<AssetTagType, React.ReactNode>> = {
  [AssetTagType.SUCCESS]: <CheckCircleOutlined />,
  [AssetTagType.WARNING]: <ExclamationCircleOutlined />,
  [AssetTagType.DANGER]: <CloseCircleOutlined />,
  [AssetTagType.INFO]: <InfoCircleOutlined />
};

/**
 * 默认 tooltip 最大字符数
 */
const DEFAULT_TOOLTIP_MAX_LENGTH = 15;

// ============================================================================
// Component
// ============================================================================

/**
 * AssetTagBadge 组件
 * 
 * @description
 * 资产标签徽章组件，用于展示资产相关的各类标签。
 * 支持多种视觉样式和交互状态。
 * 
 * @param props - AssetTagBadgeProps
 * @returns React 组件
 * 
 * @example
 * ```tsx
 * // 基础用法
 * <AssetTagBadge tag="固定资产" />
 * 
 * // 带类型和颜色
 * <AssetTagBadge tag="重要设备" type="warning" />
 * 
 * // 可关闭标签
 * <AssetTagBadge tag="待审核" closable onClose={() => {}} />
 * 
 * // 带计数
 * <AssetTagBadge tag="待处理" showCount count={5} />
 * ```
 * 
 * @since 1.0.0
 */
export const AssetTagBadge: React.FC<AssetTagBadgeProps> = ({
  tag,
  type = AssetTagType.DEFAULT,
  color,
  size = AssetTagSize.MEDIUM,
  closable = false,
  disabled = false,
  showCount = false,
  count,
  onClose,
  onClick,
  tooltipMaxLength = DEFAULT_TOOLTIP_MAX_LENGTH,
  className,
  style,
  'data-testid': testId
}) => {
  
  /**
   * 计算最终的显示颜色
   * 优先级：自定义color > 类型对应的默认颜色
   */
  const displayColor = useMemo(() => {
    return color || TYPE_COLORS[type];
  }, [color, type]);

  /**
   * 判断标签名是否需要显示 tooltip
   */
  const needsTooltip = useMemo(() => {
    return tag.length > tooltipMaxLength;
  }, [tag, tooltipMaxLength]);

  /**
   * 处理关闭事件
   */
  const handleClose = useCallback(() => {
    if (onClose && !disabled) {
      onClose(tag);
    }
  }, [onClose, tag, disabled]);

  /**
   * 处理点击事件
   */
  const handleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (onClick && !disabled) {
      onClick(e);
    }
  }, [onClick, disabled]);

  /**
   * 构建 Tag 组件的 props
   */
  const tagProps = useMemo((): TagProps => {
    const props: TagProps = {
      color: displayColor,
      closable: closable && !disabled,
      onClose: handleClose,
      onClick: handleClick,
      className: className,
      style: {
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        ...style
      },
      'data-testid': testId
    };

    // 添加尺寸
    if (size !== AssetTagSize.MEDIUM) {
      props.size = SIZE_MAP[size];
    }

    return props;
  }, [
    displayColor, 
    closable, 
    disabled, 
    handleClose, 
    handleClick, 
    className, 
    style, 
    size, 
    testId
  ]);

  /**
   * 渲染带计数的标签
   */
  const renderTagWithCount = useCallback((content: React.ReactNode) => {
    if (!showCount || count === undefined) {
      return content;
    }

    return (
      <Badge 
        count={count} 
        size="small"
        overflowCount={99}
      >
        {content}
      </Badge>
    );
  }, [showCount, count]);

  /**
   * 渲染标签内容
   */
  const renderTagContent = useCallback(() => {
    const icon = TYPE_ICONS[type];
    const content = (
      <>
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
        {needsTooltip ? (
          <span className="asset-tag-text">{tag}</span>
        ) : (
          tag
        )}
      </>
    );

    return renderTagWithCount(content);
  }, [type, needsTooltip, tag, renderTagWithCount]);

  /**
   * 渲染带 Tooltip 的标签
   */
  const renderBadge = useCallback(() => {
    const tagElement = (
      <Tag {...tagProps}>
        {renderTagContent()}
      </Tag>
    );

    if (needsTooltip) {
      return (
        <Tooltip 
          title={tag}
          mouseEnterDelay={0.5}
          placement="top"
        >
          {tagElement}
        </Tooltip>
      );
    }

    return tagElement;
  }, [needsTooltip, tag, tagProps, renderTagContent]);

  return renderBadge();
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 批量渲染资产标签列表
 * 
 * @description
 * 便捷函数，用于渲染一组资产标签。
 * 
 * @param tags - 资产标签数组
 * @param options - 渲染选项
 * @returns React 节点数组
 * 
 * @example
 * ```tsx
 * const tags: AssetTag[] = [
 *   { name: '重要设备', type: AssetTagType.WARNING },
 *   { name: '固定资产', type: AssetTagType.PRIMARY }
 * ];
 * 
 * <div className="tag-list">
 *   {renderAssetTags(tags)}
 * </div>
 * ```
 */
export const renderAssetTags = (
  tags: AssetTag[],
  options?: {
    size?: AssetTagSize;
    onClose?: (tag: string) => void;
    onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  }
): React.ReactNode[] => {
  return tags.map((tagItem, index) => (
    <AssetTagBadge
      key={tagItem.id || `tag-${index}`}
      tag={tagItem.name}
      type={tagItem.type}
      color={tagItem.color}
      size={options?.size}
      closable={tagItem.closable}
      disabled={tagItem.disabled}
      showCount={tagItem.showCount}
      count={tagItem.count}
      onClose={options?.onClose}
      onClick={options?.onClick}
      data-testid={`asset-tag-${tagItem.id || index}`}
    />
  ));
};

/**
 * 根据资产状态获取对应的标签类型
 * 
 * @description
 * 根据资产的状态值返回对应的标签类型。
 * 
 * @param status - 资产状态值
 * @returns 对应的 AssetTagType
 * 
 * @example
 * ```tsx
 * const status = 'IN_USE';
 * const tagType = getTagTypeByStatus(status);
 * <AssetTagBadge tag={status} type={tagType} />
 * ```
 */
export const getTagTypeByStatus = (status: string): AssetTagType => {
  const statusMap: Record<string, AssetTagType> = {
    // 资产使用状态
    'IN_USE': AssetTagType.SUCCESS,
    'IDLE': AssetTagType.WARNING,
    'SCRAPPED': AssetTagType.DEFAULT,
    'MAINTENANCE': AssetTagType.INFO,
    'TRANSFERRED': AssetTagType.PRIMARY,
    'DISPOSED': AssetTagType.DANGER,
    
    // 审批状态
    'PENDING': AssetTagType.WARNING,
    'APPROVED': AssetTagType.SUCCESS,
    'REJECTED': AssetTagType.DANGER,
    
    // 审计操作类型
    'CREATE': AssetTagType.SUCCESS,
    'UPDATE': AssetTagType.PRIMARY,
    'DELETE': AssetTagType.DANGER,
    'VIEW': AssetTagType.INFO
  };

  return statusMap[status.toUpperCase()] || AssetTagType.DEFAULT;
};

/**
 * 根据资产类别获取对应的标签类型
 * 
 * @description
 * 根据资产的类别返回对应的标签类型，用于在审计日志中区分不同类型的资产变更。
 * 
 * @param category - 资产类别
 * @returns 对应的 AssetTagType
 */
export const getTagTypeByCategory = (category: string): AssetTagType => {
  const categoryMap: Record<string, AssetTagType> = {
    'ELECTRONICS': AssetTagType.PRIMARY,
    'FURNITURE': AssetTagType.INFO,
    'VEHICLE': AssetTagType.WARNING,
    'BUILDING': AssetTagType.DEFAULT,
    'MACHINERY': AssetTagType.WARNING,
    'OTHER': AssetTagType.DEFAULT
  };

  return categoryMap[category.toUpperCase()] || AssetTagType.DEFAULT;
};

// ============================================================================
// Default Export
// ============================================================================

export default AssetTagBadge;