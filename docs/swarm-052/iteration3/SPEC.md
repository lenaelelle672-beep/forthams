# SWARM-052 Iteration 3 - 审批流程前端集成规格指导文档

## 版本信息

| 属性 | 值 |
|------|-----|
| **文档版本** | v1.0.0 |
| **迭代编号** | Iteration 3 |
| **创建日期** | 2024-01-15 |
| **最后更新** | 2024-01-15 |
| **状态** | DRAFT |

---

## 1. 需求与背景

### 1.1 业务背景

企业固定资产管理系统中的审批流程模块需要支持用户通过前端界面完成以下操作：

- 发起审批请求
- 查看待审批任务列表
- 执行审批通过或驳回操作
- 实时感知审批状态变更
- 追踪审批历史记录

当前系统后端 ApprovalService 已实现基础功能，本次迭代重点完成前端集成开发。

### 1.2 技术栈约束

| 层级 | 技术选型 | 版本要求 |
|------|----------|----------|
| 前端框架 | Vue 3 | ^3.4.0 |
| 构建工具 | Vite | ^5.0.0 |
| 状态管理 | Pinia | ^2.1.0 |
| HTTP 客户端 | Axios | ^1.6.0 |
| UI 组件库 | Element Plus | ^2.5.0 |
| 单元测试 | Vitest | ^1.2.0 |
| 组件测试 | @vue/test-utils | ^2.4.0 |
| E2E 测试 | Playwright | ^1.40.0 |
| 接口 Mock | MSW | ^2.0.0 |

### 1.3 本次集成目标

根据项目迭代计划，Phase 3 (UI 交互层实现) 的子目标如下：

| 子目标 ID | 描述 | 交付物 | 优先级 |
|-----------|------|--------|--------|
| P3.1 | ApprovalService 前端 SDK 封装 | `useApproval` Composable | P0 |
| P3.2 | 审批状态流转组件开发 | `ApprovalFlowChart.vue` | P0 |
| P3.3 | 审批操作面板组件开发 | `ApprovalActionPanel.vue` | P0 |
| P3.4 | 审批列表页面集成 | `ApprovalListView.vue` | P0 |

---

## 2. 边界约束

### 2.1 作用域边界

#### 包含范围 (In Scope)

- ✅ 审批流程前端组件开发
- ✅ ApprovalService API 封装与双向绑定
- ✅ 审批状态可视化流转图表
- ✅ 审批操作面板（通过/驳回）
- ✅ 审批列表页面及详情页
- ✅ Pinia Store 状态管理
- ✅ 单元测试与 E2E 测试

#### 排除范围 (Out of Scope)

- ❌ 审批流程后端逻辑实现（后端团队负责）
- ❌ 审批规则引擎配置
- ❌ 审批流程设计器开发
- ❌ 多级审批流程嵌套
- ❌ 审批催办/提醒功能

### 2.2 技术边界

| 约束项 | 具体要求 |
|--------|----------|
| 编码规范 | 仅支持 Vue 3 Composition API (`<script setup>`) |
| 组件通信 | 采用 `defineProps` + `defineEmits` 模式，禁止使用 `$emit` |
| API 调用 | 禁止在组件内直接调用 Axios，必须通过 `useApproval` Composable |
| 响应式 | 优先使用 `ref`/`reactive`，避免直接操作 DOM |
| 类型安全 | 所有接口必须定义 TypeScript 类型，禁止使用 `any` |

### 2.3 数据边界

| 约束项 | 具体要求 |
|--------|----------|
| 审批实例数据 | 由后端 ApprovalService 决定，前端仅做展示适配 |
| 状态枚举值 | `PENDING` \| `APPROVED` \| `REJECTED` \| `CANCELLED` |
| 审批类型枚举 | `LEAVE` \| `EXPENSE` \| `PURCHASE` \| `TRANSFER` \| `SCRAP` \| `CLEARANCE` |
| 时间格式 | ISO 8601 格式 (e.g., `2024-01-15T10:30:00Z`) |

---

## 3. 接口契约

### 3.1 核心类型定义

#### ApprovalItem - 审批项

