/**
 * MSW (Mock Service Worker) handlers for the Inventory Management module.
 *
 * Implements all API endpoints defined in SWARM-P3-010-FE spec §API 契约:
 *   - 盘点任务 CRUD（列表/创建/详情/状态变更）
 *   - 盘点执行（资产清单/逐条确认/批量确认）
 *   - 盘点汇总（盘盈盘亏/提交核准）
 *
 * All handlers maintain in-memory mutable state so that successive requests
 * (e.g. confirm → summary) reflect the latest changes.
 *
 * @module mocks/inventoryHandlers
 */

import { http, HttpResponse } from 'msw';

// ---------------------------------------------------------------------------
// Type definitions (aligned with spec SWARM-P3-010-FE §数据约束)
// ---------------------------------------------------------------------------

/** 盘点任务状态 */
type TaskStatus = 'draft' | 'in_progress' | 'completed' | 'submitted';

/** 盘点范围类型 */
type ScopeType = 'location' | 'category' | 'all';

/** 实盘状态 */
type ActualStatus = 'normal' | 'surplus' | 'deficit' | 'damaged' | 'other';

/** 盘点任务 (mock in-memory representation) */
interface MockTask {
  taskId: string;
  taskName: string;
  scopeType: ScopeType;
  scopeIds: string[];
  status: TaskStatus;
  progress: number;
  totalAssets: number;
  countedAssets: number;
  uncountedAssets: number;
  surplusAssets: number;
  deficitAssets: number;
  createdAt: string;
  updatedAt: string;
}

/** 任务下的单条资产 */
interface MockAsset {
  assetId: string;
  assetCode: string;
  assetName: string;
  bookStatus: string;
  actualStatus: ActualStatus | '';
  remark: string;
  confirmed: boolean;
  confirmedAt: string | null;
}

/** 盘盈/盘亏明细项 */
interface SummaryItem {
  assetId: string;
  assetCode: string;
  assetName: string;
  reason: string;
}

/** 分页响应结构 */
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = '/api/inventory';

/** 生成唯一任务 ID */
let taskSeq = 100;
const nextTaskId = (): string => {
  taskSeq += 1;
  return `task-${String(taskSeq).padStart(4, '0')}`;
};

/** 计算进度百分比，保留 1 位小数 */
const calcProgress = (counted: number, total: number): number => {
  if (total <= 0) return 0;
  return parseFloat(((counted / total) * 100).toFixed(1));
};

/** 当前 ISO 时间戳 */
const now = (): string => new Date().toISOString();

/**
 * 根据 taskId + 索引生成确定性的资产 ID，便于测试断言。
 */
const makeAssetId = (taskId: string, idx: number): string =>
  `${taskId}-ast-${String(idx + 1).padStart(4, '0')}`;

// ---------------------------------------------------------------------------
// Seed data — 盘点任务
// ---------------------------------------------------------------------------

/**
 * 创建初始种子任务。每次调用返回全新数组，供 resetMockData 使用。
 */
