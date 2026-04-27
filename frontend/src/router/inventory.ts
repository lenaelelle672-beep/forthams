/**
 * @module router/inventory
 * @description SWARM-P3-010-FE 资产盘点管理路由配置
 *
 * 路由结构:
 *   /inventory                  → 盘点任务列表页 (P3-010-A)，左右分栏布局
 *   /inventory/tasks/:taskId    → 盘点执行详情页 (P3-010-C/D/E)
 *
 * P3-010-B (新建盘点任务弹窗) 作为 CreateTaskModal 组件嵌入列表页，无需独立路由。
 *
 * 权限守卫由父级路由或全局 permission guard 统一拦截，
 * 无盘点权限用户将被重定向至 403 页面。
 */
import type { RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Spin } from 'antd';

// ---------------------------------------------------------------------------
// Lazy-loaded page components
// ---------------------------------------------------------------------------

/**
 * 盘点任务列表主页面
 *
 * 左右分栏布局：
 * - 左侧 320px：TaskList 组件（筛选、分页、任务列表）
 * - 右侧：通过 <Outlet /> 渲染子路由内容
 */
const InventoryTasksPage = lazy(
  () => import('@/app/pages/InventoryTasks'),
);

/**
 * 盘点执行详情页
 *
 * 包含：ProgressSummary、AssetTable、AssetTableToolbar、DifferenceSummaryPanel
 */
const InventoryDetailPage = lazy(
  () => import('@/app/pages/InventoryDetail'),
);

// ---------------------------------------------------------------------------
// Shared UI helpers
// ---------------------------------------------------------------------------

/**
 * 懒加载 Suspense fallback
 *
 * @returns 全屏居中 Spin 加载指示器
 */
function PageLoadingFallback(): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        minHeight: 200,
      }}
    >
      <Spin size="large" />
    </div>
  );
}

/**
 * 默认占位内容
 *
 * 未选中任何盘点任务时，右侧面板显示此占位组件，
 * 引导用户在左侧任务列表中选择任务。
 *
 * @returns 占位提示 React 元素
 */
function InventoryDefaultPlaceholder(): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        minHeight: 400,
        color: 'rgba(0, 0, 0, 0.25)',
        fontSize: 14,
      }}
    >
      请在左侧选择一个盘点任务查看详情
    </div>
  );
}

/**
 * 使用 Suspense 包裹懒加载组件
 *
 * @param LazyComponent - React.lazy 返回的懒加载组件
 * @returns 包含 Suspense fallback 的 React 元素
 */
function suspend<T extends React.ComponentType<any>>(
  LazyComponent: React.LazyExoticComponent<T>,
): React.ReactElement {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <LazyComponent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Route configuration
// ---------------------------------------------------------------------------

/**
 * 资产盘点管理路由配置数组
 *
 * 导出至主路由文件 (router/index.ts) 进行聚合注册。
 *
 * 路由层级:
 * ```
 * inventory                          → InventoryTasksPage (左右分栏布局)
 * ├── (index)                        → 默认占位提示
 * └── tasks/:taskId                  → InventoryDetailPage (盘点执行详情)
 * ```
 *
 * 各路由 handle 含 breadcrumb 配置，可供面包屑组件读取：
 *   盘点管理 > 任务详情
 */
export const inventoryRoutes: RouteObject[] = [
  {
    path: 'inventory',
    element: suspend(InventoryTasksPage),
    handle: {
      breadcrumb: '盘点管理',
    },
    children: [
      {
        index: true,
        element: <InventoryDefaultPlaceholder />,
      },
      {
        path: 'tasks/:taskId',
        element: suspend(InventoryDetailPage),
        handle: {
          breadcrumb: '任务详情',
        },
      },
    ],
  },
];

/**
 * 默认导出路由配置，便于动态导入
 */
export default inventoryRoutes;