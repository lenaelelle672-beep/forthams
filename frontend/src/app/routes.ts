import { Suspense, createElement, lazy, type ComponentType } from "react";
import { Navigate, Outlet, createBrowserRouter, useLocation } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { useAuth } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { vendorRoutes, locationRoutes, auditRoutes } from "./router";
import { assetImportExportRoutes } from "./router/AppRouter";
import { retirementRoutes, assetDetailRoute, workOrderRoutes } from "./routes/AppRoutes";

const DisposalDetailPage = withSuspense(
  lazy(() =>
    import("./pages/assets/DisposalDetailPage").then((module) => ({
      default: module.DisposalDetailPage,
    })),
  ),
);

const Dashboard = withSuspense(
  lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard }))),
);
const AssetRegistry = withSuspense(
  lazy(() => import("./pages/AssetRegistry").then((module) => ({ default: module.AssetRegistry }))),
);
const AssetFormPage = withSuspense(
  lazy(() => import("./pages/assets/AssetFormPage").then((module) => ({ default: module.default }))),
);
const ImportantEquipment = withSuspense(
  lazy(() => import("./pages/ImportantEquipment").then((module) => ({ default: module.ImportantEquipment }))),
);
const RFIDInventory = withSuspense(
  lazy(() => import("./pages/RFIDInventory").then((module) => ({ default: module.RFIDInventory }))),
);
const IdleAssets = withSuspense(
  lazy(() => import("./pages/IdleAssets").then((module) => ({ default: module.IdleAssets }))),
);
const Disposals = withSuspense(
  lazy(() => import("./pages/Disposals").then((module) => ({ default: module.Disposals }))),
);
const AssetTransferForm = withSuspense(
  lazy(() => import("./pages/AssetTransferForm").then((module) => ({ default: module.AssetTransferForm }))),
);
const AssetClearanceForm = withSuspense(
  lazy(() => import("./pages/AssetClearanceForm").then((module) => ({ default: module.AssetClearanceForm }))),
);
const AssetScrapForm = withSuspense(
  lazy(() => import("./pages/AssetScrapForm").then((module) => ({ default: module.AssetScrapForm }))),
);
const AssetCompensationForm = withSuspense(
  lazy(() =>
    import("./pages/AssetCompensationForm").then((module) => ({ default: module.AssetCompensationForm })),
  ),
);
const Approval = withSuspense(
  lazy(() => import("./pages/ApprovalListPage").then((module) => ({ default: module.ApprovalListPage }))),
);
const Analytics = withSuspense(
  lazy(() => import("./pages/Analytics").then((module) => ({ default: module.Analytics }))),
);
const Settings = withSuspense(
  lazy(() => import("./pages/Settings").then((module) => ({ default: module.Settings }))),
);
const WorkflowDesigner = withSuspense(
  lazy(() => import("./pages/WorkflowDesigner").then((module) => ({ default: module.WorkflowDesigner }))),
);
const WorkflowCenter = withSuspense(
  lazy(() => import("./pages/WorkflowCenter").then((module) => ({ default: module.WorkflowCenter }))),
);
const AssetSituationDashboard = withSuspense(
  lazy(() =>
    import("./pages/AssetSituationDashboard").then((module) => ({
      default: module.AssetSituationDashboard,
    })),
  ),
);
const Retirement = withSuspense(
  lazy(() => import("./pages/Retirement").then((module) => ({ default: module.default }))),
);
const CyberDashboardV12 = withSuspense(
  lazy(() => import("./pages/CyberDashboardV12").then((module) => ({ default: module.CyberDashboardV12 }))),
);
const IndustrialDashboardV13 = withSuspense(
  lazy(() => import("./pages/IndustrialDashboardV13").then((module) => ({ default: module.IndustrialDashboardV13 }))),
);

/** 资产分类管理页面 — 迭代14 */
const CategoryManagerPage = withSuspense(
  lazy(() =>
    import("./pages/category/CategoryManagerPage").then((module) => ({ default: module.default })),
  ),
);

function PageLoadingFallback() {
  return createElement(
    "div",
    { className: "rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm" },
    "正在加载页面...",
  );
}

function withSuspense(Component: ComponentType) {
  return function SuspendedRoute() {
    return createElement(
      Suspense,
      { fallback: createElement(PageLoadingFallback) },
      createElement(Component),
    );
  };
}

function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return createElement(
      "div",
      { className: "flex min-h-screen items-center justify-center bg-muted/40 px-6" },
      createElement(
        "div",
        {
          className:
            "rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm",
        },
        "正在验证登录状态...",
      ),
    );
  }

  if (!isAuthenticated) {
    return createElement(Navigate, {
      replace: true,
      state: { from: { pathname: location.pathname } },
      to: "/login",
    });
  }

  return createElement(Outlet);
}

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    Component: ProtectedRoute,
    children: [
      {
        path: "/",
        Component: RootLayout,
        children: [
          { index: true, Component: Dashboard },
          { path: "dashboard", Component: Dashboard },
          { path: "assets", Component: AssetRegistry },
          { path: "assets/new", Component: AssetFormPage },
          { path: "assets/:id/edit", Component: AssetFormPage },
          { path: "equipment", Component: ImportantEquipment },
          { path: "inventory", Component: RFIDInventory },
          { path: "idle", Component: IdleAssets },
          { path: "disposals", Component: Disposals },
          { path: "disposals/:id", Component: DisposalDetailPage },
          { path: "disposals/transfer/new", Component: AssetTransferForm },
          { path: "disposals/clearance/new", Component: AssetClearanceForm },
          { path: "disposals/scrap/new", Component: AssetScrapForm },
          { path: "disposals/compensation/new", Component: AssetCompensationForm },
          { path: "approval", Component: Approval },
          { path: "retirement", Component: Retirement },
          { path: "analytics", Component: Analytics },
          { path: "situation", Component: AssetSituationDashboard },
          { path: "cyber-v12", Component: CyberDashboardV12 },
          { path: "industrial-v13", Component: IndustrialDashboardV13 },
          { path: "settings", Component: Settings },
          { path: "workflows", Component: WorkflowCenter },
          { path: "workflow-designer", Component: WorkflowDesigner },
          { path: "categories", Component: CategoryManagerPage },
          // Modular route modules
          ...vendorRoutes,
          ...locationRoutes,
          ...auditRoutes,
          ...assetImportExportRoutes,
          ...retirementRoutes,
          assetDetailRoute,
          ...workOrderRoutes,
        ],
      },
    ],
  },
]);
