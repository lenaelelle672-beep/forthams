import { ref, computed } from 'vue';
import type { Ref } from 'vue';
import type { AuditLog } from '@/types/audit.types';
import type { GraphifyNode } from '@/components/audit/GraphifyKnowledgeGraph';
import { useAuditLog } from './useAuditLog';

/**
 * useAuditLogs 组合式函数
 *
 * 提供审计日志相关的状态管理和操作方法
 *
 * @example
 * ```typescript
 * const { auditLogs, loading, generateGraphifyNodes } = useAuditLogs('AST-2024-001');
 * const nodes = generateGraphifyNodes(auditLogs.value);
 * ```
 */

interface UseAuditLogsOptions {
  /** 是否自动加载数据 */
  autoLoad?: boolean;
  /** 每页大小 */
  pageSize?: number;
}

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface UseAuditLogsReturn {
  /** 审计日志列表 */
  auditLogs: Ref<AuditLog[]>;
  /** 加载状态 */
  loading: Ref<boolean>;
  /** 错误信息 */
  error: Ref<string | null>;
  /** 分页状态 */
  pagination: Ref<PaginationState>;
  /** 是否有更多数据 */
  hasMore: Ref<boolean>;
  /** 加载审计日志 */
  loadAuditLogs: (assetId: string, page?: number) => Promise<void>;
  /** 刷新数据 */
  refresh: (assetId: string) => Promise<void>;
  /** 加载更多 */
  loadMore: (assetId: string) => Promise<void>;
  /** 导出审计日志 */
  exportAuditLogs: (assetId: string, format?: 'json' | 'csv') => Promise<string>;
  /** 过滤审计日志 */
  filterAuditLogs: (filters: AuditLogFilters) => Ref<AuditLog[]>;
  /** 生成 Graphify 节点数据 */
  generateGraphifyNodes: (auditLogs: AuditLog[]) => GraphifyNode[];
}

export interface AuditLogFilters {
  /** 操作类型 */
  operationType?: string;
  /** 开始时间 */
  startDate?: Date;
  /** 结束时间 */
  endDate?: Date;
  /** 操作人 */
  operator?: string;
  /** 关键词搜索 */
  keyword?: string;
}

/**
 * 审计日志组合式函数
 *
 * 提供审计日志的加载、过滤、导出等功能
 *
 * @param assetId - 资产ID
 * @param options - 配置选项
 * @returns 审计日志相关状态和方法
 *
 * @example
 * ```typescript
 * const {
 *   auditLogs,
 *   loading,
 *   loadAuditLogs,
 *   generateGraphifyNodes
 * } = useAuditLogs('AST-2024-001');
 *
 * // 加载数据
 * await loadAuditLogs('AST-2024-001');
 *
 * // 生成图谱节点
 * const nodes = generateGraphifyNodes(auditLogs.value);
 * ```
 */
