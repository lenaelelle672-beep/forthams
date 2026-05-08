export interface ApprovalProcess {
  id: number;
  processName: string;
  processType: 'asset_change' | 'ticket_approval' | 'inventory';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  applicantId: number;
  applicantName: string;
  approverId?: number;
  approverName?: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
}

export interface ApprovalQueryParams {
  page?: number;
  size?: number;
  status?: string;
  processType?: string;
}