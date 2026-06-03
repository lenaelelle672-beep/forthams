export enum ItemTypeEnum {
  PASS_FAIL = 'PASS_FAIL',
  READING = 'READING',
  PHOTO = 'PHOTO',
  TEXT = 'TEXT'
}

export interface SafetyChecklistTemplate {
  id?: number;
  templateName: string;
  categoryIds?: string;
  tenantId?: string;
  status?: string;
  createBy?: number;
  createTime?: string;
  updateTime?: string;
  deleted?: number;
}

export interface SafetyChecklistItem {
  id?: number;
  templateId?: number;
  itemName: string;
  itemType: ItemTypeEnum;
  sortOrder?: number;
  required?: number;
  createTime?: string;
  updateTime?: string;
  deleted?: number;
}

export interface SafetyChecklistExecution {
  id?: number;
  templateId: number;
  assetId: number;
  executorId: number;
  executeDate: string;
  status: string;
  overallResult?: string;
  tenantId?: string;
  createBy?: number;
  createTime?: string;
  updateTime?: string;
  deleted?: number;
}

export interface SafetyChecklistResult {
  id?: number;
  executionId?: number;
  itemId: number;
  result?: string;
  reading?: number;
  photoUrl?: string;
  note?: string;
  createTime?: string;
  updateTime?: string;
  deleted?: number;
}

export interface SysAttachment {
  id?: number;
  businessType: string;
  businessId: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  uploadBy: number;
  createTime?: string;
}

export interface SafetyChecklistBatchResult {
  successCount: number;
  failCount: number;
  failedAssetIds?: number[];
  results?: Map<number, SafetyChecklistExecution>;
  totalCount?: number;
  allSuccess?: boolean;
}
