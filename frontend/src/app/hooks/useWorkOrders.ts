/**
 * @module frontend/src/app/hooks/useWorkOrders
 * @description React Hook for work order list queries, detail fetching,
 *              and lifecycle mutations (create, update, delete, submit, operate).
 *
 * Provides typed, encapsulated state management for pages that consume the
 * workOrderService API layer. No mock/stub data — all calls hit real backend.
 *
 * Exposed capabilities:
 *   - useWorkOrderList: paginated list with status/keyword filters
 *   - useWorkOrderDetail: single record fetch by ID
 *   - useWorkOrderMutation: create, update, delete, submit, lifecycle operations
 *
 * @see frontend/src/app/services/workOrderService.ts
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  workOrderService,
  type WorkOrderRecord,
  type WorkOrderDTO,
  type WorkOrderListParams,
} from "../services/workOrderService";

// ---------------------------------------------------------------------------
// useWorkOrderList — paginated list query
// ---------------------------------------------------------------------------

/**
 * Return type for useWorkOrderList hook.
 */
export interface UseWorkOrderListReturn {
  /** Work order records from current page. */
  records: WorkOrderRecord[];
  /** Total record count across all pages. */
  total: number;
  /** Total number of pages. */
  totalPages: number;
  /** Current page number (1-based). */
  page: number;
  /** Whether data is being fetched. */
  loading: boolean;
  /** Error message if fetch failed. */
  error: string | null;
  /** Navigate to a different page. */
  setPage: (page: number) => void;
  /** Manually trigger a re-fetch with optional parameter overrides. */
  refetch: (overrideParams?: WorkOrderListParams) => Promise<void>;
}

/** Default page size for list queries. */
const DEFAULT_PAGE_SIZE = 10;

/**
 * Hook for fetching a paginated, filterable work order list.
 *
 * Internally calls workOrderService.list() which maps to
 * GET /api/workorders?page=&pageSize=&status=&keyword=
 *
 * @param params - optional initial query parameters (status, keyword)
 * @returns paginated list state and controls
 *
 * @example
 * ```tsx
 * const { records, total, loading, page, setPage, refetch } = useWorkOrderList({ status: "DRAFT" });
 * ```
 */
