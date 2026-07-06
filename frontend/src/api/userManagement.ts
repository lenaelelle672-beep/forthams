import { api } from '../app/utils/api';

export interface UserManagementRecord {
  id: number;
  username: string;
  realName?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  status?: number | null;
  deptId?: number | null;
  createTime?: string | null;
  updateTime?: string | null;
  deleted?: number | null;
}

export interface UserManagementPage {
  records: UserManagementRecord[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

export interface UserManagementListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

const USER_MANAGEMENT_LIST = '/user-management/list';

export function listUserManagement(params: UserManagementListParams = {}) {
  const keyword = params.keyword?.trim();
  return api.get<UserManagementPage>(USER_MANAGEMENT_LIST, {
    params: {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
      ...(keyword ? { keyword } : {}),
    },
  });
}