```typescript
/**
 * 审批项数据结构
 * @description 包含审批请求的基本信息和当前状态
 */
interface ApprovalItem {
  /** 审批项唯一标识 */
  id: string;
  /** 审批标题 */
  title: string;
  /** 审批类型 */
  type: 'LEAVE' | 'EXPENSE' | 'PURCHASE' | 'TRANSFER' | 'SCRAP' | 'CLEARANCE';
  /** 申请人信息 */
  applicant: {
    id: string;
    name: string;
    avatar?: string;
  };
  /** 当前状态 */
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  /** 审批描述/备注 */
  description?: string;
  /** 关联资产 ID（如适用） */
  assetId?: string;
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  updatedAt: string;
}
```

#### ApprovalHistoryItem - 审批历史节点

```typescript
/**
 * 审批历史记录节点
 * @description 记录审批流程中每个节点的操作信息
 */
interface ApprovalHistoryItem {
  /** 历史记录唯一标识 */
  id: string;
  /** 审批状态 */
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  /** 操作人信息 */
  operator: {
    id: string;
    name: string;
    avatar?: string;
  };
  /** 操作时间 */
  operatedAt: string;
  /** 审批意见 */
  comment?: string;
  /** 节点顺序（用于图表渲染） */
  order: number;
}
```

#### ApprovalAction - 审批操作

```typescript
/**
 * 审批操作结果
 * @description 审批操作完成后的返回数据结构
 */
interface ApprovalAction {
  /** 操作是否成功 */
  success: boolean;
  /** 审批项 ID */
  approvalId: string;
  /** 操作后的状态 */
  newStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  /** 错误信息（如有） */
  error?: string;
}
```

### 3.2 API 端点契约

| 方法 | 端点 | 描述 | 请求体 | 响应体 |
|------|------|------|--------|--------|
| GET | `/api/approvals` | 获取待审批列表 | - | `ApprovalItem[]` |
| GET | `/api/approvals/{id}` | 获取审批详情 | - | `ApprovalItem` |
| GET | `/api/approvals/{id}/history` | 获取审批历史 | - | `ApprovalHistoryItem[]` |
| POST | `/api/approvals/{id}/approve` | 审批通过 | `{ comment: string }` | `ApprovalAction` |
| POST | `/api/approvals/{id}/reject` | 审批驳回 | `{ comment: string }` | `ApprovalAction` |
| POST | `/api/approvals/{id}/cancel` | 取消审批 | - | `ApprovalAction` |

---

## 4. 开发切入层级序列

### 4.1 Phase 1: 基础设施层 (Day 1)

#### 目标
完成 ApprovalService 前端 SDK 封装，实现与 Pinia Store 的双向绑定。

#### 目录结构

```
src/
├── services/
│   └── approval/
│       ├── types.ts              # 类型定义（ApprovalItem, ApprovalHistoryItem, ApprovalAction）
│       ├── errors.ts             # 错误类定义（ApprovalServiceError）
│       └── api.ts                # API 调用封装（基于 Axios）
├── stores/
│   └── approvalStore.ts          # Pinia Store（状态：pendingApprovals, currentApproval, isLoading）
└── composables/
    └── useApproval.ts            # Composable 封装（fetchPendingApprovals, approve, reject, subscribe）
```

#### 交付物清单

| 文件 | 职责 | 关键方法/属性 |
|------|------|---------------|
| `services/approval/types.ts` | 定义所有审批相关 TypeScript 接口 | `ApprovalItem`, `ApprovalHistoryItem`, `ApprovalAction` |
| `services/approval/errors.ts` | 定义业务错误类 | `ApprovalServiceError` |
| `services/approval/api.ts` | 封装 Axios API 调用 | `getApprovals`, `approve`, `reject`, `cancel` |
| `stores/approvalStore.ts` | Pinia 状态管理 | `pendingApprovals`, `currentApproval`, `fetchPending`, `approve`, `reject` |
| `composables/useApproval.ts` | 组合式函数封装 | `fetchPendingApprovals`, `approve`, `reject`, `subscribe` |

### 4.2 Phase 2: UI 组件层 (Day 2-3)

#### 目标
开发审批状态流转图表组件和审批操作面板组件。

#### 目录结构

```
src/
└── components/
    └── approval/
        ├── ApprovalFlowChart.vue       # 状态流转图（时间轴样式）
        ├── ApprovalActionPanel.vue     # 操作面板（通过/驳回按钮 + 意见输入）
        ├── ApprovalCard.vue            # 列表项卡片
        └── ApprovalDetailDrawer.vue    # 详情抽屉（整合 flow + action）
```

#### 组件接口定义

