/**
 * @file types/borrow.ts
 * @description 借用管理前端类型定义
 */

export enum BorrowStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  BORROWED = 'BORROWED',
  OVERDUE = 'OVERDUE',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
}

export const BORROW_STATUS_CONFIG: Record<BorrowStatus, { label: string; color: string; bgColor: string }> = {
  [BorrowStatus.DRAFT]:             { label: '草稿',     color: '#6b7280', bgColor: '#f3f4f6' },
  [BorrowStatus.PENDING_APPROVAL]:  { label: '待审批',   color: '#2563eb', bgColor: '#dbeafe' },
  [BorrowStatus.APPROVED]:          { label: '已审批',   color: '#16a34a', bgColor: '#dcfce7' },
  [BorrowStatus.REJECTED]:          { label: '已驳回',   color: '#dc2626', bgColor: '#fee2e2' },
  [BorrowStatus.BORROWED]:          { label: '已借出',   color: '#9333ea', bgColor: '#f3e8ff' },
  [BorrowStatus.OVERDUE]:           { label: '已逾期',   color: '#dc2626', bgColor: '#fef2f2' },
  [BorrowStatus.RETURNED]:          { label: '已归还',   color: '#78716c', bgColor: '#f5f5f4' },
  [BorrowStatus.CANCELLED]:         { label: '已取消',   color: '#78716c', bgColor: '#f5f5f4' },
};

export interface AssetBorrow {
  id: number;
  assetId: number;
  borrowerId?: number;
  borrowerDeptId?: number;
  borrowDate?: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  status: BorrowStatus;
  purpose?: string;
  remark?: string;
  notified?: number;
  assetNo?: string;
  assetName?: string;
  createTime: string;
}

export interface CreateBorrowRequest {
  assetId: number;
  expectedReturnDate: string;
  purpose?: string;
  remark?: string;
}

export interface UpdateBorrowRequest {
  expectedReturnDate?: string;
  purpose?: string;
  remark?: string;
}

export interface BorrowListQuery {
  keyword?: string;
  assetId?: number;
  status?: string;
  page?: number;
  pageSize?: number;
}