export function useWorkOrderList(
  params?: WorkOrderListParams,
): UseWorkOrderListReturn {
  const [records, setRecords] = useState<WorkOrderRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(params?.page ?? 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Latest params ref for re-fetch */
  const paramsRef = useRef(params);

  /**
   * Fetch work orders from backend with current filters.
   * Maps to GET /api/workorders?page=&pageSize=&status=&keyword=
   *
   * @param overrideParams - optional parameter overrides for this fetch
   */
  const refetch = useCallback(
    async (overrideParams?: WorkOrderListParams) => {
      try {
        setLoading(true);
        setError(null);

        const merged: Record<string, unknown> = {
          page,
          pageSize: DEFAULT_PAGE_SIZE,
          ...paramsRef.current,
          ...overrideParams,
        };

        const result = await workOrderService.list(merged);
        setRecords(result.records || []);
        setTotal(result.total || 0);
        setTotalPages(
          result.pages || Math.ceil((result.total || 0) / DEFAULT_PAGE_SIZE),
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "加载工单列表失败";
        setError(message);
        setRecords([]);
        setTotal(0);
        setTotalPages(0);
      } finally {
        setLoading(false);
      }
    },
    [page],
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    records,
    total,
    totalPages,
    page,
    loading,
    error,
    setPage,
    refetch,
  };
}

// ---------------------------------------------------------------------------
// useWorkOrderDetail — single record fetch
// ---------------------------------------------------------------------------

/**
 * Return type for useWorkOrderDetail hook.
 */
export interface UseWorkOrderDetailReturn {
  /** The fetched work order record. */
  order: WorkOrderRecord | null;
  /** Whether data is being fetched. */
  loading: boolean;
  /** Error message if fetch failed. */
  error: string | null;
  /** Manually trigger a re-fetch. */
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching a single work order by ID.
 *
 * Internally calls workOrderService.getById() which maps to
 * GET /api/workorders/{id}
 *
 * @param id - work order ID (string from route params)
 * @returns detail state and refetch control
 *
 * @example
 * ```tsx
 * const { order, loading, error, refetch } = useWorkOrderDetail(id);
 * ```
 */
export function useWorkOrderDetail(
  id: string | undefined,
): UseWorkOrderDetailReturn {
  const [order, setOrder] = useState<WorkOrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch work order detail from backend.
   * Maps to GET /api/workorders/{id}
   */
  const refetch = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await workOrderService.getById(id);
      setOrder(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "加载工单详情失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { order, loading, error, refetch };
}

// ---------------------------------------------------------------------------
// useWorkOrderMutation — create, update, delete, submit, lifecycle ops
// ---------------------------------------------------------------------------

/**
 * Return type for useWorkOrderMutation hook.
 */
export interface UseWorkOrderMutationReturn {
  /** Whether a mutation is in progress. */
  mutating: boolean;
  /** Error message from last failed mutation. */
  error: string | null;
  /** Create a new work order. */
  create: (payload: WorkOrderDTO) => Promise<WorkOrderRecord>;
  /** Update an existing work order (DRAFT/REJECTED only). */
  update: (id: number | string, payload: WorkOrderDTO) => Promise<WorkOrderRecord>;
  /** Delete a work order (DRAFT/REJECTED/CANCELLED only). */
  remove: (id: number | string) => Promise<void>;
  /** Submit a work order for approval (DRAFT/REJECTED → PENDING). */
  submit: (id: number | string) => Promise<WorkOrderRecord>;
  /** Execute a lifecycle operation (approve/reject/start/complete/cancel). */
  operate: (
    id: number | string,
    operation: string,
    comment?: string,
  ) => Promise<WorkOrderRecord>;
  /** Clear the current error state. */
  clearError: () => void;
}

/**
 * Hook for work order mutations (create, update, delete, lifecycle ops).
 *
 * All methods wrap workOrderService calls with loading/error state.
 * The caller is responsible for post-success actions (navigation, refetch).
 *
 * @returns mutation functions and state
 *
 * @example
 * ```tsx
 * const { create, update, submit, operate, mutating, error } = useWorkOrderMutation();
 * const created = await create({ title: "Fix pump" });
 * ```
 */
export function useWorkOrderMutation(): UseWorkOrderMutationReturn {
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  /**
   * Create a new work order via POST /api/workorders.
   * Initial status: DRAFT (server-assigned).
   *
   * @param payload - work order data (title is required)
   * @returns the created work order with server-assigned id and workOrderNo
   */
  const create = useCallback(
    async (payload: WorkOrderDTO): Promise<WorkOrderRecord> => {
      try {
        setMutating(true);
        setError(null);
        return await workOrderService.create(payload);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "创建工单失败";
        setError(message);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [],
  );

  /**
   * Update an existing work order via PUT /api/workorders/{id}.
   * Only DRAFT or REJECTED status can be updated (backend enforced).
   *
   * @param id - work order ID
   * @param payload - fields to update
   * @returns the updated work order record
   */
  const update = useCallback(
    async (
      id: number | string,
      payload: WorkOrderDTO,
    ): Promise<WorkOrderRecord> => {
      try {
        setMutating(true);
        setError(null);
        return await workOrderService.update(id, payload);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "更新工单失败";
        setError(message);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [],
  );

  /**
   * Delete a work order via DELETE /api/workorders/{id}.
   * Only DRAFT, REJECTED, or CANCELLED can be deleted (backend enforced).
   *
   * @param id - work order ID
   */
  const remove = useCallback(
    async (id: number | string): Promise<void> => {
      try {
        setMutating(true);
        setError(null);
        await workOrderService.delete(id);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "删除工单失败";
        setError(message);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [],
  );

  /**
   * Submit a work order for approval via POST /api/workorders/{id}/submit.
   * Transition: DRAFT/REJECTED → PENDING (backend enforced).
   *
   * @param id - work order ID
   * @returns the updated work order with PENDING status
   */
  const submit = useCallback(
    async (id: number | string): Promise<WorkOrderRecord> => {
      try {
        setMutating(true);
        setError(null);
        return await workOrderService.submit(id);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "提交失败";
        setError(message);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [],
  );

  /**
   * Execute a lifecycle operation via POST /api/workorders/{id}/operate.
   * Backend normalizes operation to lowercase (case-tolerant).
   *
   * Supported operations:
   *   "approve"  — PENDING → APPROVED
   *   "reject"   — PENDING → REJECTED
   *   "start"    — APPROVED → EXECUTING
   *   "complete" — EXECUTING → COMPLETED
   *   "cancel"   — DRAFT/PENDING/APPROVED → CANCELLED
   *
   * @param id - work order ID
   * @param operation - lifecycle operation string
   * @param comment - optional comment/note
   * @returns the updated work order record
   */
  const operate = useCallback(
    async (
      id: number | string,
      operation: string,
      comment?: string,
    ): Promise<WorkOrderRecord> => {
      try {
        setMutating(true);
        setError(null);
        return await workOrderService.operate(id, operation, comment);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "操作失败";
        setError(message);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [],
  );

  return {
    mutating,
    error,
    create,
    update,
    remove,
    submit,
    operate,
    clearError,
  };
}