function createSeedTasks(): MockTask[] {
  // 批量任务用于分页测试（ATB-001 step 5 需要 ≥25 条）
  const batch: MockTask[] = Array.from({ length: 25 }, (_, i) => {
    const status: TaskStatus = (['draft', 'in_progress', 'completed', 'submitted'] as const)[i % 4];
    const totalAssets = 20 + (i % 30);
    const isCounted = status !== 'draft';
    const countedAssets = isCounted
      ? Math.floor(totalAssets * (status === 'completed' || status === 'submitted' ? 1 : Math.random()))
      : 0;
    return {
      taskId: `task-batch-${String(i + 1).padStart(3, '0')}`,
      taskName: `批量测试任务 ${i + 1}`,
      scopeType: 'location' as ScopeType,
      scopeIds: [`loc-${i}`],
      status,
      progress: calcProgress(countedAssets, totalAssets),
      totalAssets,
      countedAssets,
      uncountedAssets: totalAssets - countedAssets,
      surplusAssets: isCounted ? Math.floor(Math.random() * 3) : 0,
      deficitAssets: isCounted ? Math.floor(Math.random() * 3) : 0,
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - i * 86400000).toISOString(),
    };
  });

  return [
    {
      taskId: 'task-in-progress-001',
      taskName: '2024Q4 办公室盘点',
      scopeType: 'location',
      scopeIds: ['loc-floor-1', 'loc-floor-2'],
      status: 'in_progress',
      progress: 60.0,
      totalAssets: 100,
      countedAssets: 60,
      uncountedAssets: 40,
      surplusAssets: 2,
      deficitAssets: 3,
      createdAt: '2024-10-01T10:00:00Z',
      updatedAt: '2024-10-15T14:30:00Z',
    },
    {
      taskId: 'task-draft-002',
      taskName: '研发部 IT 设备盘点',
      scopeType: 'category',
      scopeIds: ['cat-it-equipment'],
      status: 'draft',
      progress: 0,
      totalAssets: 50,
      countedAssets: 0,
      uncountedAssets: 50,
      surplusAssets: 0,
      deficitAssets: 0,
      createdAt: '2024-10-10T09:00:00Z',
      updatedAt: '2024-10-10T09:00:00Z',
    },
    {
      taskId: 'task-completed-003',
      taskName: '财务部年度盘点',
      scopeType: 'location',
      scopeIds: ['loc-finance-dept'],
      status: 'completed',
      progress: 100.0,
      totalAssets: 85,
      countedAssets: 85,
      uncountedAssets: 0,
      surplusAssets: 1,
      deficitAssets: 2,
      createdAt: '2024-09-01T08:00:00Z',
      updatedAt: '2024-09-15T17:00:00Z',
    },
    {
      taskId: 'task-submitted-004',
      taskName: '行政部 Q3 盘点',
      scopeType: 'all',
      scopeIds: [],
      status: 'submitted',
      progress: 100.0,
      totalAssets: 200,
      countedAssets: 200,
      uncountedAssets: 0,
      surplusAssets: 0,
      deficitAssets: 1,
      createdAt: '2024-07-01T10:00:00Z',
      updatedAt: '2024-07-20T16:00:00Z',
    },
    ...batch,
  ];
}

// ---------------------------------------------------------------------------
// Mutable state
// ---------------------------------------------------------------------------

let mockTasks: MockTask[] = createSeedTasks();

/**
 * 资产按 taskId 缓存，首次访问时懒生成。
 * key = taskId, value = 该任务下的资产数组。
 */
const assetStore: Map<string, MockAsset[]> = new Map();

// ---------------------------------------------------------------------------
// Asset generation
// ---------------------------------------------------------------------------

const CATEGORY_NAMES = ['IT设备', '办公家具', '电子用品', '交通工具', '其他'];
const LOCATION_NAMES = ['研发楼-A座', '研发楼-B座', '行政大楼-3F', '财务部', '仓库'];
const BOOK_STATUSES = ['在用', '闲置', '维修中'];

/**
 * 为指定任务生成模拟资产清单。
 * 同一 taskId 重复调用返回缓存数据（支持状态变更后复用）。
 */
function getOrCreateAssets(taskId: string, task: MockTask): MockAsset[] {
  if (assetStore.has(taskId)) {
    return assetStore.get(taskId)!;
  }

  const actualStatuses: ActualStatus[] = ['normal', 'surplus', 'deficit', 'damaged', 'other'];

  const assets: MockAsset[] = Array.from({ length: task.totalAssets }, (_, i) => {
    const isCounted = i < task.countedAssets;

    // 已盘资产随机分配实盘状态（加权使 normal 占多数）
    let actualStatus: ActualStatus | '' = '';
    if (isCounted) {
      const rand = Math.random();
      if (rand < 0.7) actualStatus = 'normal';
      else actualStatus = actualStatuses[Math.floor(Math.random() * actualStatuses.length)];
    }

    return {
      assetId: makeAssetId(taskId, i),
      assetCode: `AST-${String(i + 1).padStart(6, '0')}`,
      assetName: `${CATEGORY_NAMES[i % CATEGORY_NAMES.length]}-${i + 1}`,
      bookStatus: BOOK_STATUSES[i % BOOK_STATUSES.length],
      actualStatus,
      remark: isCounted && actualStatus === 'normal' ? '设备完好' : '',
      confirmed: isCounted,
      confirmedAt: isCounted
        ? new Date(Date.now() - Math.random() * 86400000 * 30).toISOString()
        : null,
    };
  });

  assetStore.set(taskId, assets);
  return assets;
}

/**
 * 遍历已确认资产，重新统计盘盈/盘亏数量。
 */
