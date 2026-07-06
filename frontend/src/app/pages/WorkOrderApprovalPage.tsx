/**
 * @module frontend/src/app/pages/WorkOrderApprovalPage
 * @description Work Order Approval Page — displays a list of work orders with
 * approve/reject actions for pending items.
 *
 * Features:
 * - Paginated table of work orders fetched from backend
 * - Approve / Reject action buttons only visible for state === "pending"
 * - Confirmation dialog (WorkOrderActionDialog) to prevent accidental operations
 * - Data refresh via callback after successful action (no window.location.reload)
 * - Search and pagination
 *
 * @see frontend/src/app/components/WorkOrderActionDialog.tsx
 * @see frontend/src/app/api/workOrders.ts
 */

import React, { useState, useEffect, useCallback } from "react";
import { WorkOrderActionDialog } from "../components/WorkOrderActionDialog";
import { api } from "../utils/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single work order row as returned by the list API. */
interface WorkOrderRow {
  id: string;
  title: string;
  state: string;
  assetName?: string;
  reporterName?: string;
  priority?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/** Paginated list response from the backend. */
interface WorkOrderListResponse {
  records: WorkOrderRow[];
  total: number;
  pages: number;
}

/** Dialog state shape — null means dialog is closed. */
interface DialogState {
  open: boolean;
  type: "approve" | "reject";
  id: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

/**
 * Get display label for work order state.
 *
 * @param state — the backend state string
 * @returns human-readable label
 */
function getStateLabel(state: string): string {
  const labels: Record<string, string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    draft: "Draft",
    executing: "Executing",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return labels[state] ?? state;
}

/**
 * Get Tailwind CSS classes for status badge.
 *
 * @param state — the backend state string
 * @returns CSS class string
 */
function getStateBadgeClasses(state: string): string {
  switch (state) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "approved":
      return "bg-green-100 text-green-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    case "draft":
      return "bg-blue-50 text-gray-800";
    case "executing":
      return "bg-blue-100 text-blue-800";
    case "completed":
      return "bg-green-200 text-green-900";
    case "cancelled":
      return "bg-blue-50 text-gray-500";
    default:
      return "bg-blue-50 text-gray-500";
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * WorkOrderApprovalPage — displays a paginated table of work orders
 * with inline Approve / Reject actions for pending items.
 *
 * Uses WorkOrderActionDialog for confirmation and the api utility for
 * data fetching. Data refresh after approve/reject is done via refetching
 * (no full page reload).
 */
export function WorkOrderApprovalPage() {
  // -- state ---------------------------------------------------------------
  const [records, setRecords] = useState<WorkOrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");

  /** Dialog control state — null when closed. */
  const [dialogState, setDialogState] = useState<DialogState | null>(null);

  // -- data fetching -------------------------------------------------------

  /**
   * Fetch work order list from backend.
   * Uses the api utility to GET /api/work-orders with pagination.
   */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string | number> = {
        page,
        pageSize: DEFAULT_PAGE_SIZE,
      };
      if (keyword.trim()) {
        params.keyword = keyword.trim();
      }

      const result = await api.get<WorkOrderListResponse>("/work-orders", {
        params,
      });

      setRecords(result.records ?? []);
      setTotal(result.total ?? 0);
      setTotalPages(
        result.pages ?? Math.ceil((result.total ?? 0) / DEFAULT_PAGE_SIZE),
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to load work orders");
      setRecords([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -- dialog handlers -----------------------------------------------------

  /**
   * Open the confirmation dialog for a specific work order and action.
   */
  const openDialog = useCallback(
    (id: string, type: "approve" | "reject") => {
      setDialogState({ open: true, type, id });
    },
    [],
  );

  /**
   * Close the confirmation dialog.
   */
  const closeDialog = useCallback(() => {
    setDialogState(null);
  }, []);

  /**
   * Called after a successful approve/reject — triggers data refresh.
   * No window.location.reload() — uses the fetchData callback.
   */
  const handleSuccess = useCallback(() => {
    setDialogState(null);
    fetchData();
  }, [fetchData]);

  // -- render --------------------------------------------------------------

  return (
    <div className="space-y-6" data-testid="work-order-approval-page">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            Work Order Approvals
          </h2>
          <p className="mt-1 text-gray-500">
            Review and approve or reject pending work orders
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-yellow-100 px-3 py-1.5 font-medium text-yellow-800">
            Pending: {total}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700"
          >
            &times;
          </button>
        </div>
      )}

      {/* Table Card */}
      <div className="rounded-lg border border-gray-200 bg-white">
        {/* Search Bar */}
        <div className="flex items-center gap-4 border-b border-gray-200 px-6 py-4">
          <div className="relative max-w-md flex-1">
            <input
              type="text"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              placeholder="Search work orders..."
              className="w-full rounded-lg border border-gray-200 py-2 pl-4 pr-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              data-testid="approval-search-input"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-50" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            No work orders found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Asset
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Reporter
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e3a5f]">
                {records.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">
                      {row.id}
                    </td>
                    <td className="max-w-[200px] truncate px-6 py-4 text-sm text-gray-900">
                      {row.title}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {row.assetName ?? "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {row.reporterName ?? "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${getStateBadgeClasses(row.state)}`}
                        data-testid={`status-badge-${row.id}`}
                      >
                        {getStateLabel(row.state)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {row.state === "pending" ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openDialog(row.id, "approve")}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
                            data-testid={`btn-approve-${row.id}`}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openDialog(row.id, "reject")}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
                            data-testid={`btn-reject-${row.id}`}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
            <p className="text-sm text-gray-500">
              Total {total}, Page {page}/{totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-gray-200 p-2 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ‹
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-gray-200 p-2 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* WorkOrderActionDialog — mounted once, controlled by dialogState */}
      {dialogState && (
        <WorkOrderActionDialog
          open={dialogState.open}
          type={dialogState.type}
          workOrderId={dialogState.id}
          onClose={closeDialog}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

export default WorkOrderApprovalPage;