##### ApprovalFlowChart.vue

```typescript
// Props 定义
interface Props {
  /** 审批历史记录列表 */
  approvalHistory: ApprovalHistoryItem[];
  /** 是否显示时间戳 */
  showTimestamp?: boolean;
  /** 是否可折叠 */
  collapsible?: boolean;
}

// Emits 定义
interface Emits {
  /** 点击历史节点 */
  (e: 'node-click', node: ApprovalHistoryItem): void;
}
```

##### ApprovalActionPanel.vue

```typescript
// Props 定义
interface Props {
  /** 审批项 ID */
  approvalId: string;
  /** 是否禁用操作按钮 */
  disabled?: boolean;
  /** 加载状态 */
  loading?: boolean;
  /** 是否显示取消按钮 */
  showCancel?: boolean;
}

// Emits 定义
interface Emits {
  /** 审批通过 */
  (e: 'approve', payload: { id: string; comment: string }): void;
  /** 审批驳回 */
  (e: 'reject', payload: { id: string; comment: string }): void;
  /** 取消审批 */
  (e: 'cancel', id: string): void;
}
```

### 4.3 Phase 3: 页面集成层 (Day 4)

#### 目标
完成审批列表页面和审批详情页面的集成。

#### 目录结构

```
src/
└── views/
    └── approval/
        ├── ApprovalListView.vue        # 审批列表页
        └── ApprovalDetailView.vue      # 审批详情页
```

#### 页面功能

| 页面 | 功能描述 |
|------|----------|
| `ApprovalListView.vue` | 待审批列表、已审批列表 Tab 切换、搜索过滤、列表分页 |
| `ApprovalDetailView.vue` | 审批详情、审批历史流转图、操作面板 |

### 4.4 Phase 4: 测试与验收 (Day 5)

#### 目标
完成所有测试用例，验证功能完整性。

#### 测试覆盖

| 测试类型 | 覆盖范围 | 工具 |
|----------|----------|------|
| 单元测试 | Composable、Store、组件逻辑 | Vitest + @vue/test-utils |
| 集成测试 | API Mock、状态同步 | Vitest + MSW |
| E2E 测试 | 完整用户交互流程 | Playwright |

---

## 5. 验收测试基准 (ATB)

### 5.1 ATB-1: ApprovalService 前端 SDK 封装

#### 测试编号: ATB-1.1

| 属性 | 值 |
|------|-----|
| **测试描述** | `useApproval().fetchPendingApprovals()` 返回待审批列表 |
| **测试方法** | Vitest 单元测试 + MSW mock |
| **前置条件** | MSW 拦截 `/api/approvals` 请求 |
| **测试步骤** | 调用 `useApproval().fetchPendingApprovals()` |
| **期待结果** | 返回 `ApprovalItem[]`，数据结构符合接口定义 |

```typescript
// 测试代码示例
it('ATB-1.1: fetchPendingApprovals returns approval list', async () => {
  server.use(mockGetApprovalsSuccess)
  const { fetchPendingApprovals } = useApproval()
  const result = await fetchPendingApprovals()
  expect(result).toBeInstanceOf(Array)
  expect(result.length).toBeGreaterThan(0)
  expect(result[0]).toHaveProperty('id')
  expect(result[0]).toHaveProperty('title')
  expect(result[0]).toHaveProperty('status')
})
```

#### 测试编号: ATB-1.2

| 属性 | 值 |
|------|-----|
| **测试描述** | `useApproval().approve(id, comment)` 提交审批通过 |
| **测试方法** | Vitest 单元测试 |
| **前置条件** | MSW 拦截 `POST /api/approvals/{id}/approve` |
| **测试步骤** | 调用 `useApproval().approve('approval-001', '同意本次申请')` |
| **期待结果** | 返回 `{ success: true, approvalId: 'approval-001' }` |

#### 测试编号: ATB-1.3

| 属性 | 值 |
|------|-----|
| **测试描述** | `useApproval().reject(id, comment)` 提交审批驳回 |
| **测试方法** | Vitest 单元测试 |
| **前置条件** | MSW 拦截 `POST /api/approvals/{id}/reject` |
| **测试步骤** | 调用 `useApproval().reject('approval-001', '材料不完整')` |
| **期待结果** | 返回 `{ success: true, approvalId: 'approval-001' }` |

#### 测试编号: ATB-1.4

