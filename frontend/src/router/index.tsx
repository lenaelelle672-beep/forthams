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

import React, { Suspense, useEffect } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
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
  const navigate = useNavigate();

  // UA 检测：移动端访问根路径时自动重定向到 /m
  useEffect(() => {
    if (typeof window !== 'undefined' && location.pathname === '/') {
      const isMobile = /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      if (isMobile) {
        navigate('/m', { replace: true });
      }
    }
  }, [location.pathname, navigate]);

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
const AnalyticsPage         = React.lazy(() => import('@/pages/analytics/AnalyticsPage'));
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
const RetirementListPage       = React.lazy(() => import('@/pages/retirement/RetirementListPage'));
const RetirementFormPage       = React.lazy(() => import('@/pages/retirement/RetirementFormPage'));
const RetirementDetailPage     = React.lazy(() => import('@/pages/retirement/RetirementDetailPage'));
const IntakeListPage        = React.lazy(() => import('@/pages/intake/IntakeListPage'));
const IntakeFormPage        = React.lazy(() => import('@/pages/intake/IntakeFormPage'));
const IntakeDetailPage      = React.lazy(() => import('@/pages/intake/IntakeDetailPage'));
const AssignmentListPage    = React.lazy(() => import('@/pages/assignment/AssignmentListPage'));
const AssignmentFormPage    = React.lazy(() => import('@/pages/assignment/AssignmentFormPage'));
const AssignmentDetailPage  = React.lazy(() => import('@/pages/assignment/AssignmentDetailPage'));
const BorrowListPage        = React.lazy(() => import('@/pages/borrow/BorrowListPage'));
const BorrowFormPage        = React.lazy(() => import('@/pages/borrow/BorrowFormPage'));
const BorrowDetailPage      = React.lazy(() => import('@/pages/borrow/BorrowDetailPage'));
const ReportsPage           = React.lazy(() => import('@/pages/reports/ReportsPage'));
const AssetImportExportPage   = React.lazy(() => import('@/pages/AssetImportExport/AssetImportExportPage'));
const CategoryManagerPage     = React.lazy(() => import('@/pages/category/CategoryManagerPage'));
const AssetModelPage          = React.lazy(() => import('@/pages/asset-models/AssetModelPage'));
const ManufacturerPage        = React.lazy(() => import('@/pages/manufacturers/ManufacturerPage'));
const PurchaseOrderPage       = React.lazy(() => import('@/pages/purchase-order/PurchaseOrderPage'));
const ContractPage            = React.lazy(() => import('@/pages/contracts/ContractPage'));
const MaintenancePage         = React.lazy(() => import('@/pages/maintenance/MaintenancePage'));
const MaintenancePlanPage     = React.lazy(() => import('@/pages/maintenance/MaintenancePlanPage'));
const GisMapPage              = React.lazy(() => import('@/pages/gis/GisMapPage'));
const FloorPlanPage           = React.lazy(() => import('@/pages/floorplan/FloorPlanPage'));
const EnergyDashboardPage     = React.lazy(() => import('@/pages/energy/EnergyDashboardPage'));
const SoftwareLicensePage     = React.lazy(() => import('@/pages/licenses/SoftwareLicensePage'));
const SamDashboardPage        = React.lazy(() => import('@/pages/sam/SamDashboardPage'));
const TestResultsPage         = React.lazy(() => import('@/pages/test-results/TestResultsPage'));
const FaultCodePage           = React.lazy(() => import('@/pages/fault-codes/FaultCodePage'));
const SparePartListPage       = React.lazy(() => import('@/pages/spare-parts/SparePartListPage'));
const SparePartDetailPage     = React.lazy(() => import('@/pages/spare-parts/SparePartDetailPage'));
const WorkOrderAcceptancePage = React.lazy(() => import('@/pages/workorder/WorkOrderAcceptancePage'));
const ReliabilityPage         = React.lazy(() => import('@/pages/analytics/reliability/ReliabilityPage'));

// ── 重构完成的新页面 ──────────────────────────────────────────────────────────
const IdleAssetsPage       = React.lazy(() => import('@/pages/idle/IdleAssetsPage'));
const DepreciationListPage = React.lazy(() => import('@/pages/depreciation/DepreciationListPage'));

// ── 工作流新版页面 ────────────────────────────────────────────────────────────
const WorkflowCenterPage  = React.lazy(() => import('@/pages/workflow/WorkflowCenterPage'));
const WorkflowDesignerPage = React.lazy(() => import('@/pages/workflow/WorkflowDesignerPage'));
const WorkflowFormPage = React.lazy(() => import('@/pages/workflow/WorkflowFormPage'));

