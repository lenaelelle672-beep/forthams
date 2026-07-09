import { readFileSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemCustomFieldSetsWorkbenchPage from '../SystemCustomFieldSetsWorkbenchPage';
import {
  getCustomFieldsetAll,
  getCustomFieldsetDetail,
  getCustomFieldsetList,
  getCustomFieldsetMeta,
  getFieldsetByCategory,
  getFieldsetFields,
  previewCustomFieldsets,
} from '../../../api/customField';

vi.mock('../../../api/customField', () => ({
  getCustomFieldsetList: vi.fn(),
  getCustomFieldsetAll: vi.fn(),
  getCustomFieldsetDetail: vi.fn(),
  getFieldsetFields: vi.fn(),
  getFieldsetByCategory: vi.fn(),
  getCustomFieldsetMeta: vi.fn(),
  previewCustomFieldsets: vi.fn(),
}));

const mockedList = vi.mocked(getCustomFieldsetList);
const mockedAll = vi.mocked(getCustomFieldsetAll);
const mockedDetail = vi.mocked(getCustomFieldsetDetail);
const mockedFields = vi.mocked(getFieldsetFields);
const mockedByCategory = vi.mocked(getFieldsetByCategory);
const mockedMeta = vi.mocked(getCustomFieldsetMeta);
const mockedPreview = vi.mocked(previewCustomFieldsets);

const pageSource = readFileSync('src/pages/system/SystemCustomFieldSetsWorkbenchPage.tsx', 'utf8');

describe('SystemCustomFieldSetsWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedList.mockResolvedValue({ records: [fieldset()], total: 1, size: 20, current: 1, pages: 1 });
    mockedAll.mockResolvedValue([fieldset(), { ...fieldset(), id: 4, name: '办公设备字段集', categoryId: 13, fieldCount: 1 }]);
    mockedDetail.mockResolvedValue(fieldset());
    mockedFields.mockResolvedValue([field()]);
    mockedByCategory.mockResolvedValue(fieldset());
    mockedMeta.mockResolvedValue({
      statuses: [{ value: '1', label: '启用' }],
      previewPolicy: {
        tenantScoped: true,
        noPersistence: true,
        runtimeEffect: false,
        validatesFieldIds: true,
        validatesCategoryId: true,
      },
      allowedRoutes: [],
      readOnly: true,
      tenantScoped: true,
      noPersistencePreview: true,
      runtimeEffect: false,
      categoryBindingDeferred: true,
      assignmentMutationDeferred: true,
      readonlyBoundary: '字段集只读 catalog + 无持久化预览',
      nonGoals: ['不保存字段分配', '不保存分类绑定'],
    });
    mockedPreview.mockResolvedValue({
      valid: false,
      missingFields: [{ fieldId: 404, fieldLabel: '404', reason: '字段不存在或不属于当前租户' }],
      rejectedFields: [{ fieldId: 8, fieldLabel: '8', reason: '字段 ID 重复，预览已去重' }],
      usedFields: [{ fieldId: 7, fieldName: 'warranty_expiry', fieldLabel: '保修到期', fieldType: 'DATE', required: true, encrypted: false }],
      wouldBindCategory: true,
      tenantScoped: true,
      noPersistence: true,
      runtimeEffect: false,
      errors: ['字段 404：字段不存在或不属于当前租户'],
    });
  });

  it('真实调用字段集 list/all/detail/fields/by-category/meta/preview 并展示只读边界', async () => {
    const { container } = render(<SystemCustomFieldSetsWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('字段集只读目录加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '字段集 catalog' })).toBeInTheDocument();
    expect(container.querySelector('[data-system-custom-field-sets="workbench-v3"]')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getByText(/真实调用 \/system\/custom-fieldsets/)).toBeInTheDocument();
    expect(screen.getByText(/只读字段集目录 \+ 无持久化字段分配\/分类绑定预览/)).toBeInTheDocument();
    expect(screen.getByText(/基础资料组未全组完成/)).toBeInTheDocument();
    expect(screen.getByText(/未覆盖全部 44 项/)).toBeInTheDocument();
    expect(mockedList).toHaveBeenCalledWith(1, 20, undefined);
    expect(mockedAll).toHaveBeenCalled();
    expect(mockedMeta).toHaveBeenCalled();
    expect(mockedDetail).toHaveBeenCalledWith(3);
    expect(mockedFields).toHaveBeenCalledWith(3);
    expect(mockedByCategory).toHaveBeenCalledWith(12);

    await userEvent.click(screen.getByRole('button', { name: '运行无持久化字段集预览' }));
    await waitFor(() => expect(mockedPreview).toHaveBeenCalledWith({
      fieldsetId: 3,
      fieldIds: [7, 8],
      categoryId: 12,
    }));
    expect(await screen.findByLabelText('字段集预览结果')).toHaveTextContent('valid=false · wouldBindCategory=true');
    expect(screen.getByLabelText('字段集预览结果')).toHaveTextContent('missingFields：404:字段不存在或不属于当前租户');
    expect(screen.getByLabelText('字段集预览结果')).toHaveTextContent('tenantScoped=true · noPersistence=true · runtimeEffect=false');
  });

  it('支持关键词查询、分类诊断和无权限 fail-closed', async () => {
    render(<SystemCustomFieldSetsWorkbenchPage />);
    expect((await screen.findAllByText(/IT 设备字段集/)).length).toBeGreaterThan(0);

    await userEvent.type(screen.getByPlaceholderText('按字段集名称或描述搜索'), 'IT');
    await userEvent.click(screen.getByRole('button', { name: '查询只读字段集' }));
    await waitFor(() => expect(mockedList).toHaveBeenLastCalledWith(1, 20, 'IT'));

    await userEvent.clear(screen.getByLabelText('分类 ID 只读诊断'));
    await userEvent.type(screen.getByLabelText('分类 ID 只读诊断'), '13');
    await userEvent.click(screen.getByRole('button', { name: '查询分类字段集' }));
    await waitFor(() => expect(mockedByCategory).toHaveBeenLastCalledWith(13));

    vi.clearAllMocks();
    render(<SystemCustomFieldSetsWorkbenchPage canView={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无权限访问字段集只读目录');
    expect(mockedList).not.toHaveBeenCalled();
    expect(mockedPreview).not.toHaveBeenCalled();
  });

  it('静态证明 V3 页面未调用字段集写入、资产字段值或受保护 API helper', () => {
    for (const forbidden of [
      'createCustomFieldset',
      'updateCustomFieldset',
      'deleteCustomFieldset',
      'assignFieldsToFieldset',
      'assignFieldsetToCategory',
      'getAssetCustomFields',
      'saveAssetCustomFields',
      'createCustomField',
      'updateCustomField',
      'deleteCustomField',
      'routePermissions',
      'auth/login/mobile',
      '../api/workflow',
    ]) {
      expect(pageSource).not.toContain(forbidden);
    }
  });

  function fieldset() {
    return {
      id: 3,
      tenantId: 'tenant-a',
      name: 'IT 设备字段集',
      description: 'IT 设备扩展字段',
      categoryId: 12,
      sortOrder: 10,
      fieldCount: 2,
      status: 1,
      createTime: '2026-01-01T00:00:00',
      updateTime: '2026-01-01T00:00:00',
    };
  }

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
