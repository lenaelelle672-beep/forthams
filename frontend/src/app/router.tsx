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
 *   /vendors/edit/:id     → VendorFormPage   (edit vendor)
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
 * - `vendors/edit/:id`    → VendorFormPage (edit mode)
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
    path: "vendors/edit/:id",
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

export default vendorRoutes;
