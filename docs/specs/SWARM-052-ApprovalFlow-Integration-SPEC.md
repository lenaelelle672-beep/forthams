# SWARM-052: 审批流程前端集成规格指导文档

**版本**: v1.0  
**迭代**: Iteration 4  
**状态**: Active  
**创建日期**: 2025-01-15

---

## 1. 需求与背景

### 1.1 业务背景

审批流程模块是企业级资产管理系统（AMS）的核心功能，涉及申请提交、多级审批、状态追踪等关键业务流程。前端集成需提供流畅的用户交互体验，实时反映审批状态变更，实现与后端 ApprovalService 的完整双向绑定。

### 1.2 技术背景

ApprovalService 后端服务已完成部署，提供完整的 RESTful API 接口。本次迭代需完成前端双向绑定与 UI 组件搭建，实现：
- 审批表单数据与后端的实时同步
- 审批状态的乐观更新与回滚机制
- WebSocket 实时状态推送订阅

### 1.3 核心依赖

| 依赖项 | 版本要求 | 说明 |
|--------|----------|------|
| React | ≥18.0 | 核心框架 |
| TypeScript | ≥5.0 | 类型安全 |
| @tanstack/react-query | ≥5.0 | 服务端状态管理 |
| Zustand | ≥4.0 | 客户端状态管理 |
| Ant Design | ≥5.0 | UI 组件库 |
| React Hook Form | ≥7.0 | 表单处理 |
| Zod | ≥3.0 | Schema 校验 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 4 目标定位

参照项目 Phase 拆解，本次 Iteration 4 对准 **Phase 4: 审批流程 UI 集成** 阶段。

### 2.2 实施范围

