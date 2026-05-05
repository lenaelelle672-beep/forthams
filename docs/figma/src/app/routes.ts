import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/RootLayout";
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

export const router = createBrowserRouter([
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
    ],
  },
]);
