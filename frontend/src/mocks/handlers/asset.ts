import { http, HttpResponse } from 'msw';

// Mock data for assets
const MOCK_ASSETS = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  assetCode: `AST-${String(i + 1).padStart(4, '0')}`,
  name: ['MacBook Pro', 'Dell Monitor', 'Keyboard', 'Mouse', 'Laptop Stand'][i % 5],
  category: ['laptop', 'monitor', 'peripheral', 'accessory', 'device'][i % 5],
  status: ['active', 'maintenance', 'retired', 'idle'][i % 4] as 'active' | 'maintenance' | 'retired' | 'idle',
  location: ['Office A-101', 'Office B-202', 'Warehouse C', 'Meeting Room D'][i % 4],
  department: ['Engineering', 'Marketing', 'Finance', 'HR'][i % 4],
  purchaseDate: `2023-${String((i % 12) + 1).padStart(2, '0')}-15`,
  value: [5999, 2499, 299, 49, 199][i % 5],
}));

// Mock data for approvals
const MOCK_APPROVALS = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  processName: ['Asset Transfer', 'Ticket Approval', 'Inventory Check'][i % 3] + ` #${i + 1}`,
  processType: ['asset_change', 'ticket_approval', 'inventory'][i % 3] as 'asset_change' | 'ticket_approval' | 'inventory',
  status: ['pending', 'approved', 'rejected'][i % 3] as 'pending' | 'approved' | 'rejected',
  applicantId: (i % 5) + 1,
  applicantName: ['张三', '李四', '王五', '赵六', '钱七'][i % 5],
  approverId: i % 3 === 0 ? null : 10,
  approverName: i % 3 === 0 ? null : '管理员',
  createdAt: `2024-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`,
  updatedAt: `2024-01-${String((i % 28) + 1).padStart(2, '0')}T12:00:00Z`,
}));

// Mock data for dashboard stats
const MOCK_DASHBOARD_STATS = {
  totalTickets: 128,
  pendingApprovals: 15,
  totalAssets: 342,
  activeAssets: 298,
};

export const assetHandlers = [
  // Asset list with pagination and search
  http.get('/api/assets', ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const size = parseInt(url.searchParams.get('size') || '10');
    const keyword = url.searchParams.get('keyword') || '';

    let filtered = MOCK_ASSETS;
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      filtered = MOCK_ASSETS.filter(asset =>
        asset.name.toLowerCase().includes(lowerKeyword) ||
        asset.assetCode.toLowerCase().includes(lowerKeyword) ||
        asset.department.toLowerCase().includes(lowerKeyword)
      );
    }

    const start = (page - 1) * size;
    const end = start + size;

    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: {
        data: filtered.slice(start, end),
        total: filtered.length,
        page,
        size,
      },
    });
  }),

  // Approval list with pagination and filter
  http.get('/api/approvals', ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const size = parseInt(url.searchParams.get('size') || '10');
    const status = url.searchParams.get('status');

    let filtered = MOCK_APPROVALS;
    if (status) {
      filtered = MOCK_APPROVALS.filter(approval => approval.status === status);
    }

    const start = (page - 1) * size;
    const end = start + size;

    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: {
        data: filtered.slice(start, end),
        total: filtered.length,
        page,
        size,
      },
    });
  }),

  // Dashboard stats
  http.get('/api/dashboard/stats', () => {
    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: MOCK_DASHBOARD_STATS,
    });
  }),
];