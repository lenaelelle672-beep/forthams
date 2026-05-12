/**
 * AppRoutes — Centralized application route configuration for retirement module.
 *
 * SWARM-062: Provides route definitions for the asset retirement/decommission
 * module, including the retirement application form page and detail page.
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
    import('../pages/Retirement/RetirementDetail').then((module) => ({
      default: module.default ?? module.RetirementDetail,
    }))
  )
);

/**
 * Asset detail page — includes retirement history tab.
 */
const AssetDetailPage = withSuspense(
  lazy(() =>
    import('../pages/assets/AssetDetailPage').then((module) => ({
      default: module.AssetDetailPage,
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
 * All routes exported by this module.
 * Merge these into the main router's RootLayout children array.
 */
export const allAppRoutes: RouteObject[] = [
  assetDetailRoute,
  ...retirementRoutes,
];

export default allAppRoutes;
