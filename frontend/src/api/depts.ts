import { api } from '../app/utils/api';

export interface DeptListNode {
  id: number;
  name?: string | null;
  deptName?: string | null;
  dept_name?: string | null;
  deptCode?: string | null;
  dept_code?: string | null;
  parentId?: number | null;
  parent_id?: number | null;
  sortOrder?: number | null;
  sort_order?: number | null;
  orderNum?: number | null;
  leader?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | number | null;
  createTime?: string | null;
  create_time?: string | null;
  children?: DeptListNode[];
}

export interface DeptTreeNode {
  id: number;
  name?: string | null;
  parentId?: number | null;
  orderNum?: number | null;
  leader?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | number | null;
  createTime?: string | null;
  updateTime?: string | null;
  children?: DeptTreeNode[];
}

export interface DeptListParams {
  keyword?: string;
}

const DEPTS_LIST = '/depts/list';
const DEPTS_TREE = '/depts/tree';

export function listDepts(params: DeptListParams = {}) {
  const keyword = params.keyword?.trim();
  return api.get<DeptListNode[]>(DEPTS_LIST, {
    params: {
      ...(keyword ? { keyword } : {}),
    },
  });
}

export function getDeptTree() {
  return api.get<DeptTreeNode[]>(DEPTS_TREE);
}
