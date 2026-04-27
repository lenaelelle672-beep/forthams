/**
 * @module frontend/src/router/dashboard
 * @description [SWARM-P2-007-FE] Asset Panorama Dashboard — Route configuration.
 *
 * Defines the `/dashboard` route with authentication guard and lazy-loaded
 * page component. The dashboard renders stat cards, ECharts pie/line charts,
 * and an expiring-asset warning list as specified in Phase 2 Iteration 1.
 */

import { createElement, lazy, Suspense, type ReactNode } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Lazy-loaded modules (code-split for performance)
// ---------------------------------------------------------------------------

/** Dashboard page — heavy module containing ECharts, React Query, etc. */
const DashboardPage = lazy(
  () => import('../pages/DashboardPage'),
);

/**
 * Authentication guard component.
 *
 * Checks whether a valid auth token exists (localStorage / cookie).
 * Redirects to `/login` when unauthenticated; renders children otherwise.
 *
 * @param props.children - Protected content to render when authenticated.
 * @returns React node — either the children or a redirect to login.
 */
function AuthGuard({ children }: { children: ReactNode }): ReactNode {
  const isAuthenticated = Boolean(
    typeof window !== 'undefined' &&
    (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')),
  );

  if (!isAuthenticated) {
    return createElement(Navigate, { to: '/login', replace: true });
  }

  return children as ReactNode;
}

// ---------------------------------------------------------------------------
// Loading fallback — skeleton screen shown while dashboard chunk loads
// ---------------------------------------------------------------------------

/**
 * Renders a full-page skeleton placeholder with correct data-testid for E2E.
 *
 * @returns A React element representing the loading skeleton.
 */
function renderDashboardSkeleton(): ReactNode {
  return createElement(
    'div',
    {
      className: 'dashboard-skeleton',
      'data-testid': 'dashboard-loading',
      style: {
        display: 'grid',
        gap: '16px',
        padding: '24px',
        gridTemplateColumns: 'repeat(4, 1fr)',
      },
    },
    // Four skeleton stat-card placeholders
    ...Array.from({ length: 4 }, (_, i) =>
      createElement('div', {
        key: `skeleton-card-${i}`,
        style: {
          height: '100px',
          borderRadius: '8px',
          background:
            'linear-gradient(90deg, var(--color-surface-muted, #e0e0e0) 25%, transparent 50%)',
          backgroundSize: '200% 100%',
          animation: 'skeleton-shimmer 1.5s infinite',
        },
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

/**
 * Builds the dashboard route object with authentication guard.
 *
 * The route renders a lazy-loaded `DashboardPage` wrapped in an `AuthGuard`
 * to enforce login state. A skeleton fallback is shown during chunk loading.
 *
 * @returns A single `RouteObject` for `/dashboard`.
 */
export function buildDashboardRoute(): RouteObject {
  return {
    path: '/dashboard',
    element: createElement(
      AuthGuard,
      null,
      createElement(
        Suspense,
        { fallback: renderDashboardSkeleton() },
        createElement(DashboardPage),
      ),
    ),
  };
}

/**
 * Pre-built dashboard route — convenient default export for router tree.
 *
 * @example
 * ```ts
 * // frontend/src/router/index.ts
 * import dashboardRoutes from './dashboard';
 *
 * const router = createBrowserRouter([dashboardRoutes, ...otherRoutes]);
 * ```
 */
const dashboardRoutes: RouteObject = buildDashboardRoute();
export default dashboardRoutes;