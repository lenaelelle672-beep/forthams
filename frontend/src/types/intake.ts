/**
 * @file types/intake.ts
 * @description 入库验收前端类型定义
 */

/** 入库验收单状态 */
export enum IntakeStatus {
  DRAFT = 'DRAFT',
  PENDING_INSPECT = 'PENDING_INSPECT',
  INSPECTING = 'INSPECTING',
  PARTIAL_ACCEPTED = 'PARTIAL_ACCEPTED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export const INTAKE_STATUS_CONFIG: Record<IntakeStatus, { label: string; color: string; bgColor: string }> = {
  [IntakeStatus.DRAFT]:           { label: '草稿',     color: '#6b7280', bgColor: '#f3f4f6' },
  [IntakeStatus.PENDING_INSPECT]: { label: '待质检',   color: '#2563eb', bgColor: '#dbeafe' },
  [IntakeStatus.INSPECTING]:      { label: '质检中',   color: '#d97706', bgColor: '#fef3c7' },
  [IntakeStatus.PARTIAL_ACCEPTED]:{ label: '部分验收', color: '#9333ea', bgColor: '#f3e8ff' },
  [IntakeStatus.ACCEPTED]:        { label: '已验收',   color: '#16a34a', bgColor: '#dcfce7' },
  [IntakeStatus.REJECTED]:        { label: '已驳回',   color: '#dc2626', bgColor: '#fee2e2' },
  [IntakeStatus.CANCELLED]:       { label: '已取消',   color: '#78716c', bgColor: '#f5f5f4' },
};

/** 检查项 */
export interface IntakeCheckItem {
  id?: number;
  intakeOrderId?: number;
  itemName: string;
  expectedValue?: string;
  actualValue?: string;
  result?: string;
  remark?: string;
  sortOrder?: number;
}

/** 入库资产 */
export interface IntakeAsset {
  id?: number;
  intakeOrderId?: number;
  assetNo?: string;
  assetName: string;
  model?: string;
  brand?: string;
  serialNo?: string;
  supplier?: string;
  purchaseDate?: string;
  originalValue?: number;
  warrantyPeriod?: number;
  categoryId?: number;
  locationId?: number;
  remark?: string;
}

/** 入库验收单 */
export interface IntakeOrder {
  id: number;
  orderNo: string;
  vendorId?: number;
  orderDate?: string;
  status: IntakeStatus;
  totalAmount?: number;
  remark?: string;
  rejectReason?: string;
  checkItems?: IntakeCheckItem[];
  intakeAssets?: IntakeAsset[];
  tenantId?: string;
  createBy?: number;
  createTime: string;
  updateTime: string;
}

/** 创建验收单请求 */
export interface CreateIntakeOrderRequest {
  vendorId?: number;
  orderDate?: string;
  totalAmount?: number;
  remark?: string;
  checkItems: IntakeCheckItem[];
  intakeAssets: IntakeAsset[];
}

/** 更新验收单请求 */
export interface UpdateIntakeOrderRequest {
  remark?: string;
  orderDate?: string;
  totalAmount?: number;
}

/** 查询参数 */
export interface IntakeOrderListQuery {
  keyword?: string;
  orderNo?: string;
  status?: string;
  vendorId?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}
