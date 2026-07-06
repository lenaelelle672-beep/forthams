import { api } from '../app/utils/api';

export interface FileStorageAttachmentMetadata {
  id: number;
  businessType: string;
  businessId: number;
  fileName: string;
  displayName: string;
  fileSize?: number | null;
  fileType?: string | null;
  uploadBy?: number | null;
  createTime?: string | null;
}

export interface FileStorageAttachmentSummary {
  totalAttachmentCount: number;
  totalFileSize: number;
  businessTypeCount: number;
  fileTypeCount: number;
  currentPageAttachmentCount: number;
}

export interface FileStorageAttachmentPage {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface FileStorageAttachmentCatalog {
  attachments: FileStorageAttachmentMetadata[];
  summary: FileStorageAttachmentSummary;
  page: FileStorageAttachmentPage;
  businessTypes: string[];
  fileTypes: string[];
  riskTips: string[];
  readonlyNotice: string;
}

export interface FileStorageAttachmentCatalogParams {
  keyword?: string;
  businessType?: string;
  fileType?: string;
  page?: number;
  pageSize?: number;
}

const FILE_STORAGE_ATTACHMENT_CATALOG = '/system/file-storage/attachments/catalog';

export function getFileStorageAttachmentCatalog(params: FileStorageAttachmentCatalogParams = {}) {
  const keyword = params.keyword?.trim();
  const businessType = params.businessType?.trim();
  const fileType = params.fileType?.trim();
  return api.get<FileStorageAttachmentCatalog>(FILE_STORAGE_ATTACHMENT_CATALOG, {
    params: {
      ...(keyword ? { keyword } : {}),
      ...(businessType ? { businessType } : {}),
      ...(fileType ? { fileType } : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.pageSize ? { pageSize: params.pageSize } : {}),
    },
  });
}
