/**
 * E2E Test Fixtures for Work Order Approval Workflow
 * 
 * SPEC: SWARM-2025-Q2-P0-003 (Iteration 8)
 * Purpose: Fixtures for approval workflow E2E tests
 * 
 * Test Coverage:
 * - E2E-001: Approval page loading
 * - E2E-002: Pending approval list display
 * - E2E-003: Approval detail page navigation
 * - E2E-004: Approval confirmation (approve action)
 * - E2E-005: Rejection with comments
 * - E2E-006: Secondary confirmation dialog
 * - E2E-007: Comment validation
 * - E2E-008: Permission isolation
 * - E2E-009: List pagination
 * - E2E-010: Approval history viewing
 */

import type { Page } from '@playwright/test';

// ============================================================================
// Type Definitions
// ============================================================================

export enum WorkOrderState {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CLOSED = 'CLOSED',
}

export interface WorkOrderFixture {
  id: string;
  title: string;
  description: string;
  state: WorkOrderState;
  version: number;
  createdBy: string;
  createdAt: string;
  department: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface ApprovalHistoryFixture {
  id: string;
  workOrderId: string;
  action: 'approve' | 'reject';
  operatorId: string;
  operatorName: string;
  reason: string;
  createdAt: string;
  version: number;
}

export interface ApprovalUserFixture {
  id: string;
  name: string;
  role: 'approver' | 'viewer' | 'admin';
  department: string;
  permissions: string[];
}

// ============================================================================
// Work Order Fixtures
// ============================================================================

export const createWorkOrderFixture = (
  overrides: Partial<WorkOrderFixture> = {}
): WorkOrderFixture => ({
  id: `WO-2025-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`,
  title: 'Test Work Order',
  description: 'Test work order description for E2E testing',
  state: WorkOrderState.PENDING,
  version: 1,
  createdBy: 'user001',
  createdAt: new Date().toISOString(),
  department: 'IT',
  priority: 'medium',
  ...overrides,
});

export const workOrderFixtures: WorkOrderFixture[] = [
  createWorkOrderFixture({
    id: 'WO-2025-0001',
    title: '服务器采购申请',
    state: WorkOrderState.PENDING,
    priority: 'high',
    department: 'IT',
  }),
  createWorkOrderFixture({
    id: 'WO-2025-0002',
    title: '办公设备更新',
    state: WorkOrderState.PENDING,
    priority: 'medium',
    department: 'ADMIN',
  }),
  createWorkOrderFixture({
    id: 'WO-2025-0003',
    title: '软件许可续期',
    state: WorkOrderState.IN_PROGRESS,
    priority: 'low',
    department: 'IT',
  }),
  createWorkOrderFixture({
    id: 'WO-2025-0004',
    title: '网络设备升级',
    state: WorkOrderState.APPROVED,
    priority: 'medium',
    department: 'IT',
  }),
  createWorkOrderFixture({
    id: 'WO-2025-0005',
    title: '安全设备采购',
    state: WorkOrderState.REJECTED,
    priority: 'urgent',
    department: 'SECURITY',
  }),
];

// ============================================================================
// Approval History Fixtures
// ============================================================================

export const createApprovalHistoryFixture = (
  overrides: Partial<ApprovalHistoryFixture> = {}
): ApprovalHistoryFixture => ({
  id: `AH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  workOrderId: 'WO-2025-0001',
  action: 'approve',
  operatorId: 'approver001',
  operatorName: '张三',
  reason: '',
  createdAt: new Date().toISOString(),
  version: 1,
  ...overrides,
});

export const approvalHistoryFixtures: ApprovalHistoryFixture[] = [
  createApprovalHistoryFixture({
    id: 'AH-2025-0001',
    workOrderId: 'WO-2025-0001',
    action: 'approve',
    operatorName: '李四',
    reason: '申请合理，批准',
  }),
  createApprovalHistoryFixture({
    id: 'AH-2025-0002',
    workOrderId: 'WO-2025-0005',
    action: 'reject',
    operatorName: '王五',
    reason: '预算不足，暂缓采购',
  }),
];

// ============================================================================
// User Fixtures
// ============================================================================

export const approverUserFixture: ApprovalUserFixture = {
  id: 'approver001',
  name: '张三',
  role: 'approver',
  department: 'IT',
  permissions: ['approve_workorder', 'view_workorder', 'reject_workorder'],
};

export const viewerUserFixture: ApprovalUserFixture = {
  id: 'viewer001',
  name: '李四',
  role: 'viewer',
  department: 'IT',
  permissions: ['view_workorder'],
};

export const adminUserFixture: ApprovalUserFixture = {
  id: 'admin001',
  name: '管理员',
  role: 'admin',
  department: 'ADMIN',
  permissions: ['approve_workorder', 'reject_workorder', 'view_workorder', 'manage_users'],
};

// ============================================================================
// API Response Fixtures
// ============================================================================

export const pendingWorkOrdersResponse = {
  items: workOrderFixtures.filter((wo) => wo.state === WorkOrderState.PENDING),
  total: 2,
  page: 1,
  pageSize: 20,
};

export const workOrderDetailResponse = {
  id: 'WO-2025-0001',
  title: '服务器采购申请',
  description: '需要采购3台高性能服务器用于研发环境',
  state: WorkOrderState.PENDING,
  version: 1,
  createdBy: 'user001',
  createdAt: '2025-01-15T10:30:00Z',
  department: 'IT',
  priority: 'high',
  content: {
    items: [
      { name: '服务器A', quantity: 2, price: 50000 },
      { name: '服务器B', quantity: 1, price: 80000 },
    ],
    totalBudget: 180000,
  },
  attachments: [],
  history: approvalHistoryFixtures,
};

export const approvalSuccessResponse = {
  id: 'WO-2025-0001',
  state: WorkOrderState.APPROVED,
  version: 2,
  updatedAt: new Date().toISOString(),
};

export const rejectionSuccessResponse = {
  id: 'WO-2025-0001',
  state: WorkOrderState.REJECTED,
  version: 2,
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// State Transition Fixtures
// ============================================================================

export const validStateTransitions: Array<{
  from: WorkOrderState;
  to: WorkOrderState;
  valid: boolean;
}> = [
  { from: WorkOrderState.PENDING, to: WorkOrderState.IN_PROGRESS, valid: true },
  { from: WorkOrderState.IN_PROGRESS, to: WorkOrderState.APPROVED, valid: true },
  { from: WorkOrderState.IN_PROGRESS, to: WorkOrderState.REJECTED, valid: true },
  { from: WorkOrderState.APPROVED, to: WorkOrderState.CLOSED, valid: true },
];

export const invalidStateTransitions: Array<{
  from: WorkOrderState;
  to: WorkOrderState;
}> = [
  { from: WorkOrderState.APPROVED, to: WorkOrderState.PENDING },
  { from: WorkOrderState.REJECTED, to: WorkOrderState.APPROVED },
  { from: WorkOrderState.CLOSED, to: WorkOrderState.IN_PROGRESS },
];

// ============================================================================
// Page Object Fixtures
// ============================================================================

export const approvalPageSelectors = {
  // List page
  listContainer: '[data-testid="approval-list"]',
  workOrderItem: (id: string) => `[data-testid="work-order-${id}"]`,
  emptyState: '[data-testid="empty-state"]',
  pagination: '[data-testid="pagination"]',
  
  // Detail page
  detailContainer: '[data-testid="approval-detail"]',
  workOrderTitle: '[data-testid="work-order-title"]',
  workOrderDescription: '[data-testid="work-order-description"]',
  stateBadge: '[data-testid="state-badge"]',
  versionInfo: '[data-testid="version-info"]',
  
  // Action buttons
  approveButton: 'button:has-text("通过")',
  rejectButton: 'button:has-text("拒绝")',
  confirmButton: 'button:has-text("确认")',
  cancelButton: 'button:has-text("取消")',
  
  // Form elements
  commentInput: 'textarea[name="reason"]',
  commentValidationError: '[data-testid="comment-error"]',
  
  // Dialog
  confirmDialog: '[role="dialog"]',
  dialogTitle: '[data-testid="dialog-title"]',
  
  // History
  historySection: '[data-testid="approval-history"]',
  historyItem: (index: number) => `[data-testid="history-item-${index}"]`,
  
  // Toast
  toast: '.toast',
  toastMessage: (text: string) => `.toast:has-text("${text}")`,
};

// ============================================================================
// Helper Functions
// ============================================================================

export const waitForApprovalPage = async (page: Page, path: string = '/approval'): Promise<void> => {
  await page.goto(path);
  await page.waitForSelector(approvalPageSelectors.listContainer, { timeout: 10000 });
};

export const waitForDetailPage = async (page: Page, workOrderId: string): Promise<void> => {
  await page.goto(`/approval/${workOrderId}`);
  await page.waitForSelector(approvalPageSelectors.detailContainer, { timeout: 10000 });
};

export const getWorkOrderById = (id: string): WorkOrderFixture | undefined => {
  return workOrderFixtures.find((wo) => wo.id === id);
};

export const getPendingWorkOrders = (): WorkOrderFixture[] => {
  return workOrderFixtures.filter((wo) => wo.state === WorkOrderState.PENDING);
};

export const simulateStateTransition = (
  workOrder: WorkOrderFixture,
  targetState: WorkOrderState
): WorkOrderFixture => {
  return {
    ...workOrder,
    state: targetState,
    version: workOrder.version + 1,
  };
};

// ============================================================================
// Mock Data Generators
// ============================================================================

export const generateWorkOrderList = (count: number): WorkOrderFixture[] => {
  const priorities: Array<'low' | 'medium' | 'high' | 'urgent'> = ['low', 'medium', 'high', 'urgent'];
  const departments = ['IT', 'ADMIN', 'HR', 'FINANCE', 'SECURITY'];
  
  return Array.from({ length: count }, (_, index) => 
    createWorkOrderFixture({
      id: `WO-2025-${String(index + 1).padStart(4, '0')}`,
      title: `自动生成的工单 ${index + 1}`,
      priority: priorities[index % priorities.length],
      department: departments[index % departments.length],
    })
  );
};

export const generateApprovalHistory = (workOrderId: string, count: number): ApprovalHistoryFixture[] => {
  return Array.from({ length: count }, (_, index) =>
    createApprovalHistoryFixture({
      id: `AH-${Date.now()}-${index}`,
      workOrderId,
      action: index % 2 === 0 ? 'approve' : 'reject',
      createdAt: new Date(Date.now() - index * 86400000).toISOString(),
    })
  );
};

// ============================================================================
// Export all fixtures
// ============================================================================

export default {
  WorkOrderState,
  workOrderFixtures,
  approvalHistoryFixtures,
  approverUserFixture,
  viewerUserFixture,
  adminUserFixture,
  pendingWorkOrdersResponse,
  workOrderDetailResponse,
  approvalSuccessResponse,
  rejectionSuccessResponse,
  validStateTransitions,
  invalidStateTransitions,
  approvalPageSelectors,
  waitForApprovalPage,
  waitForDetailPage,
  getWorkOrderById,
  getPendingWorkOrders,
  simulateStateTransition,
  generateWorkOrderList,
  generateApprovalHistory,
  createWorkOrderFixture,
  createApprovalHistoryFixture,
};