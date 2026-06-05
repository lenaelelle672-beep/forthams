/**
 * @file types/sparePart.ts
 * @description 备品备件类型定义
 */

/** 备品备件实体 */
export interface SparePart {
  id: number;
  partNo: string;
  partName: string;
  specification?: string;
  categoryId?: number;
  currentStock: number;
  safetyStock: number;
  unit: string;
  unitPrice?: number;
  locationId?: number;
  vendorId?: number;
  status: string;
  tenantId?: string;
  version: number;
  createTime?: string;
  updateTime?: string;
}

/** 备件领用记录 */
export interface SparePartUsage {
  id: number;
  sparePartId: number;
  workOrderId: number;
  quantity: number;
  usageDate: string;
  userId?: number;
  note?: string;
  createTime?: string;
  updateTime?: string;
}

/** 创建备件请求 */
export interface CreateSparePartRequest {
  partNo: string;
  partName: string;
  specification?: string;
  categoryId?: number;
  currentStock?: number;
  safetyStock?: number;
  unit: string;
  unitPrice?: number;
  locationId?: number;
  vendorId?: number;
}

/** 更新备件请求 */
export interface UpdateSparePartRequest extends CreateSparePartRequest {
  status?: string;
}

/** 领用备件请求 */
export interface ConsumePartRequest {
  sparePartId: number;
  workOrderId: number;
  quantity: number;
  userId?: number;
  note?: string;
}

/** 采购建议 */
export interface PurchaseSuggestion {
  sparePartId: number;
  partNo: string;
  partName: string;
  currentStock: number;
  safetyStock: number;
  dailyAvgConsumption: number;
  suggestedOrderQuantity: number;
  unit: string;
}
