/**
 * AppRoutes — Centralized application route configuration.
 *
 * SWARM-062 / SWARM-501: Provides route definitions for the asset
 * retirement/decommission module, approval workflow, workflow center,
 * workflow designer, and disposal management (transfer, clearance,
 * scrap, compensation). All pages use lazy loading + Suspense.
 * Intended to be integrated into the main router in routes.ts.
 *
 * @module routes/AppRoutes
 * @since SWARM-062
 */

import { createElement, Suspense, lazy, type ComponentType } from 'react';
import {
  type RouteObject,
} from 'react-router';

// ---------------------------------------------------------------------------
// Lazy-loaded page components
// ---------------------------------------------------------------------------

/**
 * PageLoadingFallback — displayed while lazy-loaded pages are being fetched.
 *
 * @returns A loading indicator element
 */
function PageLoadingFallback() {
  return createElement(
    'div',
    {
      className:
        'rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm',
    },
    '正在加载页面...'
  );
}

/**
 * Higher-order component that wraps a component with Suspense.
 *
 * @param Component - The component to wrap
 * @returns A wrapped component with Suspense boundary
 */
function withSuspense(Component: ComponentType) {
  return function SuspendedRoute() {
    return createElement(
      Suspense,
      { fallback: createElement(PageLoadingFallback) },
      createElement(Component)
    );
  };
}

// ---------------------------------------------------------------------------
// Lazy imports
// ---------------------------------------------------------------------------

/**
 * Asset retirement form page — users submit retirement applications.
 */
const AssetRetirementPage = withSuspense(
  lazy(() =>
    import('../pages/assets/AssetRetirementPage').then((module) => ({
      default: module.AssetRetirementPage,
    }))
  )
);

/**
 * Retirement detail page — view application status and approval chain.
 */
const RetirementDetail = withSuspense(
  lazy(() =>
    import('../pages/assets/AssetRetirementDetailPage').then((module) => ({
      default: module.AssetRetirementDetailPage,
    }))
  )
);

/**
 * Asset detail page — includes retirement history tab.
 */
const AssetDetailPage = withSuspense(
  lazy(() => import('@/pages/asset/AssetDetailPage'))
);

/**
 * Work order management page — centralized list, create, and lifecycle management.
 * SWARM-063: Full lifecycle work order management with real API integration.
 */
const WorkOrderManagementPage = withSuspense(
  lazy(() =>
    import('../pages/workorders/WorkOrderManagementPage').then((module) => ({
      default: module.WorkOrderManagementPage,
    }))
  )
);

/**
 * Approval list page — browse and act on approval processes.
 * SWARM-501: Centralized approval workflow list.
 */
const ApprovalListPage = withSuspense(
  lazy(() =>
    import('../pages/ApprovalListPage').then((module) => ({
      default: module.ApprovalListPage,
    }))
  )
);

/**
 * Workflow center page — manage workflow definitions and instances.
 */
const WorkflowCenter = withSuspense(
  lazy(() =>
    import('../pages/WorkflowCenter').then((module) => ({
      default: module.WorkflowCenter,
    }))
  )
);

/**
 * Workflow designer page — visual workflow definition editor.
 */
const WorkflowDesigner = withSuspense(
  lazy(() =>
    import('../pages/WorkflowDesigner').then((module) => ({
      default: module.WorkflowDesigner,
    }))
  )
);

/**
 * Disposals page — asset disposal management (transfer, clearance, scrap, compensation).
 */
const Disposals = withSuspense(
  lazy(() =>
    import('../pages/Disposals').then((module) => ({
      default: module.Disposals,
    }))
  )
);

/**
 * Asset transfer form — create a new transfer disposal.
 */
const AssetTransferForm = withSuspense(
  lazy(() =>
    import('../pages/AssetTransferForm').then((module) => ({
      default: module.AssetTransferForm,
    }))
  )
);

/**
 * Asset clearance form — create a new clearance disposal.
 */
const AssetClearanceForm = withSuspense(
  lazy(() =>
    import('../pages/AssetClearanceForm').then((module) => ({
      default: module.AssetClearanceForm,
    }))
  )
);

/**
 * Asset scrap form — create a new scrap disposal.
 */
