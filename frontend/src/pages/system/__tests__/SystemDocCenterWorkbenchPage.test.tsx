import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemDocCenterWorkbenchPage from '../SystemDocCenterWorkbenchPage';
import { listDocArticles, getDocCenterMeta } from '../../../api/docCenter';

vi.mock('../../../api/docCenter', () => ({
  listDocArticles: vi.fn(),
  getDocCenterMeta: vi.fn(),
}));

const mockedList = vi.mocked(listDocArticles);
const mockedMeta = vi.mocked(getDocCenterMeta);

const records = [
  { id: 1, title: '资产管理制度', category: 'POLICY', categoryLabel: '制度规范', version: 2, status: 'PUBLISHED', statusLabel: '已发布', authorName: '管理员', attachmentCount: 1 },
  { id: 2, title: '操作手册', category: 'MANUAL', categoryLabel: '操作手册', version: 1, status: 'DRAFT', statusLabel: '草稿', authorName: '张三', attachmentCount: 0 },
];
const meta = { categories: ['POLICY'], statuses: ['PUBLISHED'], readOnlyNotice: '只读' };

describe('SystemDocCenterWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedList.mockResolvedValue({ records, total: records.length });
    mockedMeta.mockResolvedValue(meta);
  });

  it('加载并展示文档列表', async () => {
    render(<SystemDocCenterWorkbenchPage canView />);
    expect(await screen.findByText('资产管理制度')).toBeInTheDocument();
    // "操作手册" 同时是标题和分类标签，用 getAllByText
    expect(screen.getAllByText('操作手册').length).toBeGreaterThanOrEqual(1);
  });

  it('状态筛选：选草稿只显示草稿文档', async () => {
    render(<SystemDocCenterWorkbenchPage canView />);
    await screen.findByText('资产管理制度');

    await userEvent.selectOptions(screen.getAllByRole('combobox')[0], 'DRAFT');

    expect(screen.queryByText('资产管理制度')).not.toBeInTheDocument();
    expect(screen.getAllByText('操作手册').length).toBeGreaterThanOrEqual(1);
  });

  it('展示只读边界提示', async () => {
    render(<SystemDocCenterWorkbenchPage canView />);
    await screen.findByText('资产管理制度');
    expect(screen.getAllByText(/只读边界/).length).toBeGreaterThanOrEqual(1);
  });

  it('加载失败展示脱敏错误提示', async () => {
    mockedList.mockRejectedValueOnce(new Error('token=raw-secret'));
    render(<SystemDocCenterWorkbenchPage canView />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();
  });

  it('无权限态展示只读拦截', () => {
    render(<SystemDocCenterWorkbenchPage canView={false} />);
    expect(screen.getByText(/无权限访问文档中心/)).toBeInTheDocument();
  });
});
