import type { InspectionTypeEnum } from './inspection';

/**
 * 检验任务状态枚举
 */
export enum InspectionTaskStatusEnum {
  PENDING = 'PENDING',           // 待处理
  IN_PROGRESS = 'IN_PROGRESS',   // 进行中
  COMPLETED = 'COMPLETED',       // 已完成
  CANCELLED = 'CANCELLED',       // 已取消
  OVERDUE = 'OVERDUE'            // 已逾期
}

/**
 * 检验任务接口
 */
export interface InspectionTask {
  id?: number;
  taskNo: string;                // 任务编号
  templateId?: number;           // 检验模板ID
  taskName: string;              // 任务名称
  taskType: InspectionTypeEnum;  // 任务类型
  plannedDate: string;           // 计划检验日期 (YYYY-MM-DD)
  actualDate?: string;           // 实际检验日期 (YYYY-MM-DD)
  status: InspectionTaskStatusEnum;  // 任务状态
  assignedTo?: number;           // 分配给（用户ID）
  remarks?: string;              // 备注
  tenantId?: string;             // 租户ID
  createBy?: number;             // 创建人ID
  createTime?: string;           // 创建时间
  updateTime?: string;           // 更新时间
  deleted?: number;              // 软删除标记
}

/**
 * 检验任务查询参数接口
 */
export interface InspectionTaskQueryParams {
  keyword?: string;              // 关键词（任务编号、任务名称）
  status?: string;               // 任务状态
  taskType?: string;             // 任务类型
  startDate?: string;            // 开始日期 (YYYY-MM-DD)
  endDate?: string;              // 结束日期 (YYYY-MM-DD)
  pageNum?: number;              // 页码
  pageSize?: number;             // 每页条数
}

/**
 * 检验任务批量创建参数接口
 */
export interface InspectionTaskBatchCreateDTO {
  templateId: number;            // 检验模板ID
  taskType: InspectionTypeEnum;  // 任务类型
  plannedDate: string;           // 计划检验日期
  assetIds: number[];            // 资产ID列表
  assignedTo?: number;           // 分配给（用户ID）
  remarks?: string;              // 备注
}

/**
 * 检验任务状态更新参数接口
 */
export interface InspectionTaskStatusUpdateDTO {
  status: InspectionTaskStatusEnum;  // 新状态
  actualDate?: string;               // 实际检验日期
  remarks?: string;                  // 备注
}