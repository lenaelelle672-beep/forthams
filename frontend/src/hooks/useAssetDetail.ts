/**
 * @file useAssetDetail.ts
 * @description 资产详情页面数据获取与管理 Hook
 * 
 * 功能职责：
 * - 资产基础信息获取
 * - 资产关联审计日志查询
 * - @Auditable 字段变更记录绑定
 * - Graphify 知识图谱节点数据整合
 * 
 * @author SWARM-051 Team
 * @version 1.0.0
 * @since Iteration 10
 */

import { ref, computed, watch, onMounted } from 'vue';
import { assetService } from '../services/assetService';
import { auditService } from '../services/auditService';
import type { Asset, AssetDetail, GraphifyNode, GraphifyEdge } from '../types/asset.types';
import type { AuditLog, AuditQuery } from '../types/audit.types';

/**
 * 资产详情页面状态接口
 */
export interface AssetDetailState {
  /** 资产基础信息 */
  asset: AssetDetail | null;
  /** 资产关联的审计日志列表 */
  auditLogs: AuditLog[];
  /** Graphify 知识图谱节点 */
  graphifyNodes: GraphifyNode[];
  /** Graphify 知识图谱边 */
  graphifyEdges: GraphifyEdge[];
  /** 加载状态 */
  isLoading: boolean;
  /** 审计日志加载状态 */
  isAuditLoading: boolean;
  /** 知识图谱加载状态 */
  isGraphLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 审计日志分页信息 */
  auditPagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

/**
 * 资产详情 Hook 配置参数
 */
export interface UseAssetDetailOptions {
  /** 资产 ID */
  assetId: string;
  /** 是否启用知识图谱 */
  enableGraphify?: boolean;
  /** 是否延迟加载审计日志 */
  lazyLoadAudit?: boolean;
  /** 审计日志每页大小 */
  auditPageSize?: number;
  /** 初始加载审计日志页数 */
  initialAuditPages?: number;
}

/**
 * 资产详情页面数据管理 Hook
 * 
 * @param options - 配置参数
 * @returns 资产详情状态和方法
 * 
 * @example
 * ```typescript
 * const {
 *   asset,
 *   auditLogs,
 *   graphifyNodes,
 *   loadAssetDetail,
 *   loadMoreAuditLogs,
 *   refreshData
 * } = useAssetDetail({
 *   assetId: '12345',
 *   enableGraphify: true,
 *   lazyLoadAudit: true
 * });
 * ```
 */
export function useAssetDetail(options: UseAssetDetailOptions) {
  // ============================================================================
  // 响应式状态
  // ============================================================================
  
  const asset = ref<AssetDetail | null>(null);
  const auditLogs = ref<AuditLog[]>([]);
  const graphifyNodes = ref<GraphifyNode[]>([]);
  const graphifyEdges = ref<GraphifyEdge[]>([]);
  
  const isLoading = ref(false);
  const isAuditLoading = ref(false);
  const isGraphLoading = ref(false);
  
  const error = ref<string | null>(null);
  
  const auditPagination = ref({
    page: 1,
    pageSize: options.auditPageSize ?? 20,
    total: 0,
    hasMore: true
  });

  // ============================================================================
  // 计算属性
  // ============================================================================

  /**
   * 判断是否有待展示的审计日志
   */
  const hasAuditLogs = computed(() => auditLogs.value.length > 0);

  /**
   * 判断是否正在加载审计日志
   */
  const isLoadingAuditLogs = computed(() => isAuditLoading.value);

  /**
   * 获取已标记 @Auditable 的审计日志（包含字段变更）
   */
  const auditableAuditLogs = computed(() => {
    return auditLogs.value.filter(log => 
      log.changes && log.changes.length > 0
    );
  });

  /**
   * 获取 Graphify 节点数量
   */
  const graphifyNodeCount = computed(() => graphifyNodes.value.length);

  /**
   * 判断 Graphify 知识图谱是否有数据
   */
  const hasGraphifyData = computed(() => graphifyNodes.value.length > 0);

  /**
   * 获取最近一次审计操作
   */
  const latestAuditLog = computed(() => {
    if (auditLogs.value.length === 0) return null;
    return auditLogs.value[0];
  });

  // ============================================================================
  // 核心方法
  // ============================================================================

  /**
   * 加载资产详情
   * 
   * @returns Promise<AssetDetail | null>
   */
  async function loadAssetDetail(): Promise<AssetDetail | null> {
    if (!options.assetId) {
      error.value = '资产 ID 不能为空';
      return null;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await assetService.getAssetById(options.assetId);
      
      if (response.code === 200 && response.data) {
        asset.value = response.data;
        
        // 触发知识图谱数据加载（如果启用）
        if (options.enableGraphify) {
          loadGraphifyData();
        }
        
        // 触发审计日志加载（如果不是延迟加载）
        if (!options.lazyLoadAudit) {
          loadAuditLogs();
        }
        
        return response.data;
      } else {
        error.value = response.message || '获取资产详情失败';
        return null;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载资产详情时发生未知错误';
      error.value = errorMessage;
      console.error('[useAssetDetail] loadAssetDetail error:', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 加载资产关联的审计日志
   * 
   * @param page - 页码（默认从 1 开始）
   * @param reset - 是否重置现有数据
   * @returns Promise<AuditLog[]>
   */
  async function loadAuditLogs(page: number = 1, reset: boolean = false): Promise<AuditLog[]> {
    if (!options.assetId) {
      return [];
    }

    if (page === 1) {
      isAuditLoading.value = true;
    }

    try {
      const query: AuditQuery = {
        entityType: 'Asset',
        entityId: options.assetId,
        page: page,
        pageSize: auditPagination.value.pageSize
      };

      const response = await auditService.queryAuditLogs(query);
      
      if (response.code === 200 && response.data) {
        const logs = response.data.records || [];
        
        if (reset || page === 1) {
          auditLogs.value = logs;
        } else {
          auditLogs.value = [...auditLogs.value, ...logs];
        }
        
        auditPagination.value = {
          page: page,
          pageSize: auditPagination.value.pageSize,
          total: response.data.total || 0,
          hasMore: auditLogs.value.length < (response.data.total || 0)
        };
        
        return logs;
      } else {
        console.warn('[useAssetDetail] loadAuditLogs: 非 200 响应', response);
        return [];
      }
    } catch (err) {
      console.error('[useAssetDetail] loadAuditLogs error:', err);
      return [];
    } finally {
      if (page === 1) {
        isAuditLoading.value = false;
      }
    }
  }

  /**
   * 加载更多审计日志（分页）
   * 
   * @returns Promise<boolean> - 是否还有更多数据
   */
  async function loadMoreAuditLogs(): Promise<boolean> {
    if (!auditPagination.value.hasMore || isAuditLoading.value) {
      return false;
    }

    const nextPage = auditPagination.value.page + 1;
    await loadAuditLogs(nextPage);
    
    return auditPagination.value.hasMore;
  }

  /**
   * 加载 Graphify 知识图谱数据
   * 
   * @returns Promise<void>
   */
  async function loadGraphifyData(): Promise<void> {
    if (!options.assetId) {
      return;
    }

    isGraphLoading.value = true;

    try {
      // 并行加载节点和边数据
      const [nodesResponse, edgesResponse] = await Promise.all([
        assetService.getGraphifyNodes(options.assetId),
        assetService.getGraphifyEdges(options.assetId)
      ]);

      if (nodesResponse.code === 200 && nodesResponse.data) {
        graphifyNodes.value = nodesResponse.data;
      }

      if (edgesResponse.code === 200 && edgesResponse.data) {
        graphifyEdges.value = edgesResponse.data;
      }
    } catch (err) {
      console.error('[useAssetDetail] loadGraphifyData error:', err);
    } finally {
      isGraphLoading.value = false;
    }
  }

  /**
   * 获取指定类型的审计日志
   * 
   * @param operationType - 操作类型（如 'UPDATE', 'DELETE'）
   * @returns AuditLog[]
   */
  function getAuditLogsByOperation(operationType: string): AuditLog[] {
    return auditLogs.value.filter(log => log.operation === operationType);
  }

  /**
   * 获取 @Auditable 字段变更记录
   * 
   * @param auditLogId - 审计日志 ID
   * @returns 变更字段列表
   */
  function getAuditableFieldChanges(auditLogId: string): Array<{ field: string; oldValue: any; newValue: any }> {
    const log = auditLogs.value.find(l => l.id === auditLogId);
    if (!log || !log.changes) {
      return [];
    }
    
    return log.changes.filter(change => change.isAuditable === true);
  }

  /**
   * 刷新所有数据
   * 
   * @returns Promise<void>
   */
  async function refreshData(): Promise<void> {
    await Promise.all([
      loadAssetDetail(),
      loadAuditLogs(1, true),
      options.enableGraphify ? loadGraphifyData() : Promise.resolve()
    ]);
  }

  /**
   * 清除所有状态
   */
  function clearState(): void {
    asset.value = null;
    auditLogs.value = [];
    graphifyNodes.value = [];
    graphifyEdges.value = [];
    error.value = null;
    auditPagination.value = {
      page: 1,
      pageSize: options.auditPageSize ?? 20,
      total: 0,
      hasMore: true
    };
  }

  /**
   * 设置错误状态
   * 
   * @param errorMessage - 错误信息
   */
  function setError(errorMessage: string): void {
    error.value = errorMessage;
  }

  // ============================================================================
  // 监听器
  // ============================================================================

  /**
   * 监听资产 ID 变化，自动重新加载数据
   */
  watch(
    () => options.assetId,
    (newAssetId, oldAssetId) => {
      if (newAssetId && newAssetId !== oldAssetId) {
        clearState();
        loadAssetDetail();
      }
    },
    { immediate: true }
  );

  // ============================================================================
  // 生命周期
  // ============================================================================

  onMounted(() => {
    // 初始加载已完成
  });

  // ============================================================================
  // 导出
  // ============================================================================

  return {
    // 状态
    asset,
    auditLogs,
    graphifyNodes,
    graphifyEdges,
    isLoading,
    isAuditLoading,
    isGraphLoading,
    error,
    auditPagination,
    
    // 计算属性
    hasAuditLogs,
    isLoadingAuditLogs,
    auditableAuditLogs,
    graphifyNodeCount,
    hasGraphifyData,
    latestAuditLog,
    
    // 方法
    loadAssetDetail,
    loadAuditLogs,
    loadMoreAuditLogs,
    loadGraphifyData,
    getAuditLogsByOperation,
    getAuditableFieldChanges,
    refreshData,
    clearState,
    setError
  };
}

export default useAssetDetail;