/**
 * @file types/assignment.ts
 * @description 领用归还前端类型定义
 */

// ── 领用类型枚举 ──────────────────────────────────────────────────────────────

export enum AllocationType {
  ASSIGNMENT = 'ASSIGNMENT',
  BORROW = 'BORROW',
  RETURN = 'RETURN',
  TRANSFER = 'TRANSFER',
}

export const ALLOCATION_TYPE_CONFIG: Record<AllocationType, { label: string; color: string; bgColor: string }> = {
  [AllocationType.ASSIGNMENT]: { label: '长期领用', color: '#2563eb', bgColor: '#dbeafe' },
  [AllocationType.BORROW]:     { label: '短期借用', color: '#d97706', bgColor: '#fef3c7' },
  [AllocationType.RETURN]:     { label: '归还入库', color: '#16a34a', bgColor: '#dcfce7' },
  [AllocationType.TRANSFER]:   { label: '调拨转移', color: '#9333ea', bgColor: '#f3e8ff' },
};

// ── 状态枚举 ──────────────────────────────────────────────────────────────────

export enum AssignmentStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CHECKED_OUT = 'CHECKED_OUT',
  RETURN_REQUESTED = 'RETURN_REQUESTED',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
}

export const ASSIGNMENT_STATUS_CONFIG: Record<AssignmentStatus, { label: string; color: string; bgColor: string }> = {
  [AssignmentStatus.DRAFT]:             { label: '草稿',       color: '#6b7280', bgColor: '#f3f4f6' },
  [AssignmentStatus.PENDING_APPROVAL]:  { label: '待审批',     color: '#2563eb', bgColor: '#dbeafe' },
  [AssignmentStatus.APPROVED]:          { label: '已审批',     color: '#16a34a', bgColor: '#dcfce7' },
  [AssignmentStatus.REJECTED]:          { label: '已驳回',     color: '#dc2626', bgColor: '#fee2e2' },
  [AssignmentStatus.CHECKED_OUT]:       { label: '已签收',     color: '#9333ea', bgColor: '#f3e8ff' },
  [AssignmentStatus.RETURN_REQUESTED]:  { label: '待归还',     color: '#d97706', bgColor: '#fef3c7' },
  [AssignmentStatus.RETURNED]:          { label: '已归还',     color: '#78716c', bgColor: '#f5f5f4' },
  [AssignmentStatus.CANCELLED]:         { label: '已取消',     color: '#78716c', bgColor: '#f5f5f4' },
};

// ── 实体接口 ──────────────────────────────────────────────────────────────────

export interface AssetAssignment {
  id: number;
  assetId: number;
  applicantId?: number;
  applicantDeptId?: number;
  assignedToUserId?: number;
  assignedToDeptId?: number;
  allocationType?: string;       // 新增：领用类型
  approverId?: number;           // 新增：审批人 ID
  approvalTime?: string;         // 新增：审批时间
  approvalRemark?: string;       // 新增：审批备注/驳回原因
  expectedReturnDate?: string;
  actualReturnDate?: string;
  status: AssignmentStatus;
  assignmentDate?: string;
  returnCondition?: string;
  remark?: string;
  assetNo?: string;
  assetName?: string;
  tenantId?: number;
  createBy?: number;
  createTime: string;
  updateTime?: string;
}

export interface CreateAssignmentRequest {
  assetId: number;
  assignedToUserId?: number;
  assignedToDeptId?: number;
  allocationType?: string;      // 新增：领用类型，默认 ASSIGNMENT
  expectedReturnDate?: string;
  remark?: string;
}

export interface UpdateAssignmentRequest {
  assignedToUserId?: number;
  assignedToDeptId?: number;
  allocationType?: string;      // 新增
  expectedReturnDate?: string;
  returnCondition?: string;
  remark?: string;
}

export interface AssignmentListQuery {
  keyword?: string;
  assetId?: number;
  status?: string;
  applicantId?: number;
  allocationType?: string;      // 新增：按领用类型筛选
  page?: number;
  pageSize?: number;
}
