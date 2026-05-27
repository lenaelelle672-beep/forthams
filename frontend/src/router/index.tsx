/**
 * @file router/index.tsx
 * @description forthAMS 唯一路由配置 — 权威版本
 *
 * 规则：
 * - 全项目只有此文件定义路由
 * - 所有页面组件使用 React.lazy + Suspense 懒加载
 * - 新页面已建立则直接使用，未建立则使用 PlaceholderPage
 * - ProtectedRoute（同步组件，不 lazy）守卫受保护路由
 */

import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/app/context/AuthContext';
import ForbiddenPage from '@/pages/ForbiddenPage';

// ── 通用占位组件（未完成页面的临时展示）────────────────────────────────────────
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="p-6 flex flex-col items-center justify-center min-h-[400px] text-center">
    <div className="w-16 h-16 rounded-2xl bg-[#f1f5f9] flex items-center justify-center mb-4">
      <svg className="w-8 h-8 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    </div>
    <h2 className="text-lg font-semibold text-[#374151] mb-2">{title}</h2>
    <p className="text-sm text-[#94a3b8]">此模块正在重构中，即将上线</p>
  </div>
);

// ── Loading 态 ───────────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3b82f6]" />
  </div>
);

// ── Suspense 包装工具 ─────────────────────────────────────────────────────────
const S = (C: React.LazyExoticComponent<any>) => (
  <Suspense fallback={<PageLoader />}><C /></Suspense>
);

