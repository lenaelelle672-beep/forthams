import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemCustomFieldsWorkbenchPage from '../SystemCustomFieldsWorkbenchPage';
import {
  getCustomFieldAll,
  getCustomFieldDetail,
  getCustomFieldList,
  getCustomFieldMeta,
  previewCustomFields,
} from '../../../api/customField';

vi.mock('../../../api/customField', () => ({
  getCustomFieldList: vi.fn(),
  getCustomFieldAll: vi.fn(),
  getCustomFieldDetail: vi.fn(),
  getCustomFieldMeta: vi.fn(),
  previewCustomFields: vi.fn(),
}));

const mockedList = vi.mocked(getCustomFieldList);
const mockedAll = vi.mocked(getCustomFieldAll);
const mockedDetail = vi.mocked(getCustomFieldDetail);
const mockedMeta = vi.mocked(getCustomFieldMeta);
const mockedPreview = vi.mocked(previewCustomFields);

describe('SystemCustomFieldsWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedList.mockResolvedValue({ records: [field()], total: 1, size: 20, current: 1, pages: 1 });
    mockedAll.mockResolvedValue([field(), { ...field(), id: 8, fieldName: 'criticality', fieldLabel: '重要级别', fieldType: 'DROPDOWN', fieldOptions: '["高","中","低"]' }]);
    mockedDetail.mockResolvedValue(field());
    mockedMeta.mockResolvedValue({
      fieldTypes: [{ value: 'DATE', label: '日期' }],
      statuses: [{ value: '1', label: '启用' }],
      previewPolicy: {
        noPersistence: true,
        tenantScoped: true,
        safeDisplay: true,
        encryptedSampleEcho: false,
        regexSafetyBounded: true,
      },
      readOnly: true,
      tenantScoped: true,
      noPersistencePreview: true,
      fieldsetsDeferred: true,
      assetValuesDeferred: true,
      runtimeEffect: false,
      readonlyBoundary: '自定义字段定义只读 catalog + 无持久化校验预览',
      nonGoals: ['不完成字段集', '不写资产字段值'],
    });
    mockedPreview.mockResolvedValue({
      valid: false,
      missing: [{ fieldId: 9, fieldName: 'required_code', fieldLabel: '必填编码', reason: '必填字段未提供样例值' }],
      rejected: [{ fieldId: 8, fieldName: 'criticality', fieldLabel: '重要级别', reason: '不在下拉选项白名单内' }],
      errors: ['重要级别：不在下拉选项白名单内'],
      usedFields: [{ fieldId: 7, fieldName: 'warranty_expiry', fieldLabel: '保修到期', fieldType: 'DATE', required: true, encrypted: false }],
      tenantScoped: true,
      noPersistence: true,
      runtimeEffect: false,
    });
  });

  it('真实调用自定义字段定义 list/all/detail/meta/preview 并展示只读边界', async () => {
    const { container } = render(<SystemCustomFieldsWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('自定义字段定义加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '字段定义 catalog' })).toBeInTheDocument();
    expect(container.querySelector('[data-system-custom-fields="workbench-v3"]')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getByText(/真实调用 \/system\/custom-fields/)).toBeInTheDocument();
    expect(screen.getByText(/只读自定义字段定义目录 \+ 无持久化校验预览/)).toBeInTheDocument();
    expect(screen.getByText(/不代表字段集完成/)).toBeInTheDocument();
    expect(mockedList).toHaveBeenCalledWith(1, 20, undefined);
    expect(mockedAll).toHaveBeenCalled();
    expect(mockedMeta).toHaveBeenCalled();
    expect(mockedDetail).toHaveBeenCalledWith(7);

    await userEvent.click(screen.getByRole('button', { name: '运行无持久化校验预览' }));
    await waitFor(() => expect(mockedPreview).toHaveBeenCalledWith(expect.objectContaining({
      values: expect.objectContaining({ warranty_expiry: '2026-12-31' }),
    })));
    expect(await screen.findByLabelText('自定义字段预览结果')).toHaveTextContent('valid=false');
    expect(screen.getByLabelText('自定义字段预览结果')).toHaveTextContent('missing：必填编码:必填字段未提供样例值');
    expect(screen.getByLabelText('自定义字段预览结果')).toHaveTextContent('rejected：重要级别:不在下拉选项白名单内');
    expect(screen.getByLabelText('自定义字段预览结果')).toHaveTextContent('tenantScoped=true · noPersistence=true · runtimeEffect=false');
  });

  it('支持关键词查询和无权限 fail-closed', async () => {
    render(<SystemCustomFieldsWorkbenchPage />);
    expect((await screen.findAllByText(/保修到期/)).length).toBeGreaterThan(0);

    await userEvent.type(screen.getByPlaceholderText('按字段名或字段标签搜索'), '保修');
    await userEvent.click(screen.getByRole('button', { name: '查询只读目录' }));
    await waitFor(() => expect(mockedList).toHaveBeenLastCalledWith(1, 20, '保修'));

    vi.clearAllMocks();
    render(<SystemCustomFieldsWorkbenchPage canView={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无权限访问自定义字段定义目录');
    expect(mockedList).not.toHaveBeenCalled();
    expect(mockedPreview).not.toHaveBeenCalled();
  });

  function field() {
    return {
      id: 7,
      tenantId: 'tenant-a',
      fieldName: 'warranty_expiry',
      fieldLabel: '保修到期',
      fieldType: 'DATE',
      fieldOptions: '',
      validationPattern: '',
      fieldOrder: 10,
      required: 1,
      encrypted: 0,
      status: 1,
      createdAt: '2026-01-01T00:00:00',
      updatedAt: '2026-01-01T00:00:00',
    };
  }
});
