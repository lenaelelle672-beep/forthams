/**
 * ScopeSelector — 盘点范围选择器组件
 *
 * 支持三种互斥的盘点范围选择模式：
 * 1. 挌位置树多选（scopeType = 'location'）
 * 2. 按分类树多选（scopeType = 'category'）
 * 3. 全部资产（scopeType = 'all'）
 *
 * 作为受控组件使用，通过 value / onChange 与父表单集成。
 * 切换 Tab 时自动清空前一种模式的已选节点（互斥行为）。
 *
 * @see SWARM-P3-010-B 新建盘点任务弹窗（范围选择器）
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Tabs, Tree, Alert, Tag, Empty, Spin, Typography, Button } from 'antd';
import {
  EnvironmentOutlined,
  AppstoreOutlined,
  GlobalOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { TreeProps } from 'antd';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 盘点范围类型，与后端 scopeType 字段对齐 */
export type ScopeType = 'location' | 'category' | 'all';

/** ScopeSelector 组件属性接口 */
export interface ScopeSelectorProps {
  /** 当前选中的范围值（受控模式） */
  value: { scopeType: ScopeType; scopeIds: string[] };
  /** 范围变更回调 */
  onChange: (value: { scopeType: ScopeType; scopeIds: string[] }) => void;
}

/** 树节点数据结构（兼容 Ant Design DataNode） */
interface TreeNodeData {
  key: string;
  title: string;
  children?: TreeNodeData[];
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 递归构建 key → title 映射表，用于将 scopeId 解析为可读名称
 *
 * @param nodes - 树节点数组
 * @returns key 到 title 的映射 Map
 */
function buildKeyTitleMap(nodes: TreeNodeData[]): Map<string, string> {
  const map = new Map<string, string>();
  const traverse = (items: TreeNodeData[]) => {
    for (const item of items) {
      map.set(String(item.key), item.title);
      if (item.children?.length) {
        traverse(item.children);
      }
    }
  };
  traverse(nodes);
  return map;
}

/**
 * 通用树数据获取函数
 *
 * @param url - API 端点 URL
 * @returns 解析后的树节点数组
 * @throws 网络错误或非 200 响应
 */
async function fetchTreeData(url: string): Promise<TreeNodeData[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`请求失败 (HTTP ${response.status})`);
  }
  const raw = await response.json();
  // 兼容 { data: [...] } 或直接返回数组的响应格式
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  return [];
}

// ---------------------------------------------------------------------------
// 自定义 Hook：树数据加载
// ---------------------------------------------------------------------------

/**
 * 管理单棵树的数据加载、加载状态和错误状态
 *
 * @param url - API 端点 URL
 * @returns { data, loading, error, retry } 状态元组
 */
function useTreeData(url: string): {
  data: TreeNodeData[];
  loading: boolean;
  error: string | null;
  retry: () => void;
} {
  const [data, setData] = useState<TreeNodeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryFlag, setRetryFlag] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchTreeData(url);
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setError('加载数据失败，请重试');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [url, retryFlag]);

  const retry = useCallback(() => {
    setRetryFlag((prev) => prev + 1);
  }, []);

  return { data, loading, error, retry };
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

/**
 * ScopeSelector 盘点范围选择器
 *
 * 提供"按位置树多选"、"按分类多选"、"全部资产"三种互斥 Tab，
 * 选中结果通过受控 value/onChange 回调上报给父级表单。
 *
 * @param props - ScopeSelectorProps
 * @returns React 组件
 */
