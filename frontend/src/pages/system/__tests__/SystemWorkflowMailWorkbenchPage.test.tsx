import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemWorkflowMailWorkbenchPage from '../SystemWorkflowMailWorkbenchPage';
import { listWorkflowMailConfigs, getWorkflowMailMeta } from '../../../api/workflowMail';

vi.mock('../../../api/workflowMail', () => ({
  listWorkflowMailConfigs: vi.fn(),
  getWorkflowMailMeta: vi.fn(),
}));

const mockedList = vi.mocked(listWorkflowMailConfigs);
const mockedMeta = vi.mocked(getWorkflowMailMeta);

const records = [
  { id: 1, businessType: 'ASSET_TRANSFER', nodeKey: 'approval', nodeName: '部门审批', triggerEvent: 'ON_APPROVAL', triggerEventLabel: '审批时', templateCode: 'TRANSFER_NOTICE', enabled: true, recipientScope: 'APPLICANT', recipientScopeLabel: '申请人' },
  { id: 2, businessType: 'MAINTENANCE', nodeKey: 'end', nodeName: '结束', triggerEvent: 'ON_COMPLETE', triggerEventLabel: '完成时', templateCode: '', enabled: false, recipientScope: 'APPROVER', recipientScopeLabel: '审批人' },
];
const meta = { triggerEvents: ['ON_APPROVAL'], recipientScopes: ['APPLICANT'], readOnlyNotice: '只读' };

describe('SystemWorkflowMailWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedList.mockResolvedValue({ records, total: records.length });
    mockedMeta.mockResolvedValue(meta);
  });

  it('加载并展示流程邮件配置列表', async () => {
    render(<SystemWorkflowMailWorkbenchPage canView />);
    expect(await screen.findByText('ASSET_TRANSFER')).toBeInTheDocument();
    expect(screen.getByText('MAINTENANCE')).toBeInTheDocument();
    expect(screen.getAllByText('审批时').length).toBeGreaterThanOrEqual(1);
  });

  it('展示只读边界与零业务调用风险提示', async () => {
    render(<SystemWorkflowMailWorkbenchPage canView />);
    await screen.findByText('ASSET_TRANSFER');
    expect(screen.getAllByText(/只读边界/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/零业务调用风险/)).toBeInTheDocument();
  });

  it('加载失败展示脱敏错误提示', async () => {
    mockedList.mockRejectedValueOnce(new Error('token=raw-secret'));
    render(<SystemWorkflowMailWorkbenchPage canView />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();
  });

  it('无权限态展示只读拦截', () => {
    render(<SystemWorkflowMailWorkbenchPage canView={false} />);
    expect(screen.getByText(/无权限访问流程邮件配置/)).toBeInTheDocument();
  });
});
