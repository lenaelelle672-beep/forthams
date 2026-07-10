import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemHandoverWorkbenchPage from '../SystemHandoverWorkbenchPage';
import { listHandoverTasks, getHandoverMeta } from '../../../api/handover';

vi.mock('../../../api/handover', () => ({
  listHandoverTasks: vi.fn(),
  getHandoverMeta: vi.fn(),
}));

const mockedList = vi.mocked(listHandoverTasks);
const mockedMeta = vi.mocked(getHandoverMeta);

const records = [
  { id: 1, title: '张三交接', outgoingUserName: '张三', incomingUserName: '李四', status: 'PENDING', statusLabel: '待交接', assetCount: 5, workorderCount: 2, approvalCount: 1 },
  { id: 2, title: '王五交接', outgoingUserName: '王五', incomingUserName: '赵六', status: 'COMPLETED', statusLabel: '已完成', assetCount: 3, workorderCount: 0, approvalCount: 0 },
];

const meta = { statuses: ['PENDING', 'COMPLETED'], readOnlyNotice: '只读 catalog' };

describe('SystemHandoverWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedList.mockResolvedValue({ records, total: records.length });
    mockedMeta.mockResolvedValue(meta);
  });

  it('加载并展示交接任务列表', async () => {
    render(<SystemHandoverWorkbenchPage canView />);
    expect(await screen.findByText('张三交接')).toBeInTheDocument();
    expect(screen.getByText('王五交接')).toBeInTheDocument();
    expect(screen.getAllByText('待交接').length).toBeGreaterThanOrEqual(1);
  });

  it('展示只读边界与未闭环风险提示', async () => {
    render(<SystemHandoverWorkbenchPage canView />);
    await screen.findByText('张三交接');
    expect(screen.getAllByText(/只读边界/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/真实资产\/工单\/审批对象转移未闭环/)).toBeInTheDocument();
  });

  it('状态筛选：选已完成只显示已完成任务', async () => {
    render(<SystemHandoverWorkbenchPage canView />);
    await screen.findByText('张三交接');

    await userEvent.selectOptions(screen.getByRole('combobox'), 'COMPLETED');

    expect(screen.queryByText('张三交接')).not.toBeInTheDocument();
    expect(screen.getByText('王五交接')).toBeInTheDocument();
  });

  it('加载失败展示脱敏错误提示', async () => {
    mockedList.mockRejectedValueOnce(new Error('token=raw-secret'));
    render(<SystemHandoverWorkbenchPage canView />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();
  });

  it('无权限态展示只读拦截', () => {
    render(<SystemHandoverWorkbenchPage canView={false} />);
    expect(screen.getByText(/无权限访问交接管理/)).toBeInTheDocument();
  });
});
