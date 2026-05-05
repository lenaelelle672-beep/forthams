import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { TreeSelect, Spin, message } from 'antd';
import type { TreeSelectProps } from 'antd';
import type { DefaultOptionType } from 'antd/es/select';
import http from '../../../utils/http';

/**
 * 后端返回的分类树节点结构
 */
interface CategoryTreeNode {
  /** 分类编码 */
  code: string;
  /** 分类名称 */
  name: string;
  /** 子分类列表 */
  children?: CategoryTreeNode[];
}

/**
 * CategoryTreeSelect 组件属性
 */
export interface CategoryTreeSelectProps {
  /** 当前选中的分类编码列表（受控值，与 Ant Design Form.Item 兼容） */
  value?: string[];
  /** 选中值变化回调 */
  onChange?: (value: string[]) => void;
  /** 占位提示文本 */
  placeholder?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 自定义 CSS 类名 */
  className?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 将后端返回的分类树数据转换为 Ant Design TreeSelect 组件所需的 treeData 格式。
 *
 * @param nodes - 后端返回的原始分类树节点数组
 * @returns 符合 TreeSelect treeData 格式的节点数组
 */
function transformTreeData(
  nodes: CategoryTreeNode[]
): DefaultOptionType[] {
  if (!Array.isArray(nodes)) return [];

  return nodes.map((node) => ({
    title: node.name,
    value: node.code,
    key: node.code,
    children:
      node.children && node.children.length > 0
        ? transformTreeData(node.children)
        : undefined,
  }));
}

/**
 * CategoryTreeSelect —— 资产分类树形多选组件
 *
 * 用于导出筛选面板（ExportFilterPanel），允许用户以树形多选方式选择资产分类。
 * 数据源接口：GET /api/v1/asset-categories/tree
 *
 * 组件在挂载时自动请求分类树数据，并转换为 TreeSelect 所需格式。
 * 选中值类型为 `string[]`（分类编码列表），与导出请求 `categoryCodes` 字段直接对应。
 *
 * @example
 * ```tsx
 * <Form.Item name="categoryCodes" label="资产分类">
 *   <CategoryTreeSelect />
 * </Form.Item>
 * ```
 */
const CategoryTreeSelect: React.FC<CategoryTreeSelectProps> = ({
  value,
  onChange,
  placeholder = '请选择资产分类',
  style,
  className,
  disabled = false,
}) => {
  /** TreeSelect 渲染用的树形数据 */
  const [treeData, setTreeData] = useState<DefaultOptionType[]>([]);
  /** 数据加载状态 */
  const [loading, setLoading] = useState<boolean>(false);

  /**
   * 从后端接口获取分类树数据并更新本地状态。
   * 接口地址：GET /api/v1/asset-categories/tree
   */
  const fetchCategoryTree = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get('/api/v1/asset-categories/tree');
      // 兼容 response.data.data 和 response.data 两种响应结构
      const rawData = response.data?.data ?? response.data;
      const data = Array.isArray(rawData) ? rawData : [];
      setTreeData(transformTreeData(data));
    } catch (error: unknown) {
      console.error('获取资产分类树数据失败:', error);
      message.error('获取资产分类数据失败，请稍后重试');
      setTreeData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /** 组件挂载时自动拉取分类树数据 */
  useEffect(() => {
    fetchCategoryTree();
  }, [fetchCategoryTree]);

  /** 合并默认宽度与自定义样式 */
  const mergedStyle = useMemo<React.CSSProperties>(
    () => ({ width: '100%', ...style }),
    [style]
  );

  return (
    <Spin spinning={loading} size="small">
      <TreeSelect
        treeData={treeData}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={mergedStyle}
        className={className}
        disabled={disabled}
        treeCheckable
        showCheckedStrategy={TreeSelect.SHOW_PARENT}
        allowClear
        multiple
        maxTagCount="responsive"
        showSearch
        treeNodeFilterProp="title"
        notFoundContent={loading ? '加载中...' : '暂无分类数据'}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        listHeight={256}
      />
    </Spin>
  );
};

export default CategoryTreeSelect;