// ── Phase 6: 用户体验与平台能力 ─────────────────────────────────────────────
const AssetHealthPage         = React.lazy(() => import('@/pages/analytics/health/AssetHealthPage'));
const ScheduledReportConfigPage = React.lazy(() => import('@/pages/report/ScheduledReportConfigPage'));
const ReportBuilderPage       = React.lazy(() => import('@/pages/report-builder/ReportBuilderPage'));

// ── Phase 4: 财务管理增强 ───────────────────────────────────────────────────
const InsuranceListPage   = React.lazy(() => import('@/pages/insurance/InsuranceListPage'));
const InsuranceFormPage   = React.lazy(() => import('@/pages/insurance/InsuranceFormPage'));
const InsuranceDetailPage = React.lazy(() => import('@/pages/insurance/InsuranceDetailPage'));

// ── Phase 5: 循环盘点
const InspectionTemplatePage   = React.lazy(() => import('@/pages/inspection/InspectionTemplatePage'));
const InspectionListPage          = React.lazy(() => import('@/pages/inspection/InspectionListPage'));
const InspectionFormPage          = React.lazy(() => import('@/pages/inspection/InspectionFormPage'));
const InspectionDetailPage        = React.lazy(() => import('@/pages/inspection/InspectionDetailPage'));
const InspectionUploadPage        = React.lazy(() => import('@/pages/inspection/InspectionUploadPage'));
const InspectionRecordPage        = React.lazy(() => import('@/pages/inspection/InspectionRecordPage'));
const CycleCountConfigPage        = React.lazy(() => import('@/pages/inventory/CycleCountConfigPage'));
const ABCClassificationPage       = React.lazy(() => import('@/pages/inventory/ABCClassificationPage'));
const StocktakingCycleListPage    = React.lazy(() => import('@/pages/stocktaking/StocktakingCycleListPage'));
const StocktakingCycleFormPage    = React.lazy(() => import('@/pages/stocktaking/StocktakingCycleFormPage'));
const StocktakingCycleDetailPage  = React.lazy(() => import('@/pages/stocktaking/StocktakingCycleDetailPage'));
const StocktakingTaskPage         = React.lazy(() => import('@/pages/stocktaking/StocktakingTaskPage'));
const RiskAssessmentFormPage      = React.lazy(() => import('@/pages/risk/RiskAssessmentFormPage'));
const RiskAssessmentEditPage      = React.lazy(() => import('@/pages/risk/RiskAssessmentEditPage'));
const RiskMatrixPage              = React.lazy(() => import('@/pages/risk/RiskMatrixPage'));
const RiskMatrixConfigPage        = React.lazy(() => import('@/pages/risk/RiskMatrixConfigPage'));
const SafetyChecklistTemplatePage   = React.lazy(() => import('@/pages/safety/SafetyChecklistTemplatePage'));
const SafetyChecklistExecutionPage  = React.lazy(() => import('@/pages/safety/SafetyChecklistExecutionPage'));
const SafetyChecklistHistoryPage    = React.lazy(() => import('@/pages/safety/SafetyChecklistHistoryPage'));
const RevaluationListPage  = React.lazy(() => import('@/pages/revaluation/RevaluationListPage'));
const RevaluationFormPage  = React.lazy(() => import('@/pages/revaluation/RevaluationFormPage'));
const TcoPage              = React.lazy(() => import('@/pages/analytics/tco/TcoPage'));
const BudgetListPage       = React.lazy(() => import('@/pages/budget/BudgetListPage'));
const BudgetFormPage       = React.lazy(() => import('@/pages/budget/BudgetFormPage'));
const BudgetDetailPage     = React.lazy(() => import('@/pages/budget/BudgetDetailPage'));

// ── 重构完成的页面（新 Design System）────────────────────────────────────────
const EquipmentPage = React.lazy(() => import('@/pages/equipment/EquipmentPage'));
const RFIDScanPage      = React.lazy(() => import('@/pages/inventory/RFIDScanPage'));
const SmartReportPage   = React.lazy(() => import('@/pages/inventory/SmartReportPage'));
const VendorsPage   = React.lazy(() => import('@/pages/vendors/VendorsPage'));
const LocationsPage = React.lazy(() => import('@/pages/locations/LocationsPage'));
const SettingsPage  = React.lazy(() => import('@/pages/settings/SettingsPage'));
const MenuManagementPage = React.lazy(() => import('@/pages/system/MenuManagement'));

