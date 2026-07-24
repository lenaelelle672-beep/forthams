import { api } from '../app/utils/api';

export interface ImportExportTaskRecord {
  id: number;
  taskType: string;
  businessObject: string;
  fileFormat: string;
  status: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  operatorId?: number;
  operatorName?: string;
  errorSummary?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt?: string;
}

export interface ImportExportTaskList {
  records: ImportExportTaskRecord[];
  total: number;
  current?: number;
  pages?: number;
}

export interface ImportExportMeta {
  supportedObjects: string[];
  supportedFormats: string[];
  statuses: string[];
  importRowLimit: number;
  exportRowLimit: number;
  readOnlyNotice: string;
}

export interface ImportExportQuery {
  page?: number;
  pageSize?: number;
  taskType?: string;
  businessObject?: string;
  status?: string;
}

export function listImportExportTasks(params: ImportExportQuery = {}) {
  return api.get<ImportExportTaskList>('/system/import-export/tasks', { params });
}

export function getImportExportTaskDetail(id: number) {
  return api.get<ImportExportTaskRecord>(`/system/import-export/tasks/${id}`);
}

export function getImportExportMeta() {
  return api.get<ImportExportMeta>('/system/import-export/meta');
}
