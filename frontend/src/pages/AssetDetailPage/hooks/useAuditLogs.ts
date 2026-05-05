/**
 * useAuditLogs Hook - 资产详情页审计日志管理
 *
 * 提供审计日志的获取、转换和可视化功能
 *
 * @module pages/AssetDetailPage/hooks/useAuditLogs
 * @requires vue
 * @requires vue-router
 * @requires @vueuse/core
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDebounceFn } from '@vueuse/core';
import {
  fetchAuditLogs,
  fetchAuditLogById,
  createAuditLog,
  updateAuditLog,
  deleteAuditLog,
  exportAuditLogs,
  searchAuditLogs,
  getAuditStatistics,
  getAuditTrend
} from '../services/auditApi';
import type { AuditLog, AuditLogEntry, AuditStatistics, AuditTrend } from '../types/audit.types';
import type { GraphifyNode } from '@/types/audit.types';

/** 缓存配置 */
const CACHE_CONFIG = {
  /** 缓存有效期（毫秒） */
  TTL: 5 * 60 * 1000, // 5分钟
  /** 最大缓存条目数 */
  MAX_SIZE: 100
};

/**
 * 审计日志排序配置
 */
export interface SortConfig {
  /** 排序字段 */
  field: keyof AuditLog;
  /** 排序方向 */
  order: 'asc' | 'desc';
}

/**
 * 筛选条件配置
 */
export interface FilterConfig {
  /** 开始日期 */
  startDate?: string;
  /** 结束日期 */
  endDate?: string;
  /** 操作类型 */
  operationType?: string;
  /** 操作人 */
  operator?: string;
  /** 关键词搜索 */
  keyword?: string;
}

/**
 * 分页配置
 */
export interface PaginationConfig {
  /** 当前页码 */
  page: number;
  /** 每页条目数 */
  pageSize: number;
  /** 总条目数 */
  total: number;
}

/**
 * 审计日志Hook返回类型
 */
export interface UseAuditLogsReturn {
  // 状态
  /** 审计日志列表 */
  auditLogs: typeof auditLogs;
  /** 加载状态 */
  loading: typeof loading;
  /** 错误信息 */
  error: typeof error;
  /** 是否存在更多数据 */
  hasMore: typeof hasMore;

  // 分页
  /** 分页配置 */
  pagination: typeof pagination;
  /** 总记录数 */
  totalCount: typeof totalCount;

  // 筛选与排序
  /** 筛选条件 */
  filters: typeof filters;
  /** 排序配置 */
  sort: typeof sort;
  /** 筛选后的日志列表 */
  filteredLogs: typeof filteredLogs;

  // 操作方法
  /** 加载审计日志 */
  loadAuditLogs: () => Promise<void>;
  /** 刷新审计日志 */
  refreshAuditLogs: () => Promise<void>;
  /** 加载更多（分页） */
  loadMore: () => Promise<void>;
  /** 搜索审计日志 */
  searchAuditLogs: (keyword: string) => void;
  /** 应用筛选条件 */
  applyFilters: (config: FilterConfig) => void;
  /** 清除筛选条件 */
  clearFilters: () => void;
  /** 更新排序 */
  updateSort: (field: keyof AuditLog, order: 'asc' | 'desc') => void;
  /** 导出审计日志 */
  exportLogs: (format: 'csv' | 'json' | 'excel') => Promise<string>;

  // 统计
  /** 获取统计数据 */
  statistics: typeof statistics;
  /** 获取趋势数据 */
  trend: typeof trend;
  /** 加载统计数据 */
  loadStatistics: () => Promise<void>;

  // Graphify 知识图谱相关
  /** 生成 Graphify 节点数据 */
  generateGraphifyNodes: (auditLogs: AuditLog[]) => GraphifyNode[];
}

/**
 * 资产详情页审计日志Hook
 *
 * 提供审计日志的获取、筛选、排序、分页和导出功能
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
 * // 组件挂载时加载数据
 * onMounted(() => {
 *   loadAuditLogs();
 * });
 *
 * // 生成知识图谱节点
 * const nodes = generateGraphifyNodes(auditLogs.value);
 * ```
 *
 * @param assetId - 资产ID
 * @returns 审计日志相关状态和方法
 */