// ── Mobile 端页面 ────────────────────────────────────────────────────────────
const MobileLayout           = React.lazy(() => import('@/pages/mobile/MobileLayout'));
const MobileDashboardPage    = React.lazy(() => import('@/pages/mobile/MobileDashboardPage'));
const MobileAssetListPage    = React.lazy(() => import('@/pages/mobile/MobileAssetListPage'));
const MobileScanPage         = React.lazy(() => import('@/pages/mobile/MobileScanPage'));
const MobileProfilePage      = React.lazy(() => import('@/pages/mobile/MobileProfilePage'));

// ── 供应商门户 ──────────────────────────────────────────────────────────────
const VendorPortalPage = React.lazy(() => import('@/pages/vendor-portal/VendorPortalPage'));

// ── SSO 回调页 ──────────────────────────────────────────────────────────────
const SsoCallbackPage = React.lazy(() => import('@/pages/auth/SsoCallbackPage'));

// ── 系统管理独立页面 ─────────────────────────────────────────────────────────
const RoleManagementPage = React.lazy(() => import('@/pages/system/RoleManagement'));
const UserManagementPage = React.lazy(() => import('@/pages/system/UserManagement'));
const PostManagementPage = React.lazy(() => import('@/pages/system/PostManagement'));
const DeptManagementPage = React.lazy(() => import('@/pages/system/DeptManagement'));
const CustomFieldsPage = React.lazy(() => import('@/pages/system/custom-fields/index'));
const CustomFieldsetsPage = React.lazy(() => import('@/pages/system/custom-fieldsets/index'));

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
  // ── 供应商门户（无需认证，自带登录逻辑） ──────────────────────────────────────────────
  {
    path: '/vendor-portal',
    element: S(VendorPortalPage),
  },
   // ── 移动端路由（需要认证） ────────────────────────────────────────────────────────────
  {
    path: '/m',
    element: <ProtectedRoute />,
    children: [
      {
        element: S(MobileLayout),
        children: [
          { index: true, element: <Navigate to="/m/index" replace /> },
          { path: 'index',  element: S(MobileDashboardPage) },
          { path: 'assets', element: S(MobileAssetListPage) },
          { path: 'scan',   element: S(MobileScanPage) },
          { path: 'profile', element: S(MobileProfilePage) },
          { path: 'stocktaking-tasks/:taskId', element: S(StocktakingTaskPage) },
        ],
      },
    ],
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

          // 闲置资产
          { path: 'idle', element: S(IdleAssetsPage) },

          // 资产型号
          { path: 'asset-models', element: S(AssetModelPage) },

          // 赔偿管理
          { path: 'compensation',      element: S(AssetCompensationFormPage) },
          { path: 'compensation/new',  element: S(AssetCompensationFormPage) },
          { path: 'compensation/:id',  element: S(AssetCompensationFormPage) },

          // 折旧管理
          { path: 'depreciation', element: S(DepreciationListPage) },
          // Phase 4: 减值重估
          { path: 'revaluations',     element: S(RevaluationListPage) },
          { path: 'revaluations/new', element: S(RevaluationFormPage) },
          // Phase 4: 预算管理
          { path: 'budgets',      element: S(BudgetListPage) },
          { path: 'budgets/new',  element: S(BudgetFormPage) },
          { path: 'budgets/:id',  element: S(BudgetDetailPage) },

          // 资产领用归还
          { path: 'assignments',          element: S(AssignmentListPage) },
          { path: 'assignments/new',      element: S(AssignmentFormPage) },
          { path: 'assignments/:id',      element: S(AssignmentDetailPage) },
          { path: 'assignments/:id/edit', element: S(AssignmentFormPage) },

          // 资产借用管理
          { path: 'borrows',             element: S(BorrowListPage) },
          { path: 'borrows/new',         element: S(BorrowFormPage) },
          { path: 'borrows/:id',         element: S(BorrowDetailPage) },
          { path: 'borrows/:id/edit',    element: S(BorrowFormPage) },

          // 入库验收
          { path: 'intake',          element: S(IntakeListPage) },
          { path: 'intake/new',      element: S(IntakeFormPage) },
          { path: 'intake/:id',      element: S(IntakeDetailPage) },

          // 采购与合同
          { path: 'purchase-orders', element: S(PurchaseOrderPage) },
          { path: 'contracts',       element: S(ContractPage) },

          // 运维管理
          { path: 'maintenance',       element: S(MaintenancePage) },
          { path: 'maintenance/plans', element: S(MaintenancePlanPage) },
          { path: 'fault-codes',       element: S(FaultCodePage) },
          // Phase 3: 备品备件
          { path: 'spare-parts',       element: S(SparePartListPage) },
          { path: 'spare-parts/new',   element: S(SparePartDetailPage) },
          { path: 'spare-parts/:id',   element: S(SparePartDetailPage) },
          // Phase 3: 工单验收页面
          { path: 'workorders/:id/acceptance', element: S(WorkOrderAcceptancePage) },
          // Phase 4: 保险管理
          { path: 'insurances',      element: S(InsuranceListPage) },
          { path: 'insurances/new',  element: S(InsuranceFormPage) },
          { path: 'insurances/:id',  element: S(InsuranceDetailPage) },

          // Phase 5: 检验/年检管理
          { path: 'inspection-templates', element: S(InspectionTemplatePage) },
          { path: 'inspections',            element: S(InspectionListPage) },
          { path: 'inspections/new',        element: S(InspectionFormPage) },
          { path: 'inspections/:id',        element: S(InspectionDetailPage) },
          { path: 'inspections/:id/edit',   element: S(InspectionFormPage) },
          { path: 'inspections/:id/upload', element: S(InspectionUploadPage) },
          { path: 'inspection-records',     element: S(InspectionRecordPage) },

          // Phase 5: 循环盘点管理
          { path: 'stocktaking-cycles',          element: S(StocktakingCycleListPage) },
          { path: 'stocktaking-cycles/new',      element: S(StocktakingCycleFormPage) },
          { path: 'stocktaking-cycles/:id',      element: S(StocktakingCycleDetailPage) },

          // Phase 5: 循环盘点配置（旧路由，保留兼容）
          { path: 'inventory/cycle-count', element: S(CycleCountConfigPage) },
          // Phase 5: ABC 分类管理
          { path: 'inventory/abc-classification', element: S(ABCClassificationPage) },

          // Phase 5: 风险评估
          { path: 'risk-assessments',           element: S(RiskMatrixPage) },
          { path: 'risk-assessments/new',        element: S(RiskAssessmentFormPage) },
          { path: 'risk-assessments/:id/edit',   element: S(RiskAssessmentEditPage) },

          // Phase 5: 风险矩阵配置
          { path: 'risk-matrix', element: S(RiskMatrixConfigPage) },

          // Phase 5: 安全检查表
          { path: 'safety-checklists/config', element: S(SafetyChecklistTemplatePage) },
          { path: 'safety-checklists/execute/:executionId', element: S(SafetyChecklistExecutionPage) },
          { path: 'safety-checklists/execute', element: S(SafetyChecklistExecutionPage) },
          { path: 'safety-checklists/history', element: S(SafetyChecklistHistoryPage) },

          // 空间定位与能耗
          { path: 'gis',        element: S(GisMapPage) },
          { path: 'floorplans', element: S(FloorPlanPage) },
          { path: 'energy',     element: S(EnergyDashboardPage) },
          // 测试结果
          { path: 'test-results', element: S(TestResultsPage) },

          // 软件资产与合规
          { path: 'licenses', element: S(SoftwareLicensePage) },
          { path: 'sam',      element: S(SamDashboardPage) },

          // 审计日志
          { path: 'audit',     element: S(AuditDashboardPage) },
          { path: 'audit/:id', element: S(AuditDetailPage) },

          // 数据分析
          { path: 'analytics', element: S(AnalyticsPage) },
          // Phase 3: 可靠性分析
          { path: 'analytics/reliability', element: S(ReliabilityPage) },
          // Phase 4: TCO 分析
          { path: 'analytics/tco', element: S(TcoPage) },
          // Phase 6: 资产健康评分
          { path: 'analytics/health', element: S(AssetHealthPage) },

          // 报表中心
          { path: 'reports', element: S(ReportsPage) },
          // Phase 6: 定时报表配置
          { path: 'reports/scheduled', element: S(ScheduledReportConfigPage) },
          // Phase 6: 自定义报表构建器
          { path: 'report-builder', element: S(ReportBuilderPage) },

          // 通知中心
          { path: 'notifications', element: S(NotificationsPage) },

          // 工作流
          { path: 'workflows',         element: S(WorkflowCenterPage) },
          { path: 'workflow-designer', element: S(WorkflowDesignerPage) },
          { path: 'workflow-form/:businessType', element: S(WorkflowFormPage) },

          // 基础数据
          { path: 'categories',    element: S(CategoryManagerPage) },
          { path: 'manufacturers', element: S(ManufacturerPage) },
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
          // 系统管理 — 自定义字段
          { path: 'system/custom-fields', element: S(CustomFieldsPage) },
          // 系统管理 — 自定义字段集
          { path: 'system/custom-fieldsets', element: S(CustomFieldsetsPage) },
          // 设置页（仅系统配置/安全设置；历史用户/部门设置入口重定向到系统管理）
          { path: 'settings',      element: <Navigate to="/settings/sysconfig" replace /> },
          { path: 'settings/system', element: <Navigate to="/settings/sysconfig" replace /> },
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