export function useAuditLogs(
  assetId: string,
  options: UseAuditLogsOptions = {}
): UseAuditLogsReturn {
  const { autoLoad = true, pageSize = 20 } = options;

  // 状态管理
  const auditLogs = ref<AuditLog[]>([]) as Ref<AuditLog[]>;
  const loading = ref(false);
  const error = ref<string | null>(null);
  const pagination = ref<PaginationState>({
    page: 1,
    pageSize,
    total: 0
  });
  const hasMore = computed(() => {
    const { page, pageSize, total } = pagination.value;
    return page * pageSize < total;
  });

  // 内部状态
  const currentAssetId = ref<string | null>(null);
  const filters = ref<AuditLogFilters>({});

  /**
   * 加载审计日志
   *
   * @param assetId - 资产ID
   * @param page - 页码，默认从1开始
   */
  async function loadAuditLogs(assetId: string, page: number = 1): Promise<void> {
    if (!assetId) {
      error.value = '资产ID不能为空';
      return;
    }

    loading.value = true;
    error.value = null;
    currentAssetId.value = assetId;

    try {
      // 模拟API调用
      // 实际项目中应替换为真实的API调用
      const response = await fetchAuditLogs(assetId, page, pagination.value.pageSize);

      if (page === 1) {
        auditLogs.value = response.data;
      } else {
        auditLogs.value = [...auditLogs.value, ...response.data];
      }

      pagination.value = {
        page,
        pageSize: pagination.value.pageSize,
        total: response.total
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载审计日志失败';
      console.error('Failed to load audit logs:', err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 刷新审计日志
   *
   * @param assetId - 资产ID
   */
  async function refresh(assetId: string): Promise<void> {
    await loadAuditLogs(assetId, 1);
  }

  /**
   * 加载更多审计日志
   *
   * @param assetId - 资产ID
   */
  async function loadMore(assetId: string): Promise<void> {
    if (!hasMore.value || loading.value) return;
    await loadAuditLogs(assetId, pagination.value.page + 1);
  }

  /**
   * 导出审计日志
   *
   * @param assetId - 资产ID
   * @param format - 导出格式，默认json
   * @returns 导出数据
   */
  async function exportAuditLogs(
    assetId: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    if (!assetId) {
      throw new Error('资产ID不能为空');
    }

    // 获取全部数据
    const allLogs = await fetchAllAuditLogs(assetId);

    if (format === 'json') {
      return JSON.stringify(allLogs, null, 2);
    }

    // CSV格式导出
    const headers = ['时间', '操作类型', '操作人', '变更内容'];
    const rows = allLogs.map(log => [
      log.timestamp,
      log.operationType,
      log.operator,
      JSON.stringify(log.changes)
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * 过滤审计日志
   *
   * @param newFilters - 过滤条件
   * @returns 过滤后的审计日志
   */
  function filterAuditLogs(newFilters: AuditLogFilters): Ref<AuditLog[]> {
    filters.value = newFilters;

    return computed(() => {
      let result = [...auditLogs.value];

      if (newFilters.operationType) {
        result = result.filter(log => log.operationType === newFilters.operationType);
      }

      if (newFilters.startDate) {
        const startTime = newFilters.startDate.getTime();
        result = result.filter(log => new Date(log.timestamp).getTime() >= startTime);
      }

      if (newFilters.endDate) {
        const endTime = newFilters.endDate.getTime();
        result = result.filter(log => new Date(log.timestamp).getTime() <= endTime);
      }

      if (newFilters.operator) {
        result = result.filter(log =>
          log.operator.toLowerCase().includes(newFilters.operator!.toLowerCase())
        );
      }

      if (newFilters.keyword) {
        const keyword = newFilters.keyword.toLowerCase();
        result = result.filter(log => {
          const changeStr = JSON.stringify(log.changes).toLowerCase();
          return (
            log.operationType.toLowerCase().includes(keyword) ||
            log.operator.toLowerCase().includes(keyword) ||
            changeStr.includes(keyword)
          );
        });
      }

      return result;
    });
  }

  /**
   * 生成 Graphify 节点数据
   *
   * 将审计日志转换为可用于知识图谱展示的节点数据
   *
   * @param auditLogs - 审计日志列表
   * @returns Graphify 节点数组
   *
   * @example
   * ```typescript
   * const nodes = generateGraphifyNodes(auditLogs);
   * // 返回可直接用于 GraphifyKnowledgeGraph 组件的节点数据
   * ```
   */
  function generateGraphifyNodes(auditLogs: AuditLog[]): GraphifyNode[] {
    // ATB-BC-005: 边界条件处理 - 空数组输入
    if (!auditLogs || auditLogs.length === 0) {
      // 即使没有审计日志，也返回资产根节点（如果存在 assetId）
      const nodes: GraphifyNode[] = [];
      if (assetId) {
        nodes.push({
          id: `asset-${assetId}`,
          type: 'asset',
          label: '资产',
          properties: {
            assetId: assetId
          }
        });
      }
      return nodes;
    }

    const nodes: GraphifyNode[] = [];
    // ATB-ML-004: 使用 Set 进行节点ID去重，防止内存泄漏
    const nodeIdSet = new Set<string>();

    // 添加资产节点
    if (assetId) {
      const assetNodeId = `asset-${assetId}`;
      nodes.push({
        id: assetNodeId,
        type: 'asset',
        label: '资产',
        properties: {
          assetId: assetId
        }
      });
      nodeIdSet.add(assetNodeId);
    }

    // 从变更记录中提取相关实体
    for (const log of auditLogs) {
      if (log.changes) {
        // ATB-EX-001: 异常处理 - 跳过不完整的变更记录
        if (typeof log !== 'object' || !log.id) {
          continue;
        }

        // 处理变更中涉及的字段
        for (const [fieldName, change] of Object.entries(log.changes)) {
          // ATB-EX-004: 异常处理 - fieldName 映射失败，跳过无效字段
          if (!fieldName || typeof fieldName !== 'string') {
            continue;
          }

          // ATB-EX-001: 异常处理 - 跳过无效的变更对象
          if (!change || typeof change !== 'object') {
            continue;
          }

          // ATB-BC-006 & ATB-EX-003: 节点ID去重处理
          const nodeId = `change-${log.id}-${fieldName}`;

          // ATB-ML-004: 检查 Set 是否已存在该 ID，避免重复添加
          if (nodeIdSet.has(nodeId)) {
            continue;
          }

          // 构建变更节点
          const node: GraphifyNode = {
            id: nodeId,
            type: 'change',
            label: getFieldLabel(fieldName),
            properties: {
              fieldName,
              oldValue: (change as any).oldValue,
              newValue: (change as any).newValue,
              timestamp: log.timestamp,
              operator: log.operator
            }
          };

          nodes.push(node);
          nodeIdSet.add(nodeId);
        }

        // 处理操作者节点
        if (log.operator) {
          const operatorNodeId = `operator-${log.operator}`;

          if (!nodeIdSet.has(operatorNodeId)) {
            nodes.push({
              id: operatorNodeId,
              type: 'operator',
              label: log.operator,
              properties: {
                name: log.operator
              }
            });
            nodeIdSet.add(operatorNodeId);
          }
        }
      }
    }

    // ATB-ML-002: 清理不再需要的 Set，释放内存
    nodeIdSet.clear();

    return nodes;
  }

  /**
   * 获取字段显示标签
   *
   * @param fieldName - 字段名称
   * @returns 显示用的标签
   */
  function getFieldLabel(fieldName: string): string {
    const fieldLabels: Record<string, string> = {
      name: '资产名称',
      status: '资产状态',
      location: '存放地点',
      category: '资产类别',
      purchaseDate: '购买日期',
      purchasePrice: '购买价格',
      serialNumber: '序列号',
      manufacturer: '制造商',
      model: '型号',
      department: '所属部门',
      assignedTo: '使用人',
      description: '描述',
      notes: '备注'
    };

    return fieldLabels[fieldName] || fieldName;
  }

  // 内部方法：模拟获取审计日志
  async function fetchAuditLogs(
    assetId: string,
    page: number,
    pageSize: number
  ): Promise<{ data: AuditLog[]; total: number }> {
    // 实际项目中应替换为真实的API调用
    // 这里使用模拟数据
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          data: [],
          total: 0
        });
      }, 500);
    });
  }

  // 内部方法：获取全部审计日志
  async function fetchAllAuditLogs(assetId: string): Promise<AuditLog[]> {
    // 实际项目中应替换为真实的API调用
    return new Promise(resolve => {
      setTimeout(() => {
        resolve([]);
      }, 500);
    });
  }

  // 自动加载数据
  if (autoLoad && assetId) {
    loadAuditLogs(assetId);
  }

  return {
    auditLogs,
    loading,
    error,
    pagination,
    hasMore,
    loadAuditLogs,
    refresh,
    loadMore,
    exportAuditLogs,
    filterAuditLogs,
    generateGraphifyNodes
  };
}

// 导出类型供外部使用
export type { AuditLog, GraphifyNode };