import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemTodoFieldsWorkbenchPage from '../SystemTodoFieldsWorkbenchPage';
import { todoFieldsApi } from '../../../api/todoFields';

vi.mock('../../../api/todoFields', () => ({
  todoFieldsApi: {
    listTodoFields: vi.fn(),
    saveTodoFields: vi.fn(),
    saveTodoFieldSortOrder: vi.fn(),
    saveTodoFieldRoleOverride: vi.fn(),
    resetTodoFieldDefaults: vi.fn(),
    previewTodoFields: vi.fn(),
  },
}));

const mockedApi = vi.mocked(todoFieldsApi);

const fields = [
  { fieldKey: 'processName', fieldLabel: '流程名称', visible: true, sortOrder: 10, sensitive: false, source: 'default' },
  { fieldKey: 'applicantName', fieldLabel: '申请人', visible: true, sortOrder: 30, sensitive: true, source: 'overridden', maskedLabel: '敏感字段已脱敏', maskedValue: '******' },
];

const preview = {
  roleCode: 'APPROVER',
  visibleFields: [
    { fieldKey: 'processName', fieldLabel: '流程名称', visible: true, sortOrder: 10, sensitive: false, maskedLabel: '流程名称', maskedValue: '预览值已脱敏' },
    { fieldKey: 'applicantName', fieldLabel: '申请人', visible: true, sortOrder: 30, sensitive: true, maskedLabel: '敏感字段已脱敏', maskedValue: '******' },
  ],
  maskedFields: [{ fieldKey: 'applicantName', fieldLabel: '申请人', visible: true, sortOrder: 30, sensitive: true, maskedLabel: '敏感字段已脱敏', maskedValue: '******' }],
  totalVisible: 2,
  readOnly: true,
  tenantScoped: true,
};

describe('SystemTodoFieldsWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.listTodoFields.mockResolvedValue(fields);
    mockedApi.previewTodoFields.mockResolvedValue(preview);
    mockedApi.saveTodoFields.mockResolvedValue(fields);
    mockedApi.saveTodoFieldSortOrder.mockResolvedValue([{ ...fields[0], sortOrder: 5 }, { ...fields[1], sortOrder: 10 }]);
    mockedApi.saveTodoFieldRoleOverride.mockResolvedValue(fields);
    mockedApi.resetTodoFieldDefaults.mockResolvedValue(fields);
  });

  it('加载并展示待办字段、角色覆盖解释与预览脱敏结果', async () => {
    render(<SystemTodoFieldsWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('待办字段加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '待办字段配置' })).toBeInTheDocument();
    expect(screen.getByText('流程名称')).toBeInTheDocument();
    expect(screen.getAllByText(/overridden/).length).toBeGreaterThan(0);
    expect(screen.getByText('敏感字段已脱敏：******')).toBeInTheDocument();
    expect(screen.queryByText(/13800138000|raw-secret|token=/)).not.toBeInTheDocument();
  });

  it('支持空态、错误脱敏态与无权限态', async () => {
    mockedApi.listTodoFields.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('token=raw-secret'));
    mockedApi.previewTodoFields.mockResolvedValue(preview);

    render(<SystemTodoFieldsWorkbenchPage />);

    expect(await screen.findByText('暂无待办字段配置，可保存示例配置验证 /todo-fields 闭环。')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('错误详情已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();

    const { container } = render(<SystemTodoFieldsWorkbenchPage canView={false} />);
    expect(within(container).getByText(/无权限访问待办字段配置/)).toBeInTheDocument();
  });

  it('调用 wrapper 完成保存、排序、角色覆盖、默认恢复与只读预览', async () => {
    render(<SystemTodoFieldsWorkbenchPage />);
    await screen.findByText('流程名称');

    await userEvent.click(screen.getByRole('button', { name: '保存字段配置' }));
    await waitFor(() => expect(mockedApi.saveTodoFields).toHaveBeenCalledWith(expect.objectContaining({ confirmed: true, auditEvidence: 'TODO_FIELD_SAVE_GATE' })));

    await userEvent.click(screen.getByRole('button', { name: '保存稳定排序' }));
    await waitFor(() => expect(mockedApi.saveTodoFieldSortOrder).toHaveBeenCalledWith(expect.objectContaining({ confirmed: true, auditEvidence: 'TODO_FIELD_SORT_GATE' })));

    await userEvent.click(screen.getByRole('button', { name: '保存角色覆盖' }));
    await waitFor(() => expect(mockedApi.saveTodoFieldRoleOverride).toHaveBeenCalledWith('APPROVER', expect.objectContaining({ confirmed: true, auditEvidence: 'TODO_FIELD_ROLE_GATE' })));

    await userEvent.click(screen.getByRole('button', { name: '恢复默认配置' }));
    await waitFor(() => expect(mockedApi.resetTodoFieldDefaults).toHaveBeenCalledWith(expect.objectContaining({ confirmed: true, auditEvidence: 'TODO_FIELD_RESET_GATE' })));

    await userEvent.click(screen.getByRole('button', { name: '刷新预览' }));
    await waitFor(() => expect(mockedApi.previewTodoFields).toHaveBeenCalledWith('APPROVER'));
    expect(await screen.findByText(/只读预览已刷新/)).toBeInTheDocument();
  });
});
