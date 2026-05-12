/**
 * Asset Detail Aggregated API
 *
 * SWARM-069: Centralized data-fetching functions for the asset detail
 * panoramic page. Each function maps to an existing backend endpoint and
 * includes cross-tenant (403) and not-found (404) error interception so
 * that upstream consumers receive user-friendly messages instead of raw
 * HTTP error codes.
 *
 * Data sources:
 *   - Asset basic info         → AssetService.getAssetById
 *   - Lifecycle state history  → RetirementService.getAssetStateHistory
 *   - Related work orders      → WorkOrderService.queryWorkOrders (filtered by assetId)
 *
 * @module services/assetDetailApi
 * @since SWARM-069
 */

import { api } from '../utils/api';
import { assetService, type AssetRecord, type PagedResult } from './assetService';
import type { WorkOrderRecord } from './workOrderService';

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

/**
 * Custom error class that carries an HTTP-status classification.
 *
 * @description Used to distinguish cross-tenant 403 errors and
 * resource-not-found 404 errors from generic API failures so that
 * the UI layer can render the appropriate message without exposing
 * raw status codes to end users.
 */
export class AssetDetailApiError extends Error {
  /** HTTP status code, if available */
  public readonly httpStatus: number | null;
  /** Whether the error represents a cross-tenant rejection */
  public readonly isForbidden: boolean;
  /** Whether the error represents a missing resource */
  public readonly isNotFound: boolean;

  constructor(message: string, httpStatus?: number) {
    super(message);
    this.name = 'AssetDetailApiError';
    this.httpStatus = httpStatus ?? null;
    this.isForbidden = httpStatus === 403;
    this.isNotFound = httpStatus === 404;
  }
}

/**
 * Classify an unknown error into a user-friendly AssetDetailApiError.
 *
 * @param err - The thrown error from an API call
 * @param fallbackMessage - Default message when the error cannot be classified
 * @returns An AssetDetailApiError with appropriate classification
 */
function classifyError(err: unknown, fallbackMessage: string): AssetDetailApiError {
  if (err instanceof AssetDetailApiError) return err;

  // Attempt to extract HTTP status from Axios-like error
  const axiosErr = err as { response?: { status?: number }; message?: string };
  const status = axiosErr?.response?.status ?? null;
  const rawMessage = axiosErr?.message ?? '';

  if (status === 403) {
    return new AssetDetailApiError('无权访问该资产', 403);
  }
  if (status === 404) {
    return new AssetDetailApiError('资源不存在', 404);
  }
  if (rawMessage.includes('403') || rawMessage.includes('无权')) {
    return new AssetDetailApiError('无权访问该资产', 403);
  }
  if (rawMessage.includes('404') || rawMessage.includes('不存在')) {
    return new AssetDetailApiError('资源不存在', 404);
  }

  return new AssetDetailApiError(
    err instanceof Error ? err.message : fallbackMessage,
    status ?? undefined,
  );
}

// ---------------------------------------------------------------------------
// Types — lifecycle node
// ---------------------------------------------------------------------------

/**
 * A single node in the asset lifecycle timeline.
 *
 * @description Represents a state transition event sourced from
 * AssetLifecycleService / RetirementApplicationService. Nodes are
 * ordered by timestamp descending (newest first).
 */
export interface LifecycleNode {
  /** Unique node identifier */
  id: string;
  /** Source of this event (e.g. "创建", "领用", "维修", "退役申请", "报废") */
  eventType: string;
  /** Display label for the event type */
  eventLabel: string;
  /** Previous status before this event */
  fromStatus: string;
  /** New status after this event */
  toStatus: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Operator who triggered this event */
  operator: string;
  /** Optional reason or comment */
  reason?: string;
  /** Visual status indicator: "normal" | "warning" | "terminal" */
  nodeStatus: 'normal' | 'warning' | 'terminal';
}

/**
 * Aggregated result from the lifecycle timeline query.
 */
