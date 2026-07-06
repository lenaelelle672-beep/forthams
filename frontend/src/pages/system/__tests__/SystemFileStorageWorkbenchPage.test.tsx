import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemFileStorageWorkbenchPage from '../SystemFileStorageWorkbenchPage';
import { getFileStorageAttachmentCatalog } from '../../../api/fileStorage';

vi.mock('../../../api/fileStorage', () => ({
  getFileStorageAttachmentCatalog: vi.fn(),
}));

const mockedGetCatalog = vi.mocked(getFileStorageAttachmentCatalog);

const readonlyNotice = '当前仅为 /system/file-storage/attachments/catalog 只读元数据目录，不支持上传/下载/预览/删除，不访问文件系统，不代表文件生命周期闭环。';

const emptyCatalog = {
  attachments: [],
  summary: {
    totalAttachmentCount: 0,
    totalFileSize: 0,
    businessTypeCount: 0,
    fileTypeCount: 0,
    currentPageAttachmentCount: 0,
  },
  page: {
    page: 1,
    pageSize: 20,
    totalCount: 0,
    totalPages: 0,
  },
  businessTypes: [],
  fileTypes: [],
  riskTips: [readonlyNotice],
  readonlyNotice,
};

function sampleCatalog() {
  return {
    attachments: [
      {
        id: 1,
        businessType: 'asset',
        businessId: 1001,
        fileName: '资产照片.jpg',
        displayName: '资产照片.jpg',
        fileSize: 2048,
        fileType: 'image/jpeg',
        uploadBy: 9,
        createTime: '2026-07-01T10:00:00',
      },
      {
        id: 2,
        businessType: 'workflow',
        businessId: 2001,
        fileName: '审批单.pdf',
        displayName: '审批单.pdf',
        fileSize: 4096,
        fileType: 'application/pdf',
        uploadBy: 10,
        createTime: '2026-07-02T10:00:00',
      },
    ],
    summary: {
      totalAttachmentCount: 2,
      totalFileSize: 6144,
      businessTypeCount: 2,
      fileTypeCount: 2,
      currentPageAttachmentCount: 2,
    },
    page: {
      page: 1,
      pageSize: 20,
      totalCount: 2,
      totalPages: 1,
    },
    businessTypes: ['asset', 'workflow'],
    fileTypes: ['image/jpeg', 'application/pdf'],
    riskTips: [readonlyNotice, '仅查询 sys_attachment 中 deleted=0 的附件元数据。'],
    readonlyNotice,
  };
}

describe('SystemFileStorageWorkbenchPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('加载并展示附件元数据、统计摘要与只读边界', async () => {
    mockedGetCatalog.mockResolvedValueOnce(sampleCatalog());

    render(<SystemFileStorageWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('附件元数据加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '附件元数据目录' })).toBeInTheDocument();
    expect(screen.getByText('资产照片.jpg')).toBeInTheDocument();
    expect(screen.getByText('审批单.pdf')).toBeInTheDocument();
    expect(screen.getByText('6.0 KB')).toBeInTheDocument();
    expect(screen.getAllByText(readonlyNotice).length).toBeGreaterThan(0);
  });

  it('支持关键词、业务类型、文件类型筛选与重新加载', async () => {
    mockedGetCatalog
      .mockResolvedValueOnce(sampleCatalog())
      .mockResolvedValueOnce({
        ...sampleCatalog(),
        attachments: [sampleCatalog().attachments[1]],
        summary: { ...sampleCatalog().summary, totalAttachmentCount: 1, currentPageAttachmentCount: 1 },
        page: { ...sampleCatalog().page, totalCount: 1 },
      })
      .mockResolvedValueOnce({
        ...sampleCatalog(),
        attachments: [{ ...sampleCatalog().attachments[1], displayName: '刷新后的审批单.pdf', fileName: '刷新后的审批单.pdf' }],
        summary: { ...sampleCatalog().summary, totalAttachmentCount: 1, currentPageAttachmentCount: 1 },
        page: { ...sampleCatalog().page, totalCount: 1 },
      });

    render(<SystemFileStorageWorkbenchPage />);
    expect(await screen.findByText('资产照片.jpg')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('按文件名、业务类型或文件类型搜索'), '  审批  ');
    await userEvent.selectOptions(screen.getByLabelText('业务类型筛选'), 'workflow');
    await userEvent.selectOptions(screen.getByLabelText('文件类型筛选'), 'application/pdf');
    await userEvent.click(screen.getByRole('button', { name: '查询' }));

    await waitFor(() => expect(mockedGetCatalog).toHaveBeenLastCalledWith({
      keyword: '审批',
      businessType: 'workflow',
      fileType: 'application/pdf',
      page: 1,
      pageSize: 20,
    }));
    expect(await screen.findByText('审批单.pdf')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(mockedGetCatalog).toHaveBeenCalledTimes(3));
    expect(await screen.findByText('刷新后的审批单.pdf')).toBeInTheDocument();
  });

  it('空态、错误脱敏态与无权限态可见且无高风险操作按钮', async () => {
    mockedGetCatalog.mockResolvedValueOnce(emptyCatalog).mockRejectedValueOnce(new Error('secret=/tmp/raw'));

    render(<SystemFileStorageWorkbenchPage />);

    expect(await screen.findByText('暂无附件元数据。')).toBeInTheDocument();
    for (const label of ['上传', '下载', '预览', '删除', '导入', '导出', '执行']) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/secret=\/tmp\/raw/)).not.toBeInTheDocument();

    const { container } = render(<SystemFileStorageWorkbenchPage canView={false} />);
    expect(within(container).getByText(/无权限访问文件存储元数据/)).toBeInTheDocument();
  });
});
