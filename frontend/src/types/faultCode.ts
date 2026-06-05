/**
 * @file types/faultCode.ts
 * @description 故障代码体系类型定义
 */

/** 故障代码实体 */
export interface FaultCode {
  id: number;
  code: string;
  faultPhenomenon?: string;
  faultCause?: string;
  solution?: string;
  parentId?: number;
  level?: number;
  categoryIds?: string;
  tenantId?: string;
  status: string;
  sortOrder?: number;
  children?: FaultCode[];
  createTime?: string;
  updateTime?: string;
}

/** 创建故障代码请求 */
export interface CreateFaultCodeRequest {
  code: string;
  faultPhenomenon?: string;
  faultCause?: string;
  solution?: string;
  parentId?: number;
  categoryIds?: string;
  sortOrder?: number;
}

/** 更新故障代码请求 */
export interface UpdateFaultCodeRequest extends CreateFaultCodeRequest {
  status?: string;
}
