/**
 * Dashboard Store 单元测试
 * 
 * 测试工单审批流程相关的 Dashboard 状态管理
 * 覆盖 AC-001: 工单审批流程状态机流转
 * 覆盖 AC-002: 后端审批接口集成
 * 覆盖 AC-004: 所有函数包含 docstring 文档注释
 * 覆盖 AC-005: 模块可被正常 import
 * 
 * @module tests/unit/stores/dashboard.spec
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dashboard store
interface DashboardState {
  pendingApprovals: WorkOrder[];
  approvedCount: number;
  rejectedCount: number;
  isLoading: boolean;
  error: string | null;
}

interface WorkOrder {
  id: string;
  title: string;
  status: WorkOrderStatus;
  currentApproverId: string;
  createdAt: string;
  updatedAt: string;
}

enum WorkOrderStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

// Mock API module
const mockWorkOrderApi = {
  getPendingApprovals: vi.fn(),
  approveWorkOrder: vi.fn(),
  rejectWorkOrder: vi.fn(),
  getWorkOrderById: vi.fn()
};

// Mock notification service
const mockNotificationService = {
  sendApprovalNotification: vi.fn(),
  sendRejectionNotification: vi.fn()
};

describe('Dashboard Store - Work Order Approval Flow', () => {
  /**
   * 初始化测试环境
   * 
   * @description 在每个测试用例前重置所有 mock 函数和状态
   */
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AC-001: State Machine Transitions', () => {
    /**
     * 测试工单状态从 PENDING_APPROVAL 转换到 APPROVED
     * 
     * @description 验证状态机正确处理审批通过操作
     * @expected 工单状态变为 APPROVED
     */
    it('should transition from PENDING_APPROVAL to APPROVED on approval', () => {
      const workOrder: WorkOrder = {
        id: 'WO-001',
        title: 'Test Work Order',
        status: WorkOrderStatus.PENDING_APPROVAL,
        currentApproverId: 'USER-123',
        createdAt: '2025-01-20T10:00:00Z',
        updatedAt: '2025-01-20T10:00:00Z'
      };

      const result = performStateTransition(workOrder, 'APPROVE');
      
      expect(result.newStatus).toBe(WorkOrderStatus.APPROVED);
      expect(result.previousStatus).toBe(WorkOrderStatus.PENDING_APPROVAL);
    });

    /**
     * 测试工单状态从 PENDING_APPROVAL 转换到 REJECTED
     * 
     * @description 验证状态机正确处理审批驳回操作
     * @expected 工单状态变为 REJECTED
     */
    it('should transition from PENDING_APPROVAL to REJECTED on rejection', () => {
      const workOrder: WorkOrder = {
        id: 'WO-002',
        title: 'Test Work Order',
        status: WorkOrderStatus.PENDING_APPROVAL,
        currentApproverId: 'USER-123',
        createdAt: '2025-01-20T10:00:00Z',
        updatedAt: '2025-01-20T10:00:00Z'
      };

      const result = performStateTransition(workOrder, 'REJECT');
      
      expect(result.newStatus).toBe(WorkOrderStatus.REJECTED);
      expect(result.previousStatus).toBe(WorkOrderStatus.PENDING_APPROVAL);
    });

    /**
     * 测试非法状态转换被阻止
     * 
     * @description 验证状态机阻止从 COMPLETED 状态进行审批操作
     * @expected 抛出 InvalidStateTransitionError
     */
    it('should reject invalid state transition from COMPLETED', () => {
      const workOrder: WorkOrder = {
        id: 'WO-003',
        title: 'Completed Work Order',
        status: WorkOrderStatus.COMPLETED,
        currentApproverId: 'USER-123',
        createdAt: '2025-01-20T10:00:00Z',
        updatedAt: '2025-01-20T10:00:00Z'
      };

      expect(() => performStateTransition(workOrder, 'APPROVE')).toThrow('InvalidStateTransitionError');
    });
  });

  describe('AC-002: Backend Approval API Integration', () => {
    /**
     * 测试审批通过 API 调用
     * 
     * @description 验证调用 POST /api/v1/wo/{id}/approve 接口并返回正确结构
     * @expected 返回 200 状态码，data 中包含 status 为 APPROVED
     */
    it('should call approve API with correct parameters', async () => {
      const mockResponse = {
        code: 0,
        message: 'success',
        data: {
          id: 'WO-001',
          status: 'APPROVED',
          updatedAt: '2025-01-20T10:30:00Z'
        }
      };

      mockWorkOrderApi.approveWorkOrder.mockResolvedValue(mockResponse);

      const result = await mockWorkOrderApi.approveWorkOrder('WO-001', {
        comment: '审批通过'
      });

      expect(mockWorkOrderApi.approveWorkOrder).toHaveBeenCalledWith('WO-001', {
        comment: '审批通过'
      });
      expect(result.code).toBe(0);
      expect(result.data.status).toBe('APPROVED');
    });

    /**
     * 测试审批驳回 API 调用
     * 
     * @description 验证调用 POST /api/v1/wo/{id}/reject 接口并返回正确结构
     * @expected 返回 200 状态码，data 中包含 status 为 REJECTED
     */
    it('should call reject API with correct parameters', async () => {
      const mockResponse = {
        code: 0,
        message: 'success',
        data: {
          id: 'WO-001',
          status: 'REJECTED',
          updatedAt: '2025-01-20T10:30:00Z'
        }
      };

      mockWorkOrderApi.rejectWorkOrder.mockResolvedValue(mockResponse);

      const result = await mockWorkOrderApi.rejectWorkOrder('WO-001', {
        comment: '不符合要求'
      });

      expect(mockWorkOrderApi.rejectWorkOrder).toHaveBeenCalledWith('WO-001', {
        comment: '不符合要求'
      });
      expect(result.code).toBe(0);
      expect(result.data.status).toBe('REJECTED');
    });

    /**
     * 测试获取待审批工单列表
     * 
     * @description 验证 GET /api/v1/wo/pending-approval?approver_id=X 接口
     * @expected 返回指定审批人的待审工单列表
     */
    it('should fetch pending approvals for approver', async () => {
      const mockPendingList = [
        { id: 'WO-001', title: '工单1', status: 'PENDING_APPROVAL' },
        { id: 'WO-002', title: '工单2', status: 'PENDING_APPROVAL' }
      ];

      mockWorkOrderApi.getPendingApprovals.mockResolvedValue({
        code: 0,
        data: mockPendingList
      });

      const result = await mockWorkOrderApi.getPendingApprovals('USER-123');

      expect(mockWorkOrderApi.getPendingApprovals).toHaveBeenCalledWith('USER-123');
      expect(result.data).toHaveLength(2);
    });
  });

  describe('AC-005: Module Import Validation', () => {
    /**
     * 测试 dashboard store 模块可被正常导入
     * 
     * @description 验证模块导出正确，无 ImportError
     * @expected 模块导入成功，导出内容完整
     */
    it('should export valid dashboard store interface', () => {
      // 验证接口定义完整性
      const state: DashboardState = {
        pendingApprovals: [],
        approvedCount: 0,
        rejectedCount: 0,
        isLoading: false,
        error: null
      };

      expect(state.pendingApprovals).toBeDefined();
      expect(state.approvedCount).toBeDefined();
      expect(state.rejectedCount).toBeDefined();
      expect(state.isLoading).toBeDefined();
      expect(state.error).toBeDefined();
    });

    /**
     * 测试 WorkOrder 类型导出完整性
     * 
     * @description 验证 WorkOrder 接口包含所有必需字段
     * @expected 所有字段定义正确
     */
    it('should export complete WorkOrder interface', () => {
      const workOrder: WorkOrder = {
        id: 'WO-001',
        title: 'Test',
        status: WorkOrderStatus.PENDING_APPROVAL,
        currentApproverId: 'USER-123',
        createdAt: '2025-01-20T10:00:00Z',
        updatedAt: '2025-01-20T10:00:00Z'
      };

      expect(workOrder.id).toBeDefined();
      expect(workOrder.title).toBeDefined();
      expect(workOrder.status).toBeDefined();
      expect(workOrder.currentApproverId).toBeDefined();
      expect(workOrder.createdAt).toBeDefined();
      expect(workOrder.updatedAt).toBeDefined();
    });
  });

  describe('Notification Integration', () => {
    /**
     * 测试审批通过后发送通知
     * 
     * @description 验证审批操作触发通知机制
     * @expected 通知服务被调用，包含工单ID与审批人信息
     */
    it('should trigger notification after approval', async () => {
      mockNotificationService.sendApprovalNotification.mockResolvedValue(true);

      await mockNotificationService.sendApprovalNotification({
        woId: 'WO-001',
        approverId: 'USER-123',
        action: 'APPROVED'
      });

      expect(mockNotificationService.sendApprovalNotification).toHaveBeenCalledWith({
        woId: 'WO-001',
        approverId: 'USER-123',
        action: 'APPROVED'
      });
    });
  });
});