function recalcSurplusDeficit(assets: MockAsset[]): {
  surplusAssets: number;
  deficitAssets: number;
} {
  let surplusAssets = 0;
  let deficitAssets = 0;
  for (const a of assets) {
    if (!a.confirmed) continue;
    if (a.actualStatus === 'surplus') surplusAssets++;
    if (a.actualStatus === 'deficit') deficitAssets++;
  }
  return { surplusAssets, deficitAssets };
}

/**
 * 确认单条资产后，同步更新对应任务的统计数据。
 */
function updateTaskStatsAfterConfirm(taskIdx: number, assets: MockAsset[]): void {
  const task = mockTasks[taskIdx];
  const countedAssets = assets.filter(a => a.confirmed).length;
  const uncountedAssets = task.totalAssets - countedAssets;
  const { surplusAssets, deficitAssets } = recalcSurplusDeficit(assets);

  mockTasks[taskIdx] = {
    ...task,
    countedAssets,
    uncountedAssets: Math.max(0, uncountedAssets),
    surplusAssets,
    deficitAssets,
    progress: calcProgress(countedAssets, task.totalAssets),
    updatedAt: now(),
  };
}

// ---------------------------------------------------------------------------
// Reset helper (useful for isolated tests)
// ---------------------------------------------------------------------------

/**
 * 将所有 mock 数据重置为初始种子状态。
 * 在测试 beforeEach 中调用可确保用例之间互不干扰。
 */
export function resetMockData(): void {
  mockTasks = createSeedTasks();
  assetStore.clear();
  taskSeq = 100;
}

// ---------------------------------------------------------------------------
// MSW Handlers — strictly matches spec §API 契约
// ---------------------------------------------------------------------------

