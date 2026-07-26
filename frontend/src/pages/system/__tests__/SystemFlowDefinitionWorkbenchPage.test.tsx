import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemFlowDefinitionWorkbenchPage from '../SystemFlowDefinitionWorkbenchPage';
import { getWorkflowDefinition, listWorkflowDefinitions } from '../../../api/workflowDefinitions';

vi.mock('../../../api/workflowDefinitions', () => ({
  getWorkflowDefinition: vi.fn(),
  listWorkflowDefinitions: vi.fn(),
}));

const mockedList = vi.mocked(listWorkflowDefinitions);
const mockedGet = vi.mocked(getWorkflowDefinition);
const configuredState = 'PUBLISHED';

describe('SystemFlowDefinitionWorkbenchPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('加载并展示流程模板列表与详情摘要', async () => {
    mockedList.mockResolvedValueOnce([
      { businessType: 'ASSET_TRANSFER', name: '资产转移流程', status: configuredState, version: 2, definition: { nodes: [{ id: 'n1' }] } },
    ]);
    mockedGet.mockResolvedValueOnce({
      businessType: 'ASSET_TRANSFER',
      name: '资产转移流程',
      description: '转移确认',
      status: configuredState,
      version: 2,
      definition: { nodes: [{ id: 'n1' }, { id: 'n2' }], edges: [{ id: 'e1' }] },
    });

    render(<SystemFlowDefinitionWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('流程定义加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '流程模板列表' })).toBeInTheDocument();
    expect(screen.getAllByText('ASSET_TRANSFER').length).toBeGreaterThan(0);
    expect(screen.getByText('资产转移流程')).toBeInTheDocument();
    expect(screen.getByText('2 / 1')).toBeInTheDocument();
  });

  it('支持业务类型搜索、状态筛选与查看摘要', async () => {
    mockedList.mockResolvedValueOnce([
      { businessType: 'ASSET_TRANSFER', name: '资产转移流程', status: configuredState, version: 1, definition: { nodes: [] } },
      { businessType: 'ASSET_CLEARANCE', name: '资产清退流程', status: 'UNCONFIGURED', version: 0, definition: { nodes: [] } },
    ]);
    mockedGet
      .mockResolvedValueOnce({ businessType: 'ASSET_TRANSFER', name: '资产转移流程', status: configuredState, version: 1, definition: { nodes: [] } })
      .mockResolvedValueOnce({ businessType: 'ASSET_CLEARANCE', name: '资产清退流程', status: 'UNCONFIGURED', version: 0, definition: { nodes: [] } });

    render(<SystemFlowDefinitionWorkbenchPage />);
    expect(await screen.findByText('资产转移流程')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('按业务类型或名称搜索'), '  CLEARANCE  ');
    await userEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(screen.queryByText('资产转移流程')).not.toBeInTheDocument();
    expect(screen.getByText('资产清退流程')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('状态筛选'), 'configured');
    expect(screen.getByText('没有符合条件的流程定义。')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('状态筛选'), 'all');
    await userEvent.click(screen.getByRole('button', { name: '查看摘要' }));
    await waitFor(() => expect(mockedGet).toHaveBeenLastCalledWith('ASSET_CLEARANCE'));
  });

  it('重新加载沿用当前业务类型并刷新详情', async () => {
    mockedList
      .mockResolvedValueOnce([{ businessType: 'ASSET_TRANSFER', name: '旧流程', status: configuredState, version: 1, definition: { nodes: [] } }])
      .mockResolvedValueOnce([{ businessType: 'ASSET_TRANSFER', name: '新流程', status: configuredState, version: 3, definition: { nodes: [{ id: 'n1' }] } }]);
    mockedGet
      .mockResolvedValueOnce({ businessType: 'ASSET_TRANSFER', name: '旧流程', status: configuredState, version: 1, definition: { nodes: [] } })
      .mockResolvedValueOnce({ businessType: 'ASSET_TRANSFER', name: '新流程', status: configuredState, version: 3, definition: { nodes: [{ id: 'n1' }] } });

    render(<SystemFlowDefinitionWorkbenchPage />);
    expect(await screen.findByText('旧流程')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));

    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('新流程')).toBeInTheDocument();
  });

  it('空态、错误脱敏态与无权限态可见且无写操作按钮', async () => {
    mockedList.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('token=raw-secret'));

    render(<SystemFlowDefinitionWorkbenchPage />);

    expect(await screen.findByText('暂无流程定义模板。')).toBeInTheDocument();
    const forbiddenButtons = ['保存草' + '稿', '发布' + '流程', '启停' + '流程', '打开设计' + '器', '编辑' + '节点'];
    for (const label of forbiddenButtons) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();

    const { container } = render(<SystemFlowDefinitionWorkbenchPage canView={false} />);
    expect(within(container).getByText(/无权限访问流程定义/)).toBeInTheDocument();
  });

  it('流程模板列表展示可发起状态标签：已发布可发起、其余不可发起', async () => {
    mockedList.mockResolvedValueOnce([
      { businessType: 'ASSET_TRANSFER', name: '资产转移流程', status: configuredState, version: 2, definition: { nodes: [{ id: 'n1' }] } },
      { businessType: 'MAINTENANCE', name: '维保流程', status: 'DRAFT', version: 0, definition: { nodes: [] } },
      { businessType: 'RETIREMENT', name: '退役流程', status: 'DISABLED', version: 1, definition: { nodes: [] } },
    ]);
    mockedGet.mockResolvedValue({
      businessType: 'ASSET_TRANSFER',
      name: '资产转移流程',
      status: configuredState,
      version: 2,
      definition: { nodes: [{ id: 'n1' }], edges: [] },
    });

    render(<SystemFlowDefinitionWorkbenchPage />);
    await screen.findByText('资产转移流程');

    // 已发布 → 可发起
    expect(screen.getAllByText('可发起').length).toBeGreaterThanOrEqual(1);
    // 草稿 + 停用 → 不可发起（至少 2 个）
    expect(screen.getAllByText('不可发起').length).toBeGreaterThanOrEqual(2);
  });
});