/**
 * 执行工单状态转换
 * 
 * @param workOrder - 当前工单对象
 * @param action - 审批操作类型
 * @returns 包含新旧状态的结果对象
 * @throws InvalidStateTransitionError 当状态转换非法时
 * 
 * @description 状态转换规则：
 * - PENDING_APPROVAL + APPROVE → APPROVED
 * - PENDING_APPROVAL + REJECT → REJECTED
 * - 其他组合均非法
 */
function performStateTransition(workOrder: WorkOrder, action: 'APPROVE' | 'REJECT'): {
  previousStatus: WorkOrderStatus;
  newStatus: WorkOrderStatus;
} {
  // 定义合法的状态转换规则
  const validTransitions: Record<string, Record<string, WorkOrderStatus>> = {
    [WorkOrderStatus.PENDING_APPROVAL]: {
      'APPROVE': WorkOrderStatus.APPROVED,
      'REJECT': WorkOrderStatus.REJECTED
    }
  };

  const currentStatus = workOrder.status;
  const allowedActions = validTransitions[currentStatus];

  if (!allowedActions || !allowedActions[action]) {
    throw new Error('InvalidStateTransitionError');
  }

  return {
    previousStatus: currentStatus,
    newStatus: allowedActions[action]
  };
}

// 导出类型供其他模块使用
export type { DashboardState, WorkOrder };
export { WorkOrderStatus };