import { api } from "../utils/api";

export interface DashboardStats {
  totalAssets: number;
  inUseAssets: number;
  idleAssets: number;
  maintenanceAssets: number;
  scrapAssets: number;
  totalValue: number | string;
  netValue: number | string;
  categoryDistribution: Record<string, number>;
  pendingApprovals: number;
}

export interface AssetValueTrend {
  date: string;
  totalValue: number | string;
  netValue: number | string;
}

export interface DeptDistribution {
  deptId: number;
  deptName: string;
  assetCount: number;
}

export const dashboardService = {
  getStats() {
    return api.get<DashboardStats>("/dashboard/stats");
  },

  getValueTrends(days = 180) {
    return api.get<AssetValueTrend[]>("/dashboard/trends", {
      params: { days },
    });
  },

  getDeptDistribution() {
    return api.get<DeptDistribution[]>("/dashboard/dept-distribution");
  },

  getMaintenanceStats() {
    return api.get<Record<string, unknown>>("/dashboard/maintenance-stats");
  },

  getPendingApprovals() {
    return api.get<Record<string, unknown>>("/dashboard/pending-approvals");
  },
};
