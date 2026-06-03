/**
 * @file types/maintenanceExecution.ts
 * @description 维保执行跟踪类型定义 — 与后端实体字段严格对齐
 */

/** 维保执行主记录 */
export interface MaintenanceExecution {
  id: number;
  tenantId?: string;
  maintenanceRecordId: number;
  workOrderId: number;
  assigneeId: number | null;
  assigneeName: string | null;
  /** IDLE | RUNNING | PAUSED | COMPLETED */
  status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
  totalLaborHours: number | null;
  totalMaterialCost: number | null;
  startTime: string | null;
  pauseTime: string | null;
  resumeTime: string | null;
  endTime: string | null;
  remark: string | null;
  createBy?: number;
  createTime?: string;
  updateTime?: string;
}

/** 施工步骤 */
export interface MaintenanceExecutionStep {
  id: number;
  tenantId?: string;
  executionId: number;
  stepName: string;
  stepOrder: number;
  description: string | null;
  operatorId: number | null;
  operatorName: string | null;
  laborHours: number | null;
  startTime: string | null;
  endTime: string | null;
  createTime?: string;
  updateTime?: string;
}

/** 物料/备件使用记录 */
export interface MaintenanceExecutionMaterial {
  id: number;
  tenantId?: string;
  executionId: number;
  materialName: string;
  specification: string | null;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
  sourceWarehouse: string | null;
  remark: string | null;
  createTime?: string;
}

/** 开始施工请求 */
export interface ExecutionStartPayload {
  maintenanceRecordId: number;
  workOrderId: number;
  assigneeId?: number | null;
  assigneeName?: string | null;
  remark?: string | null;
}

/** 创建步骤请求 */
export interface StepCreatePayload {
  stepName: string;
  stepOrder?: number;
  description?: string | null;
  operatorId?: number | null;
  operatorName?: string | null;
  laborHours?: number | null;
}

/** 更新步骤请求 */
export interface StepUpdatePayload {
  stepName?: string;
  stepOrder?: number;
  description?: string | null;
  operatorId?: number | null;
  operatorName?: string | null;
  laborHours?: number | null;
}

/** 添加物料请求 */
export interface MaterialCreatePayload {
  materialName: string;
  specification?: string | null;
  quantity: number;
  unitPrice?: number | null;
  /** 合计金额（可选，后端会校验一致性） */
  totalPrice?: number | null;
  sourceWarehouse?: string | null;
  remark?: string | null;
}
