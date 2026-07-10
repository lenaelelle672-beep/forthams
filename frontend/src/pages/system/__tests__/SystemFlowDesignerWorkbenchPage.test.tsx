import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemFlowDesignerWorkbenchPage from '../SystemFlowDesignerWorkbenchPage';
import { flowDesignerApi } from '../../../api/flowDesigner';

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    ReactFlow: ({ children }: { children?: React.ReactNode }) => <div data-testid="flow-canvas">{children}</div>,
  };
});
vi.mock('@xyflow/react/dist/style.css', () => ({}));

vi.mock('../../../components/flow/FlowCanvas', () => ({
  FlowCanvas: () => <div data-testid="flow-canvas" />,
}));
vi.mock('../../../components/flow/NodeConfigPanel', () => ({
  NodeConfigPanel: () => <div data-testid="node-config-panel" />,
}));
vi.mock('../../../components/flow/NodePanel', () => ({
  NodePanel: () => <div data-testid="node-panel" />,
}));

vi.mock('../../../api/flowDesigner', () => ({
  flowDesignerApi: {
    listDefinitions: vi.fn(),
    getDesigner: vi.fn(),
    listVersions: vi.fn(),
    validateGraph: vi.fn(),
    saveDraft: vi.fn(),
    publish: vi.fn(),
    rollback: vi.fn(),
  },
}));

const mockedApi = vi.mocked(flowDesignerApi);

const definition = {
  id: 'ASSET_TRANSFER',
  businessType: 'ASSET_TRANSFER',
  name: '资产转移流程',
  description: '用于资产转移审批',
  status: 'PUBLISHED',
  version: 2,
  definition: {
    nodes: [
      { id: 'start', type: 'START', label: '开始' },
      { id: 'approval', type: 'APPROVAL', label: '部门审批' },
      { id: 'end', type: 'END', label: '结束' },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'approval' },
      { id: 'e2', source: 'approval', target: 'end' },
    ],
  },
};

describe('SystemFlowDesignerWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.listDefinitions.mockResolvedValue([definition]);
    mockedApi.getDesigner.mockResolvedValue(definition);
    mockedApi.listVersions.mockResolvedValue([]);
  });

  it('加载流程设计器并展示模板名称与画布', async () => {
    render(<SystemFlowDesignerWorkbenchPage canView />);
    expect(await screen.findByText(/资产转移流程/)).toBeInTheDocument();
    expect(screen.getByTestId('flow-canvas')).toBeTruthy();
  });

  it('校验图结构成功后展示通过提示', async () => {
    mockedApi.validateGraph.mockResolvedValueOnce({ valid: true, errors: [] });
    render(<SystemFlowDesignerWorkbenchPage canView />);
    await screen.findByText(/资产转移流程/);

    await userEvent.click(screen.getByRole('button', { name: '图结构校验' }));
    await waitFor(() => expect(screen.getByText(/可进入发布复核/)).toBeInTheDocument());
    expect(mockedApi.validateGraph).toHaveBeenCalled();
  });

  it('保存草稿调用 saveDraft 并展示成功提示', async () => {
    mockedApi.saveDraft.mockResolvedValueOnce(definition);
    render(<SystemFlowDesignerWorkbenchPage canView />);
    await screen.findByText(/资产转移流程/);

    await userEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await waitFor(() => expect(screen.getByText(/草稿已通过/)).toBeInTheDocument());
    expect(mockedApi.saveDraft).toHaveBeenCalled();
  });

  it('无权限态展示只读拦截提示', () => {
    render(<SystemFlowDesignerWorkbenchPage canView={false} />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