export interface LifecycleTimelineResult {
  /** Asset ID this timeline belongs to */
  assetId: string;
  /** Lifecycle nodes ordered by timestamp descending */
  nodes: LifecycleNode[];
}

// ---------------------------------------------------------------------------
// Types — related work orders
// ---------------------------------------------------------------------------

/**
 * A simplified work order record for the asset detail page.
 */
export interface RelatedWorkOrderItem {
  /** Work order ID */
  id: number;
  /** Work order number */
  workOrderNo?: string;
  /** Title / description */
  title?: string;
  /** Current status */
  status?: string;
  /** Priority level */
  priority?: string;
  /** Creation timestamp */
  createTime?: string;
  /** Work order type (e.g. maintenance, repair) */
  type?: string;
}

/**
 * Paginated result for related work orders.
 */
export interface RelatedWorkOrdersResult {
  /** Work order records */
  records: RelatedWorkOrderItem[];
  /** Total count */
  total: number;
}

// ---------------------------------------------------------------------------
// Types — aggregated asset detail
// ---------------------------------------------------------------------------

/**
 * Full aggregated data for the asset detail panoramic page.
 *
 * Combines basic asset info, lifecycle timeline, and related work orders
 * into a single data structure fetched in parallel.
 */
export interface AssetDetailAggregated {
  /** Basic asset information */
  asset: AssetRecord;
  /** Lifecycle timeline nodes */
  lifecycle: LifecycleNode[];
  /** Related work orders */
  workOrders: RelatedWorkOrderItem[];
  /** Total work order count */
  workOrderTotal: number;
}

// ---------------------------------------------------------------------------
// Lifecycle event type → display label mapping
// ---------------------------------------------------------------------------

const EVENT_LABEL_MAP: Record<string, string> = {
  ACTIVE: '在用',
  INACTIVE: '闲置',
  MAINTENANCE: '维护中',
  RETIRED: '已退役',
  DISPOSED: '已处置',
  LOST: '已丢失',
  TRANSFERRED: '已转移',
  SCRAPPED: '已报废',
  COMPLETED: '已完成',
  PENDING: '待审批',
  APPROVED: '已审批',
  CANCELLED: '已取消',
  DRAFT: '草稿',
  EXECUTING: '执行中',
  REJECTED: '已驳回',
};

/**
 * Terminal states — once reached, the lifecycle node should display
 * as "terminal" (irreversible).
 */
const TERMINAL_NODE_STATUSES = new Set([
  'SCRAPPED', 'RETIRED', 'DISPOSED', 'COMPLETED',
]);

/**
 * Warning states — display as "warning" in the timeline.
 */
const WARNING_NODE_STATUSES = new Set([
  'PENDING', 'REJECTED', 'CANCELLED', 'MAINTENANCE',
]);

/**
 * Determine the visual node status for a lifecycle node.
 *
 * @param toStatus - The resulting status after this event
 * @returns The visual status indicator
 */
