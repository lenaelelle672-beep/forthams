import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemImportExportWorkbenchPage from '../SystemImportExportWorkbenchPage';
import { listImportExportTasks, getImportExportMeta } from '../../../api/importExport';

vi.mock('../../../api/importExport', () => ({
  listImportExportTasks: vi.fn(),
  getImportExportMeta: vi.fn(),
}));

const mockedList = vi.mocked(listImportExportTasks);
const mockedMeta = vi.mocked(getImportExportMeta);

const tasks = [
  { id: 1, taskType: 'IMPORT', businessObject: 'asset', fileFormat: 'XLSX', status: 'SUCCESS', totalRows: 100, successRows: 100, failedRows: 0, operatorName: '管理员' },
  { id: 2, taskType: 'EXPORT', businessObject: 'asset', fileFormat: 'CSV', status: 'FAILED', totalRows: 50, successRows: 0, failedRows: 50, operatorName: '张三', errorSummary: '分类不存在（已脱敏）' },
];

const meta = { supportedObjects: ['asset'], supportedFormats: ['XLSX'], statuses: ['SUCCESS'], importRowLimit: 5000, exportRowLimit: 50000, readOnlyNotice: '只读 catalog' };

describe('SystemImportExportWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedList.mockResolvedValue({ records: tasks, total: tasks.length });
    mockedMeta.mockResolvedValue(meta);
  });

  it('加载并展示任务历史列表', async () => {
    render(<SystemImportExportWorkbenchPage canView />);
    expect(await screen.findByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getAllByText('导入').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('导出').length).toBeGreaterThanOrEqual(1);
  });

  it('展示只读边界提示与行数上限', async () => {
    render(<SystemImportExportWorkbenchPage canView />);
    await screen.findByText('#1');
    expect(screen.getAllByText(/只读边界/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/5000/).length).toBeGreaterThanOrEqual(1);
  });

  it('类型筛选：选导出只显示导出任务', async () => {
    render(<SystemImportExportWorkbenchPage canView />);
    await screen.findByText('#1');

    await userEvent.selectOptions(screen.getAllByRole('combobox')[0], 'EXPORT');

    expect(screen.queryByText('#1')).not.toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('加载失败展示脱敏错误提示', async () => {
    mockedList.mockRejectedValueOnce(new Error('token=raw-secret'));
    render(<SystemImportExportWorkbenchPage canView />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();
  });

  it('无权限态展示只读拦截', () => {
    render(<SystemImportExportWorkbenchPage canView={false} />);
    expect(screen.getByText(/无权限访问导入导出/)).toBeInTheDocument();
  });
});
