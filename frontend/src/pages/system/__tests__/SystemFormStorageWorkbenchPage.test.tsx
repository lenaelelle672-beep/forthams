import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemFormStorageWorkbenchPage from '../SystemFormStorageWorkbenchPage';
import { formStorageApi } from '../../../api/formStorage';

vi.mock('../../../api/formStorage', () => ({
  formStorageApi: {
    listFormStorageRecords: vi.fn(),
    getFormStorageRecord: vi.fn(),
    createFormStorageRecord: vi.fn(),
    updateFormStorageRecord: vi.fn(),
    archiveFormStorageRecord: vi.fn(),
    deleteFormStorageRecord: vi.fn(),
    listFormStorageAttachments: vi.fn(),
    registerFormStorageAttachment: vi.fn(),
    deleteFormStorageAttachment: vi.fn(),
    exportFormStorageRecords: vi.fn(),
  },
}));

const mockedApi = vi.mocked(formStorageApi);

const record = {
  id: 18,
  formKey: 'ASSET_FORM',
  definitionVersion: 1,
  businessKey: 'ASSET_CASE_MASKED',
  status: 'ACTIVE',
  fieldSummary: '字段 2 个，敏感字段 1 个，响应仅含 maskedValue',
  attachmentSummary: '附件引用 1 个，URL/storageKey 已脱敏',
  auditSummary: '创建表单实例，字段值已脱敏响应',
  fieldSummaries: [
    { id: 1, fieldKey: 'assetNo', fieldLabel: '资产编号', valueType: 'text', maskedValue: '已记录8字符', sensitive: false },
    { id: 2, fieldKey: 'ownerPhone', fieldLabel: '联系方式', valueType: 'text', maskedValue: '******', sensitive: true },
  ],
  attachmentSummaries: [
    { id: 7, instanceId: 18, fileName: '验收附件.pdf', contentType: 'application/pdf', fileSize: 2048, referenceKey: 'acceptanceDoc', maskedUrl: 'url 已脱敏(abcdef)', maskedStorageKey: 'storageKey 已脱敏(abcdef)', status: 'ACTIVE', auditSummary: '附件引用已登记' },
  ],
};

describe('SystemFormStorageWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.listFormStorageRecords.mockResolvedValue([record]);
    mockedApi.getFormStorageRecord.mockResolvedValue(record);
    mockedApi.listFormStorageAttachments.mockResolvedValue(record.attachmentSummaries);
    mockedApi.createFormStorageRecord.mockResolvedValue(record);
    mockedApi.updateFormStorageRecord.mockResolvedValue({ ...record, fieldSummary: '字段 2 个，敏感字段 1 个，响应仅含 maskedValue' });
    mockedApi.registerFormStorageAttachment.mockResolvedValue(record.attachmentSummaries[0]);
    mockedApi.archiveFormStorageRecord.mockResolvedValue({ ...record, status: 'ARCHIVED', archiveReason: 'Day4 表单实例归档复核通过' });
    mockedApi.deleteFormStorageRecord.mockResolvedValue({ ...record, status: 'DELETED', deleteReason: 'Day4 表单实例删除留痕复核通过' });
    mockedApi.deleteFormStorageAttachment.mockResolvedValue({ ...record.attachmentSummaries[0], status: 'DELETED' });
    mockedApi.exportFormStorageRecords.mockResolvedValue({
      exportId: 'form-storage-export-1',
      exportedAt: '2026-07-07T00:00:00',
      querySummary: { tenantScoped: true },
      records: [record],
      maskedFields: record.fieldSummaries,
      maskedAttachments: record.attachmentSummaries,
      total: 1,
    });
  });

  it('加载并展示实例列表、字段脱敏摘要与附件脱敏摘要', async () => {
    render(<SystemFormStorageWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('表单存储加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '表单存储' })).toBeInTheDocument();
    expect(screen.getByText('ASSET_FORM · v1')).toBeInTheDocument();
    expect(screen.getByText('联系方式：******')).toBeInTheDocument();
    expect(screen.getByText(/url 已脱敏/)).toBeInTheDocument();
    expect(screen.queryByText(/13800138000|secret-storage-key|token=|https:\/\//)).not.toBeInTheDocument();
  });

  it('支持空态、错误脱敏态与无权限态', async () => {
    mockedApi.listFormStorageRecords.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('token=raw-secret'));

    render(<SystemFormStorageWorkbenchPage />);

    expect(await screen.findByText('暂无表单实例，可通过创建示例实例验证 /form-storage 最小闭环。')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('错误详情已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();

    const { container } = render(<SystemFormStorageWorkbenchPage canView={false} />);
    expect(within(container).getByText(/无权限访问表单存储/)).toBeInTheDocument();
  });

  it('调用 wrapper 完成创建、更新、附件登记、归档、删除留痕和导出脱敏', async () => {
    render(<SystemFormStorageWorkbenchPage />);
    await screen.findByText('ASSET_FORM · v1');

    await userEvent.click(screen.getByRole('button', { name: '创建示例实例' }));
    await waitFor(() => expect(mockedApi.createFormStorageRecord).toHaveBeenCalledWith(expect.objectContaining({ formKey: 'ASSET_FORM', definitionVersion: 1 })));

    await userEvent.click(screen.getByRole('button', { name: '更新字段摘要' }));
    await waitFor(() => expect(mockedApi.updateFormStorageRecord).toHaveBeenCalledWith(18, expect.objectContaining({ formKey: 'ASSET_FORM' })));

    await userEvent.click(screen.getByRole('button', { name: '登记附件引用' }));
    await waitFor(() => expect(mockedApi.registerFormStorageAttachment).toHaveBeenCalledWith(18, expect.objectContaining({ fileName: '复核附件.pdf' })));

    await userEvent.click(screen.getByRole('button', { name: '归档实例' }));
    await waitFor(() => expect(mockedApi.archiveFormStorageRecord).toHaveBeenCalledWith(18, expect.objectContaining({ confirmed: true, reason: 'Day4 表单实例归档复核通过', auditEvidence: 'FORM_STORAGE_ARCHIVE_GATE' })));

    await userEvent.click(screen.getByRole('button', { name: '删除留痕' }));
    await waitFor(() => expect(mockedApi.deleteFormStorageRecord).toHaveBeenCalledWith(18, expect.objectContaining({ confirmed: true, reason: 'Day4 表单实例删除留痕复核通过' })));

    await userEvent.click(screen.getByRole('button', { name: '删除附件引用' }));
    await waitFor(() => expect(mockedApi.deleteFormStorageAttachment).toHaveBeenCalledWith(18, 7, expect.objectContaining({ confirmed: true, auditEvidence: 'FORM_ATTACHMENT_DELETE_GATE' })));

    await userEvent.click(screen.getByRole('button', { name: '导出脱敏快照' }));
    await waitFor(() => expect(mockedApi.exportFormStorageRecords).toHaveBeenCalledWith(expect.objectContaining({ confirmed: true, reason: '导出脱敏快照复核通过', auditEvidence: 'FORM_STORAGE_EXPORT_GATE' })));
    expect(await screen.findByText(/记录 1 条，字段 2 个，附件 1 个/)).toBeInTheDocument();
  });
});
