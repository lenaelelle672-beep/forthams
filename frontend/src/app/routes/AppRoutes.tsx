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
 * All routes exported by this module.
 * Merge these into the main router's RootLayout children array.
 */
export const allAppRoutes: RouteObject[] = [
  assetDetailRoute,
  ...retirementRoutes,
  ...workOrderRoutes,
  ...approvalRoutes,
  ...disposalRoutes,
];

export default allAppRoutes;