| 属性 | 值 |
|------|-----|
| **测试描述** | 双向绑定：API 响应自动更新 Pinia store |
| **测试方法** | Vitest 集成测试 |
| **前置条件** | Store 初始化完成 |
| **测试步骤** | 调用 `approvalStore.approve()` 后检查 `approvalStore.pendingApprovals` |
| **期待结果** | 对应审批项从 `pendingApprovals` 中移除 |

#### 测试编号: ATB-1.5

| 属性 | 值 |
|------|-----|
| **测试描述** | 错误处理：网络异常时抛出 `ApprovalServiceError` |
| **测试方法** | Vitest 单元测试 |
| **前置条件** | MSW 模拟网络错误 |
| **测试步骤** | 调用 `fetchPendingApprovals()` |
| **期待结果** | 捕获错误，验证 `error.code === 'NETWORK_ERROR'` |

### 5.2 ATB-2: 审批状态流转图表组件

#### 测试编号: ATB-2.1

| 属性 | 值 |
|------|-----|
| **测试描述** | 组件接收 `approvalHistory` prop 并正确渲染节点 |
| **测试方法** | Vitest + @vue/test-utils |
| **前置条件** | 传入包含 3 个历史节点的数组 |
| **测试步骤** | 渲染 `ApprovalFlowChart` 组件 |
| **期待结果** | 渲染出 3 个状态节点 |

#### 测试编号: ATB-2.2

| 属性 | 值 |
|------|-----|
| **测试描述** | 当前节点高亮显示 |
| **测试方法** | Vitest + DOM 断言 |
| **前置条件** | 传入历史记录数组 |
| **测试步骤** | 检查当前状态节点的 CSS 类 |
| **期待结果** | 当前节点添加 `.is-current` class |

#### 测试编号: ATB-2.3

| 属性 | 值 |
|------|-----|
| **测试描述** | 各状态节点显示正确的图标 |
| **测试方法** | Playwright E2E |
| **前置条件** | 页面加载完成 |
| **测试步骤** | 检查各状态节点的图标元素 |
| **期待结果** | PENDING 显示时钟图标，APPROVED 显示勾选图标，REJECTED 显示叉号图标 |

#### 测试编号: ATB-2.4

| 属性 | 值 |
|------|-----|
| **测试描述** | 驳回状态显示驳回原因 |
| **测试方法** | Vitest + 快照测试 |
| **前置条件** | 包含 REJECTED 状态的历史记录 |
| **测试步骤** | 检查驳回节点的内容 |
| **期待结果** | 包含驳回原因的 tooltip 或文字 |

### 5.3 ATB-3: 审批操作面板组件

#### 测试编号: ATB-3.1

| 属性 | 值 |
|------|-----|
| **测试描述** | 通过按钮触发 `approve` 事件，携带 comment |
| **测试方法** | @vue/test-utils emit 断言 |
| **前置条件** | 输入审批意见"同意" |
| **测试步骤** | 点击通过按钮 |
| **期待结果** | `emit('approve', { id: 'xxx', comment: '同意' })` |

#### 测试编号: ATB-3.2

| 属性 | 值 |
|------|-----|
| **测试描述** | 驳回按钮触发 `reject` 事件 |
| **测试方法** | @vue/test-utils emit 断言 |
| **前置条件** | 输入驳回原因"材料不完整" |
| **测试步骤** | 点击驳回按钮 |
| **期待结果** | `emit('reject', { id: 'xxx', comment: '材料不完整' })` |

#### 测试编号: ATB-3.3

| 属性 | 值 |
|------|-----|
| **测试描述** | 无权限时操作按钮禁用 |
| **测试方法** | @vue/test-utils + `props.disabled` |
| **前置条件** | 传入 `disabled: true` |
| **测试步骤** | 检查按钮的 disabled 属性 |
| **期待结果** | 按钮添加 `disabled` 属性 |

#### 测试编号: ATB-3.4

| 属性 | 值 |
|------|-----|
| **测试描述** | 空 comment 提交时提示必填 |
| **测试方法** | Playwright E2E |
| **前置条件** | 审批意见输入框为空 |
| **测试步骤** | 点击通过按钮 |
| **期待结果** | 显示 Element Plus 表单校验错误 |

#### 测试编号: ATB-3.5