```
┌─────────────────────────────────────────────────────────────┐
│                      Phase 4 范围                            │
├─────────────────────────────────────────────────────────────┤
│  ✅ ApprovalService API 封装与类型定义                       │
│  ✅ 审批状态流转数据模型建立                                 │
│  ✅ 审批表单组件开发                                         │
│  ✅ 审批列表视图组件开发                                     │
│  ✅ 审批状态时间线组件开发                                   │
│  ✅ 双向绑定逻辑实现                                         │
│  ✅ 页面级集成与路由配置                                     │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 交付物清单

| 交付物 | 文件路径 | 类型 | 状态 |
|--------|----------|------|------|
| API 服务封装 | `src/services/approvalService.ts` | Service | ⏳ 进行中 |
| 类型定义 | `src/types/approval.ts` | TypeScript | ✅ 完成 |
| 审批状态 Hook | `src/hooks/useApprovalFlow.ts` | Hook | 🔄 待开发 |
| 审批表单组件 | `src/components/approval/ApprovalForm.tsx` | Component | 🔄 待开发 |
| 审批列表组件 | `src/components/approval/ApprovalList.tsx` | Component | 🔄 待开发 |
| 状态时间线组件 | `src/components/approval/ApprovalTimeline.tsx` | Component | 🔄 待开发 |
| 审批页面 | `src/pages/approval/ApprovalPage.tsx` | Page | 🔄 待开发 |
| 单元测试 | `src/__tests__/approval/*.test.tsx` | Test | 🔄 待开发 |

---

## 3. 边界约束

### 3.1 功能边界

| 约束项 | 明确规定 |
|--------|----------|
| 审批类型 | 仅支持单层级简单审批流程，多级会签待后续迭代 |
| 并发处理 | 乐观更新 + 回滚机制，禁止重复提交 |
| 离线支持 | 不支持，依赖实时网络请求 |
| 权限控制 | 仅前端路由拦截，后端验证由其他模块负责 |
| 草稿保存 | 支持自动保存，防抖间隔 2 秒 |

### 3.2 技术边界

```
技术栈锁定清单
├── 状态管理：仅使用 Zustand + React Query 组合
├── 组件库：仅使用 Ant Design 5.x
├── 样式方案：CSS Modules + Ant Design Token
├── 路由管理：React Router v6
├── 表单处理：React Hook Form + Zod 校验
└── HTTP 客户端：Axios 实例（统一拦截器配置）
```

### 3.3 禁止事项

- ❌ 禁止在组件内直接调用原生 fetch，需统一经由 approvalService
- ❌ 禁止在 UI 组件内处理业务逻辑，逻辑下沉至 Hook 层
- ❌ 禁止硬编码审批状态枚举值，需引用统一类型定义
- ❌ 禁止跳过 React Query 缓存层直接操作 localStorage
- ❌ 禁止在非授权状态下进行审批操作

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-001: API 服务层测试

```typescript
// src/__tests__/approval/approvalService.test.ts

describe('ApprovalService API Tests', () => {
  test('ATB-001-01: submitApproval 应返回审批记录 ID', async () => {
    // Arrange: 构造有效审批提交数据
    const payload = {
      title: '设备采购申请',
      amount: 5000,
      reason: '研发需要',
      attachments: []
    };
    
    // Act: 调用 submitApproval
    const result = await approvalService.submitApproval(payload);
    
    // Assert: 验证返回结果包含 id 字段
    expect(result).toHaveProperty('id');
    expect(result.id).toMatch(/^APR-\d{10}$/);
  });

  test('ATB-001-02: getApprovalDetail 应返回完整审批链信息', async () => {
    // Arrange: 已知审批 ID
    const approvalId = 'APR-0000000001';
    
    // Act
    const detail = await approvalService.getApprovalDetail(approvalId);
    
    // Assert: 验证数据结构完整性
    expect(detail).toMatchObject({
      id: approvalId,
      status: expect.stringMatching(/^(pending|approved|rejected|withdrawn)$/),
      history: expect.any(Array),
      currentStep: expect.any(Number)
    });
  });

  test('ATB-001-03: approve 应触发状态变更并返回新状态', async () => {
    // Arrange: 待审批记录
    const approvalId = 'APR-0000000001';
    const approvalData = { opinion: '同意采购', signature: 'admin-sign' };
    
    // Act
    const result = await approvalService.approve(approvalId, approvalData);
    
    // Assert: 验证状态变更为 approved
    expect(result.status).toBe('approved');
    expect(result.updatedAt).toBeDefined();
  });

  test('ATB-001-04: 网络错误时应抛出标准化异常', async () => {
    // Arrange: 模拟网络故障
    server.use(
      rest.post('/api/approvals', (req, res, ctx) => {
        return res(ctx.status(503), ctx.json({ message: 'Service Unavailable' }));
      })
    );
    
    // Act & Assert: 验证捕获到标准错误类型
    await expect(approvalService.submitApproval({})).rejects.toThrow('ApprovalServiceError');
  });
});
```

**测试覆盖率要求**: API 层测试覆盖率 ≥ 90%

---

### 4.2 ATB-002: 双向绑定逻辑测试

```typescript
// src/__tests__/approval/useApprovalFlow.test.ts

describe('ApprovalFlow Hook - 双向绑定测试', () => {
  test('ATB-002-01: 表单数据变更应同步至全局状态', async () => {
    // Arrange: 渲染包含表单的组件
    const { result } = renderHook(() => useApprovalFlow());
    const user = userEvent.setup();
    
    // Act: 用户输入审批标题
    await act(async () => {
      await user.type(screen.getByLabelText('审批标题'), '测试申请');
    });
    
    // Assert: 验证 Zustand store 中数据已更新
    expect(result.current.draft.title).toBe('测试申请');
  });

  test('ATB-002-02: 后端状态变更应触发前端重新渲染', async () => {
    // Arrange: 订阅审批状态
    const { result } = renderHook(() => useApprovalFlow('APR-0000000001'));
    
    // Act: 模拟 WebSocket 推送状态变更
    await act(async () => {
      mockWebSocketServer.emit('approval:statusChanged', {
        id: 'APR-0000000001',
        status: 'approved'
      });
    });
    
    // Assert: 验证组件状态已更新
    await waitFor(() => {
      expect(result.current.approval?.status).toBe('approved');
    });
  });

  test('ATB-002-03: 草稿自动保存应防抖处理', async () => {
    // Arrange: 开启自动保存，设置 2 秒防抖
    const saveSpy = vi.fn();
    renderHook(() => useApprovalFlow('APR-0000000001', { autoSave: true, debounceMs: 2000 }));
    
    // Act: 快速连续触发变更
    await act(async () => {
      store.setState({ draft: { title: '变更1' } });
      store.setState({ draft: { title: '变更2' } });
      store.setState({ draft: { title: '变更3' } });
    });
    
    // Assert: 验证仅在最后一次变更后触发保存
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenLastCalledWith(expect.objectContaining({ title: '变更3' }));
  });
});
```

---

### 4.3 ATB-003: UI 组件渲染测试

```typescript
// src/__tests__/approval/components/ApprovalTimeline.test.tsx

describe('ApprovalTimeline Component Tests', () => {
  test('ATB-003-01: 待审批状态应显示橙色标识', () => {
    // Arrange
    const pendingStep = {
      status: 'pending',
      label: '部门主管审批',
      assignee: '张三',
      timestamp: null
    };
    
    // Act
    render(<ApprovalTimeline steps={[pendingStep]} />);
    
    // Assert: 验证橙色状态标识
    const statusBadge = screen.getByTestId('step-0-status');
    expect(statusBadge).toHaveClass('ant-tag-orange');
  });

  test('ATB-003-02: 已通过状态应显示绿色并带勾选图标', () => {
    // Arrange
    const approvedStep = {
      status: 'approved',
      label: '部门主管审批',
      assignee: '张三',
      timestamp: '2024-01-15T10:30:00Z'
    };
    
    // Act
    render(<ApprovalTimeline steps={[approvedStep]} />);
    
    // Assert
    const statusBadge = screen.getByTestId('step-0-status');
    expect(statusBadge).toHaveClass('ant-tag-green');
    expect(screen.getByTestId('step-0-icon')).toContainHTML('CheckCircle');
  });

  test('ATB-003-03: 被拒绝状态应显示红色并包含拒绝原因', () => {
    // Arrange
    const rejectedStep = {
      status: 'rejected',
      label: '财务审批',
      assignee: '李四',
      timestamp: '2024-01-16T14:20:00Z',
      reason: '预算超支'
    };
    
    // Act
    render(<ApprovalTimeline steps={[rejectedStep]} />);
    
    // Assert
    expect(screen.getByText('预算超支')).toBeInTheDocument();
    expect(screen.getByTestId('step-0-status')).toHaveClass('ant-tag-red');
  });

  test('ATB-003-04: 当前节点应高亮显示', () => {
    // Arrange
    const steps = [
      { status: 'approved' as const },
      { status: 'pending' as const },
      { status: 'pending' as const }
    ];
    
    // Act
    render(<ApprovalTimeline steps={steps} currentStep={1} />);
    
    // Assert
    expect(screen.getByTestId('step-1-container')).toHaveClass('current-step');
  });
});
```

---

### 4.4 ATB-004: E2E 审批流程测试

```typescript
// e2e/approval-flow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('审批流程 E2E 测试', () => {
  test('ATB-004-01: 完整审批提交流程', async ({ page }) => {
    // Step 1: 进入审批页面
    await page.goto('/approval/new');
    
    // Step 2: 填写审批表单
    await page.fill('[data-testid="approval-title"]', 'Q2 预算申请');
    await page.fill('[data-testid="approval-amount"]', '50000');
    await page.selectOption('[data-testid="approval-category"]', 'budget');
    await page.fill('[data-testid="approval-reason"]', '用于购买服务器设备');
    
    // Step 3: 提交审批
    await page.click('[data-testid="submit-approval"]');
    
    // Assert: 验证跳转至详情页且状态为待审批
    await expect(page).toHaveURL(/\/approval\/APR-\d+/);
    await expect(page.locator('[data-testid="approval-status"]')).toContainText('待审批');
    
    // Verify: 验证审批列表中显示新记录
    await page.goto('/approval/list');
    await expect(page.locator('[data-testid="approval-item"]').first()).toContainText('Q2 预算申请');
  });

  test('ATB-004-02: 审批通过后状态流转正确', async ({ page }) => {
    // Arrange: 以审批人身份登录
    await page.goto('/approval/APR-0000000001');
    
    // Act: 审批通过
    await page.fill('[data-testid="approval-opinion"]', '同意');
    await page.click('[data-testid="btn-approve"]');
    
    // Assert: 验证状态变更
    await expect(page.locator('[data-testid="approval-status"]')).toContainText('已通过');
    await expect(page.locator('[data-testid="timeline"]')).toContainText('已通过');
  });

  test('ATB-004-03: 重复提交应被阻止', async ({ page }) => {
    await page.goto('/approval/new');
    await page.fill('[data-testid="approval-title"]', '测试');
    await page.fill('[data-testid="approval-amount"]', '100');
    
    // 首次提交
    await page.click('[data-testid="submit-approval"]');
    
    // 等待提交完成
    await page.waitForResponse(res => res.url().includes('/api/approvals'));
    
    // 尝试重复提交
    await page.click('[data-testid="submit-approval"]');
    
    // Assert: 验证重复提交警告
    await expect(page.locator('.ant-message')).toContainText('已有待处理审批');
  });
});
```

---

## 5. 开发切入层级序列

### 5.1 层级 1: 类型定义与 API 基础层

```
开发顺序: 1
预计工时: 2h
```

| 优先级 | 任务 | 交付物 |
|--------|------|--------|
| P0 | 定义审批状态枚举 | `src/types/approval.ts` - ApprovalStatus |
| P0 | 定义审批数据结构 | `src/types/approval.ts` - Approval, ApprovalStep |
| P0 | 封装 HTTP 请求基础函数 | `src/services/baseApi.ts` |
| P0 | 实现 approvalService 单例 | `src/services/approvalService.ts` |

**入口文件**:
```typescript
// src/types/approval.ts
export enum ApprovalStatus {
  Draft = 'draft',
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Withdrawn = 'withdrawn'
}

export interface ApprovalStep {
  stepId: string;
  status: ApprovalStatus;
  assignee: string;
  label: string;
  timestamp: string | null;
  reason?: string;
}

export interface Approval {
  id: string;
  title: string;
  status: ApprovalStatus;
  currentStep: number;
  history: ApprovalStep[];
  createdAt: string;
  updatedAt: string;
}
```

---

### 5.2 层级 2: 状态管理层

```
开发顺序: 2
预计工时: 3h
```

| 优先级 | 任务 | 交付物 |
|--------|------|--------|
| P0 | 实现 useApprovalFlow Hook | `src/hooks/useApprovalFlow.ts` |
| P0 | 配置 React Query 查询方案 | `src/hooks/queries/approvalQueries.ts` |
| P1 | 实现草稿持久化逻辑 | Zustand Middleware |
| P1 | 实现 WebSocket 订阅逻辑 | `src/hooks/useApprovalSubscription.ts` |

**核心 Hook 签名**:
```typescript
// src/hooks/useApprovalFlow.ts
export function useApprovalFlow(approvalId?: string, options?: {
  autoSave?: boolean;
  debounceMs?: number;
}): {
  approval: Approval | null;
  draft: Partial<Approval>;
  isLoading: boolean;
  isSaving: boolean;
  updateDraft: (data: Partial<Approval>) => void;
  submit: () => Promise<void>;
  approve: (data: ApprovalAction) => Promise<void>;
  reject: (data: ApprovalAction) => Promise<void>;
  withdraw: () => Promise<void>;
};
```

---

### 5.3 层级 3: UI 组件层

```
开发顺序: 3
预计工时: 4h
```

| 优先级 | 任务 | 交付物 |
|--------|------|--------|
| P0 | 实现审批表单组件 | `src/components/approval/ApprovalForm.tsx` |
| P0 | 实现审批列表组件 | `src/components/approval/ApprovalList.tsx` |
| P0 | 实现状态时间线组件 | `src/components/approval/ApprovalTimeline.tsx` |
| P1 | 实现审批操作按钮组 | `src/components/approval/ApprovalActions.tsx` |
| P2 | 实现状态筛选器 | `src/components/approval/StatusFilter.tsx` |

**组件接口规范**:
```typescript
// ApprovalForm Props
interface ApprovalFormProps {
  initialData?: Partial<Approval>;
  onSubmit: (data: ApprovalSubmitPayload) => Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
}

// ApprovalTimeline Props
interface ApprovalTimelineProps {
  steps: ApprovalStep[];
  currentStep: number;
  orientation?: 'horizontal' | 'vertical';
}

// ApprovalList Props
interface ApprovalListProps {
  filters?: ApprovalFilters;
  onSelect: (approval: Approval) => void;
  emptyText?: string;
}
```

---

### 5.4 层级 4: 页面集成层

```
开发顺序: 4
预计工时: 2h
```

| 优先级 | 任务 | 交付物 |
|--------|------|--------|
| P0 | 实现新建审批页面 | `src/pages/approval/NewApprovalPage.tsx` |
| P0 | 实现审批详情页面 | `src/pages/approval/ApprovalDetailPage.tsx` |
| P0 | 实现审批列表页面 | `src/pages/approval/ApprovalListPage.tsx` |
| P0 | 配置审批路由 | `src/router/approvalRoutes.tsx` |

**路由结构**:
```typescript
// src/router/approvalRoutes.tsx
export const approvalRoutes: RouteObject[] = [
  {
    path: '/approval',
    children: [
      { path: '', redirectTo: 'list', pathMatch: 'full' },
      { path: 'list', element: <ApprovalListPage /> },
      { path: 'new', element: <NewApprovalPage /> },
      { path: ':id', element: <ApprovalDetailPage /> }
    ]
  }
];
```

---

### 5.5 层级 5: 测试与调试层

```
开发顺序: 5
预计工时: 3h
```

| 优先级 | 任务 | 产出 |
|--------|------|------|
| P0 | 编写 API 层单元测试 | `src/__tests__/approval/approvalService.test.ts` |
| P0 | 编写 Hook 层单元测试 | `src/__tests__/approval/useApprovalFlow.test.ts` |
| P0 | 编写组件单元测试 | `src/__tests__/approval/components/*.test.tsx` |
| P1 | 编写 E2E 测试用例 | `e2e/approval-flow.spec.ts` |
| P2 | 生成组件 Storybook | `src/stories/approval/*.stories.tsx` |

---

## 6. 附录：审批状态流转定义

### 6.1 状态流转图

```
                    ┌─────────────┐
                    │   Draft     │ (草稿状态，可编辑)
                    └──────┬──────┘
                           │ submit()
                           ▼
                    ┌─────────────┐
         ┌─────────│   Pending   │─────────┐
         │         └─────────────┘         │
         │ approve()              reject() │
         ▼                                 ▼
  ┌─────────────┐                   ┌─────────────┐
  │  Approved   │                   │  Rejected   │
  └─────────────┘                   └─────────────┘
                                       
         withdraw() ────────────────────────►
                    ┌─────────────┐
                    │  Withdrawn  │
                    └─────────────┘
```

### 6.2 状态说明

| 状态 | 枚举值 | 可执行操作 | 样式标识 |
|------|--------|------------|----------|
| 草稿 | `draft` | 编辑、提交、删除 | 灰色 |
| 待审批 | `pending` | 审批通过、审批拒绝 | 橙色 |
| 已通过 | `approved` | - | 绿色 |
| 已拒绝 | `rejected` | 查看原因 | 红色 |
| 已撤回 | `withdrawn` | - | 灰色 |

---

## 7. 错误处理规范

### 7.1 错误类型定义

```typescript
// src/types/approval.ts
export class ApprovalServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApprovalServiceError';
  }
}

export enum ApprovalErrorCode {
  NotFound = 'APPROVAL_NOT_FOUND',
  Unauthorized = 'UNAUTHORIZED',
  InvalidState = 'INVALID_STATE_TRANSITION',
  DuplicateSubmit = 'DUPLICATE_SUBMISSION',
  NetworkError = 'NETWORK_ERROR'
}
```

### 7.2 错误处理策略

| 场景 | 处理策略 | 用户反馈 |
|------|----------|----------|
| 网络超时 | 重试 3 次，间隔 2s | "网络不稳定，请稍后重试" |
| 404 错误 | 跳转至列表页 | "审批记录不存在" |
| 401/403 | 清除登录态跳转登录页 | "登录已过期，请重新登录" |
| 状态冲突 | 回滚乐观更新 | "该审批已被其他操作更新" |
| 服务不可用 | 降级提示 | "服务暂时不可用" |

---

**文档结束**

---

### 修订历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2025-01-15 | SWARM-052 | 初始版本 |