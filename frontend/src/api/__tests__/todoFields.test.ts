import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import http from '@/utils/http';
import { todoFieldsApi } from '@/api/todoFields';

const mockedHttp = {
  get: vi.mocked(http.get),
  post: vi.mocked(http.post),
  put: vi.mocked(http.put),
  delete: vi.mocked(http.delete),
};

describe('api/todoFields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('uses real /todo-fields list save sort role override reset and preview endpoints', async () => {
    sessionStorage.setItem('user_info', JSON.stringify({ userId: 42 }));
    mockedHttp.get.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});

    const payload = { confirmed: true as const, reason: '字段保存复核', fields: [{ fieldKey: 'processName', fieldLabel: '流程名称', visible: true, sortOrder: 10 }] };
    await todoFieldsApi.listTodoFields('APPROVER');
    await todoFieldsApi.saveTodoFields(payload);
    await todoFieldsApi.saveTodoFieldSortOrder({ ...payload, reason: '排序复核' });
    await todoFieldsApi.saveTodoFieldRoleOverride('APPROVER/QA', { ...payload, explanation: '角色覆盖来源：overridden' });
    await todoFieldsApi.resetTodoFieldDefaults({ confirmed: true, reason: '默认恢复复核', auditEvidence: 'RESET-GATE' });
    await todoFieldsApi.previewTodoFields('APPROVER');

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/todo-fields', { params: { roleCode: 'APPROVER' } });
    expect(mockedHttp.put).toHaveBeenNthCalledWith(1, '/todo-fields', expect.objectContaining({ confirmed: true, reason: '字段保存复核', operatorId: 42 }));
    expect(mockedHttp.put).toHaveBeenNthCalledWith(2, '/todo-fields/sort-order', expect.objectContaining({ reason: '排序复核', operatorId: 42 }));
    expect(mockedHttp.put).toHaveBeenNthCalledWith(3, '/todo-fields/role-overrides/APPROVER%2FQA', expect.objectContaining({ explanation: '角色覆盖来源：overridden', operatorId: 42 }));
    expect(mockedHttp.post).toHaveBeenCalledWith('/todo-fields/reset-defaults', { confirmed: true, reason: '默认恢复复核', auditEvidence: 'RESET-GATE', operatorId: 42 });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/todo-fields/preview', { params: { roleCode: 'APPROVER' } });
  });

  it('keeps audit payloads and avoids workflow or V2 fallback dependencies', async () => {
    localStorage.setItem('user_info', JSON.stringify({ id: 7 }));
    mockedHttp.put.mockResolvedValue({});

    await todoFieldsApi.saveTodoFields({
      confirmed: true,
      auditEvidence: 'SAVE-GATE',
      fields: [{ fieldKey: 'form.assetNo', fieldLabel: '资产编号', visible: true, sortOrder: 20 }],
    });

    expect(mockedHttp.put).toHaveBeenCalledWith('/todo-fields', expect.objectContaining({ auditEvidence: 'SAVE-GATE', operatorId: 7 }));
    expect(JSON.stringify(mockedHttp.put.mock.calls)).not.toMatch(/workflow\.ts|fixed-assets\/workbench\?menu=|iframe|public\/mock/);
  });
});
