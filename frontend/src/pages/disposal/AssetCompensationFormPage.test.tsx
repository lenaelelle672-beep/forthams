import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import AssetCompensationFormPage, {
  buildCompensationDescription,
} from './AssetCompensationFormPage';

const apiMocks = vi.hoisted(() => ({
  getAssetList: vi.fn(),
  getDeptList: vi.fn(),
}));
const httpMocks = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('@/api/asset', () => ({ getAssetList: apiMocks.getAssetList }));
vi.mock('@/api/base', () => ({ getDeptList: apiMocks.getDeptList }));
vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: httpMocks.post,
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/components/ui/Select', () => ({
  Select: ({
    value,
    onValueChange,
    label,
    error,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    label?: string;
    error?: string;
    children: React.ReactNode;
  }) => (
    <label>
      {label}
      <select value={value} onChange={(event) => onValueChange?.(event.target.value)}>{children}</select>
      {error && <span>{error}</span>}
    </label>
  ),
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

const compensation = {
  id: 11,
  compensationNo: 'CMP-20260609-001',
  assetId: 1,
  compensationType: 'cash',
  compensationAmount: 100,
  description: '赔偿事由',
  responsibleUserId: 6,
  responsibleDeptId: 2,
  status: 'PENDING',
  createTime: '2026-06-09T10:00:00',
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AssetCompensationFormPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText('请详细描述资产损坏情况、发生经过及损失范围...'), {
    target: { value: '设备因意外损坏需要赔偿' },
  });
  fireEvent.change(screen.getByLabelText('损坏日期'), { target: { value: '2026-06-09' } });
  fireEvent.change(screen.getByPlaceholderText('输入责任人 ID'), { target: { value: '6' } });
  fireEvent.change(screen.getByLabelText('责任部门'), { target: { value: '2' } });
}

describe('AssetCompensationFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getAssetList.mockResolvedValue({
      records: [
        { id: 1, assetNo: 'AST-001', assetName: '资产 A', categoryName: '办公设备', originalValue: 1000 },
        { id: 2, assetNo: 'AST-002', assetName: '资产 B', categoryName: '办公设备', originalValue: 2000 },
      ],
      total: 2,
      size: 200,
      current: 1,
    });
    apiMocks.getDeptList.mockResolvedValue([{ id: 2, deptName: '研发部' }]);
  });

  it('validates each selected asset amount before calling the compensation API', async () => {
    renderPage();
    await screen.findByText('资产 A');
    await fillRequiredFields();

    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: '提交申请' }));

    expect(await screen.findByText('该资产的赔偿金额必须大于 0')).toBeTruthy();
    expect(httpMocks.post).not.toHaveBeenCalled();
  });

  it('shows the backend-compatible decimal precision error on each invalid selected asset', async () => {
    renderPage();
    await screen.findByText('资产 A');
    await fillRequiredFields();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
    fireEvent.change(screen.getByLabelText('资产 A赔偿金额'), { target: { value: '100000000' } });
    fireEvent.change(screen.getByLabelText('资产 B赔偿金额'), { target: { value: '0.001' } });
    fireEvent.click(screen.getByRole('button', { name: '提交申请' }));

    expect(await screen.findAllByText('该资产的赔偿金额最多 8 位整数和 2 位小数')).toHaveLength(2);
    expect(httpMocks.post).not.toHaveBeenCalled();
  });

  it('blocks an overlong composed compensation reason before calling the API', async () => {
    renderPage();
    await screen.findByText('资产 A');
    await fillRequiredFields();

    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.change(screen.getByLabelText('资产 A赔偿金额'), { target: { value: '100' } });
    fireEvent.change(screen.getByPlaceholderText('请详细描述资产损坏情况、发生经过及损失范围...'), {
      target: { value: 'a'.repeat(490) },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交申请' }));

    expect(await screen.findByText('赔偿事由及附加信息不能超过 500 个字符')).toBeTruthy();
    expect(httpMocks.post).not.toHaveBeenCalled();
  });

  it('retains successful results and only leaves failed assets selected for retry', async () => {
    httpMocks.post
      .mockResolvedValueOnce(compensation)
      .mockRejectedValueOnce(new Error('资产已进入其他流程'));
    renderPage();
    await screen.findByText('资产 A');
    await fillRequiredFields();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
    fireEvent.change(screen.getByLabelText('资产 A赔偿金额'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('资产 B赔偿金额'), { target: { value: '200' } });
    await waitFor(() => {
      expect(checkboxes[1]).toBeChecked();
      expect(checkboxes[2]).toBeChecked();
      expect(screen.getByLabelText('资产 A赔偿金额')).toHaveValue(100);
      expect(screen.getByLabelText('资产 B赔偿金额')).toHaveValue(200);
    });
    fireEvent.click(screen.getByRole('button', { name: '提交申请' }));

    await waitFor(() => {
      expect(httpMocks.post).toHaveBeenNthCalledWith(1, '/compensation', expect.objectContaining({
        assetId: 1,
        compensationAmount: 100,
      }));
      expect(httpMocks.post).toHaveBeenNthCalledWith(2, '/compensation', expect.objectContaining({
        assetId: 2,
        compensationAmount: 200,
      }));
    });
    expect(await screen.findByText('已成功提交的赔偿申请')).toBeTruthy();
    expect(screen.getByText('资产 1：CMP-20260609-001')).toBeTruthy();
    expect(screen.getByText('资产 2：资产已进入其他流程')).toBeTruthy();
    expect(checkboxes[1]).not.toBeChecked();
    expect(checkboxes[2]).toBeChecked();
  });

  it('builds the description from all submitted text and preserves the 500-character boundary', () => {
    const description = buildCompensationDescription({
      damageType: 'human',
      damageDesc: '资产损坏赔偿',
      discoverer: '张三',
      insured: 'no',
      remark: '现场已核验',
    });

    expect(description).toBe('损坏类型：human；赔偿事由：资产损坏赔偿；发现人：张三；是否报险：否；备注：现场已核验');
    expect(buildCompensationDescription({
      damageType: 'human',
      damageDesc: 'a'.repeat(490),
      insured: 'no',
    }).length).toBeGreaterThan(500);
  });
});