| 属性 | 值 |
|------|-----|
| **测试描述** | 提交中显示 loading 状态 |
| **测试方法** | @vue/test-utils + `props.loading` |
| **前置条件** | 传入 `loading: true` |
| **测试步骤** | 检查按钮的 loading 状态 |
| **期待结果** | 按钮显示 loading 动画 |

### 5.4 ATB-4: 审批列表页面集成

#### 测试编号: ATB-4.1

| 属性 | 值 |
|------|-----|
| **测试描述** | 页面挂载时自动加载待审批列表 |
| **测试方法** | Playwright E2E + MSW mock |
| **前置条件** | MSW 拦截 API 请求返回 mock 数据 |
| **测试步骤** | 访问 `/approvals` 页面 |
| **期待结果** | 列表渲染出 3 条 mock 数据 |

```typescript
// Playwright 测试示例
test('ATB-4.1: 页面加载时获取待审批列表', async ({ page }) => {
  await page.goto('/approvals')
  await expect(page.locator('.approval-card')).toHaveCount(3)
})
```

#### 测试编号: ATB-4.2

| 属性 | 值 |
|------|-----|
| **测试描述** | 点击审批项展开详情 |
| **测试方法** | Playwright E2E |
| **前置条件** | 列表存在审批项 |
| **测试步骤** | 点击第一个审批卡片 |
| **期待结果** | 显示 `ApprovalFlowChart` 和 `ApprovalActionPanel` |

#### 测试编号: ATB-4.3

| 属性 | 值 |
|------|-----|
| **测试描述** | 审批完成后列表自动刷新 |
| **测试方法** | Playwright E2E + 断言 |
| **前置条件** | 存在待审批项 |
| **测试步骤** | 执行审批通过操作 |
| **期待结果** | 已审批项从列表消失 |

#### 测试编号: ATB-4.4

| 属性 | 值 |
|------|-----|
| **测试描述** | 空状态显示"暂无待审批项" |
| **测试方法** | Playwright E2E |
| **前置条件** | 待审批列表为空 |
| **测试步骤** | 访问审批列表页面 |
| **期待结果** | 渲染空状态插画和文案 |

### 5.5 ATB-5: 响应式状态同步

#### 测试编号: ATB-5.1

| 属性 | 值 |
|------|-----|
| **测试描述** | 后端推送状态变更时前端实时更新 |
| **测试方法** | Vitest + `fakeTimers` |
| **前置条件** | WebSocket 或轮询机制已配置 |
| **测试步骤** | 模拟后端状态变更推送 |
| **期待结果** | Store 中对应审批状态同步更新 |

#### 测试编号: ATB-5.2

| 属性 | 值 |
|------|-----|
| **测试描述** | 多标签页状态同步 |
| **测试方法** | Playwright 多页面测试 |
| **前置条件** | 打开两个标签页 |
| **测试步骤** | 在标签页1执行审批操作 |
| **期待结果** | 标签页2自动刷新同步状态 |

---

## 6. 测试用例与验收矩阵

### 6.1 测试用例汇总

| 用例 ID | 所属 ATB | 优先级 | 预估工时 | 测试类型 |
|---------|----------|--------|----------|----------|
| TC-001 | ATB-1.1 | P0 | 15min | Unit |
| TC-002 | ATB-1.2 | P0 | 15min | Unit |
| TC-003 | ATB-1.3 | P0 | 15min | Unit |
| TC-004 | ATB-1.4 | P0 | 20min | Integration |
| TC-005 | ATB-1.5 | P1 | 15min | Unit |
| TC-006 | ATB-2.1 | P0 | 15min | Unit |
| TC-007 | ATB-2.2 | P0 | 15min | Unit |
| TC-008 | ATB-2.3 | P0 | 20min | E2E |
| TC-009 | ATB-2.4 | P1 | 15min | Unit |
| TC-010 | ATB-3.1 | P0 | 15min | Unit |
| TC-011 | ATB-3.2 | P0 | 15min | Unit |
| TC-012 | ATB-3.3 | P0 | 10min | Unit |
| TC-013 | ATB-3.4 | P1 | 20min | E2E |
| TC-014 | ATB-3.5 | P1 | 10min | Unit |
| TC-015 | ATB-4.1 | P0 | 20min | E2E |
| TC-016 | ATB-4.2 | P0 | 20min | E2E |
| TC-017 | ATB-4.3 | P0 | 25min | E2E |
| TC-018 | ATB-4.4 | P1 | 15min | E2E |
| TC-019 | ATB-5.1 | P1 | 30min | Integration |
| TC-020 | ATB-5.2 | P2 | 30min | E2E |

