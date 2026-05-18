import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssetTransferForm } from '../../src/app/pages/AssetTransferForm';
import { AssetClearanceForm } from '../../src/app/pages/AssetClearanceForm';
import { AssetScrapForm } from '../../src/app/pages/AssetScrapForm';
import { AssetCompensationForm } from '../../src/app/pages/AssetCompensationForm';
import { approvalService } from '../../src/app/services/approvalService';
import { assetService } from '../../src/app/services/assetService';
import { deptService } from '../../src/app/services/deptService';
import { userService } from '../../src/app/services/userService';
import { toast } from 'sonner';

const navigate = vi.fn();

vi.mock('react-router', () => ({
  useNavigate: () => navigate,
}));

vi.mock('../../src/app/services/approvalService', () => ({
  approvalService: {
    create: vi.fn(),
  },
}));

vi.mock('../../src/app/services/assetService', () => ({
  assetService: {
    list: vi.fn(),
    getById: vi.fn(),
  },
}));

vi.mock('../../src/app/services/deptService', () => ({
  deptService: {
    getAll: vi.fn(),
  },
}));

vi.mock('../../src/app/services/userService', () => ({
  userService: {
    list: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const transferAsset = {
  id: 1001,
  assetName: '研发示波器',
  departmentName: '研发部',
  departmentId: 2001,
  locationName: '南山实验室',
  custodianName: '张三',
};

function input(container: HTMLElement, name: string) {
  const element = container.querySelector(`[name="${name}"]`);
  if (!element) {
    throw new Error(`Missing input ${name}`);
  }
  return element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
}

async function submitApprovalForm(container: HTMLElement) {
  fireEvent.click(screen.getByRole('button', { name: /提交审批/ }));
  await waitFor(() => expect(approvalService.create).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/approval'));
  const payload = vi.mocked(approvalService.create).mock.calls[0][0];
  expect(payload.businessData).toEqual(expect.any(String));
  return {
    approvalPayload: payload,
    businessData: JSON.parse(String(payload.businessData)) as Record<string, unknown>,
  };
}

describe('workflow business forms', () => {
  beforeEach(() => {
    vi.mocked(approvalService.create).mockReset();
    vi.mocked(approvalService.create).mockResolvedValue({ id: 1 });
    vi.mocked(assetService.list).mockReset();
    vi.mocked(assetService.list).mockResolvedValue({
      records: [transferAsset],
      total: 1,
      size: 50,
      current: 1,
      pages: 1,
    });
    vi.mocked(assetService.getById).mockReset();
    vi.mocked(assetService.getById).mockResolvedValue(transferAsset);
    vi.mocked(userService.list).mockReset();
    vi.mocked(userService.list).mockResolvedValue({
      records: [
        { id: 42, realName: '李四', deptId: 3001 },
        { id: 43, realName: '王五', deptId: 3002 },
      ],
      total: 2,
      size: 100,
      current: 1,
      pages: 1,
    });
    vi.mocked(deptService.getAll).mockReset();
    vi.mocked(deptService.getAll).mockResolvedValue([
      { id: 3001, dept_name: '市场部' },
      { id: 3002, dept_name: '财务部' },
    ]);
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    navigate.mockReset();
    window.localStorage.clear();
  });

  it('submits asset transfer as an approval process with complete business data', async () => {
    const { container } = render(<AssetTransferForm />);
    await waitFor(() => expect(assetService.list).toHaveBeenCalledWith({ page: 1, pageSize: 50 }));

    fireEvent.change(screen.getByTestId('asset-select'), { target: { value: '1001' } });

    await waitFor(() => expect(input(container, 'assetName')).toHaveValue('研发示波器'));
    expect(input(container, 'transferDeptCode')).toHaveValue('2001');
    expect(input(container, 'transferDept')).toHaveValue('研发部');
    expect(input(container, 'transferArea')).toHaveValue('南山实验室');

    fireEvent.change(input(container, 'receiveDeptCode'), { target: { value: '3001' } });
    fireEvent.change(input(container, 'receiver'), { target: { value: '42' } });
    fireEvent.change(input(container, 'receiveDept'), { target: { value: '市场部' } });
    fireEvent.change(input(container, 'receiveArea'), { target: { value: '张江园区' } });
    fireEvent.change(input(container, 'transferReason'), { target: { value: '资产调拨' } });

    const { approvalPayload, businessData } = await submitApprovalForm(container);

    expect(approvalPayload).toMatchObject({
      processType: 'ASSET_TRANSFER',
      businessType: 'ASSET_TRANSFER',
      businessId: 1001,
      description: expect.stringContaining('资产调拨'),
    });
    expect(businessData).toMatchObject({
      processId: expect.stringContaining('TRF-'),
      assetId: 1001,
      assetIds: '1001',
      assetName: '研发示波器',
      transferDeptCode: '2001',
      transferDept: '研发部',
      receiveDeptCode: '3001',
      receiveDept: '市场部',
      targetDeptId: 3001,
      targetUserId: 42,
      targetLocation: '张江园区',
      reason: '资产调拨',
      transferReason: '资产调拨',
    });
    expect(toast.success).toHaveBeenCalledWith('资产转移申请已提交');
  });

  it('fills asset transfer fields by asset ID blur and submits numeric DTO payload', async () => {
    vi.mocked(assetService.getById).mockResolvedValueOnce({
      id: 1005,
      name: '机房服务器',
      deptName: '运维部',
      deptId: 4001,
      location: '数据中心 A 区',
    });

    const { container } = render(<AssetTransferForm />);
    fireEvent.change(input(container, 'assetIds'), { target: { value: '1005' } });
    fireEvent.blur(input(container, 'assetIds'));

    await waitFor(() => expect(assetService.getById).toHaveBeenCalledWith('1005'));
    await waitFor(() => expect(input(container, 'assetName')).toHaveValue('机房服务器'));
    expect(input(container, 'transferDeptCode')).toHaveValue('4001');
    expect(input(container, 'transferDept')).toHaveValue('运维部');
    expect(input(container, 'transferArea')).toHaveValue('数据中心 A 区');

    fireEvent.change(input(container, 'receiveDeptCode'), { target: { value: '3002' } });
    fireEvent.change(input(container, 'receiver'), { target: { value: '43' } });
    fireEvent.change(input(container, 'receiveArea'), { target: { value: '总部 12 楼' } });
    fireEvent.change(input(container, 'transferReason'), { target: { value: '机房资产调拨' } });

    const { businessData } = await submitApprovalForm(container);

    expect(businessData).toMatchObject({
      assetId: 1005,
      assetIds: '1005',
      assetName: '机房服务器',
      transferDeptCode: '4001',
      transferDept: '运维部',
      targetDeptId: 3002,
      targetUserId: 43,
      targetLocation: '总部 12 楼',
      reason: '机房资产调拨',
      transferReason: '机房资产调拨',
    });
  });

  it('selects receiver and carries out the receiver department automatically', async () => {
    const { container } = render(<AssetTransferForm />);
    await waitFor(() => expect(userService.list).toHaveBeenCalledWith({ page: 1, pageSize: 100 }));
    await waitFor(() => expect(deptService.getAll).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByTestId('receiver-select'), { target: { value: '42' } });

    expect(input(container, 'receiver')).toHaveValue('42');
    expect(input(container, 'receiveDeptCode')).toHaveValue('3001');
    expect(input(container, 'receiveDept')).toHaveValue('市场部');
  });

  it('saves and restores asset transfer drafts from local storage', async () => {
    const firstRender = render(<AssetTransferForm />);
    fireEvent.change(input(firstRender.container, 'assetIds'), { target: { value: '1001' } });
    fireEvent.change(input(firstRender.container, 'receiver'), { target: { value: '42' } });
    fireEvent.change(input(firstRender.container, 'receiveDeptCode'), { target: { value: '3001' } });
    fireEvent.change(input(firstRender.container, 'receiveDept'), { target: { value: '市场部' } });
    fireEvent.change(input(firstRender.container, 'transferReason'), { target: { value: '待补充附件后提交' } });

    fireEvent.click(screen.getByRole('button', { name: /保存草稿/ }));
    expect(toast.success).toHaveBeenCalledWith('草稿保存成功');
    firstRender.unmount();

    const secondRender = render(<AssetTransferForm />);
    fireEvent.click(await screen.findByTestId('draft-restore-btn'));

    expect(input(secondRender.container, 'assetIds')).toHaveValue('1001');
    expect(input(secondRender.container, 'receiver')).toHaveValue('42');
    expect(input(secondRender.container, 'receiveDeptCode')).toHaveValue('3001');
    expect(input(secondRender.container, 'transferReason')).toHaveValue('待补充附件后提交');
  });

  it('keeps manual asset transfer submission available when asset lookup fails', async () => {
    vi.mocked(assetService.getById).mockRejectedValueOnce(new Error('not found'));

    const { container } = render(<AssetTransferForm />);
    fireEvent.change(input(container, 'assetIds'), { target: { value: '1006' } });
    fireEvent.blur(input(container, 'assetIds'));

    await waitFor(() => expect(assetService.getById).toHaveBeenCalledWith('1006'));
    expect(await screen.findByTestId('asset-lookup-message')).toHaveTextContent('可继续手工填写后提交');

    fireEvent.change(input(container, 'receiveDeptCode'), { target: { value: '3003' } });
    fireEvent.change(input(container, 'receiver'), { target: { value: '44' } });
    fireEvent.change(input(container, 'receiveArea'), { target: { value: '临港园区' } });
    fireEvent.change(input(container, 'transferReason'), { target: { value: '手工录入资产转移' } });

    const { businessData } = await submitApprovalForm(container);

    expect(businessData).toMatchObject({
      assetId: 1006,
      assetIds: '1006',
      targetDeptId: 3003,
      targetUserId: 44,
      targetLocation: '临港园区',
      reason: '手工录入资产转移',
      transferReason: '手工录入资产转移',
    });
  });

  it('submits asset clearance as an approval process with clearance payload', async () => {
    const { container } = render(<AssetClearanceForm />);
    const clearanceReason = '资产状态良好，已发布闲置公告满三个月';
    fireEvent.change(input(container, 'assetId'), { target: { value: '1002' } });
    fireEvent.change(input(container, 'assetName'), { target: { value: '闲置笔记本' } });
    fireEvent.change(input(container, 'idleAssetType'), { target: { value: '便携机' } });
    fireEvent.change(input(container, 'clearanceReason'), { target: { value: clearanceReason } });
    fireEvent.change(input(container, 'storageLocation'), { target: { value: 'A 库房' } });

    const { approvalPayload, businessData } = await submitApprovalForm(container);

    expect(approvalPayload).toMatchObject({
      processType: 'ASSET_CLEARANCE',
      businessType: 'ASSET_CLEARANCE',
      businessId: 1002,
      description: clearanceReason,
    });
    expect(businessData).toMatchObject({
      assetId: 1002,
      assetName: '闲置笔记本',
      idleAssetType: '便携机',
      clearanceReason,
      storageLocation: 'A 库房',
      reason: clearanceReason,
    });
  });

  it('loads asset clearance assets from ledger and fills selected asset details', async () => {
    const { container } = render(<AssetClearanceForm />);
    const clearanceReason = '闲置资产性能不佳，尚有利用价值，集中清退库房后期利用（一般为IT建议）';

    fireEvent.click(screen.getByTestId('clearance-load-assets-btn'));
    await waitFor(() => expect(assetService.list).toHaveBeenCalledWith({ page: 1, pageSize: 50 }));

    fireEvent.change(screen.getByTestId('clearance-asset-select'), { target: { value: '1001' } });

    expect(input(container, 'assetId')).toHaveValue('1001');
    expect(input(container, 'assetName')).toHaveValue('研发示波器');
    expect(input(container, 'deptCode')).toHaveValue('2001');
    expect(input(container, 'department')).toHaveValue('研发部');
    expect(input(container, 'storageLocation')).toHaveValue('南山实验室');
    expect(input(container, 'user')).toHaveValue('张三');

    fireEvent.change(input(container, 'idleAssetType'), { target: { value: '机器设备' } });
    fireEvent.change(input(container, 'clearanceReason'), { target: { value: clearanceReason } });

    const { businessData } = await submitApprovalForm(container);

    expect(businessData).toMatchObject({
      assetId: 1001,
      assetName: '研发示波器',
      deptCode: '2001',
      department: '研发部',
      storageLocation: '南山实验室',
      user: '张三',
      idleAssetType: '机器设备',
      clearanceReason,
      reason: clearanceReason,
    });
  });

  it('submits asset scrap as an approval process with scrap payload', async () => {
    const { container } = render(<AssetScrapForm />);
    fireEvent.change(input(container, 'assetId'), { target: { value: '1003' } });
    fireEvent.change(input(container, 'assetName'), { target: { value: '老旧台式机' } });
    fireEvent.change(input(container, 'scrapReason'), { target: { value: '设备报废' } });

    const { approvalPayload, businessData } = await submitApprovalForm(container);

    expect(approvalPayload).toMatchObject({
      processType: 'ASSET_SCRAP',
      businessType: 'ASSET_SCRAP',
      businessId: 1003,
      description: '设备报废',
    });
    expect(businessData).toMatchObject({
      assetId: 1003,
      assetName: '老旧台式机',
      scrapReason: '设备报废',
      reason: '设备报废',
    });
  });

  it('submits asset compensation as an approval process with compensation payload', async () => {
    const { container } = render(<AssetCompensationForm />);
    fireEvent.change(input(container, 'assetId'), { target: { value: '1004' } });
    fireEvent.change(input(container, 'userPhone'), { target: { value: '13800000000' } });
    fireEvent.change(input(container, 'lossLocation'), { target: { value: '办公区' } });
    fireEvent.change(input(container, 'responsibleId'), { target: { value: '77' } });
    fireEvent.change(input(container, 'responsibleName'), { target: { value: '责任人' } });
    fireEvent.change(input(container, 'lossDescription'), { target: { value: '资产遗失赔偿' } });
    fireEvent.change(input(container, 'lossDate'), { target: { value: '2026-05-14' } });
    fireEvent.change(input(container, 'operatorName'), { target: { value: '经办人' } });
    fireEvent.change(input(container, 'operatorPhone'), { target: { value: '13900000000' } });

    const { approvalPayload, businessData } = await submitApprovalForm(container);

    expect(approvalPayload).toMatchObject({
      processType: 'ASSET_COMPENSATION',
      businessType: 'ASSET_COMPENSATION',
      businessId: 1004,
      description: '资产遗失赔偿',
    });
    expect(businessData).toMatchObject({
      assetId: 1004,
      userPhone: '13800000000',
      lossLocation: '办公区',
      responsibleId: '77',
      responsibleName: '责任人',
      lossDescription: '资产遗失赔偿',
      lossDate: '2026-05-14',
      operatorName: '经办人',
      operatorPhone: '13900000000',
      responsibleUserId: 77,
      compensationType: 'ASSET_LOSS',
      description: '资产遗失赔偿',
      incidentDate: '2026-05-14',
    });
  });
});
