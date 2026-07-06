export enum InspectionTypeEnum {
  ANNUAL = 'ANNUAL',
  PERIODIC = 'PERIODIC',
  SPECIAL = 'SPECIAL'
}

export enum InspectionResultEnum {
  PASS = 'PASS',
  FAIL = 'FAIL',
  CONDITIONAL = 'CONDITIONAL',
  PENDING = 'PENDING',
  OVERDUE = 'OVERDUE'
}

export interface Inspection {
  id?: number;
  inspectionNo: string;
  assetId: number;
  inspectionType: InspectionTypeEnum;
  inspectionDate: string;
  nextInspectionDate?: string;
  inspectionAgency?: string;
  inspectorName?: string;
  result: InspectionResultEnum;
  certificateNo?: string;
  certificateExpiry?: string;
  reportAttachment?: string;
  cost?: number;
  templateId?: number;
  photos?: string; // JSON数组字符串
  findings?: string; // 检查发现文本
  tenantId?: string;
  createBy?: number;
  createTime?: string;
  updateTime?: string;
  deleted?: number;
}

export interface InspectionTemplate {
  id?: number;
  templateName: string;
  type: InspectionTypeEnum;
  frequency?: number; // 检验周期（月数）
  categoryIds?: string; // JSON数组字符串
  checkItems?: string; // JSON数组字符串
  status?: 'ACTIVE' | 'DISABLED';
  tenantId?: string;
  createBy?: number;
  createTime?: string;
  updateTime?: string;
  deleted?: number;
}

export interface InspectionQueryParams {
  keyword?: string;
  inspectionType?: InspectionTypeEnum;
  result?: InspectionResultEnum;
  startDate?: string;
  endDate?: string;
  pageNum?: number;
  pageSize?: number;
}

export interface InspectionTemplateQueryParams {
  keyword?: string;
  type?: InspectionTypeEnum;
  pageNum?: number;
  pageSize?: number;
}

export interface AutoGenerateParams {
  assetIds: number[];
  templateId: number;
}

export interface AutoGenerateByCategoryParams {
  assetCategoryId: number;
  templateId: number;
}

// ==================== 检验记录相关类型 ====================

export interface InspectionRecord {
  id?: number;
  recordNo: string;
  assetId: number;
  assetName?: string;
  templateId?: number;
  templateName?: string;
  inspectionType: InspectionTypeEnum;
  inspectionDate: string;
  nextInspectionDate?: string;
  result: InspectionResultEnum;
  checkResults?: string; // JSON数组字符串
  attachments?: string; // JSON数组字符串
  inspectorId?: number;
  inspectorName?: string;
  notes?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  tenantId?: string;
  createdBy?: number;
  createdTime?: string;
  updatedBy?: number;
  updatedTime?: string;
  deleted?: number;
}

export interface InspectionRecordQueryParams {
  keyword?: string;
  assetId?: number;
  inspectionType?: InspectionTypeEnum;
  status?: string;
  startDate?: string;
  endDate?: string;
  pageNum?: number;
  pageSize?: number;
}

export interface InspectionStatisticsDTO {
  startDate: string;
  endDate: string;
  totalCount: number;
  completedCount: number;
  overdueCount: number;
  completionRate: number;
  overdueRate: number;
}

export interface InspectionStatisticsQueryParams {
  startDate?: string;
  endDate?: string;
}

// ==================== 附件相关类型 ====================

export interface SysAttachment {
  id: number;
  businessType: string;
  businessId: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  uploadBy: number;
  createTime: string;
  deleted?: number;
}
