import React, { useCallback } from 'react';
import { Tree, Card, Empty, Spin, Typography, Tag } from 'antd';

const { Text } = Typography;

/**
 * 盘点范围树节点数据结构定义。
 * 用于描述位置树或分类树中的单个节点。
 */
export interface IInventoryScopeNode {
  /** 节点唯一标识 */
  key: string | number;
  /** 节点显示标题 */
  title: React.ReactNode;
  /** 是否为叶子节点 */
  isLeaf?: boolean;
  /** 子节点列表 */
  children?: IInventoryScopeNode[];
  /** 节点类型标识（位置/分类） */
  nodeType?: 'location' | 'category';
  /** 该节点直接关联的资产数量 */
  assetCount?: number;
  /** 允许携带其他业务扩展属性 */
  [key: string]: unknown;
}

/**
 * InventoryScopeSelector 组件属性接口。
 *
 * 设计原则：
 * - 受控组件模式：通过 value / onChange 管理选中状态
 * - 数据外置：treeData 由父组件通过 API 获取后传入，组件不负责数据持久化
 * - 标准 onChange 事件签名：与 Ant Design 表单生态兼容
 */
export interface InventoryScopeSelectorProps {
  /** 选择模式：按位置树或按分类树 */
  type: 'location' | 'category';
  /** 树形数据源，由父组件通过 API 获取后传入，保证组件高复用性 */
  treeData?: IInventoryScopeNode[];
  /** 当前已选中的 key 集合（受控模式） */
  value?: React.Key[];
  /**
   * 值变更回调（标准 onChange 事件）。
   * @param selectedKeys - 当前所有选中节点的 key 数组
   * @param selectedNodes - 当前所有选中节点的完整数据对象数组
   */
  onChange?: (selectedKeys: React.Key[], selectedNodes: IInventoryScopeNode[]) => void;
  /** 是否正在加载数据 */
  loading?: boolean;
  /** 是否禁用整棵树的选择 */
  disabled?: boolean;
  /** 无数据时的占位提示文字 */
  placeholder?: string;
  /** 组件容器自定义样式 */
  style?: React.CSSProperties;
  /** 组件容器自定义类名 */
  className?: string;
}

type CheckedTreeKeys =
  | React.Key[]
  | {
      checked: React.Key[];
      halfChecked?: React.Key[];
    };

interface CheckedTreeInfo {
  checkedNodes: IInventoryScopeNode[];
}

/**
 * InventoryScopeSelector —— 资产盘点范围选择器
 *
 * 独立封装的高复用性组件，支持「按位置树」和「按分类树」两种模式的多选。
 * 内部状态高内聚，对外暴露标准 onChange 事件。
 *
 * @example
 * ```tsx
 * // 按位置树选择
 * <InventoryScopeSelector
 *   type="location"
 *   treeData={locationTreeData}
 *   value={selectedLocationIds}
 *   onChange={(keys, nodes) => {
 *     form.setFieldValue('locationIds', keys);
 *   }}
 * />
 *
 * // 按分类树选择
 * <InventoryScopeSelector
 *   type="category"
 *   treeData={categoryTreeData}
 *   value={selectedCategoryIds}
 *   onChange={(keys, nodes) => {
 *     form.setFieldValue('categoryIds', keys);
 *   }}
 * />
 * ```
 */
const InventoryScopeSelector: React.FC<InventoryScopeSelectorProps> = React.memo(
  ({
    type,
    treeData = [],
    value = [],
    onChange,
    loading = false,
    disabled = false,
    placeholder,
    style,
    className,
  }) => {
    /** 根据选择模式生成默认占位提示文字 */
    const defaultPlaceholder =
      placeholder ?? (type === 'location' ? '暂无位置数据，请先维护位置信息' : '暂无分类数据，请先维护资产分类');

    /** 根据选择模式生成标题文案 */
    const titleText = type === 'location' ? '📍 选择盘点位置范围' : '🏷️ 选择资产分类范围';

    /**
     * 处理树节点勾选事件。
     * 从 Ant Design Tree 的 onCheck 回调中提取选中的 keys 和节点数据，
     * 并统一标注节点类型后通过 onChange 向上传递。
     */
    const handleCheck = useCallback(
      (checkedKeys, info) => {
        if (!onChange) return;

        // Ant Design onCheck 的 checkedKeys 可能是 Key[] 或 { checked: Key[], halfChecked: Key[] }
        const keys: React.Key[] = Array.isArray(checkedKeys)
          ? checkedKeys
          : checkedKeys.checked;

        // 从 info.checkedNodes 提取选中节点的完整数据对象
        const selectedNodes: IInventoryScopeNode[] = (
          info.checkedNodes as IInventoryScopeNode[]
        ).map((node) => ({
          ...node,
          nodeType: type,
        }));

        onChange(keys, selectedNodes);
      },
      [onChange, type]
    ) as (checkedKeys: CheckedTreeKeys, info: CheckedTreeInfo) => void;

    /**
     * 自定义树节点渲染函数。
     * 在节点标题旁展示该节点关联的资产数量标签，提升可视化效果。
     */
    const titleRender = useCallback(
      (nodeData: IInventoryScopeNode) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span>{nodeData.title}</span>
          {nodeData.assetCount !== undefined && nodeData.assetCount > 0 && (
            <Tag
              color="blue"
              style={{ marginLeft: 4, fontSize: 11, lineHeight: '18px', padding: '0 4px' }}
            >
              {nodeData.assetCount} 项
            </Tag>
          )}
        </span>
      ),
      []
    );

    // ─── 空状态渲染 ───────────────────────────────────────
    if (!loading && treeData.length === 0) {
      return (
        <Card className={className} style={style} size="small">
          <Empty
            description={defaultPlaceholder}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      );
    }

    // ─── 主渲染 ───────────────────────────────────────────
    return (
      <div
        className={className}
        style={{
          border: '1px solid #f0f0f0',
          borderRadius: 8,
          padding: 12,
          background: '#fff',
          opacity: disabled ? 0.6 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
          transition: 'opacity 0.2s',
          ...style,
        }}
        data-testid={`inventory-scope-selector-${type}`}
      >
        {/* 顶部标题栏：显示模式标题 + 已选节点计数 */}
        <div
          style={{
            marginBottom: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text strong>{titleText}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            已选 {value.length} 个节点
          </Text>
        </div>

        {/* 树形选择区域 */}
        <Card
          size="small"
          styles={{ body: { padding: 0, maxHeight: 360, overflowY: 'auto' } }}
        >
          {loading ? (
            <div
              style={{
                height: 200,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Spin />
              <Text type="secondary" style={{ fontSize: 12 }}>
                加载范围数据中...
              </Text>
            </div>
          ) : (
            <Tree
              checkable
              showLine
              defaultExpandAll
              checkedKeys={value}
              onCheck={handleCheck}
              disabled={disabled}
              treeData={treeData}
              titleRender={titleRender}
              selectable={false}
              blockNode
            />
          )}
        </Card>
      </div>
    );
  }
);

InventoryScopeSelector.displayName = 'InventoryScopeSelector';

export { InventoryScopeSelector };
export default InventoryScopeSelector;
