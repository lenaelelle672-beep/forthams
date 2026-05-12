/**
 * MainLayout — 主布局路由容器
 *
 * 作为系统默认首页路由的入口布局组件，
 * 将根路径的默认出口重定向至 DashboardPage。
 *
 * 职责：
 * - 渲染 DashboardPage 作为系统首页内容
 * - 保持与现有 RootLayout 侧边栏、顶部导航的兼容性
 * - 不破坏已有的嵌套路由与其他页面权限守卫逻辑
 *
 * @module layout/MainLayout
 * @see frontend/src/app/pages/DashboardPage.tsx — DashboardPage
 */

import React, { Suspense, lazy } from 'react';

/**
 * 懒加载 DashboardPage 以优化首屏加载性能
 */
const LazyDashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((module) => ({
    default: module.default,
  }))
);

/**
 * DashboardPage 加载中的骨架占位组件
 */
function DashboardLoadingFallback(): React.ReactElement {
  return (
    <div
      data-testid="dashboard-loading-fallback"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        padding: '2rem',
        fontSize: '0.875rem',
        color: '#6b7280',
      }}
    >
      <div
        style={{
          borderRadius: '0.5rem',
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          padding: '1.5rem',
          boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
        }}
      >
        正在加载仪表板页面...
      </div>
    </div>
  );
}

/**
 * MainLayout 组件
 *
 * 渲染 DashboardPage 作为系统默认首页。
 * 使用 Suspense 包裹懒加载组件，提供加载态骨架屏。
 * 不破坏已有的嵌套路由与其他页面权限守卫逻辑。
 *
 * @example
 * ```tsx
 * // 在 App.tsx 路由中使用（替代原 Dashboard 组件）
 * { index: true, Component: MainLayout }
 * ```
 */
export const MainLayout: React.FC = () => {
  return (
    <Suspense fallback={<DashboardLoadingFallback />}>
      <LazyDashboardPage />
    </Suspense>
  );
};

export default MainLayout;