const AssetScrapForm = withSuspense(
  lazy(() =>
    import('../pages/AssetScrapForm').then((module) => ({
      default: module.AssetScrapForm,
    }))
  )
);

/**
 * Asset compensation form — create a new compensation disposal.
 */
const AssetCompensationForm = withSuspense(
  lazy(() =>
    import('../pages/AssetCompensationForm').then((module) => ({
      default: module.AssetCompensationForm,
    }))
  )
);

/**
 * Disposal detail page — view disposal application details with approval history.
 */
const DisposalDetailPage = withSuspense(
  lazy(() =>
    import('../pages/assets/DisposalDetailPage').then((module) => ({
      default: module.DisposalDetailPage,
    }))
  )
);

/**
 * Work order detail page — view work order details and approval history.
 */
const WorkOrderDetailPage = withSuspense(
  lazy(() =>
    import('../pages/workorders/WorkOrderDetailPage').then((module) => ({
      default: module.default ?? module.WorkOrderDetailPage,
    }))
  )
);

/**
 * Maintenance execution page — execution tracking with timeline, steps, materials, and photos.
 * T3.1 维修执行跟踪
 */
const MaintenanceExecutionPage = withSuspense(
  lazy(() =>
    import('../pages/maintenance/execution/MaintenanceExecutionPage').then((module) => ({
      default: module.MaintenanceExecutionPage,
    }))
  )
);

/**
 * Depreciation comparison page — compare depreciation across different methods.
 * T4.4 折旧对比报表
 */
const DepreciationComparisonPage = withSuspense(
  lazy(() =>
    import('../pages/depreciation/DepreciationComparisonPage').then((module) => ({
      default: module.default,
    }))
  )
);

/**
 * Inspection template management page.
 * T5.2 检验模板管理
 */
const InspectionTemplatePage = withSuspense(
  lazy(() =>
    import('../pages/inspection/InspectionTemplatePage').then((module) => ({
      default: module.default,
    }))
  )
);

/**
 * Inspection record management page.
 * T5.2 检验记录管理
 */
const InspectionRecordPage = withSuspense(
  lazy(() =>
    import('../pages/inspection/InspectionRecordPage').then((module) => ({
      default: module.default,
    }))
  )
);

/**
 * Inspection task management page.
 * T5.2 检验任务管理
 */
const InspectionTaskPage = withSuspense(
  lazy(() =>
    import('../pages/inspection/InspectionTaskPage').then((module) => ({
      default: module.default,
    }))
  )
);

/**
 * Inspection form page (create/edit).
 * T5.2 检验表单页
 */
const InspectionFormPage = withSuspense(
  lazy(() =>
    import('../pages/inspection/InspectionFormPage').then((module) => ({
      default: module.default,
    }))
  )
);

/**
 * Inspection detail page.
 * T5.2 检验详情页
 */
const InspectionDetailPage = withSuspense(
  lazy(() =>
    import('../pages/inspection/InspectionDetailPage').then((module) => ({
      default: module.default,
    }))
  )
);

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

/**
 * Retirement-related route objects for integration into the main router.
 *
 * @description Defines routes for:
 * - `/retirement/new` — Asset retirement application form (reads assetId from query params)
 * - `/retirement/:id` — Retirement application detail view
 * - `/assets/:id` — Asset detail page with retirement history tab
 *
 * These routes are designed to be merged into the main router configuration
 * in routes.ts as children of the RootLayout route.
 */
export const retirementRoutes: RouteObject[] = [
  {
    path: 'retirement/new',
    Component: AssetRetirementPage,
  },
  {
    path: 'retirement/:id',
    Component: RetirementDetail,
  },
];

/**
 * Asset detail route with retirement integration.
 *
 * @description Overrides the assets/:id route to use the enhanced
 * AssetDetailPage that includes the retirement history tab.
 */
export const assetDetailRoute: RouteObject = {
  path: 'assets/:id',
  Component: AssetDetailPage,
};

/**
 * Work order management routes.
 *
 * @description Defines routes for:
 * - `/workorders` — Work order management page (list + inline create)
 * - `/workorders/:id` — Work order detail view
 */
export const workOrderRoutes: RouteObject[] = [
  {
    path: 'workorders',
    Component: WorkOrderManagementPage,
  },
  {
    path: 'workorders/:id',
    Component: WorkOrderDetailPage,
  },
];

