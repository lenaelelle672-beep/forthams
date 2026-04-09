import { createElement } from "react";
import { Navigate, Outlet, createBrowserRouter, useLocation } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { useAuth } from "./context/AuthContext";
import { Dashboard } from "./pages/Dashboard";
import { AssetRegistry } from "./pages/AssetRegistry";
import { ImportantEquipment } from "./pages/ImportantEquipment";
import { RFIDInventory } from "./pages/RFIDInventory";
import { IdleAssets } from "./pages/IdleAssets";
import { Disposals } from "./pages/Disposals";
import { AssetTransferForm } from "./pages/AssetTransferForm";
import { AssetClearanceForm } from "./pages/AssetClearanceForm";
import { AssetScrapForm } from "./pages/AssetScrapForm";
import { AssetCompensationForm } from "./pages/AssetCompensationForm";
import { Approval } from "./pages/Approval";
import { Analytics } from "./pages/Analytics";
import { Settings } from "./pages/Settings";
import { WorkflowDesigner } from "./pages/WorkflowDesigner";
import { Login } from "./pages/Login";

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
          { path: "analytics", Component: Analytics },
          { path: "settings", Component: Settings },
          { path: "workflow-designer", Component: WorkflowDesigner },
        ],
      },
    ],
  },
]);
