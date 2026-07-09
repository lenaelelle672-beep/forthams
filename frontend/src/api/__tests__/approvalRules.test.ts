import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

import http from '@/utils/http';
import { approvalRulesApi } from '@/api/approvalRules';

const mockedHttp = vi.mocked(http);

describe('api/approvalRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('uses real /approval-rules list detail create update endpoints with operatorId', async () => {
    sessionStorage.setItem('user_info', JSON.stringify({ userId: 42 }));
    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue({});

    await approvalRulesApi.listApprovalRules({ processKey: 'PROC', nodeKey: 'NODE', status: 'ACTIVE' });
    await approvalRulesApi.getApprovalRule('10/20');
    await approvalRulesApi.createApprovalRule({ processKey: 'PROC', nodeKey: 'NODE', ruleName: '大额审批', priority: 10, conditionExpression: 'amount >= 1000', approverStrategy: 'ROLE_MANAGER', reason: '创建复核' });
    await approvalRulesApi.updateApprovalRule(10, { processKey: 'PROC', nodeKey: 'NODE', ruleName: '大额审批更新', priority: 20, conditionExpression: 'amount >= 2000', approverStrategy: 'ROLE_DIRECTOR', auditEvidence: 'UPDATE-GATE' });

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/approval-rules', { params: { processKey: 'PROC', nodeKey: 'NODE', status: 'ACTIVE' } });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/approval-rules/10%2F20');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/approval-rules', expect.objectContaining({ processKey: 'PROC', reason: '创建复核', operatorId: 42 }));
    expect(mockedHttp.put).toHaveBeenCalledWith('/approval-rules/10', expect.objectContaining({ ruleName: '大额审批更新', auditEvidence: 'UPDATE-GATE', operatorId: 42 }));
  });

  it('keeps confirmed audit payloads for enable disable simulate and conflicts without workflow fallback', async () => {
    localStorage.setItem('user_info', JSON.stringify({ id: 7 }));
    mockedHttp.post.mockResolvedValue({});

    await approvalRulesApi.enableApprovalRule(12, { confirmed: true, reason: '启用复核', auditEvidence: 'ENABLE-GATE' });
    await approvalRulesApi.disableApprovalRule(12, { confirmed: true, reason: '停用复核', auditEvidence: 'DISABLE-GATE' });
    await approvalRulesApi.simulateApprovalRules({ processKey: 'PROC', nodeKey: 'NODE', context: { amount: 1200 }, reason: '模拟复核' });
    await approvalRulesApi.detectApprovalRuleConflicts({ processKey: 'PROC', nodeKey: 'NODE', context: { amount: 1200 }, auditEvidence: 'CONFLICT-GATE' });

    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/approval-rules/12/enable', { confirmed: true, reason: '启用复核', auditEvidence: 'ENABLE-GATE', operatorId: 7 });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/approval-rules/12/disable', { confirmed: true, reason: '停用复核', auditEvidence: 'DISABLE-GATE', operatorId: 7 });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(3, '/approval-rules/simulate', expect.objectContaining({ processKey: 'PROC', context: { amount: 1200 }, operatorId: 7 }));
    expect(mockedHttp.post).toHaveBeenNthCalledWith(4, '/approval-rules/conflicts', expect.objectContaining({ auditEvidence: 'CONFLICT-GATE', operatorId: 7 }));
    expect(JSON.stringify(mockedHttp.post.mock.calls)).not.toMatch(/workflow\.ts|fixed-assets\/workbench\?menu=|iframe|public\/mock/);
  });
});
