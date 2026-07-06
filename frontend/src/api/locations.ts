import { api } from '../app/utils/api';

export interface LocationRecord {
  id: number;
  name: string;
  locationCode?: string | null;
  parentId?: number | null;
  sortOrder?: number | null;
  description?: string | null;
  status?: number | null;
  createTime?: string | null;
  updateTime?: string | null;
  deleted?: number | null;
}

const LOCATIONS_LIST = '/locations/list';
const LOCATIONS_ROOT = '/locations/root';

export function listLocations() {
  return api.get<LocationRecord[]>(LOCATIONS_LIST);
}

export function listRootLocations() {
  return api.get<LocationRecord[]>(LOCATIONS_ROOT);
}