export function useAuditLogs(assetId: string): UseAuditLogsReturn {
  // ==================== 响应式状态 ====================

  /** 审计日志列表 */
  const auditLogs = ref<AuditLog[]>([]);

  /** 加载状态 */
  const loading = ref(false);

  /** 错误信息 */
  const error = ref<string | null>(null);

  /** 是否还有更多数据 */
  const hasMore = ref(true);

  /** 分页配置 */
  const pagination = ref<PaginationConfig>({
    page: 1,
    pageSize: 20,
    total: 0
  });

  /** 总记录数 */
  const totalCount = ref(0);

  /** 筛选条件 */
  const filters = ref<FilterConfig>({});

  /** 排序配置 */
  const sort = ref<SortConfig>({
    field: 'timestamp',
    order: 'desc'
  });

  /** 统计数据 */
  const statistics = ref<AuditStatistics | null>(null);

  /** 趋势数据 */
  const trend = ref<AuditTrend | null>(null);

  /** 缓存映射 */
  const cacheMap = new Map<string, { data: unknown; timestamp: number }>();

  /** 防抖搜索定时器 */
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** 路由和路由器实例 */
  const route = useRoute();
  const router = useRouter();

  // ==================== 计算属性 ====================

  /**
   * 筛选后的审计日志列表
   *
   * 根据当前筛选条件和排序配置过滤日志
   */
  const filteredLogs = computed(() => {
    let result = [...auditLogs.value];

    // 应用筛选条件
    if (filters.value.startDate) {
      result = result.filter(
        (log) => new Date(log.timestamp) >= new Date(filters.value.startDate!)
      );
    }

    if (filters.value.endDate) {
      result = result.filter(
        (log) => new Date(log.timestamp) <= new Date(filters.value.endDate!)
      );
    }

    if (filters.value.operationType) {
      result = result.filter((log) => log.operationType === filters.value.operationType);
    }

    if (filters.value.operator) {
      result = result.filter((log) => log.operator === filters.value.operator);
    }

    if (filters.value.keyword) {
      const keyword = filters.value.keyword.toLowerCase();
      result = result.filter(
        (log) =>
          log.operationType?.toLowerCase().includes(keyword) ||
          log.description?.toLowerCase().includes(keyword) ||
          log.operator?.toLowerCase().includes(keyword)
      );
    }

    // 应用排序
    result.sort((a, b) => {
      const aValue = a[sort.value.field];
      const bValue = b[sort.value.field];

      if (aValue === bValue) return 0;

      const comparison = aValue! > bValue! ? 1 : -1;
      return sort.value.order === 'asc' ? comparison : -comparison;
    });

    return result;
  });

  // ==================== 方法 ====================

  /**
   * 检查缓存是否有效
   *
   * @param key - 缓存键
   * @returns 是否命中缓存
   */
  function isCacheValid(key: string): boolean {
    const cached = cacheMap.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < CACHE_CONFIG.TTL;
  }

  /**
   * 设置缓存
   *
   * @param key - 缓存键
   * @param data - 缓存数据
   */
  function setCache(key: string, data: unknown): void {
    // 清理过期缓存
    if (cacheMap.size >= CACHE_CONFIG.MAX_SIZE) {
      const oldestKey = cacheMap.keys().next().value;
      if (oldestKey) cacheMap.delete(oldestKey);
    }
    cacheMap.set(key, { data, timestamp: Date.now() });
  }

  /**
   * 获取缓存数据
   *
   * @param key - 缓存键
   * @returns 缓存的数据或undefined
   */
  function getCache<T>(key: string): T | undefined {
    const cached = cacheMap.get(key);
    if (cached) {
      return cached.data as T;
    }
    return undefined;
  }

  /**
   * 清除所有缓存
   */
  function clearCache(): void {
    cacheMap.clear();
  }

  /**
   * 加载审计日志
   *
   * 根据当前分页、筛选和排序配置加载审计日志
   *
   * @example
   * ```typescript
   * await loadAuditLogs();
   * ```
   */
  async function loadAuditLogs(): Promise<void> {
    if (loading.value) return;

    loading.value = true;
    error.value = null;

    try {
      const cacheKey = JSON.stringify({
        assetId,
        pagination: pagination.value,
        filters: filters.value,
        sort: sort.value
      });

      // 检查缓存
      if (isCacheValid(cacheKey)) {
        const cachedData = getCache<{ logs: AuditLog[]; total: number }>(cacheKey);
        if (cachedData) {
          auditLogs.value = cachedData.logs;
          totalCount.value = cachedData.total;
          pagination.value.total = cachedData.total;
          loading.value = false;
          return;
        }
      }

      // 构建查询参数
      const params: Record<string, unknown> = {
        assetId,
        page: pagination.value.page,
        pageSize: pagination.value.pageSize,
        sortField: sort.value.field,
        sortOrder: sort.value.order,
        ...filters.value
      };

      // 发起API请求
      const response = await fetchAuditLogs(params);

      // 更新状态
      auditLogs.value = response.logs || [];
      totalCount.value = response.total || 0;
      pagination.value.total = response.total || 0;
      hasMore.value = auditLogs.value.length < totalCount.value;

      // 设置缓存
      setCache(cacheKey, { logs: auditLogs.value, total: totalCount.value });
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
   * 重置分页并重新加载数据
   *
   * @example
   * ```typescript
   * await refreshAuditLogs();
   * ```
   */
  async function refreshAuditLogs(): Promise<void> {
    pagination.value.page = 1;
    clearCache();
    await loadAuditLogs();
  }

  /**
   * 加载更多（分页）
   *
   * 加载下一页数据并追加到现有列表
   *
   * @example
   * ```typescript
   * await loadMore();
   * ```
   */
  async function loadMore(): Promise<void> {
    if (!hasMore.value || loading.value) return;

    pagination.value.page += 1;
    const previousLogs = [...auditLogs.value];

    try {
      await loadAuditLogs();
    } catch (err) {
      // 加载失败时回滚页码
      pagination.value.page -= 1;
      auditLogs.value = previousLogs;
      error.value = err instanceof Error ? err.message : '加载更多失败';
    }
  }

  /**
   * 防抖搜索
   *
   * @param keyword - 搜索关键词
   */
  const debouncedSearch = useDebounceFn((keyword: string) => {
    filters.value.keyword = keyword;
    refreshAuditLogs();
  }, 300);

  /**
   * 搜索审计日志
   *
   * @param keyword - 搜索关键词
   */
  function searchAuditLogs(keyword: string): void {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    searchDebounceTimer = setTimeout(() => {
      debouncedSearch(keyword);
    }, 300);
  }

  /**
   * 应用筛选条件
   *
   * @param config - 筛选配置
   * @example
   * ```typescript
   * applyFilters({
   *   startDate: '2024-01-01',
   *   endDate: '2024-12-31',
   *   operationType: 'UPDATE'
   * });
   * ```
   */
  function applyFilters(config: FilterConfig): void {
    filters.value = { ...config };
    refreshAuditLogs();
  }

  /**
   * 清除筛选条件
   */
  function clearFilters(): void {
    filters.value = {};
    refreshAuditLogs();
  }

  /**
   * 更新排序
   *
   * @param field - 排序字段
   * @param order - 排序方向
   */
  function updateSort(field: keyof AuditLog, order: 'asc' | 'desc'): void {
    sort.value = { field, order };
    refreshAuditLogs();
  }

  /**
   * 导出审计日志
   *
   * @param format - 导出格式 (csv, json, excel)
   * @returns 导出文件路径或Base64数据
   * @example
   * ```typescript
   * const csvPath = await exportLogs('csv');
   * ```
   */
  async function exportLogs(format: 'csv' | 'json' | 'excel'): Promise<string> {
    try {
      const exportParams = {
        assetId,
        format,
        filters: filters.value
      };

      const result = await exportAuditLogs(exportParams);
      return result.path || result.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '导出失败';
      throw err;
    }
  }

  /**
   * 加载统计数据
   */
  async function loadStatistics(): Promise<void> {
    try {
      statistics.value = await getAuditStatistics(assetId);
      trend.value = await getAuditTrend(assetId);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  }

  // ==================== Graphify 知识图谱相关 ====================

  /**
   * 计算节点布局位置
   *
   * 基于节点数量计算力导向布局简化版的节点坐标
   *
   * @param index - 节点索引
   * @param total - 总节点数
   * @returns 节点坐标 { x, y }
   */
  function calculateNodePosition(index: number, total: number): { x: number; y: number } {
    const centerX = 400;
    const centerY = 300;
    const radius = 150;

    if (total <= 1) {
      return { x: centerX, y: centerY };
    }

    // 计算节点在圆周上的位置
    const angle = (2 * Math.PI * index) / total - Math.PI / 2;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    };
  }

  /**
   * 计算变更严重程度
   *
   * @param fieldName - 字段名称
   * @param change - 变更内容
   * @returns 严重程度等级
   */
  function calculateChangeSeverity(
    fieldName: string,
    change: { oldValue?: unknown; newValue?: unknown }
  ): 'low' | 'medium' | 'high' | 'critical' {
    // 关键字段变更
    const criticalFields = ['status', 'owner', 'location'];
    if (criticalFields.includes(fieldName)) {
      return 'critical';
    }

    // 高风险字段
    const highRiskFields = ['value', 'depreciation', 'category'];
    if (highRiskFields.includes(fieldName)) {
      return 'high';
    }

    // 中等风险字段
    const mediumRiskFields = ['name', 'description', 'manufacturer'];
    if (mediumRiskFields.includes(fieldName)) {
      return 'medium';
    }

    // 低风险字段
    return 'low';
  }

  /**
   * 生成 Graphify 知识图谱节点数据
   *
   * 将审计日志转换为知识图谱可视化所需的节点数组
   *
   * 边界条件处理 (ATB-BC-*):
   * - ATB-BC-005: 空数组输入 → 仅返回 asset 根节点
   * - ATB-BC-006: 重复 ID 场景 → 使用 Set 去重
   *
   * 异常处理路径 (ATB-EX-*):
   * - ATB-EX-003: nodeIdSet 重复冲突 → 依赖 Set 行为覆盖而非报错
   * - ATB-EX-001: 缺少必需字段 → 跳过无效项
   *
   * 内存泄漏风险 (ATB-ML-*):
   * - ATB-ML-001: 避免循环引用 → 使用函数级局部变量而非闭包持有
   * - ATB-ML-004: Set 累积增长 → 函数结束时自动清理
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
    // 边界条件: 空数组或非数组输入处理
    if (!Array.isArray(auditLogs)) {
      console.warn('generateGraphifyNodes: auditLogs must be an array, received:', typeof auditLogs);
      return [];
    }

    const nodes: GraphifyNode[] = [];
    const nodeIdSet = new Set<string>();

    // 边界条件: 空数组仅返回 asset 根节点 (ATB-BC-005)
    if (auditLogs.length === 0) {
      const assetNodeId = `asset-${assetId}`;
      nodes.push({
        id: assetNodeId,
        type: 'asset',
        label: '资产',
        properties: {
          assetId: assetId
        }
      });
      return nodes;
    }

    // 添加资产根节点
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

    // 异常处理: 追踪已处理的节点ID用于去重
    const processedNodeIds = new Set<string>();

    // 从变更记录中提取相关实体
    for (const log of auditLogs) {
      // 异常处理: 跳过无效日志条目 (ATB-EX-001)
      if (!log || typeof log !== 'object') {
        continue;
      }

      if (log.changes) {
        // 处理变更中涉及的字段
        for (const [fieldName, change] of Object.entries(log.changes)) {
          // 异常处理: 跳过无效变更
          if (!change || typeof change !== 'object') {
            continue;
          }

          // 异常处理: 检查必需字段 (ATB-EX-001)
          if (!('oldValue' in change) && !('newValue' in change)) {
            continue;
          }

          const changeRecord = change as { oldValue?: unknown; newValue?: unknown };

          // 生成变更节点ID (使用 Set 去重, ATB-BC-006, ATB-EX-003)
          const changeNodeId = `change-${log.id || Date.now()}-${fieldName}`;

          // 跳过已处理的节点
          if (processedNodeIds.has(changeNodeId)) {
            continue;
          }
          processedNodeIds.add(changeNodeId);

          // 计算变更严重程度
          const severity = calculateChangeSeverity(fieldName, changeRecord);

          // 计算节点位置 (力导向布局简化版)
          const nodeIndex = nodes.length;
          const position = calculateNodePosition(nodeIndex, auditLogs.length * 2);

          // 创建变更节点
          const changeNode: GraphifyNode = {
            id: changeNodeId,
            type: 'change',
            label: fieldName,
            x: position.x,
            y: position.y,
            properties: {
              fieldName,
              oldValue: changeRecord.oldValue ?? null,
              newValue: changeRecord.newValue ?? null,
              timestamp: log.timestamp || new Date().toISOString(),
              operator: log.operator || 'unknown'
            },
            severity
          };

          nodes.push(changeNode);

          // 添加节点到 Set 用于去重追踪
          nodeIdSet.add(changeNodeId);
        }
      }

      // 处理操作人节点
      if (log.operator) {
        const operatorNodeId = `operator-${log.operator}`;

        if (!processedNodeIds.has(operatorNodeId)) {
          processedNodeIds.add(operatorNodeId);

          const operatorIndex = nodes.length;
          const position = calculateNodePosition(operatorIndex, auditLogs.length * 2);

          nodes.push({
            id: operatorNodeId,
            type: 'operator',
            label: log.operator,
            x: position.x,
            y: position.y,
            properties: {
              operator: log.operator
            }
          });

          nodeIdSet.add(operatorNodeId);
        }
      }
    }

    // 内存泄漏风险: 显式清理 Set 引用 (ATB-ML-004)
    // 虽然函数作用域结束后自动清理，但显式清空是良好实践
    processedNodeIds.clear();

    return nodes;
  }

  // ==================== 生命周期 ====================

  /**
   * 组件挂载时初始化
   */
  onMounted(() => {
    // 从路由参数获取资产ID
    const routeAssetId = route.params.id as string;
    if (routeAssetId && routeAssetId !== assetId) {
      console.warn('Asset ID mismatch:', { props: assetId, route: routeAssetId });
    }

    // 初始加载
    loadAuditLogs();
  });

  /**
   * 组件卸载时清理
   */
  onUnmounted(() => {
    // 清理定时器
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    // 清理缓存
    clearCache();
  });

  // ==================== 监听器 ====================

  /**
   * 监听路由变化重新加载
   */
  watch(
    () => route.params.id,
    (newId) => {
      if (newId && newId !== assetId) {
        refreshAuditLogs();
      }
    }
  );

  /**
   * 监听排序变化重新加载
   */
  watch(
    () => sort.value,
    () => {
      refreshAuditLogs();
    },
    { deep: true }
  );

  // ==================== 返回值 ====================

  return {
    // 状态
    auditLogs,
    loading,
    error,
    hasMore,

    // 分页
    pagination,
    totalCount,

    // 筛选与排序
    filters,
    sort,
    filteredLogs,

    // 操作方法
    loadAuditLogs,
    refreshAuditLogs,
    loadMore,
    searchAuditLogs,
    applyFilters,
    clearFilters,
    updateSort,
    exportLogs,

    // 统计
    statistics,
    trend,
    loadStatistics,

    // Graphify 知识图谱相关
    generateGraphifyNodes
  };
}

export default useAuditLogs;