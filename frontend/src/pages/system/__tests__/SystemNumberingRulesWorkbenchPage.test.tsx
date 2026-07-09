import { readFileSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemNumberingRulesWorkbenchPage from '../SystemNumberingRulesWorkbenchPage';
import { numberingRulesApi } from '../../../api/numberingRules';

vi.mock('../../../api/numberingRules', () => ({
  numberingRulesApi: {
    list: vi.fn(),
    detail: vi.fn(),
    meta: vi.fn(),
    preview: vi.fn(),
  },
}));

const mockedApi = vi.mocked(numberingRulesApi);
const pageSource = readFileSync('src/pages/system/SystemNumberingRulesWorkbenchPage.tsx', 'utf8');

describe('SystemNumberingRulesWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.list.mockResolvedValue([ruleRecord()]);
    mockedApi.detail.mockResolvedValue(ruleRecord());
    mockedApi.meta.mockResolvedValue({
      defaultRules: [ruleRecord()],
      allowedVariables: [{ value: '{SEQ}', label: '样例序号' }, { value: '{YYYYMMDD}', label: '年月日' }],
      previewPolicy: { deterministic: true, noPersistence: true, noSequenceReserved: true, runtimeEffect: false, cacheRefreshed: false, sequenceAllocated: false, persistent: false, readonlyBoundary: '只读编号规则目录', rejectedInputFields: ['tenantId'] },
      tenantScoped: true,
      readOnly: true,
      noPersistencePreview: true,
      noSequenceReserved: true,
      runtimeEffect: false,
      cacheRefreshed: false,
      sequenceAllocated: false,
      persistent: false,
      authority: 'system_config:numbering.rule.*',
      readonlyBoundary: '只读编号规则目录',
      nonGoals: ['不分配或预留序列号', '不保证并发唯一', '不接入资产/工单/流程创建链路', '不完成基础资料组或 44 项全量覆盖'],
    });
    mockedApi.preview.mockResolvedValue({
      ruleKey: 'numbering.rule.asset',
      template: 'AUTO-{YYYYMMDD}-{SEQ}',
      previewValue: 'AUTO-20260708-009',
      usedVariables: ['{YYYYMMDD}', '{SEQ}'],
      missingVariables: [],
      rejectedVariables: [],
      authority: 'system_config:numbering.rule.*',
      warnings: ['不预留序号'],
      tenantScoped: true,
      noPersistence: true,
      noSequenceReserved: true,
      runtimeEffect: false,
      cacheRefreshed: false,
      sequenceAllocated: false,
      persistent: false,
      readonlyBoundary: '只读编号规则目录',
    });
  });

  it('真实调用 list、detail、meta 与 preview，并展示编号边界', async () => {
    const { container } = render(<SystemNumberingRulesWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('编号规则只读目录加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '编号规则 catalog' })).toBeInTheDocument();
    expect(container.querySelector('[data-system-numbering-rules="workbench-v3"]')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getByText(/真实调用 \/numbering-rules/)).toBeInTheDocument();
    expect(screen.getByText(/不会持久化、不刷新缓存、不预留或占用序号/)).toBeInTheDocument();
    expect(screen.getByText(/当前不保证并发唯一/)).toBeInTheDocument();
    expect(screen.getByText(/未接入资产\/工单\/流程创建链路/)).toBeInTheDocument();
    expect(screen.getByText(/不代表基础资料组完成/)).toBeInTheDocument();
    expect(screen.getByText(/不代表 44\/44 或 Workbench V3 全量完成/)).toBeInTheDocument();
    expect(mockedApi.list).toHaveBeenCalled();
    expect(mockedApi.meta).toHaveBeenCalled();
    await waitFor(() => expect(mockedApi.detail).toHaveBeenCalledWith('numbering.rule.asset'));

    await userEvent.click(screen.getByRole('button', { name: '运行无持久化编号预览' }));
    await waitFor(() => expect(mockedApi.preview).toHaveBeenCalledWith(expect.objectContaining({ ruleKey: 'numbering.rule.asset', template: 'AUTO-{YYYYMMDD}-{SEQ}', sampleAt: '2026-07-08T09:10:11', sampleSequence: '009' })));
    expect(await screen.findByLabelText('编号规则预览结果')).toHaveTextContent('previewValue=AUTO-20260708-009');
    expect(screen.getByLabelText('编号规则预览结果')).toHaveTextContent('noPersistence=true · noSequenceReserved=true · runtimeEffect=false · cacheRefreshed=false · sequenceAllocated=false · persistent=false');
  });

  it('支持详情读取、预览输入和无权限 fail-closed', async () => {
    render(<SystemNumberingRulesWorkbenchPage />);
    expect(await screen.findByText(/资产编号规则/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '读取规则详情' }));
    await waitFor(() => expect(mockedApi.detail).toHaveBeenLastCalledWith('numbering.rule.asset'));

    await userEvent.clear(screen.getByLabelText('样例序号'));
    await userEvent.type(screen.getByLabelText('样例序号'), '010');
    await userEvent.click(screen.getByRole('button', { name: '运行无持久化编号预览' }));
    await waitFor(() => expect(mockedApi.preview).toHaveBeenLastCalledWith(expect.objectContaining({ sampleSequence: '010' })));

    vi.clearAllMocks();
    render(<SystemNumberingRulesWorkbenchPage canView={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无权限访问编号规则只读目录');
    expect(mockedApi.list).not.toHaveBeenCalled();
    expect(mockedApi.preview).not.toHaveBeenCalled();
  });

  it('静态证明 V3 页面未调用系统参数 CRUD、缓存刷新、流程或受保护 API helper', () => {
    for (const allowed of [
      'numberingRulesApi.list',
      'numberingRulesApi.detail',
      'numberingRulesApi.meta',
      'numberingRulesApi.preview',
    ]) {
      expect(pageSource).toContain(allowed);
    }
    for (const forbidden of [
      'workflowApi',
      '../api/workflow',
      '@/api/workflow',
      'createSysConfig',
      'updateSysConfig',
      'deleteSysConfig',
      'saveSystemConfig',
      'refreshSysConfigCache',
      'routePermissions',
      'auth/login/mobile',
      '新增规则',
      '保存修改',
      '删除规则',
      '立即生效',
    ]) {
      expect(pageSource).not.toContain(forbidden);
    }
  });

  function ruleRecord() {
    return {
      id: 7,
      tenantId: 'tenant-a',
      ruleKey: 'numbering.rule.asset',
      name: '资产编号规则',
      template: 'AUTO-{YYYYMMDD}-{SEQ}',
      source: 'system_config',
      authority: 'system_config:numbering.rule.*',
      defaultRule: false,
      tenantScoped: true,
      readOnly: true,
      readonlyBoundary: '只读编号规则目录',
      variables: ['{YYYYMMDD}', '{SEQ}'],
    };
  }
});