const ScopeSelector: React.FC<ScopeSelectorProps> = ({ value, onChange }) => {
  // ---- 树数据加载 ----
  const locationTree = useTreeData('/api/v1/locations/tree');
  const categoryTree = useTreeData('/api/v1/categories/tree');

  // ---- key → title 映射 ----
  const locationKeyMap = useMemo(
    () => buildKeyTitleMap(locationTree.data),
    [locationTree.data],
  );
  const categoryKeyMap = useMemo(
    () => buildKeyTitleMap(categoryTree.data),
    [categoryTree.data],
  );

  /** 当前激活的范围类型对应的 key-title 映射 */
  const currentKeyMap = useMemo(() => {
    switch (value.scopeType) {
      case 'location':
        return locationKeyMap;
      case 'category':
        return categoryKeyMap;
      default:
        return new Map<string, string>();
    }
  }, [value.scopeType, locationKeyMap, categoryKeyMap]);

  // ---- 事件处理 ----

  /**
   * Tab 切换处理：切换范围类型并清空已选节点（互斥行为）
   *
   * @param key - 新激活的 Tab key，对应 ScopeType
   */
  const handleTabChange = useCallback(
    (key: string) => {
      onChange({ scopeType: key as ScopeType, scopeIds: [] });
    },
    [onChange],
  );

  /**
   * 树节点勾选处理：更新 scopeIds
   *
   * @param checkedKeys - Ant Design Tree 返回的已勾选 key 集合
   */
  const handleTreeCheck: TreeProps['onCheck'] = useCallback(
    (checkedKeys) => {
      const keys = Array.isArray(checkedKeys)
        ? checkedKeys
        : checkedKeys.checked;
      onChange({
        scopeType: value.scopeType,
        scopeIds: keys.map(String),
      });
    },
    [value.scopeType, onChange],
  );

  /**
   * 移除单个已选节点
   *
   * @param id - 要移除的节点 key
   */
  const handleRemoveItem = useCallback(
    (id: string) => {
      const newIds = value.scopeIds.filter((sid) => sid !== id);
      onChange({ scopeType: value.scopeType, scopeIds: newIds });
    },
    [value.scopeType, value.scopeIds, onChange],
  );

  /**
   * 清空所有已选节点
   */
  const handleClearAll = useCallback(() => {
    onChange({ scopeType: value.scopeType, scopeIds: [] });
  }, [value.scopeType, onChange]);

  // ---- 渲染辅助 ----

  /**
   * 渲染带加载态和错误态的树组件
   *
   * @param treeData - 树节点数据
   * @param loading - 是否加载中
   * @param error - 错误信息
   * @param onRetry - 重试回调
   * @param emptyText - 空数据提示文案
   * @returns React 节点
   */
  const renderTree = (
    treeData: TreeNodeData[],
    loading: boolean,
    error: string | null,
    onRetry: () => void,
    emptyText: string,
  ): React.ReactNode => {
    if (loading) {
      return (
        <div
          style={{ textAlign: 'center', padding: '40px 0' }}
          aria-busy="true"
          aria-label="正在加载数据"
        >
          <Spin tip="加载中..." />
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Alert
            message={error}
            type="error"
            showIcon
            action={
              <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>
                重试
              </Button>
            }
          />
        </div>
      );
    }

    if (treeData.length === 0) {
      return <Empty description={emptyText} />;
    }

    return (
      <Tree
        checkable
        checkedKeys={value.scopeIds}
        onCheck={handleTreeCheck}
        treeData={treeData}
        defaultExpandAll={false}
        selectable={false}
        style={{ maxHeight: 320, overflowY: 'auto' }}
        aria-label="范围选择树"
      />
    );
  };

  // ---- Tab 配置 ----

  const tabItems = [
    {
      key: 'location',
      label: (
        <span>
          <EnvironmentOutlined /> 按位置树多选
        </span>
      ),
      children: renderTree(
        locationTree.data,
        locationTree.loading,
        locationTree.error,
        locationTree.retry,
        '暂无位置数据',
      ),
    },
    {
      key: 'category',
      label: (
        <span>
          <AppstoreOutlined /> 按分类多选
        </span>
      ),
      children: renderTree(
        categoryTree.data,
        categoryTree.loading,
        categoryTree.error,
        categoryTree.retry,
        '暂无分类数据',
      ),
    },
    {
      key: 'all',
      label: (
        <span>
          <GlobalOutlined /> 全部资产
        </span>
      ),
      children: (
        <Alert
          message="将对所有资产进行盘点"
          description="选择此模式后，盘点范围覆盖系统内全部资产，无需手动选择位置或分类。"
          type="info"
          showIcon
          style={{ margin: '20px 0' }}
        />
      ),
    },
  ];

  // ---- 主渲染 ----

  return (
    <div className="scope-selector" data-testid="scope-selector">
      {/* 范围选择 Tabs */}
      <Tabs
        activeKey={value.scopeType}
        onChange={handleTabChange}
        type="card"
        items={tabItems}
        aria-label="盘点范围选择"
      />

      {/* 已选范围列表（仅位置/分类模式显示） */}
      {value.scopeType !== 'all' && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Text strong>
              已选范围（{value.scopeIds.length} 项）
            </Text>
            {value.scopeIds.length > 0 && (
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={handleClearAll}
                aria-label="清空所有选择"
              >
                清空
              </Button>
            )}
          </div>

          {value.scopeIds.length === 0 ? (
            <Text type="secondary">请选择盘点范围</Text>
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 4,
                maxHeight: 100,
                overflowY: 'auto',
                padding: 8,
                background: '#fafafa',
                borderRadius: 6,
              }}
            >
              {value.scopeIds.map((id) => (
                <Tag
                  key={id}
                  closable
                  onClose={() => handleRemoveItem(id)}
                  color={
                    value.scopeType === 'location' ? 'blue' : 'green'
                  }
                >
                  {currentKeyMap.get(id) ?? id}
                </Tag>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

ScopeSelector.displayName = 'ScopeSelector';

export { ScopeSelector };
export default ScopeSelector;