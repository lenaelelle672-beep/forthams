import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemTechSupportWorkbenchPage from '../SystemTechSupportWorkbenchPage';
import { listSupportTickets, getTechSupportMeta } from '../../../api/techSupport';

vi.mock('../../../api/techSupport', () => ({
  listSupportTickets: vi.fn(),
  getTechSupportMeta: vi.fn(),
}));

const mockedList = vi.mocked(listSupportTickets);
const mockedMeta = vi.mocked(getTechSupportMeta);

const records = [
  { id: 1, title: '系统报错', category: 'BUG', priority: 'URGENT', priorityLabel: '紧急', status: 'OPEN', statusLabel: '待处理', requesterName: '张三', diagnosticPackageAttached: true, diagnosticPackageMasked: true },
  { id: 2, title: '导入失败', category: 'USAGE', priority: 'NORMAL', priorityLabel: '普通', status: 'RESOLVED', statusLabel: '已解决', requesterName: '李四', diagnosticPackageAttached: false, diagnosticPackageMasked: true },
];
const meta = { priorities: ['URGENT'], statuses: ['OPEN'], readOnlyNotice: '诊断包必须脱敏' };

describe('SystemTechSupportWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedList.mockResolvedValue({ records, total: records.length });
    mockedMeta.mockResolvedValue(meta);
  });

  it('加载并展示工单列表', async () => {
    render(<SystemTechSupportWorkbenchPage canView />);
    expect(await screen.findByText('系统报错')).toBeInTheDocument();
    expect(screen.getByText('导入失败')).toBeInTheDocument();
    expect(screen.getAllByText('紧急').length).toBeGreaterThanOrEqual(1);
  });

  it('展示诊断包脱敏安全边界提示', async () => {
    render(<SystemTechSupportWorkbenchPage canView />);
    await screen.findByText('系统报错');
    expect(screen.getAllByText(/诊断包必须脱敏/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/禁止导出敏感配置原值/).length).toBeGreaterThanOrEqual(1);
  });

  it('加载失败展示脱敏错误提示', async () => {
    mockedList.mockRejectedValueOnce(new Error('token=raw-secret'));
    render(<SystemTechSupportWorkbenchPage canView />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();
  });

  it('无权限态展示只读拦截', () => {
    render(<SystemTechSupportWorkbenchPage canView={false} />);
    expect(screen.getByText(/无权限访问技术支持/)).toBeInTheDocument();
  });
});
