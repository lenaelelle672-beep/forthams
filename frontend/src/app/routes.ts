import { Suspense, createElement, lazy, type ComponentType } from "react";
import { Navigate, Outlet, createBrowserRouter, useLocation } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { useAuth } from "./context/AuthContext";
import { Login } from "./pages/Login";

const Dashboard = withSuspense(
  lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard }))),
);
const AssetRegistry = withSuspense(
  lazy(() => import("./pages/AssetRegistry").then((module) => ({ default: module.AssetRegistry }))),
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
  lazy(() => import("./pages/Approval").then((module) => ({ default: module.Approval }))),
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
const Retirement = withSuspense(
  lazy(() => import("./pages/Retirement").then((module) => ({ default: module.default }))),
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
          { path: "assets", Component: AssetRegistry },
          { path: "equipment", Component: ImportantEquipment },
          { path: "inventory", Component: RFIDInventory },
          { path: "idle", Component: IdleAssets },
          { path: "disposals", Component: Disposals },
          { path: "disposals/transfer/new", Component: AssetTransferForm },
          { path: "disposals/clearance/new", Component: AssetClearanceForm },
          { path: "disposals/scrap/new", Component: AssetScrapForm },
          { path: "disposals/compensation/new", Component: AssetCompensationForm },
          { path: "approval", Component: Approval },
          { path: "retirement", Component: Retirement },
          { path: "analytics", Component: Analytics },
          { path: "settings", Component: Settings },
          { path: "workflows", Component: WorkflowCenter },
          { path: "workflow-designer", Component: WorkflowDesigner },
        ],
      },
    ],
  },
]);
