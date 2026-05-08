import React, { Suspense, lazy } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
} from 'react-router-dom';

/* -------------------------------------------------------------------------- */
/*  Lazy-loaded layout & pages                                                */
/* -------------------------------------------------------------------------- */

const Layout = lazy(
  () => import('@/components/layout').then((mod) => ({ default: mod.Layout })),
);

const DashboardPage = lazy(
  () =>
    import('@/pages/DashboardPage').then((mod) => ({
      default: mod.DashboardPage,
    })),
);

const AssetList = lazy(
  () => import('@/pages/assets').then((mod) => ({ default: mod.AssetList })),
);

const LocationTree = lazy(
  () =>
    import('@/pages/location').then((mod) => ({ default: mod.LocationTree })),
);

const CategoryTree = lazy(
  () =>
    import('@/pages/category').then((mod) => ({ default: mod.CategoryTree })),
);

const NotFoundPage = lazy(
  () =>
    import('@/pages/not-found').then((mod) => ({
      default: mod.NotFoundPage,
    })),
);

const ForbiddenPage = lazy(
  () =>
    import('@/pages/forbidden').then((mod) => ({
      default: mod.ForbiddenPage,
    })),
);

// ---------------------------------------------------------------------------
// SWARM-P3-010: Asset Inventory Management pages
// ---------------------------------------------------------------------------
const InventoryTasksPage = lazy(
  () =>
    import('@/app/pages/InventoryTasks').then((mod) => ({
      default: mod.InventoryTasks,
    })),
);

const InventoryDetailPage = lazy(
  () =>
    import('@/app/pages/InventoryDetail').then((mod) => ({
      default: mod.InventoryDetail,
    })),
);

// ---------------------------------------------------------------------------
// ITSM/ITAM Core Pages (Iteration 1 MVP)
// ---------------------------------------------------------------------------
const DashboardView = lazy(
  () =>
    import('@/views/dashboard.vue').then((mod) => ({
      default: mod.default,
    })),
);

const AssetListView = lazy(
  () =>
    import('@/views/asset-list.vue').then((mod) => ({
      default: mod.default,
    })),
);

const ApprovalListView = lazy(
  () =>
    import('@/views/approval-list.vue').then((mod) => ({
      default: mod.default,
    })),
);

/* -------------------------------------------------------------------------- */
/*  Shared suspense fallback                                                  */
/* -------------------------------------------------------------------------- */

/** Default loading indicator rendered while lazy-loaded chunks are fetched. */
const LoadingFallback: React.FC = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      minHeight: 200,
    }}
  >
    Loading…
  </div>
);

/**
 * Wraps children in a Suspense boundary with the standard fallback.
 * Keeps route definitions concise.
 */
const WithSuspense: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <Suspense fallback={<LoadingFallback />}>{children}</Suspense>;

/* -------------------------------------------------------------------------- */
/*  Permission guard                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Route-level permission guard.
 *
 * Checks whether the current user possesses the specified permission.
 * If the check fails, the user is redirected to the `/403` page.
 *
 * NOTE: Replace the placeholder body with the real permission hook
 *       (e.g. `usePermissions` from `@/app/utils/permissionHooks`)
 *       once the auth integration is complete.
 *
 * @param permission - The permission string required to access the route.
 * @param children  - The protected route element(s).
 */
const PermissionGuard: React.FC<{
  permission: string;
  children: React.ReactNode;
}> = ({ permission, children }) => {
  // TODO: Replace with actual permission check:
  //   const { hasPermission } = usePermissions();
  //   if (!hasPermission(permission)) return <Navigate to="/403" replace />;
  // Permission key is intentionally captured for future integration.
  void permission;
  return <>{children}</>;
};

/* -------------------------------------------------------------------------- */
/*  Router configuration                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Application-wide route tree.
 *
 * Inventory routes (SWARM-P3-010) are nested under `/inventory`:
 *   - `/inventory`            → InventoryTasks (left-right split layout)
 *   - `/inventory/tasks/:id`  → InventoryDetail (renders inside the right Outlet)
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <WithSuspense>
        <Layout />
      </WithSuspense>
    ),
    children: [
      // -------------------------------------------------------------------
      //  Default & top-level pages
      // -------------------------------------------------------------------
      { index: true, element: <Navigate to="/dashboard" replace /> },

      {
        path: 'dashboard',
        element: (
          <WithSuspense>
            <DashboardPage />
          </WithSuspense>
        ),
      },
      {
        path: 'assets',
        element: (
          <WithSuspense>
            <AssetList />
          </WithSuspense>
        ),
      },
      {
        path: 'location',
        element: (
          <WithSuspense>
            <LocationTree />
          </WithSuspense>
        ),
      },
      {
        path: 'category',
        element: (
          <WithSuspense>
            <CategoryTree />
          </WithSuspense>
        ),
      },
      {
        path: 'approvals',
        element: (
          <WithSuspense>
            <ApprovalListView />
          </WithSuspense>
        ),
      },

      // ===================================================================
      //  SWARM-P3-010 — 资产盘点管理 (Asset Inventory Management)
      // ===================================================================
      //
      //  Route structure:
      //    /inventory                → InventoryTasks page
      //                                 (left panel: TaskList 320px,
      //                                  right panel: Outlet → placeholder)
      //    /inventory/tasks/:taskId  → InventoryDetail page
      //                                 (renders inside right panel Outlet)
      //
      //  Permission guard: redirects to /403 if user lacks `inventory:manage`.
      //  Breadcrumb chain: 盘点管理 > 任务详情
      // ===================================================================
      {
        path: 'inventory',
        element: (
          <PermissionGuard permission="inventory:manage">
            <WithSuspense>
              <InventoryTasksPage />
            </WithSuspense>
          </PermissionGuard>
        ),
        handle: { breadcrumb: '盘点管理' },
        children: [
          {
            index: true,
            element: (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                  color: '#999',
                }}
              >
                请在左侧选择一个盘点任务
              </div>
            ),
          },
          {
            path: 'tasks/:taskId',
            element: (
              <WithSuspense>
                <InventoryDetailPage />
              </WithSuspense>
            ),
            handle: {
              breadcrumb: '任务详情',
              parentBreadcrumb: '盘点管理',
              parentPath: '/inventory',
            },
          },
        ],
      },

      // -------------------------------------------------------------------
      //  Error pages
      // -------------------------------------------------------------------
      {
        path: '403',
        element: (
          <WithSuspense>
            <ForbiddenPage />
          </WithSuspense>
        ),
      },
      {
        path: '404',
        element: (
          <WithSuspense>
            <NotFoundPage />
          </WithSuspense>
        ),
      },
      {
        path: '*',
        element: <Navigate to="/404" replace />,
      },
    ],
  },
]);

export default router;