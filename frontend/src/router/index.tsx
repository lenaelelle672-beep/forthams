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
const WorkOrderListPage     = React.lazy(() => import('@/pages/workorder/WorkOrderListPage'));
const WorkOrderDetailPage   = React.lazy(() => import('@/pages/workorder/WorkOrderDetailPage'));
const WorkOrderFormPage     = React.lazy(() => import('@/pages/workorder/WorkOrderFormPage'));
const ApprovalListPage      = React.lazy(() => import('@/pages/approval/ApprovalListPage'));
const NotificationsPage     = React.lazy(() => import('@/pages/notifications/NotificationsPage'));
const InventoryTasksPage    = React.lazy(() => import('@/pages/inventory/InventoryTasksPage'));
const InventoryDetailPage   = React.lazy(() => import('@/pages/inventory/InventoryDetailPage'));
const RetirementListPage    = React.lazy(() => import('@/pages/retirement/RetirementListPage'));
const RetirementFormPage    = React.lazy(() => import('@/pages/retirement/RetirementFormPage'));
const RetirementDetailPage  = React.lazy(() => import('@/pages/retirement/RetirementDetailPage'));
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

// ── 重构完成的新页面 ──────────────────────────────────────────────────────────
const IdleAssetsPage       = React.lazy(() => import('@/pages/idle/IdleAssetsPage'));
const DepreciationListPage = React.lazy(() => import('@/pages/depreciation/DepreciationListPage'));

// ── 工作流新版页面 ────────────────────────────────────────────────────────────
const WorkflowCenterPage  = React.lazy(() => import('@/pages/workflow/WorkflowCenterPage'));
const WorkflowDesignerPage = React.lazy(() => import('@/pages/workflow/WorkflowDesignerPage'));

// ── 重构完成的页面（新 Design System）────────────────────────────────────────
const EquipmentPage = React.lazy(() => import('@/pages/equipment/EquipmentPage'));
const RFIDScanPage      = React.lazy(() => import('@/pages/inventory/RFIDScanPage'));
const SmartReportPage   = React.lazy(() => import('@/pages/inventory/SmartReportPage'));
const VendorsPage   = React.lazy(() => import('@/pages/vendors/VendorsPage'));
const LocationsPage = React.lazy(() => import('@/pages/locations/LocationsPage'));
const SettingsPage  = React.lazy(() => import('@/pages/settings/SettingsPage'));

// ── 路由配置 ──────────────────────────────────────────────────────────────────
const router = createBrowserRouter([
  // ── 公开路由（无需认证） ───────────────────────────────────────────────────
  {
    path: '/login',
    element: S(LoginPage),
  },
  {
    path: '/bigscreen',
    element: S(BigScreenPage),
  },
  {
    path: '/bigscreen-3d',
    element: S(BigScreen3DPage),
  },

  // ── 受保护路由（需要认证） ────────────────────────────────────────────────
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
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

          // 工单管理
          { path: 'workorders',      element: S(WorkOrderListPage) },
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

          // 退役管理
          { path: 'retirement',     element: S(RetirementListPage) },
          { path: 'retirement/new', element: S(RetirementFormPage) },
          { path: 'retirement/:id', element: S(RetirementDetailPage) },

          // 资产处置
          { path: 'disposals',              element: S(DisposalListPage) },
          { path: 'disposals/:id',          element: S(DisposalDetailPage) },
          { path: 'disposals/transfer/new',  element: S(AssetTransferFormPage) },
          { path: 'disposals/clearance/new', element: S(AssetClearanceFormPage) },
          { path: 'disposals/scrap/new',     element: S(AssetScrapFormPage) },
          { path: 'disposals/compensation/new', element: S(AssetCompensationFormPage) },

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

          // 基础数据
          { path: 'vendors',       element: S(VendorsPage) },
          { path: 'locations',     element: S(LocationsPage) },
          { path: 'settings',      element: S(SettingsPage) },
          { path: 'settings/:tab', element: S(SettingsPage) },

          // 错误页
          {
            path: '403',
            element: <div className="flex items-center justify-center min-h-screen text-xl text-[#94a3b8]">403 — 无权限访问</div>,
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
