import { describe, expect, it } from 'vitest';
import {
  buildWorkOrderPayload,
  getSelectedAssetFromWorkOrder,
  getWorkOrderFormDefaults,
  toBackendDateTime,
} from './workOrderFormMapper';
import type { UserItem } from '@/api/base';
import type { WorkOrder } from '@/types/workorder';

const users: UserItem[] = [
  {
    id: 7,
    username: 'zhangsan',
    realName: '张三',
    deptName: '运维部',
    status: 1,
  },
];

describe('workOrderFormMapper', () => {
  it('maps desktop form fields to backend WorkOrderDTO fields', () => {
    const payload = buildWorkOrderPayload(
      {
        title: '打印机无法出纸',
        type: 'REPAIR',
        priority: 'HIGH',
        description: '三楼办公室打印机卡纸',
        estimatedCost: 120,
        dueDate: '2026-06-10',
        assignee: '7',
      },
      {
        selectedAsset: {
          id: 18,
          assetName: 'HP 打印机',
          assetNo: 'AMS-PR-001',
        },
        assigneeUsers: users,
        collaborators: ['李四'],
        attachments: ['/uploads/workorder/a.png'],
        faultCodeId: 3,
      },
    );

    expect(payload).toEqual({
      title: '打印机无法出纸',
      type: 'REPAIR',
      priority: 'HIGH',
      description: '三楼办公室打印机卡纸',
      assetId: 18,
      assetName: 'HP 打印机',
      assetCode: 'AMS-PR-001',
      assigneeId: 7,
      assigneeName: '张三',
      plannedEndDate: '2026-06-10T23:59:00',
      estimatedCost: 120,
      collaborators: ['李四'],
      attachments: ['/uploads/workorder/a.png'],
      faultCodeId: 3,
    });
  });

  it('clears repair-only fault code when the type is not repair', () => {
    const payload = buildWorkOrderPayload(
      {
        title: '调拨笔记本',
        type: 'TRANSFER',
        priority: 'MEDIUM',
        assignee: '',
      },
      {
        selectedAsset: null,
        assigneeUsers: users,
        collaborators: [],
        attachments: [],
        faultCodeId: 9,
      },
    );

    expect(payload.faultCodeId).toBeUndefined();
    expect(payload.assigneeId).toBeUndefined();
    expect(payload.plannedEndDate).toBeUndefined();
  });

  it('maps detail payload back to edit form defaults', () => {
    const workOrder = {
      id: 22,
      title: '维修投影仪',
      status: 'DRAFT',
      type: 'REPAIR',
      priority: 'CRITICAL',
      description: '会议室投影仪无信号',
      assigneeId: 7,
      assetId: 18,
      assetName: '投影仪',
      assetCode: 'AMS-PJ-001',
      estimatedCost: 300,
      plannedEndDate: '2026-06-11T15:30:00',
    } satisfies WorkOrder;

    expect(getWorkOrderFormDefaults(workOrder)).toEqual({
      title: '维修投影仪',
      type: 'REPAIR',
      priority: 'CRITICAL',
      description: '会议室投影仪无信号',
      estimatedCost: 300,
      dueDate: '2026-06-11',
      assignee: '7',
    });
    expect(getSelectedAssetFromWorkOrder(workOrder)).toEqual({
      id: 18,
      assetName: '投影仪',
      assetNo: 'AMS-PJ-001',
    });
  });

  it('normalizes date input formats for backend LocalDateTime', () => {
    expect(toBackendDateTime('2026-06-12')).toBe('2026-06-12T23:59:00');
    expect(toBackendDateTime('2026-06-12T09:15')).toBe('2026-06-12T09:15:00');
    expect(toBackendDateTime('2026-06-12T09:15:30')).toBe('2026-06-12T09:15:30');
  });
});