/**
 * Approval workflow routes.
 *
 * @description Defines routes for:
 * - `/approvals` → ApprovalListPage (browse and act on approval processes)
 * - `/workflows` → WorkflowCenter (manage workflow definitions)
 * - `/workflow-designer` → WorkflowDesigner (visual workflow editor)
 *
 * SWARM-501: Full approval workflow route registration with lazy loading.
 */
export const approvalRoutes: RouteObject[] = [
  {
    path: 'approvals',
    Component: ApprovalListPage,
  },
  {
    path: 'workflows',
    Component: WorkflowCenter,
  },
  {
    path: 'workflow-designer',
    Component: WorkflowDesigner,
  },
];

/**
 * Disposal management routes.
 *
 * @description Defines routes for:
 * - `/disposals` → Disposals (main disposal list with tabs)
 * - `/disposals/transfer/new` → AssetTransferForm
 * - `/disposals/clearance/new` → AssetClearanceForm
 * - `/disposals/scrap/new` → AssetScrapForm
 * - `/disposals/compensation/new` → AssetCompensationForm
 */
export const disposalRoutes: RouteObject[] = [
  {
    path: 'disposals',
    Component: Disposals,
  },
  {
    path: 'disposals/:id',
    Component: DisposalDetailPage,
  },
  {
    path: 'disposals/transfer/new',
    Component: AssetTransferForm,
  },
  {
    path: 'disposals/clearance/new',
    Component: AssetClearanceForm,
  },
  {
    path: 'disposals/scrap/new',
    Component: AssetScrapForm,
  },
  {
    path: 'disposals/compensation/new',
    Component: AssetCompensationForm,
  },
];

/**
 * Maintenance execution routes.
 *
 * @description Defines routes for:
 * - `/maintenance/execution/:id` — Execution tracking page with timeline, steps, materials, photos
 *
 * T3.1 维修执行跟踪
 */
export const maintenanceRoutes: RouteObject[] = [
  {
    path: 'maintenance/execution/:id',
    Component: MaintenanceExecutionPage,
  },
];

/**
 * Depreciation management routes.
 *
 * @description Defines routes for:
 * - `/depreciation/comparison` — Depreciation comparison page (T4.4)
 */
export const depreciationRoutes: RouteObject[] = [
  {
    path: 'depreciation/comparison',
    Component: DepreciationComparisonPage,
  },
];

/**
 * Inspection management routes.
 *
 * @description Defines routes for:
 * - `/inspections` — Inspection list page (T5.2)
 * - `/inspections/new` — Create new inspection (T5.2)
 * - `/inspections/:id` — Inspection detail page (T5.2)
 * - `/inspections/:id/edit` — Edit inspection (T5.2)
 * - `/inspections/:id/detail` — Inspection detail view (T5.2)
 * - `/inspection/templates` — Inspection template management page (T5.2)
 * - `/inspection/records` — Inspection record management page (T5.2)
 * - `/inspection/tasks` — Inspection task management page (T5.2)
 */
export const inspectionRoutes: RouteObject[] = [
  {
    path: 'inspection/templates',
    Component: InspectionTemplatePage,
  },
  {
    path: 'inspection/records',
    Component: InspectionRecordPage,
  },
  {
    path: 'inspection/tasks',
    Component: InspectionTaskPage,
  },
  {
    path: 'inspections',
    Component: InspectionRecordPage,
  },
  {
    path: 'inspections/new',
    Component: InspectionFormPage,
  },
  {
    path: 'inspections/:id',
    Component: InspectionFormPage,
  },
  {
    path: 'inspections/:id/edit',
    Component: InspectionFormPage,
  },
  {
    path: 'inspections/:id/detail',
    Component: InspectionDetailPage,
  },
];

/**
 * All routes exported by this module.
 * Merge these into the main router's RootLayout children array.
 */
export const allAppRoutes: RouteObject[] = [
  assetDetailRoute,
  ...retirementRoutes,
  ...workOrderRoutes,
  ...approvalRoutes,
  ...disposalRoutes,
  ...maintenanceRoutes,
  ...depreciationRoutes,
  ...inspectionRoutes,
];

export default allAppRoutes;