function resolveNodeStatus(toStatus: string): 'normal' | 'warning' | 'terminal' {
  const upper = toStatus.toUpperCase();
  if (TERMINAL_NODE_STATUSES.has(upper)) return 'terminal';
  if (WARNING_NODE_STATUSES.has(upper)) return 'warning';
  return 'normal';
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Fetch the basic asset information by ID.
 *
 * @param assetId - The asset ID
 * @returns The asset record
 * @throws AssetDetailApiError on 403 (cross-tenant) or 404 (not found)
 */
export async function fetchAssetBasicInfo(assetId: string): Promise<AssetRecord> {
  try {
    return await assetService.getById(assetId);
  } catch (err) {
    throw classifyError(err, '获取资产信息失败');
  }
}

/**
 * Fetch the lifecycle timeline for an asset.
 *
 * @description Calls the retirement service's state-history endpoint
 * and maps raw history entries to typed LifecycleNode objects with
 * display labels and visual status indicators.
 *
 * @param assetId - The asset ID
 * @returns Lifecycle timeline result with nodes ordered by timestamp descending
 * @throws AssetDetailApiError on 403 (cross-tenant) or 404 (not found)
 */
export async function fetchAssetLifecycle(
  assetId: string,
): Promise<LifecycleTimelineResult> {
  try {
    const result = await api.get<{
      assetId: string;
      history: Array<{
        fromStatus: string;
        toStatus: string;
        timestamp: string;
        operator: string;
      }>;
    }>(`/retirement/assets/${assetId}/state-history`);

    const nodes: LifecycleNode[] = (result.history ?? []).map((h, idx) => ({
      id: `${assetId}-lifecycle-${idx}`,
      eventType: h.toStatus,
      eventLabel: EVENT_LABEL_MAP[h.toStatus] ?? h.toStatus,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      timestamp: h.timestamp,
      operator: h.operator,
      nodeStatus: resolveNodeStatus(h.toStatus),
    }));

    // Sort by timestamp descending (newest first)
    nodes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { assetId, nodes };
  } catch (err) {
    throw classifyError(err, '获取生命周期数据失败');
  }
}

/**
 * Fetch the related work orders for an asset.
 *
 * @description Queries the work order list endpoint filtered by assetId.
 *
 * @param assetId - The asset ID
 * @param params - Optional pagination and filter parameters
 * @returns Paginated work order result
 * @throws AssetDetailApiError on 403 (cross-tenant) or 404 (not found)
 */
export async function fetchAssetWorkOrders(
  assetId: string,
  params?: { page?: number; pageSize?: number },
): Promise<RelatedWorkOrdersResult> {
  try {
    const paged = await api.get<PagedResult<WorkOrderRecord>>('/workorders', {
      params: {
        assetId,
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 20,
      },
    });

    const records: RelatedWorkOrderItem[] = (paged?.records ?? []).map((wo) => ({
      id: wo.id,
      workOrderNo: wo.workOrderNo,
      title: wo.title,
      status: wo.status,
      priority: wo.priority,
      createTime: wo.createTime,
      type: wo.description ? '维修' : undefined,
    }));

    return {
      records,
      total: paged?.total ?? 0,
    };
  } catch (err) {
    throw classifyError(err, '获取关联工单失败');
  }
}

// ---------------------------------------------------------------------------
// Aggregated fetch — parallel data loading
// ---------------------------------------------------------------------------

/**
 * Fetch all aggregated data for the asset detail panoramic page.
 *
 * @description Loads asset basic info, lifecycle timeline, and related
 * work orders in parallel. If any sub-request fails with a 403/404,
 * the entire operation is short-circuited and the user-facing error
 * is propagated to the page-level ErrorBoundary.
 *
 * @param assetId - The asset ID to fetch data for
 * @returns Aggregated asset detail data
 * @throws AssetDetailApiError on permission or not-found errors
 */
export async function fetchAssetDetailAggregated(
  assetId: string,
): Promise<AssetDetailAggregated> {
  // Fetch all data in parallel
  const [asset, lifecycleResult, workOrdersResult] = await Promise.all([
    fetchAssetBasicInfo(assetId),
    fetchAssetLifecycle(assetId).catch((err) => {
      // Lifecycle data is non-critical; return empty timeline on failure
      if (err instanceof AssetDetailApiError && (err.isForbidden || err.isNotFound)) {
        throw err; // Re-throw permission/not-found errors
      }
      return { assetId, nodes: [] } as LifecycleTimelineResult;
    }),
    fetchAssetWorkOrders(assetId).catch((err) => {
      // Work orders data is non-critical; return empty on failure
      if (err instanceof AssetDetailApiError && (err.isForbidden || err.isNotFound)) {
        throw err; // Re-throw permission/not-found errors
      }
      return { records: [], total: 0 } as RelatedWorkOrdersResult;
    }),
  ]);

  return {
    asset,
    lifecycle: lifecycleResult.nodes,
    workOrders: workOrdersResult.records,
    workOrderTotal: workOrdersResult.total,
  };
}
