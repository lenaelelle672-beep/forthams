import React, { useMemo, useCallback } from 'react';
import { TreeSelect, Tag, Empty, Spin } from 'antd';
import type { TreeSelectProps } from 'antd';
import { EnvironmentOutlined, AppstoreOutlined } from '@ant-design/icons';

/**
 * Represents a selected node in the inventory scope tree with full metadata.
 */
export interface ScopeNode {
  /** Unique identifier of the tree node */
  key: string;
  /** Display label of the tree node */
  title: React.ReactNode;
  /** Arbitrary data payload attached to the tree node */
  data?: Record<string, unknown>;
}

/**
 * Props for the InventoryScopeSelector component.
 *
 * Renders a tree-based multi-select widget for choosing inventory scope —
 * either by physical location hierarchy or by asset category hierarchy.
 * Encapsulates internal selection logic and exposes a standard `onChange`
 * callback that returns rich node metadata rather than bare key arrays.
 */
export interface InventoryScopeSelectorProps {
  /** Ant Design TreeSelect-compatible tree data */
  treeData: TreeSelectProps['treeData'];
  /** Currently selected node keys (controlled value) */
  value?: string[];
  /** Fires when the user changes selection; returns full node metadata */
  onChange?: (selectedNodes: ScopeNode[]) => void;
  /** Tree display mode — 'location' or 'category' (affects icon & placeholder) */
  mode?: 'location' | 'category';
  /** If true, only leaf nodes can be checked (default false) */
  leafOnly?: boolean;
  /** Show loading spinner overlay */
  loading?: boolean;
  /** Placeholder text (auto-derived from mode if omitted) */
  placeholder?: string;
  /** Show removable tags below the selector summarising current selection */
  showSelectedTags?: boolean;
  /** Disable the selector */
  disabled?: boolean;
  /** Maximum selectable items (0 = unlimited) */
  maxCount?: number;
  /** Extra CSS class */
  className?: string;
  /** Extra inline style */
  style?: React.CSSProperties;
}

/** Destructure static strategy constant from TreeSelect */
const { SHOW_CHILD } = TreeSelect;

/**
 * InventoryScopeSelector — a high-reuse tree-based scope selector for
 * inventory tasks.
 *
 * Features:
 * - Multi-select via checkboxes (`treeCheckable`)
 * - Optional leaf-only constraint (disables parent-node checkboxes)
 * - Controlled `value` / `onChange` interface returning rich `ScopeNode[]`
 * - Removable tag preview of current selection
 * - Supports both location and category hierarchies
 */
const InventoryScopeSelector: React.FC<InventoryScopeSelectorProps> = ({
  treeData,
  value,
  onChange,
  mode = 'location',
  leafOnly = false,
  loading = false,
  placeholder,
  showSelectedTags = true,
  disabled = false,
  maxCount = 0,
  className,
  style,
}) => {
  /* ------------------------------------------------------------------ */
  /*  Processed tree data — enforce leafOnly by disabling parent nodes  */
  /* ------------------------------------------------------------------ */
  const processedTreeData = useMemo(() => {
    if (!treeData || !leafOnly) return treeData;

    const disableParents = (
      nodes: NonNullable<TreeSelectProps['treeData']>,
    ): any[] =>
      (nodes as unknown[]).map((node) => {
        const hasChildren =
          Array.isArray(node.children) && node.children.length > 0;
        return {
          ...node,
          disableCheckbox: hasChildren,
          selectable: !hasChildren,
          children: hasChildren ? disableParents(node.children) : undefined,
        } as Record<string, unknown>;
      });

    return disableParents(treeData);
  }, [treeData, leafOnly]);

  /* ------------------------------------------------------------------ */
  /*  Flat key → node map for O(1) lookups when resolving tags         */
  /* ------------------------------------------------------------------ */
  const nodeMap = useMemo(() => {
    const map = new Map<string, ScopeNode>();
    if (!treeData) return map;

    const walk = (nodes: any[]) => {
      for (const node of nodes) {
        const nodeKey = String(node.key ?? node.value ?? '');
        if (nodeKey) {
          map.set(nodeKey, {
            key: nodeKey,
            title: node.title ?? node.label ?? nodeKey,
            data: node.data,
          });
        }
        if (Array.isArray(node.children)) {
          walk(node.children);
        }
      }
    };

    walk(treeData as unknown[]);
    return map;
  }, [treeData]);

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  /** Resolve an array of keys into full ScopeNode objects */
  const resolveNodes = useCallback(
    (keys: string[]): ScopeNode[] =>
      keys.map((k) => nodeMap.get(k) ?? { key: k, title: k }),
    [nodeMap],
  );

  /** TreeSelect onChange → normalised ScopeNode[] callback */
  const handleChange = useCallback(
    (newValue: string | string[]) => {
      if (!onChange) return;
      const keys = Array.isArray(newValue)
        ? newValue
        : newValue
          ? [newValue]
          : [];
      onChange(resolveNodes(keys));
    },
    [onChange, resolveNodes],
  );

  /** Remove a single key from the current selection */
  const handleTagClose = useCallback(
    (keyToRemove: string) => {
      if (!value || !onChange) return;
      const updated = value.filter((k) => k !== keyToRemove);
      onChange(resolveNodes(updated));
    },
    [value, onChange, resolveNodes],
  );

  /* ------------------------------------------------------------------ */
  /*  Derived display values                                            */
  /* ------------------------------------------------------------------ */
  const defaultPlaceholder =
    placeholder ??
    (mode === 'location' ? '请选择位置范围…' : '请选择分类范围…');

  const modeIcon =
    mode === 'location' ? <EnvironmentOutlined /> : <AppstoreOutlined />;

  const modeLabel = mode === 'location' ? '位置' : '分类';

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */
  return (
    <div className={className} style={style}>
      <Spin spinning={loading} tip="加载中…">
        <TreeSelect
          treeData={processedTreeData}
          value={value}
          onChange={handleChange}
          treeCheckable
          showCheckedStrategy={SHOW_CHILD}
          allowClear
          showSearch
          placeholder={defaultPlaceholder}
          disabled={disabled || loading}
          style={{ width: '100%' }}
          dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
          treeNodeFilterProp="title"
          suffixIcon={modeIcon}
          maxTagCount={maxCount > 0 ? maxCount : undefined}
          treeNodeLabelProp="title"
          notFoundContent={
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={`暂无${modeLabel}数据`}
            />
          }
        />
      </Spin>

      {/* ---- Selected tags preview below the selector ---- */}
      {showSelectedTags && value && value.length > 0 && (
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            alignItems: 'center',
          }}
        >
          <span
            style={{
              color: 'var(--ant-color-text-secondary, #999)',
              fontSize: 12,
              lineHeight: '24px',
              marginRight: 4,
            }}
          >
            已选{modeLabel}：
          </span>
          {value.map((key) => {
            const node = nodeMap.get(key);
            return (
              <Tag
                key={key}
                closable={!disabled}
                color="blue"
                onClose={(e) => {
                  e.preventDefault();
                  handleTagClose(key);
                }}
              >
                {node?.title ?? key}
              </Tag>
            );
          })}
        </div>
      )}
    </div>
  );
};

export { InventoryScopeSelector };
export default InventoryScopeSelector;