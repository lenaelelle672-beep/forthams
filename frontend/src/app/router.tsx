/**
 * @module app/router
 * @description Vendor route registration module for SWARM-058.
 *
 * Exports a `vendorRoutes` array that can be spread into the main router's
 * children to register all vendor-related routes.
 *
 * Route structure:
 *   /vendors              → VendorListPage   (browse & search vendors)
 *   /vendors/:id          → VendorDetailPage (view vendor details)
 *   /vendors/new          → VendorFormPage   (create vendor)
 *   /vendors/:id/edit     → VendorFormPage   (edit vendor)
 *
 * @since SWARM-058
 */

import React, { Suspense, lazy } from "react";

/* ------------------------------------------------------------------ */
/*  Lazy-loaded vendor pages                                           */
/* ------------------------------------------------------------------ */

/**
 * VendorListPage — 供应商列表管理页面
 *
 * 展示供应商列表，支持搜索过滤、新增、编辑和删除操作。
 */
const VendorListPage = lazy(
  () =>
    import("./pages/vendor/VendorListPage").then((mod) => ({
      default: mod.default,
    })),
);

/**
 * VendorDetailPage — 供应商详情页面
 *
 * 展示单个供应商的完整信息，支持查看和编辑跳转。
 */
const VendorDetailPage = lazy(
  () =>
    import("./pages/vendor/VendorDetailPage").then((mod) => ({
      default: mod.default,
    })),
);

/**
 * VendorFormPage — 供应商创建/编辑表单页面
 *
 * 根据 URL 参数判断创建或编辑模式，提供表单交互。
 */
const VendorFormPage = lazy(
  () =>
    import("./pages/vendor/VendorFormPage").then((mod) => ({
      default: mod.default,
    })),
);

/**
 * LocationPage — 位置层级管理页面
 *
 * 提供位置的树形层级管理功能，支持真实 API 数据交互。
 *
 * @since SWARM-059
 */
const LocationPage = lazy(
  () =>
    import("./pages/location/LocationPage").then((mod) => ({
      default: mod.default,
    })),
);

/**
 * LocationTreePage — 位置层级树管理页面（含拖拽排序）
 *
 * 提供位置的交互式树视图浏览与拖拽重排功能。
 *
 * @since SWARM-072
 */
const LocationTreePage = lazy(
  () =>
    import("./pages/location/LocationTreePage").then((mod) => ({
      default: mod.default,
    })),
);

/**
 * LocationFormPage — 位置创建/编辑表单页面
 *
 * 根据 URL 路由参数判断创建或编辑模式。
 *
 * @since SWARM-072
 */
const LocationFormPage = lazy(
  () =>
    import("./pages/location/LocationFormPage").then((mod) => ({
      default: mod.default,
    })),
);

const AuditDashboardPage = lazy(
  () =>
    import("./pages/audit/AuditDashboardPage").then((mod) => ({
      default: mod.default ?? mod.AuditDashboardPage,
    })),
);

const AuditDetailPage = lazy(
  () =>
    import("./pages/audit/AuditDetailPage").then((mod) => ({
      default: mod.default ?? mod.AuditDetailPage,
    })),
);

/* ------------------------------------------------------------------ */
/*  Shared suspense fallback                                           */
/* ------------------------------------------------------------------ */

/**
 * Default loading indicator for lazy-loaded vendor pages.
 */
const VendorLoadingFallback: React.FC = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100%",
      minHeight: 200,
    }}
  >
    加载中…
  </div>
);

/**
 * Wraps children in a Suspense boundary with the standard fallback.
 *
 * @param props.children - The lazy-loaded component to wrap
 * @returns React component wrapped in Suspense
 */
const WithSuspense: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <Suspense fallback={<VendorLoadingFallback />}>{children}</Suspense>;

/* ------------------------------------------------------------------ */
/*  Route definitions                                                  */
/* ------------------------------------------------------------------ */

/**
 * Vendor route definitions for registration in the main router.
 *
 * All routes are lazy-loaded with Suspense boundaries.
 * Integrate by spreading into the main router's `children` array:
 *
 * @example
 * ```tsx
 * import { vendorRoutes } from "@/app/router";
 *
 * // Inside createBrowserRouter children:
 * children: [
 *   // ...existing routes...
 *   ...vendorRoutes,
 * ]
 * ```
 *
 * Route map:
 * - `vendors`             → VendorListPage
 * - `vendors/:id`         → VendorDetailPage (must come after `new` and `edit/:id`)
 * - `vendors/new`         → VendorFormPage (create mode)
 * - `vendors/:id/edit`    → VendorFormPage (edit mode)
 */
export const vendorRoutes = [
  {
    path: "vendors",
    element: (
      <WithSuspense>
        <VendorListPage />
      </WithSuspense>
    ),
  },
  {
    path: "vendors/new",
    element: (
      <WithSuspense>
        <VendorFormPage />
      </WithSuspense>
    ),
  },
  {
    path: "vendors/:id/edit",
    element: (
      <WithSuspense>
        <VendorFormPage />
      </WithSuspense>
    ),
  },
  {
    path: "vendors/:id",
    element: (
      <WithSuspense>
        <VendorDetailPage />
      </WithSuspense>
    ),
  },
];

/**
 * Location route definitions for registration in the main router.
 *
 * @description All location management routes, lazy-loaded with Suspense.
 * Integrate by spreading into the main router's `children` array:
 *
 * @example
 * ```tsx
 * import { locationRoutes } from "@/app/router";
 *
 * children: [
 *   ...locationRoutes,
 * ]
 * ```
 *
 * Route map:
 * - `locations`           → LocationPage (legacy tree table management)
 * - `locations/tree`      → LocationTreePage (interactive tree with drag-and-drop)
 * - `locations/new`       → LocationFormPage (create mode)
 * - `locations/:id/edit`  → LocationFormPage (edit mode)
 *
 * @since SWARM-059
 */
export const locationRoutes = [
  {
    path: "locations",
    element: (
      <WithSuspense>
        <LocationPage />
      </WithSuspense>
    ),
  },
  {
    path: "locations/tree",
    element: (
      <WithSuspense>
        <LocationTreePage />
      </WithSuspense>
    ),
  },
  {
    path: "locations/new",
    element: (
      <WithSuspense>
        <LocationFormPage />
      </WithSuspense>
    ),
  },
  {
    path: "locations/:id/edit",
    element: (
      <WithSuspense>
        <LocationFormPage />
      </WithSuspense>
    ),
  },
];

/**
 * Audit route definitions for registration in the main router.
 *
 * @description Audit log dashboard routes, lazy-loaded with Suspense.
 * Integrate by spreading into the main router's `children` array:
 *
 * @example
 * ```tsx
 * import { auditRoutes } from "@/app/router";
 *
 * children: [
 *   ...auditRoutes,
 * ]
 * ```
 *
 * Route map:
 * - `audit` → AuditDashboardPage (audit log dashboard with trend charts)
 * - `audit/:id` → AuditDetailPage (audit log detail drill-down)
 *
 * @since SWARM-060
 */
export const auditRoutes = [
  {
    path: "audit",
    element: (
      <WithSuspense>
        <AuditDashboardPage />
      </WithSuspense>
    ),
  },
  {
    path: "audit/:id",
    element: (
      <WithSuspense>
        <AuditDetailPage />
      </WithSuspense>
    ),
  },
];

export default vendorRoutes;
