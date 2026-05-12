/**
 * @module frontend/src/app/pages/work-orders/WorkOrderCreatePage
 * @description Work Order Create Page — route container for creating a new work order.
 *
 * This page serves as a routing container that provides layout chrome (header, back button)
 * and delegates form rendering and submission logic to WorkOrderCreateForm.
 * On successful creation, navigates back to /work-orders list page.
 *
 * Route: /work-orders/create
 *
 * Flow:
 *   1. User fills required fields (title) and optional fields via WorkOrderCreateForm
 *   2. On submit: POST /api/workorders → creates DRAFT order (handled by form)
 *   3. Success: navigate to /work-orders list page
 *
 * @see frontend/src/app/pages/work-orders/components/WorkOrderCreateForm.tsx
 * @see frontend/src/app/hooks/useWorkOrders.ts
 * @see frontend/src/app/services/workOrderService.ts
 */

import { useCallback } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { type WorkOrderRecord } from "../../services/workOrderService";
import { WorkOrderCreateForm } from "./components/WorkOrderCreateForm";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * WorkOrderCreatePage — route container for the work order creation form.
 *
 * Provides the page header (title + back button) and mounts WorkOrderCreateForm.
 * On successful creation, navigates to /work-orders (the list page).
 * On cancel, navigates back to /work-orders.
 */
export function WorkOrderCreatePage() {
  const navigate = useNavigate();

  /**
   * Success callback — navigate to the work order list page after creation.
   * Per ATB-05, the page should redirect back to /work-orders on success.
   *
   * @param _created - the created work order record (unused, but typed for clarity)
   */
  const handleSuccess = useCallback(
    (_created: WorkOrderRecord) => {
      navigate("/work-orders");
    },
    [navigate],
  );

  /** Cancel callback — navigate back to list page. */
  const handleCancel = useCallback(() => {
    navigate("/work-orders");
  }, [navigate]);

  // -- render --------------------------------------------------------------
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            type="button"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">新建工单</h2>
            <p className="text-sm text-gray-500 mt-1">
              创建后状态为草稿，可从详情页提交审批
            </p>
          </div>
        </div>
      </div>

      {/* Form component */}
      <WorkOrderCreateForm
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}

export default WorkOrderCreatePage;
