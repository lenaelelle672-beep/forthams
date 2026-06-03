/**
 * @file types/savedReport.ts
 * @description 已保存报表类型定义
 */

export interface SavedReport {
  id: number;
  reportName: string;
  reportType: 'ASSET' | 'MAINTENANCE' | 'FINANCIAL' | 'INVENTORY';
  configJson: string;
  isPublic: number;
  createdBy: number;
  createTime: string;
}

export interface ReportConfig {
  fields: ReportField[];
  groupBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: ReportFilter[];
  chartType?: 'bar' | 'line' | 'pie' | 'table';
}

export interface ReportField {
  name: string;
  label: string;
  selected: boolean;
}

export interface ReportFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'like' | 'in';
  value: string;
}
