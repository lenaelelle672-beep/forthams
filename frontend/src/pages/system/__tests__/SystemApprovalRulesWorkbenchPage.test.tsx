import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemApprovalRulesWorkbenchPage from '../SystemApprovalRulesWorkbenchPage';
import { approvalRulesApi } from '../../../api/approvalRules';

vi.mock('../../../api/approvalRules', () => ({
  approvalRulesApi: {
    listApprovalRules: vi.fn(),
    getApprovalRule: vi.fn(),
    createApprovalRule: vi.fn(),
    updateApprovalRule: vi.fn(),
    enableApprovalRule: vi.fn(),
    disableApprovalRule: vi.fn(),
    simulateApprovalRules: vi.fn(),
    detectApprovalRuleConflicts: vi.fn(),
  },
}));

const mockedApi = vi.mocked(approvalRulesApi);

const rule = {
  id: 7,
  processKey: 'ASSET_APPROVAL',
  businessType: 'ASSET',
  nodeKey: 'MANAGER_REVIEW',
  ruleName: '大额资产审批规则',
  priority: 10,
  conditionExpression: "amount >= 1000 AND applicantRole == 'MANAGER'",
  conditionSummary: "amount >= 1000 AND applicantRole == 'MANAGER'",
  approverStrategy: 'ROLE_MANAGER',
  approverSummary: '候选处理人策略：ROLE_MANAGER',
  status: 'ACTIVE',
  auditSummary: '创建审批规则，条件已通过白名单解析',
};

describe('SystemApprovalRulesWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.listApprovalRules.mockResolvedValue([rule]);
    mockedApi.getApprovalRule.mockResolvedValue(rule);
    mockedApi.createApprovalRule.mockResolvedValue({ ...rule, status: 'DISABLED' });
    mockedApi.updateApprovalRule.mockResolvedValue({ ...rule, priority: 20 });
    mockedApi.enableApprovalRule.mockResolvedValue({ ...rule, status: 'ACTIVE', enabledAt: '2026-07-07T00:00:00' });
    mockedApi.disableApprovalRule.mockResolvedValue({ ...rule, status: 'DISABLED', disabledReason: 'Day5 审批规则停用复核通过' });
    mockedApi.simulateApprovalRules.mockResolvedValue({
      processKey: 'ASSET_APPROVAL',
      nodeKey: 'MANAGER_REVIEW',
      matchedRuleIds: [7],
      matchedRules: [rule],
      safeExplanation: '白名单表达式本地解析完成，命中 1 条规则',
      approverSummary: '候选处理人策略：ROLE_MANAGER',
      warnings: [],
      tenantScoped: true,
    });
    mockedApi.detectApprovalRuleConflicts.mockResolvedValue([{ ruleId: 7, conflictRuleId: 8, conflictSummary: '同一流程/节点/优先级存在重叠条件', severity: 'HIGH' }]);
  });

  it('加载并展示审批规则、白名单表达式提示与审计摘要', async () => {
    render(<SystemApprovalRulesWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('审批规则加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '审批规则' })).toBeInTheDocument();
    expect(screen.getByText('大额资产审批规则')).toBeInTheDocument();
    expect(screen.getByText(/自有白名单 parser\/evaluator/)).toBeInTheDocument();
    expect(screen.getByText('候选处理人策略：ROLE_MANAGER')).toBeInTheDocument();
    expect(screen.queryByText(/raw-secret|token=/)).not.toBeInTheDocument();
  });

  it('支持空态、错误脱敏态与无权限态', async () => {
    mockedApi.listApprovalRules.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('token=raw-secret'));

    render(<SystemApprovalRulesWorkbenchPage />);

    expect(await screen.findByText('暂无审批规则，可创建示例规则验证 /approval-rules 闭环。')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('错误详情已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();

    const { container } = render(<SystemApprovalRulesWorkbenchPage canView={false} />);
    expect(within(container).getByText(/无权限访问审批规则/)).toBeInTheDocument();
  });

  it('调用 wrapper 完成创建、更新、启停、模拟与冲突检测', async () => {
    render(<SystemApprovalRulesWorkbenchPage />);
    await screen.findByText('大额资产审批规则');

    await userEvent.click(screen.getByRole('button', { name: '创建示例规则' }));
    await waitFor(() => expect(mockedApi.createApprovalRule).toHaveBeenCalledWith(expect.objectContaining({ processKey: 'ASSET_APPROVAL', reason: 'Day5 审批规则保存复核' })));

    await userEvent.click(screen.getByRole('button', { name: '更新优先级' }));
    await waitFor(() => expect(mockedApi.updateApprovalRule).toHaveBeenCalledWith(7, expect.objectContaining({ priority: 20, reason: 'Day5 审批规则更新复核' })));

    await userEvent.click(screen.getByRole('button', { name: '启用规则' }));
    await waitFor(() => expect(mockedApi.enableApprovalRule).toHaveBeenCalledWith(7, expect.objectContaining({ confirmed: true, auditEvidence: 'APPROVAL_RULE_ENABLE_GATE' })));

    await userEvent.click(screen.getByRole('button', { name: '停用规则' }));
    await waitFor(() => expect(mockedApi.disableApprovalRule).toHaveBeenCalledWith(7, expect.objectContaining({ confirmed: true, reason: 'Day5 审批规则停用复核通过' })));

    await userEvent.click(screen.getByRole('button', { name: '模拟命中' }));
    await waitFor(() => expect(mockedApi.simulateApprovalRules).toHaveBeenCalledWith(expect.objectContaining({ context: expect.objectContaining({ amount: 1200 }) })));
    expect(await screen.findByText('命中规则：7')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '冲突检测' }));
    await waitFor(() => expect(mockedApi.detectApprovalRuleConflicts).toHaveBeenCalledWith(expect.objectContaining({ auditEvidence: 'APPROVAL_RULE_CONFLICT_GATE' })));
    expect(await screen.findByText('同一流程/节点/优先级存在重叠条件')).toBeInTheDocument();
  });
});