// ── 路由守卫 ──────────────────────────────────────────────────────────────────
function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    // 双保险：同步检查 storage（覆盖 LoginPage 直接写 sessionStorage 或测试 seed 场景）
    const token = typeof window !== 'undefined'
      ? (window.sessionStorage.getItem('auth_token') || window.localStorage.getItem('auth_token'))
      : null;
    if (token) {
      return <Outlet />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

// ── 角色守卫 ──────────────────────────────────────────────────────────────────
function PermissionGuard({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // roles 为空或 undefined 时 — 用户信息不完整，引导重新登录
  if (!user?.roles || user.roles.length === 0) {
    return <Navigate to="/forbidden?reason=roles_missing" replace />;
  }

  const hasRequiredRole = roles.some((role) =>
    user.roles.some((r) => r.toUpperCase() === role.toUpperCase())
  );

  if (!hasRequiredRole) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}

// ── 布局 ──────────────────────────────────────────────────────────────────────
const AppLayout     = React.lazy(() => import('@/layouts/AppLayout'));
const LoginPage     = React.lazy(() => import('@/pages/auth/LoginPage'));
const BigScreenPage = React.lazy(() => import('@/pages/bigscreen/BigScreenPage'));
const BigScreen3DPage = React.lazy(() => import('@/pages/bigscreen/BigScreen3DPage'));
// ── 新建完成的页面（直接导入）──────────────────────────────────────────────────
const DashboardPage         = React.lazy(() => import('@/pages/dashboard/DashboardPage'));
const AssetListPage         = React.lazy(() => import('@/pages/asset/AssetListPage'));
const AssetDetailPage       = React.lazy(() => import('@/pages/asset/AssetDetailPage'));
const AssetFormPage         = React.lazy(() => import('@/pages/asset/AssetFormPage'));
// 工单管理已合并到资产处置（WorkOrderDetailPage 仍被审批流程详情引用，WorkOrderFormPage 供新建按钮使用）
const WorkOrderDetailPage   = React.lazy(() => import('@/pages/workorder/WorkOrderDetailPage'));
const WorkOrderFormPage     = React.lazy(() => import('@/pages/workorder/WorkOrderFormPage'));
const ApprovalListPage      = React.lazy(() => import('@/pages/approval/ApprovalListPage'));
const NotificationsPage     = React.lazy(() => import('@/pages/notifications/NotificationsPage'));
const InventoryTasksPage    = React.lazy(() => import('@/pages/inventory/InventoryTasksPage'));
const InventoryDetailPage   = React.lazy(() => import('@/pages/inventory/InventoryDetailPage'));
const AuditDashboardPage    = React.lazy(() => import('@/pages/audit/AuditDashboardPage'));
const AuditDetailPage       = React.lazy(() => import('@/pages/audit/AuditDetailPage'));
const DisposalListPage         = React.lazy(() => import('@/pages/disposal/DisposalListPage'));
const DisposalDetailPage       = React.lazy(() => import('@/pages/disposal/DisposalDetailPage'));
const AssetTransferFormPage    = React.lazy(() => import('@/pages/disposal/AssetTransferFormPage'));
const AssetClearanceFormPage   = React.lazy(() => import('@/pages/disposal/AssetClearanceFormPage'));
const AssetScrapFormPage       = React.lazy(() => import('@/pages/disposal/AssetScrapFormPage'));
const AssetCompensationFormPage = React.lazy(() => import('@/pages/disposal/AssetCompensationFormPage'));
const AnalyticsPage            = React.lazy(() => import('@/pages/analytics/AnalyticsPage'));
const ReportsPage           = React.lazy(() => import('@/pages/reports/ReportsPage'));
const AssetImportExportPage   = React.lazy(() => import('@/pages/AssetImportExport/AssetImportExportPage'));
const CategoryManagerPage     = React.lazy(() => import('@/pages/category/CategoryManagerPage'));

// ── 重构完成的新页面 ──────────────────────────────────────────────────────────
const IdleAssetsPage       = React.lazy(() => import('@/pages/idle/IdleAssetsPage'));
const DepreciationListPage = React.lazy(() => import('@/pages/depreciation/DepreciationListPage'));

// ── 工作流新版页面 ────────────────────────────────────────────────────────────
const WorkflowCenterPage  = React.lazy(() => import('@/pages/workflow/WorkflowCenterPage'));
const WorkflowDesignerPage = React.lazy(() => import('@/pages/workflow/WorkflowDesignerPage'));
const WorkflowFormPage = React.lazy(() => import('@/pages/workflow/WorkflowFormPage'));

// ── 重构完成的页面（新 Design System）────────────────────────────────────────
const EquipmentPage = React.lazy(() => import('@/pages/equipment/EquipmentPage'));
const RFIDScanPage      = React.lazy(() => import('@/pages/inventory/RFIDScanPage'));
const SmartReportPage   = React.lazy(() => import('@/pages/inventory/SmartReportPage'));
const VendorsPage   = React.lazy(() => import('@/pages/vendors/VendorsPage'));
const LocationsPage = React.lazy(() => import('@/pages/locations/LocationsPage'));
const SettingsPage  = React.lazy(() => import('@/pages/settings/SettingsPage'));
const MenuManagementPage = React.lazy(() => import('@/pages/system/MenuManagement'));

// ── SSO 回调页 ──────────────────────────────────────────────────────────────
const SsoCallbackPage = React.lazy(() => import('@/pages/auth/SsoCallbackPage'));

// ── 系统管理独立页面 ─────────────────────────────────────────────────────────
const RoleManagementPage = React.lazy(() => import('@/pages/system/RoleManagement'));
const UserManagementPage = React.lazy(() => import('@/pages/system/UserManagement'));
const PostManagementPage = React.lazy(() => import('@/pages/system/PostManagement'));
const DeptManagementPage = React.lazy(() => import('@/pages/system/DeptManagement'));

// ── 路由配置 ──────────────────────────────────────────────────────────────────
const router = createBrowserRouter([
  // ── 公开路由（无需认证） ───────────────────────────────────────────────────
  {
    path: '/login',
    element: S(LoginPage),
  },
  {
    path: '/forbidden',
    element: <ForbiddenPage />,
  },
  {
    path: '/sso-callback',
    element: S(SsoCallbackPage),
  },
  // ── 受保护路由（需要认证） ───────────────────────────────────────────────────────────
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      // 大屏路由（全屏无侧边栏，需要 ADMIN 或 SUPER_ADMIN 角色）
      { path: 'bigscreen',    element: <PermissionGuard roles={['ADMIN', 'SUPER_ADMIN']}>{S(BigScreenPage)}</PermissionGuard> },
      { path: 'bigscreen-3d', element: <PermissionGuard roles={['ADMIN', 'SUPER_ADMIN']}>{S(BigScreen3DPage)}</PermissionGuard> },
      {
        element: S(AppLayout),
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },

          // 仪表板
          { path: 'dashboard', element: S(DashboardPage) },

          // 资产台账
          { path: 'assets',              element: S(AssetListPage) },
          { path: 'assets/new',          element: S(AssetFormPage) },
          { path: 'assets/import-export', element: S(AssetImportExportPage) },
          { path: 'assets/:id',          element: S(AssetDetailPage) },
          { path: 'assets/:id/edit',     element: S(AssetFormPage) },

          // 重要设备（已重构 → EquipmentPage）
          { path: 'equipment',     element: S(EquipmentPage) },
          { path: 'equipment/:id', element: S(EquipmentPage) },

          // 工单管理已合并到资产处置，列表重定向，详情/新建页仍可访问
          { path: 'workorders',      element: <Navigate to="/disposals" replace /> },
          { path: 'workorders/new',  element: S(WorkOrderFormPage) },
          { path: 'workorders/:id',  element: S(WorkOrderDetailPage) },

          // 审批流程
          { path: 'approvals',     element: S(ApprovalListPage) },
          { path: 'approvals/:id', element: S(WorkOrderDetailPage) },

          // 盘点管理
          { path: 'inventory',                         element: S(InventoryTasksPage) },
          { path: 'inventory/tasks/:taskId',            element: S(InventoryDetailPage) },
          { path: 'inventory/scan/:taskId',             element: S(RFIDScanPage) },
          { path: 'inventory/smart-report',             element: S(SmartReportPage) },
          { path: 'inventory/smart-report/:taskId',     element: S(SmartReportPage) },

          // 退役管理已合并到资产处置/资产清退，旧路径保留重定向避免深链失效
          { path: 'retirement',     element: <Navigate to="/disposals" replace /> },
          { path: 'retirement/new', element: <Navigate to="/disposals/clearance/new" replace /> },
          { path: 'retirement/:id', element: <Navigate to="/disposals" replace /> },

          // 资产处置
          { path: 'disposals',              element: S(DisposalListPage) },
          { path: 'disposals/:id',          element: S(DisposalDetailPage) },
          { path: 'disposals/transfer/new',  element: S(AssetTransferFormPage) },
          { path: 'disposals/clearance/new', element: S(AssetClearanceFormPage) },
          { path: 'disposals/scrap/new',     element: S(AssetScrapFormPage) },

          // 闲置资产
          { path: 'idle', element: S(IdleAssetsPage) },

          // 赔偿管理
          { path: 'compensation',      element: S(AssetCompensationFormPage) },
          { path: 'compensation/new',  element: S(AssetCompensationFormPage) },
          { path: 'compensation/:id',  element: S(AssetCompensationFormPage) },

          // 折旧管理
          { path: 'depreciation', element: S(DepreciationListPage) },

          // 审计日志
          { path: 'audit',     element: S(AuditDashboardPage) },
          { path: 'audit/:id', element: S(AuditDetailPage) },

          // 数据分析
          { path: 'analytics', element: S(AnalyticsPage) },

          // 报表中心
          { path: 'reports', element: S(ReportsPage) },

          // 通知中心
          { path: 'notifications', element: S(NotificationsPage) },

          // 工作流
          { path: 'workflows',         element: S(WorkflowCenterPage) },
          { path: 'workflow-designer', element: S(WorkflowDesignerPage) },
          { path: 'workflow-form/:businessType', element: S(WorkflowFormPage) },

          // 基础数据
          { path: 'categories',    element: S(CategoryManagerPage) },
          { path: 'vendors',       element: S(VendorsPage) },
          { path: 'locations',     element: S(LocationsPage) },

          // 系统管理 — 菜单权限
          { path: 'system/menus',  element: S(MenuManagementPage) },
          // 系统管理 — 角色管理（独立页面）
          { path: 'system/roles',  element: S(RoleManagementPage) },
          // 系统管理 — 用户管理（独立页面）
          { path: 'system/users',  element: S(UserManagementPage) },
          // 系统管理 — 岗位管理
          { path: 'system/posts',  element: S(PostManagementPage) },
          // 系统管理 — 部门管理
          { path: 'system/depts',  element: S(DeptManagementPage) },
          // 设置页（仅系统配置/安全设置；历史用户/部门设置入口重定向到系统管理）
          { path: 'settings',      element: <Navigate to="/settings/system" replace /> },
          { path: 'settings/users', element: <Navigate to="/system/users" replace /> },
          { path: 'settings/departments', element: <Navigate to="/system/depts" replace /> },
          { path: 'settings/:tab', element: S(SettingsPage) },

          // 错误页
          {
            path: '403',
            element: <ForbiddenPage />,
          },
          {
            path: '404',
            element: <div className="flex items-center justify-center min-h-screen text-xl text-[#94a3b8]">404 — 页面不存在</div>,
          },
          { path: '*', element: <Navigate to="/404" replace /> },
        ],
      },
    ],
  },
]);

export default router;
