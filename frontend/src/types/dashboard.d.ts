export interface DashboardStats {
  totalTickets: number;
  pendingApprovals: number;
  totalAssets: number;
  activeAssets: number;
}

export interface StatCard {
  key: string;
  label: string;
  value: number;
}