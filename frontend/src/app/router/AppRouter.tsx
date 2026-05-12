/**
 * AppRouter — 资产导入导出路由注册模块
 *
 * @module router/AppRouter
 * @description 导出 `/assets/import-export` 路由配置，
 * 用于注册到主路由器的 children 数组中。
 *
 * 集成方式：在 App.tsx 或 routes.ts 的 children 中展开 assetImportExportRoutes。
 *
 * @since SWARM-065
 */

import React, { Suspense, lazy } from 'react';

/* ------------------------------------------------------------------ */
/*  Lazy-loaded page                                                   */
/* ------------------------------------------------------------------ */

/**
 * AssetImportExportPage — 资产批量导入导出页面
 *
 * 懒加载以优化首屏性能。
 */
const AssetImportExportPage = lazy(
  () =>
    import('../pages/assets/AssetImportExportPage').then((mod) => ({
      default: mod.default,
    })),
);

/* ------------------------------------------------------------------ */
/*  Shared suspense fallback                                           */
/* ------------------------------------------------------------------ */

/**
 * 页面加载中占位组件
 */
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
    加载中…
  </div>
);

/**
 * 包裹懒加载组件的 Suspense 边界
 *
 * @param props.children - 懒加载的组件
 * @returns 包裹了 Suspense 的组件
 */
const WithSuspense: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <Suspense fallback={<LoadingFallback />}>{children}</Suspense>;

/* ------------------------------------------------------------------ */
/*  Route definitions                                                  */
/* ------------------------------------------------------------------ */

/**
 * 资产导入导出路由定义
 *
 * @description 注册 `/assets/import-export` 路由，懒加载页面组件。
 * 集成方式：在主路由 children 中展开此数组。
 *
 * @example
 * ```tsx
 * import { assetImportExportRoutes } from '@/app/router/AppRouter';
 *
 * // 在 createBrowserRouter 的 children 中：
 * children: [
 *   ...assetImportExportRoutes,
 * ]
 * ```
 */
export const assetImportExportRoutes = [
  {
    path: 'assets/import-export',
    element: (
      <WithSuspense>
        <AssetImportExportPage />
      </WithSuspense>
    ),
  },
];

export default assetImportExportRoutes;
