import { api } from '../app/utils/api';

export interface VendorRecord {
  id: number;
  name: string;
  vendorCode?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  status?: number | null;
  createTime?: string | null;
  updateTime?: string | null;
  deleted?: number | null;
}

const VENDORS_LIST = '/vendors/list';

export function listVendors() {
  return api.get<VendorRecord[]>(VENDORS_LIST);
}
