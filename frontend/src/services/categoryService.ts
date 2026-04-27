/**
 * @module categoryService
 * @description 资产分类服务层，提供分类树查询等能力。
 * 为资产批量导入导出页面的导出筛选面板（CategoryTreeSelect）提供数据源。
 *
 * 相关 API 端点：
 *   - GET /api/v1/asset-categories/tree  获取分类树形结构
 *
 * @see [SWARM-P2-006-FE] 资产批量导入导出前端 — Layer 3.1 CategoryTreeSelect
 */

import http from '../utils/http';

/**
 * 分类树节点 —— 对应后端 CategoryTreeDTO 结构，
 * 兼容 Ant Design TreeSelect 的 treeData 格式。
 */
export interface CategoryTreeNode {
  /** 分类唯一标识 */
  id: string;
  /** 分类编码，用于导出筛选请求 categoryCodes 字段 */
  code: string;
  /** 分类显示名称 */
  name: string;
  /** 子级节点 */
  children?: CategoryTreeNode[];
}

/**
 * 获取资产分类树形结构数据。
 *
 * 调用 `GET /api/v1/asset-categories/tree` 接口，
 * 返回的树形数据可直接供 Ant Design `<TreeSelect>` 组件的 `treeData` 属性使用。
 *
 * @returns {Promise<CategoryTreeNode[]>} 分类树节点数组
 * @throws 当网络异常或后端返回非 2xx 状态码时抛出错误
 *
 * @example
 * ```tsx
 * const [treeData, setTreeData] = useState<CategoryTreeNode[]>([]);
 *
 * useEffect(() => {
 *   getCategoryTree().then(setTreeData).catch(console.error);
 * }, []);
 *
 * <TreeSelect treeData={treeData} placeholder="选择资产分类" />
 * ```
 */
export async function getCategoryTree(): Promise<CategoryTreeNode[]> {
  const response = await http.get<CategoryTreeNode[]>('/api/v1/asset-categories/tree');
  return response.data;
}

/**
 * categoryService 对象 —— 以命名空间方式导出，方便调用方按需引用。
 */
const categoryService = {
  getCategoryTree,
};

export default categoryService;