### 6.2 验收标准

| 阶段 | 通过条件 | 阻塞标准 |
|------|----------|----------|
| Unit Test | 覆盖率 ≥ 80%，所有 P0 用例通过 | 任何 P0 用例失败 |
| Integration Test | 所有用例通过 | 任何用例失败 |
| E2E Test | 所有用例通过，页面加载时间 < 3s | 任何 P0 用例失败 |
| Final | 所有测试通过，无 console.error | 存在任何错误 |

---

## 7. 错误处理规范

### 7.1 错误类型定义

```typescript
/**
 * 审批服务错误类型枚举
 */
export enum ApprovalErrorCode {
  /** 网络错误 */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** 审批不存在 */
  APPROVAL_NOT_FOUND = 'APPROVAL_NOT_FOUND',
  /** 权限不足 */
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  /** 状态不可操作 */
  INVALID_STATUS = 'INVALID_STATUS',
  /** 服务器内部错误 */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  /** 参数错误 */
  INVALID_PARAMS = 'INVALID_PARAMS',
}

/**
 * 审批服务错误类
 */
export class ApprovalServiceError extends Error {
  constructor(
    public code: ApprovalErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApprovalServiceError'
  }
}
```

### 7.2 错误处理策略

| 场景 | 处理策略 | 用户反馈 |
|------|----------|----------|
| 网络超时 | 重试 3 次后显示错误 | "网络连接失败，请检查网络后重试" |
| 审批不存在 | 跳转列表页 | "该审批记录不存在或已被删除" |
| 权限不足 | 禁用操作按钮 | "您没有审批此申请的权限" |
| 状态不可操作 | 提示并刷新状态 | "当前状态不支持此操作，请刷新后重试" |
| 服务器错误 | 显示通用错误 | "服务暂时不可用，请稍后重试" |

---

## 8. 依赖关系

### 8.1 内部依赖

| 模块 | 依赖方 | 依赖关系 |
|------|--------|----------|
| `services/approval/api.ts` | `stores/approvalStore.ts` | Store 调用 API 层 |
| `stores/approvalStore.ts` | `composables/useApproval.ts` | Composable 封装 Store |
| `composables/useApproval.ts` | `components/approval/*` | 组件使用 Composable |
| `views/approval/*` | `components/approval/*` | 页面使用组件 |

### 8.2 外部依赖

| 依赖项 | 版本要求 | 用途 | 来源 |
|--------|----------|------|------|
| vue | ^3.4.0 | 核心框架 | 项目已有 |
| vue-router | ^4.2.0 | 路由管理 | 项目已有 |
| pinia | ^2.1.0 | 状态管理 | 项目已有 |
| axios | ^1.6.0 | HTTP 客户端 | 项目已有 |
| element-plus | ^2.5.0 | UI 组件库 | 项目已有 |
| @element-plus/icons-vue | ^2.3.0 | 图标库 | 项目已有 |
| vitest | ^1.2.0 | 单元测试 | 开发依赖 |
| @vue/test-utils | ^2.4.0 | 组件测试 | 开发依赖 |
| playwright | ^1.40.0 | E2E 测试 | 开发依赖 |
| msw | ^2.0.0 | API Mock | 开发依赖 |
| typescript | ^5.3.0 | 类型检查 | 项目已有 |

---

## 9. 附录

### 9.1 术语表

| 术语 | 定义 |
|------|------|
| 双绑 (Two-way Binding) | 数据变化自动同步到 UI，UI 操作自动同步到数据层 |
| Composable | Vue 3 组合式函数，用于封装和复用有状态的逻辑 |
| Pinia Store | Vue 3 的状态管理库，类似 Vuex |
| MSW (Mock Service Worker) | 用于拦截 HTTP 请求的 API Mock 工具 |

### 9.2 参考文档

| 文档 | 路径 |
|------|------|
| Vue 3 官方文档 | https://vuejs.org/ |
| Pinia 文档 | https://pinia.vuejs.org/ |
| Element Plus 文档 | https://element-plus.org/ |
| Vitest 文档 | https://vitest.dev/ |
| Playwright 文档 | https://playwright.dev/ |

### 9.3 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0.0 | 2024-01-15 | - | 初始版本创建 |