import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ApprovalDetailPage from '@/pages/approval/ApprovalDetailPage';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 9001, id: 9001, username: 'viewer', realName: '查看人', roles: ['VIEWER'], permissions: [] },
  }),
}));

const mockFetchDetail = vi.fn();

vi.mock('@/store/approvalStore', () => ({
  useApprovalStore: vi.fn(() => ({
    currentWorkOrder: {
      id: '101',
      title: '资产调拨申请',
      status: 'PENDING',
      creator: '申请人甲',
      created_by: '申请人甲',
      created_at: '2026-06-01T09:00:00Z',
      content: '申请调拨服务器设备',
      department: '资产管理部',
      dept_name: '资产管理部',
      history: [],
    },
    loading: false,
    error: null,
    fetchWorkOrderDetail: mockFetchDetail,
    approveWorkOrder: vi.fn(),
    rejectWorkOrder: vi.fn(),
    clearError: vi.fn(),
  })),
}));

vi.mock('@/composables/useApprovalPermission', () => ({
  useApprovalPermission: () => ({ canApprove: false, hasApprovalRole: () => false }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/approvals/101']}>
        <Routes>
          <Route path="/approvals/:id" element={<ApprovalDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ApprovalDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders work order details', async () => {
    renderPage();
    expect(await screen.findByText('工单审批详情')).toBeInTheDocument();
    expect(screen.getByText('资产调拨申请')).toBeInTheDocument();
    expect(screen.getByText('申请调拨服务器设备')).toBeInTheDocument();
    expect(screen.getByText('待审批')).toBeInTheDocument();
  });

  it('shows permission warning for users without approval role', async () => {
    renderPage();
    expect(await screen.findByText(/您没有当前工单的审批权限/)).toBeInTheDocument();
  });
});