export const inventoryHandlers = [
  // -----------------------------------------------------------------------
  // 1. 盘点任务列表（分页 + 状态筛选）
  //    GET /api/v1/inventory/tasks
  // -----------------------------------------------------------------------
  http.get(`${API_BASE}/tasks`, ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10));
    const statusFilter = url.searchParams.get('status') as TaskStatus | null;

    let filtered = [...mockTasks];

    // 按状态筛选
    if (statusFilter) {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }

    // 默认按创建时间倒序
    filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    const body: PaginatedResponse<MockTask> = {
      data: items,
      pagination: { page, pageSize, total, totalPages },
    };

    return HttpResponse.json(body);
  }),

  // -----------------------------------------------------------------------
  // 2. 创建盘点任务
  //    POST /api/v1/inventory/tasks
  // -----------------------------------------------------------------------
  http.post(`${API_BASE}/tasks`, async ({ request }) => {
    const body = (await request.json()) as {
      taskName?: string;
      scopeType?: ScopeType;
      scopeIds?: string[];
    };

    // —— 服务端校验 ——
    if (!body.taskName || body.taskName.trim().length === 0) {
      return HttpResponse.json({ error: '任务名称不能为空' }, { status: 400 });
    }
    if (body.taskName.length > 50) {
      return HttpResponse.json(
        { error: '任务名称不能超过50个字符' },
        { status: 400 },
      );
    }
    if (!body.scopeType) {
      return HttpResponse.json(
        { error: '请选择盘点范围类型' },
        { status: 400 },
      );
    }
    if (
      body.scopeType !== 'all' &&
      (!body.scopeIds || body.scopeIds.length === 0)
    ) {
      return HttpResponse.json(
        { error: '请选择至少一个盘点范围节点' },
        { status: 400 },
      );
    }

    const totalAssets = 20 + Math.floor(Math.random() * 80);
    const newTask: MockTask = {
      taskId: nextTaskId(),
      taskName: body.taskName.trim(),
      scopeType: body.scopeType,
      scopeIds: body.scopeType === 'all' ? [] : body.scopeIds!,
      status: 'draft',
      progress: 0,
      totalAssets,
      countedAssets: 0,
      uncountedAssets: totalAssets,
      surplusAssets: 0,
      deficitAssets: 0,
      createdAt: now(),
      updatedAt: now(),
    };

    mockTasks.unshift(newTask);

    return HttpResponse.json(newTask, { status: 201 });
  }),

  // -----------------------------------------------------------------------
  // 3. 获取任务详情
  //    GET /api/v1/inventory/tasks/:taskId
  // -----------------------------------------------------------------------
  http.get(`${API_BASE}/tasks/:taskId`, ({ params }) => {
    const { taskId } = params;
    const task = mockTasks.find((t) => t.taskId === taskId);

    if (!task) {
      return HttpResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    return HttpResponse.json(task);
  }),

  // -----------------------------------------------------------------------
  // 4. 更新任务状态
  //    PATCH /api/v1/inventory/tasks/:taskId/status
  // -----------------------------------------------------------------------
  http.patch(`${API_BASE}/tasks/:taskId/status`, async ({ params, request }) => {
    const { taskId } = params;
    const body = (await request.json()) as { status: TaskStatus };
    const idx = mockTasks.findIndex((t) => t.taskId === taskId);

    if (idx === -1) {
      return HttpResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    /** 合法的状态流转路径 */
    const allowed: Record<TaskStatus, TaskStatus[]> = {
      draft: ['in_progress'],
      in_progress: ['completed'],
      completed: ['submitted'],
      submitted: [],
    };

    const current = mockTasks[idx].status;
    if (!allowed[current]?.includes(body.status)) {
      return HttpResponse.json(
        { error: `不允许从「${current}」变更为「${body.status}」` },
        { status: 400 },
      );
    }

    mockTasks[idx] = {
      ...mockTasks[idx],
      status: body.status,
      updatedAt: now(),
    };

    return HttpResponse.json(mockTasks[idx]);
  }),

  // -----------------------------------------------------------------------
  // 5. 获取任务下资产清单（分页）
  //    GET /api/v1/inventory/tasks/:taskId/assets
  // -----------------------------------------------------------------------
  http.get(`${API_BASE}/tasks/:taskId/assets`, ({ params, request }) => {
    const { taskId } = params;
    const task = mockTasks.find((t) => t.taskId === taskId);

    if (!task) {
      return HttpResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10));

    const assets = getOrCreateAssets(taskId as string, task);
    const total = assets.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const items = assets.slice(start, start + pageSize);

    const body: PaginatedResponse<MockAsset> = {
      data: items,
      pagination: { page, pageSize, total, totalPages },
    };

    return HttpResponse.json(body);
  }),

  // -----------------------------------------------------------------------
  // 6. 逐条确认资产
  //    PATCH /api/v1/inventory/tasks/:taskId/assets/:assetId/confirm
  // -----------------------------------------------------------------------
  http.patch(
    `${API_BASE}/tasks/:taskId/assets/:assetId/confirm`,
    async ({ params, request }) => {
      const { taskId, assetId } = params;
      const taskIdx = mockTasks.findIndex((t) => t.taskId === taskId);

      if (taskIdx === -1) {
        return HttpResponse.json({ error: '任务不存在' }, { status: 404 });
      }

      const task = mockTasks[taskIdx];

      // 只有「进行中」任务允许确认操作（§交互约束 3）
      if (task.status !== 'in_progress') {
        return HttpResponse.json(
          { error: '当前任务状态不允许确认操作' },
          { status: 400 },
        );
      }

      const body = (await request.json()) as {
        actualStatus: ActualStatus;
        remark?: string;
      };

      if (!body.actualStatus) {
        return HttpResponse.json(
          { error: '请选择实盘状态' },
          { status: 400 },
        );
      }

      const assets = getOrCreateAssets(taskId as string, task);
      const assetIdx = assets.findIndex(
        (a) => a.assetId === assetId,
      );

      if (assetIdx === -1) {
        return HttpResponse.json({ error: '资产不存在' }, { status: 404 });
      }

      if (assets[assetIdx].confirmed) {
        return HttpResponse.json(
          { error: '该资产已确认，不可重复操作' },
          { status: 400 },
        );
      }

      // —— 更新资产状态 ——
      assets[assetIdx] = {
        ...assets[assetIdx],
        actualStatus: body.actualStatus,
        remark: body.remark ?? '',
        confirmed: true,
        confirmedAt: now(),
      };

      // —— 同步更新任务统计 ——
      updateTaskStatsAfterConfirm(taskIdx, assets);

      return HttpResponse.json({
        asset: assets[assetIdx],
        task: mockTasks[taskIdx],
      });
    },
  ),

  // -----------------------------------------------------------------------
  // 7. 批量确认资产
  //    POST /api/v1/inventory/tasks/:taskId/assets/batch-confirm
  //    单次上限 100 条（§交互约束 7）
  // -----------------------------------------------------------------------
  http.post(
    `${API_BASE}/tasks/:taskId/assets/batch-confirm`,
    async ({ params, request }) => {
      const { taskId } = params;
      const taskIdx = mockTasks.findIndex((t) => t.taskId === taskId);

      if (taskIdx === -1) {
        return HttpResponse.json({ error: '任务不存在' }, { status: 404 });
      }

      const task = mockTasks[taskIdx];

      if (task.status !== 'in_progress') {
        return HttpResponse.json(
          { error: '当前任务状态不允许确认操作' },
          { status: 400 },
        );
      }

      const body = (await request.json()) as {
        assetIds: string[];
        actualStatus: ActualStatus;
        remark?: string;
      };

      if (!body.assetIds || body.assetIds.length === 0) {
        return HttpResponse.json(
          { error: '请选择至少一条资产' },
          { status: 400 },
        );
      }

      // 单次批量确认上限 100 条
      if (body.assetIds.length > 100) {
        return HttpResponse.json(
          { error: '单次批量确认不能超过100条', maxAllowed: 100 },
          { status: 400 },
        );
      }

      if (!body.actualStatus) {
        return HttpResponse.json(
          { error: '请选择实盘状态' },
          { status: 400 },
        );
      }

      const assets = getOrCreateAssets(taskId as string, task);
      let confirmedCount = 0;

      for (const aid of body.assetIds) {
        const assetIdx = assets.findIndex((a) => a.assetId === aid);
        if (assetIdx !== -1 && !assets[assetIdx].confirmed) {
          assets[assetIdx] = {
            ...assets[assetIdx],
            actualStatus: body.actualStatus,
            remark: body.remark ?? '',
            confirmed: true,
            confirmedAt: now(),
          };
          confirmedCount++;
        }
      }

      // —— 同步更新任务统计 ——
      updateTaskStatsAfterConfirm(taskIdx, assets);

      return HttpResponse.json({
        confirmedCount,
        task: mockTasks[taskIdx],
      });
    },
  ),

  // -----------------------------------------------------------------------
  // 8. 盘盈盘亏汇总
  //    GET /api/v1/inventory/tasks/:taskId/summary
  // -----------------------------------------------------------------------
  http.get(`${API_BASE}/tasks/:taskId/summary`, ({ params }) => {
    const { taskId } = params;
    const task = mockTasks.find((t) => t.taskId === taskId);

    if (!task) {
      return HttpResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    const assets = getOrCreateAssets(taskId as string, task);

    const surplus: SummaryItem[] = assets
      .filter((a) => a.confirmed && a.actualStatus === 'surplus')
      .map((a) => ({
        assetId: a.assetId,
        assetCode: a.assetCode,
        assetName: a.assetName,
        reason: a.remark || '盘盈',
      }));

    const deficit: SummaryItem[] = assets
      .filter((a) => a.confirmed && a.actualStatus === 'deficit')
      .map((a) => ({
        assetId: a.assetId,
        assetCode: a.assetCode,
        assetName: a.assetName,
        reason: a.remark || '盘亏',
      }));

    return HttpResponse.json({
      taskId: task.taskId,
      taskName: task.taskName,
      totalAssets: task.totalAssets,
      countedAssets: task.countedAssets,
      uncountedAssets: task.uncountedAssets,
      surplusCount: surplus.length,
      deficitCount: deficit.length,
      surplus,
      deficit,
    });
  }),

  // -----------------------------------------------------------------------
  // 9. 提交核准（不可逆，§交互约束 5）
  //    POST /api/v1/inventory/tasks/:taskId/submit
  // -----------------------------------------------------------------------
  http.post(`${API_BASE}/tasks/:taskId/submit`, async ({ params }) => {
    const { taskId } = params;
    const idx = mockTasks.findIndex((t) => t.taskId === taskId);

    if (idx === -1) {
      return HttpResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    const task = mockTasks[idx];

    // 允许从 in_progress 或 completed 提交
    if (task.status !== 'in_progress' && task.status !== 'completed') {
      return HttpResponse.json(
        { error: '当前任务状态不允许提交核准' },
        { status: 400 },
      );
    }

    mockTasks[idx] = {
      ...task,
      status: 'submitted',
      updatedAt: now(),
    };

    return HttpResponse.json({
      message: '提交核准成功',
      task: mockTasks[idx],
    });
  }),
];