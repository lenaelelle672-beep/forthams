# SWARM-052 前端集成-审批流程页面开发
## 规格指导文档 v2.0

---

## 1. 需求与背景

### 1.1 任务概述

| 属性 | 值 |
|------|-----|
| **任务编号** | SWARM-052 |
| **任务名称** | 前端集成-审批流程页面开发 |
| **迭代版本** | Iteration 2 |
| **任务类型** | 前端集成开发 |
| **核心交付物** | 完成审批流程前端集成，实现 ApprovalService 双向绑定，搭建审批状态流转 UI 组件与用户交互界面 |

### 1.2 业务上下文

审批流程模块作为资产管理系统核心业务链路，承担以下职责：

- **审批任务管理**：提供审批任务的查看、提交、审批操作入口
- **状态实时同步**：实时同步后端审批状态变更至前端视图
- **流程可视化**：呈现审批流程状态机可视化流转
- **意见交互**：支持审批意见的录入与历史查看

本次 Iteration 2 聚焦于 **ApprovalService 双向绑定层** 的实现，为后续 Phase 3-5 的 UI 组件开发与联调奠定数据层基础。

### 1.3 技术栈基线

| 层级 | 技术选型 | 版本约束 | 用途说明 |
|------|----------|----------|----------|
| **框架** | Vue 3 (Composition API) | ^3.4.x | 前端视图框架 |
| **状态管理** | Pinia | ^2.1.x | 全局状态管理 |
| **UI 组件库** | Element Plus | ^2.5.x | 基础 UI 组件 |
| **HTTP 客户端** | Axios | ^1.6.x | HTTP 请求封装 |
| **实时通信** | WebSocket | 原生实现 | 状态实时推送 |
| **单元测试** | Vitest | ^1.x | 单元测试框架 |
| **E2E 测试** | Playwright | ^1.40.x | 端到端测试 |
| **类型检查** | TypeScript | ^5.x | 类型安全 |

### 1.4 当前状态评估

基于 Iteration 1 的交付物，进行以下基线评估：

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 页面骨架搭建 | ✅ 已完成 | ApprovalListView、ApprovalDetailView 基础结构 |
| 路由配置 | ✅ 已完成 | `/approval/list`、`/approval/:id` 路由注册 |
| TypeScript 类型定义 | ✅ 已完成 | Approval、ApprovalDTO、ApprovalStatus 类型 |
| ApprovalService 骨架 | ⚠️ 部分完成 | 基础类结构已建立，核心方法待实现 |
| 双向绑定实现 | ❌ 待实现 | 本次迭代核心目标 |
| UI 组件开发 | ❌ 待实现 | 列入 Phase 3 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解对照表

参照标准审批流程模块开发生命周期，本次 Iteration 2 对准 **Phase 2: ApprovalService 双向绑定层**：

| Phase ID | Phase 名称 | 范围描述 | 依赖关系 | 交付状态 |
|----------|------------|----------|----------|----------|
| Phase 1 | 页面骨架与路由配置 | 基础页面结构搭建、路由注册 | - | ✅ 已完成 |
| **Phase 2** | **ApprovalService 双向绑定层** | **本次迭代核心**：Service 方法实现、Store 绑定、双向同步 | Phase 1 | 🔄 **进行中** |
| Phase 3 | 审批状态流转可视化组件 | 流程图/状态机渲染、节点交互 | Phase 2 | ⏳ 待后续迭代 |
| Phase 4 | 审批交互操作面板 | 提交/通过/驳回等操作表单 | Phase 2 | ⏳ 待后续迭代 |
| Phase 5 | 全链路联调与回归验证 | 前后端集成测试、WebSocket 对接 | Phase 3, 4 | ⏳ 待后续迭代 |

### 2.2 Iteration 2 功能性目标

| 目标编号 | 目标描述 | 验收标准 | 优先级 |
|----------|----------|----------|--------|
| **G-01** | ApprovalService 核心方法暴露 | 提供 `fetchApprovalList()`、`getApprovalDetail(id)`、`submitApproval(data)`、`updateApprovalStatus(id, status)` 四个核心方法 | P0 |
| **G-02** | 双向绑定实现 | ApprovalService 内部状态变更时，UI 自动响应更新；用户操作触发状态变更后自动同步至服务端 | P0 |
| **G-03** | 列表页数据绑定 | 审批列表页与 ApprovalStore.approvalList 状态保持同步，延迟不超过 500ms | P1 |
| **G-04** | 详情页数据绑定 | 审批详情页与 ApprovalStore.currentApproval 状态保持同步 | P1 |
| **G-05** | 实时状态同步 | 通过轮询或 WebSocket 监听后端状态变更 | P2 |

### 2.3 Iteration 2 非功能性目标

| 目标编号 | 目标描述 | 约束阈值 | 测量方法 |
|----------|----------|----------|----------|
| NF-01 | 初始化加载时间 | 审批列表首屏渲染 ≤ 1.5s | Lighthouse FCP |
| NF-02 | 状态更新响应 | 用户操作至 UI 更新 ≤ 300ms | Performance API |
| NF-03 | 错误恢复机制 | 网络异常时自动重试 3 次，间隔 1s/2s/4s 指数退避 | 单元测试验证 |
| NF-04 | 并发操作保护 | 同一审批对象同时只允许一个待处理操作 | 状态锁验证 |

---

## 3. 边界约束

### 3.1 职责边界定义

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  前端边界                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                          UI Layer (Views)                             │  │
│  │  ApprovalListView.vue  │  ApprovalDetailView.vue  │  ApprovalDialog  │  │
│  └───────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                         │
│  ┌───────────────────────────────▼───────────────────────────────────────┐  │
│  │                    Component Layer                                      │  │
│  │  ApprovalListItem │ ApprovalStatusBadge │ ApprovalActionPanel          │  │
│  └───────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                         │
│  ┌───────────────────────────────▼───────────────────────────────────────┐  │
│  │                    Binding Layer (useApprovalBinding)                  │  │
│  │  双向绑定 Hook：监听 Store 变更 → 触发 UI 更新 / 捕获 UI 事件 → 调用 Service  │  │
│  └───────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                         │
│  ┌───────────────────────────────▼───────────────────────────────────────┐  │
│  │                    State Layer (Pinia Store)                           │  │
│  │  approvalStore: approvalList, currentApproval, pendingOperations, error │  │
│  └───────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                         │
│  ┌───────────────────────────────▼───────────────────────────────────────┐  │
│  │                    Service Layer (ApprovalService)                      │  │
│  │  fetchApprovalList(), getApprovalDetail(), submitApproval(), update...  │  │
│  └───────────────────────────────┬───────────────────────────────────────┘  │
└──────────────────────────────────┼───────────────────────────────────────────┘
                                   │ HTTP/REST API
┌──────────────────────────────────┼───────────────────────────────────────────┐
│                                  ▼                                           │
│                          [后端边界]                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                          API Layer                                     │  │
│  │  ApprovalController: /api/approvals/**                                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 前端职责范围

**明确包含**：
- `ApprovalService` 类的实现与维护
- 双向绑定逻辑的编码实现
- UI 组件的状态驱动渲染
- 前端表单数据预处理与客户端验证
- 错误状态的用户提示
- 乐观更新与回滚逻辑

### 3.3 非前端职责范围

**明确排除**：
- 后端审批业务逻辑实现
- 数据库持久化操作
- API 接口契约定义（由后端团队提供）
- 审批规则引擎配置
- 审批流程图可视化渲染（Phase 3）
- 审批操作表单的详细校验规则（Phase 4）
- WebSocket 实时推送实现（Phase 5）
- 移动端适配（独立迭代）
- 多语言国际化（独立迭代）

### 3.4 技术约束

| 约束编号 | 约束类型 | 约束描述 | 违反后果 |
|----------|----------|----------|----------|
| C-01 | 强制 | 禁止直接操作 DOM，必须通过 Vue 响应式系统 | 违反：响应式失效、内存泄漏 |
| C-02 | 强制 | UI 组件禁止直接调用 Axios 实例，必须经由 ApprovalService | 违反：职责混乱、难以维护 |
| C-03 | 强制 | 禁止同步 XHR 请求 | 违反：阻塞 UI 线程 |
| C-04 | 强制 | Store 中的 approval 状态禁止直接修改，必须通过 mutations/actions | 违反：Vue DevTools 不可追踪 |
| C-05 | 强制 | 乐观更新失败必须回滚 | 违反：数据不一致 |

### 3.5 数据边界

```
ApprovalService 状态树:
─────────────────────────────────────────────────────────
approvalStore (Pinia)
├── state
│   ├── approvalList: Approval[]      ← [本次绑定范围]
│   ├── currentApproval: Approval     ← [本次绑定范围]
│   ├── pendingOperations: Set<string> ← [本次绑定范围]
│   ├── errorState: Error | null      ← [本次绑定范围]
│   └── loadingState: LoadingState   ← [本次绑定范围]
│
├── getters
│   ├── pendingApprovals              ← [本次绑定范围]
│   ├── approvedApprovals             ← [本次绑定范围]
│   └── approvalById(id)              ← [本次绑定范围]
│
└── actions
    ├── fetchApprovalList(params)     ← [本次实现]
    ├── fetchApprovalDetail(id)       ← [本次实现]
    ├── submitApproval(data)          ← [本次实现]
    └── updateApprovalStatus(id, s)   ← [本次实现]
─────────────────────────────────────────────────────────

UI 绑定层:
─────────────────────────────────────────────────────────
ApprovalListView
├── 绑定: approvalStore.approvalList
├── 绑定: approvalStore.loadingState
└── 绑定: approvalStore.errorState
─────────────────────────────────────────────────────────
ApprovalDetailView
├── 绑定: approvalStore.currentApproval
├── 绑定: approvalStore.pendingOperations
└── 绑定: approvalStore.errorState
─────────────────────────────────────────────────────────
ApprovalStatusBadge (子组件)
└── 绑定: approval.status (computed)
─────────────────────────────────────────────────────────
ApprovalActionPanel (子组件)
├── 绑定: approvalStore.pendingOperations
└── 触发: approvalStore.updateApprovalStatus()
─────────────────────────────────────────────────────────
```

---

## 4. 验收测试基准 (ATB)

### 4.1 单元测试验收

#### 4.1.1 ApprovalService 方法测试

**测试文件**: `frontend/tests/unit/services/approvalService.test.ts`

| Test ID | 测试描述 | 测试输入 | 预期输出 | 验证方式 |
|---------|----------|----------|----------|----------|
| UT-01 | `fetchApprovalList()` 返回正确数据结构 | 调用方法，无参数 | 返回 `{ data: Approval[], total: number }` | `expect().toMatchObject()` |
| UT-02 | `fetchApprovalList()` 处理空数据 | 后端返回 `[]` | Store.approvalList = `[]` | `expect().toHaveLength(0)` |
| UT-03 | `fetchApprovalList()` 错误处理 | 后端返回 HTTP 500 | Store.errorState 非空，抛出 `ServiceError` | `expect().toThrow()` |
| UT-04 | `getApprovalDetail(id)` 返回正确详情 | 传入有效 `id` | 返回对应 Approval 对象 | `expect().toMatchObject({ id })` |
| UT-05 | `getApprovalDetail(id)` 处理不存在 ID | 传入无效 `id` | 抛出 `NotFoundError` | `expect().rejects.toThrow()` |
| UT-06 | `submitApproval(data)` 正确提交 | 有效 ApprovalDTO | 返回 `{ success: true, id }` | `expect().resolves.toMatchObject()` |
| UT-07 | `updateApprovalStatus()` 乐观更新 | 传入 `{ id, status }` | Store 立即更新，异步请求后端 | Mock + `expect().toBe(newStatus)` |
| UT-08 | `updateApprovalStatus()` 失败回滚 | 更新后后端返回 400 | Store 回滚至原状态，errorState 置位 | `expect().toBe(originalStatus)` |

#### 4.1.2 双向绑定测试

**测试文件**: `frontend/tests/unit/binding/approvalBinding.test.ts`

| Test ID | 测试描述 | 测试输入 | 预期输出 | 验证方式 |
|---------|----------|----------|----------|----------|
| UT-09 | Service 状态变更触发 UI 更新 | 外部修改 `store.approvalList` | Vue 组件 data 属性同步变更 | `nextTick()` + `expect()` |
| UT-10 | UI 操作触发 Service 更新 | 用户触发 `handleApprove()` | `service.updateApprovalStatus()` 被调用 | `vi.fn()` spy |
| UT-11 | 并发操作互斥验证 | 同时触发多个审批操作 | 第二个操作进入 `pendingOperations` 队列 | `expect().toBe(1)` |
| UT-12 | 状态重置验证 | 操作完成/失败后 | `pendingOperations` 清除 | `expect().toHaveLength(0)` |

#### 4.1.3 组件测试验收

**测试文件**: `frontend/tests/unit/components/approvalList.test.ts`

| Test ID | 测试描述 | 测试输入 | 预期输出 | 验证方式 |
|---------|----------|----------|----------|----------|
| UT-13 | 列表渲染正确数量 | `approvalList = [A, B, C]` | 渲染 3 个 ApprovalItem 组件 | `findAllComponents().length` |
| UT-14 | 加载状态显示 | `loadingState.isLoading = true` | 显示 Loading 骨架屏 | `expect().toBeVisible()` |
| UT-15 | 空状态显示 | `approvalList = []` 且 `!loading` | 显示空状态插画与文案 | `expect().toBeVisible()` |
| UT-16 | 错误状态显示 | `errorState` 非空 | 显示错误提示与重试按钮 | `expect().toBeVisible()` |

### 4.2 E2E 测试验收

**测试文件**: `frontend/tests/e2e/approval.spec.ts`

#### 4.2.1 审批列表页测试

| Test ID | 测试场景 | 操作步骤 | 预期结果 | 验证方式 |
|---------|----------|----------|----------|----------|
| E2E-01 | 审批列表正常加载 | 访问 `/approval/list` | 列表显示且数据与后端一致 | `toHaveCount(n)` |
| E2E-02 | 审批列表分页 | 点击第二页 | URL 更新，列表切换，数据正确 | `toMatch(/page=2/)` |
| E2E-03 | 审批列表筛选 | 选择状态筛选「待审批」 | 仅显示待审批项 | `selectOption()` |
| E2E-04 | 审批列表搜索 | 输入关键词搜索 | 返回匹配结果（防抖 300ms） | `fill()` + `waitForResponse()` |

#### 4.2.2 审批详情页测试

| Test ID | 测试场景 | 操作步骤 | 预期结果 | 验证方式 |
|---------|----------|----------|----------|----------|
| E2E-05 | 详情页加载 | 点击列表项进入详情 | 详情数据完整展示 | `toBeVisible()` |
| E2E-06 | 详情页状态同步 | 详情页打开时后端状态变更 | 页面显示最新状态（≤ 500ms） | `evaluate()` 模拟推送 |
| E2E-07 | 返回列表状态保留 | 从详情页返回列表 | 列表保持之前的筛选/分页状态 | `sessionStorage` |

#### 4.2.3 审批操作测试

| Test ID | 测试场景 | 操作步骤 | 预期结果 | 验证方式 |
|---------|----------|----------|----------|----------|
| E2E-08 | 提交审批 | 填写表单并点击提交 | 加载指示器 → 成功提示 → 跳转列表 | `click()` + `toHaveURL()` |
| E2E-09 | 操作锁定验证 | 提交审批后快速点击 | 按钮禁用，无重复提交 | `toBeDisabled()` |
| E2E-10 | 操作失败提示 | 模拟提交失败 | 显示错误提示，按钮恢复 | `mock API 500` |
| E2E-11 | 操作成功状态更新 | 审批通过操作 | 列表项状态立即更新为「已通过」 | `toHaveText()` |

### 4.3 性能测试验收

| Test ID | 测试指标 | 测试方法 | 阈值要求 | 测量工具 |
|---------|----------|----------|----------|----------|
| PERF-01 | 首屏加载时间 | Lighthouse CI FCP | FCP ≤ 1.5s | Playwright + Lighthouse |
| PERF-02 | 列表渲染性能 | 100 条数据渲染 | TTI ≤ 2s | Playwright + Performance API |
| PERF-03 | 状态更新响应 | 触发审批操作 | UI 更新 ≤ 300ms | `performance.now()` |
| PERF-04 | 内存泄漏检测 | 多次进出审批页面 | 无 detached 组件 | Chrome DevTools Protocol |

---

## 5. 开发切入层级序列

### 5.1 依赖层级图

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Layer 0: 环境与配置层                             │
│   Node.js, pnpm, TypeScript, Vite, ESLint, Prettier                          │
│   依赖: 无                                                                   │
└──────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Layer 1: 基础设施层                               │
│   Axios 实例配置 (http.ts) │ Vue Router │ Pinia 初始化                       │
│   依赖: Layer 0                                                            │
└──────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Layer 2: 服务抽象层 ⭐ (本次核心)                       │
│   ApprovalService 类 │ API 请求封装 │ 类型定义                                │
│   依赖: Layer 1                                                            │
└──────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Layer 3: 状态管理层 (Pinia)                            │
│   approvalStore │ Getters │ Actions │ Mutations                             │
│   依赖: Layer 2                                                            │
└──────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Layer 4: 组件层                                  │
│   ApprovalListItem │ ApprovalStatusBadge │ ApprovalFilter                   │
│   依赖: Layer 3                                                            │
└──────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Layer 5: 视图层                                  │
│   ApprovalListView │ ApprovalDetailView                                     │
│   依赖: Layer 4                                                            │
└──────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Layer 6: 测试与验证层                                 │
│   单元测试 │ E2E 测试 │ 性能测试 │ 集成测试                                   │
│   依赖: Layer 0-5                                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 编码切入顺序

#### Phase 1: 基础设施配置 (预计 0.5d)

| 序号 | 任务 | 交付物 | 依赖前置 | 状态 |
|------|------|--------|----------|------|
| 1.1 | 配置 API Base URL 环境变量 | `.env.production` | 无 | ⏳ |
| 1.2 | 配置 Axios 实例拦截器 | `src/utils/http.ts` | 无 | ⏳ |
| 1.3 | 配置 Vue Router 审批路由 | `src/router/approval.ts` | 无 | ⏳ |
| 1.4 | 初始化 Pinia Store 骨架 | `src/stores/approvalStore.ts` | 无 | ⏳ |

#### Phase 2: ApprovalService 核心实现 (预计 2d) ⭐

| 序号 | 任务 | 交付物 | 依赖前置 | 状态 |
|------|------|--------|----------|------|
| 2.1 | 定义 TypeScript 类型接口 | `src/types/approval.ts` | 无 | 🔄 |
| 2.2 | 实现 ApprovalService 类骨架 | `src/services/approvalService.ts` | 2.1 | 🔄 |
| 2.3 | 实现 `fetchApprovalList()` 方法 | `src/services/approvalService.ts` | 2.2 | 🔄 |
| 2.4 | 实现 `getApprovalDetail()` 方法 | `src/services/approvalService.ts` | 2.2 | 🔄 |
| 2.5 | 实现 `submitApproval()` 方法 | `src/services/approvalService.ts` | 2.2 | 🔄 |
| 2.6 | 实现 `updateApprovalStatus()` 方法（含乐观更新） | `src/services/approvalService.ts` | 2.2 | 🔄 |
| 2.7 | 实现错误处理与重试逻辑 | `src/services/approvalService.ts` | 2.6 | 🔄 |
| 2.8 | 单元测试覆盖 ApprovalService | `tests/unit/services/approvalService.test.ts` | 2.3-2.7 | 🔄 |

#### Phase 3: Pinia Store 双向绑定实现 (预计 1.5d) ⭐

| 序号 | 任务 | 交付物 | 依赖前置 | 状态 |
|------|------|--------|----------|------|
| 3.1 | 定义 Store State 结构 | `src/stores/approvalStore.ts` | 2.1 | 🔄 |
| 3.2 | 实现 Getters（派生状态） | `src/stores/approvalStore.ts` | 3.1 | 🔄 |
| 3.3 | 实现 Actions（调用 Service） | `src/stores/approvalStore.ts` | 3.2, 2.3-2.6 | 🔄 |
| 3.4 | 实现 Mutators（状态修改） | `src/stores/approvalStore.ts` | 3.3 | 🔄 |
| 3.5 | 实现双向绑定 Hook | `src/composables/useApprovalBinding.ts` | 3.4 | 🔄 |
| 3.6 | 单元测试覆盖 Store 与 Binding | `tests/unit/stores/approvalStore.test.ts` | 3.1-3.5 | 🔄 |

#### Phase 4: UI 组件开发 (预计 2d) - 后续迭代

| 序号 | 任务 | 交付物 | 依赖前置 | 状态 |
|------|------|--------|----------|------|
| 4.1 | 开发 ApprovalListItem 组件 | `src/components/approval/ApprovalListItem.vue` | 3.5 | ⏳ |
| 4.2 | 开发 ApprovalStatusBadge 组件 | `src/components/approval/ApprovalStatusBadge.vue` | 4.1 | ⏳ |
| 4.3 | 开发 ApprovalFilter 组件 | `src/components/approval/ApprovalFilter.vue` | 4.2 | ⏳ |
| 4.4 | 开发 ApprovalActionPanel 组件 | `src/components/approval/ApprovalActionPanel.vue` | 3.5 | ⏳ |
| 4.5 | 组件单元测试覆盖 | `tests/unit/components/*.test.ts` | 4.1-4.4 | ⏳ |

#### Phase 5: 视图层组装 (预计 1d) - 后续迭代

| 序号 | 任务 | 交付物 | 依赖前置 | 状态 |
|------|------|--------|----------|------|
| 5.1 | 组装 ApprovalListView | `src/views/approval/ApprovalListView.vue` | 4.1-4.3 | ⏳ |
| 5.2 | 组装 ApprovalDetailView | `src/views/approval/ApprovalDetailView.vue` | 4.4 | ⏳ |
| 5.3 | 集成路由守卫（权限控制） | `src/router/approval.ts` | 5.1, 5.2 | ⏳ |
| 5.4 | 视图层集成测试 | `tests/unit/views/*.test.ts` | 5.1-5.3 | ⏳ |

#### Phase 6: E2E 验证 (预计 0.5d) - 后续迭代

| 序号 | 任务 | 交付物 | 依赖前置 | 状态 |
|------|------|--------|----------|------|
| 6.1 | 编写 E2E 测试用例 | `tests/e2e/approval.spec.ts` | 5.1-5.4 | ⏳ |
| 6.2 | 执行 Playwright E2E 测试 | CI/CD Pipeline | 6.1 | ⏳ |
| 6.3 | 修复 E2E 失败用例并回归 | - | 6.2 | ⏳ |

### 5.3 代码路径规范

```
frontend/src/
├── api/
│   └── approval.ts                    # API 请求函数封装
│
├── components/
│   └── approval/
│       ├── ApprovalListItem.vue       # 列表项组件
│       ├── ApprovalStatusBadge.vue    # 状态徽章组件
│       ├── ApprovalFilter.vue         # 筛选组件
│       ├── ApprovalActionPanel.vue    # 操作面板组件
│       └── index.ts                   # 组件导出
│
├── composables/
│   ├── useApprovalBinding.ts          # 双向绑定 Hook [本次实现]
│   └── useApprovalPermission.ts       # 权限判断 Hook
│
├── services/
│   ├── approvalService.ts             # ApprovalService 核心类 [本次实现]
│   └── approvalService.test.ts        # Service 单元测试
│
├── stores/
│   ├── approvalStore.ts               # Pinia Store [本次实现]
│   └── approvalStore.test.ts          # Store 单元测试
│
├── types/
│   └── approval.ts                    # 类型定义 [本次完善]
│
├── utils/
│   └── http.ts                        # Axios 实例配置
│
├── views/
│   └── approval/
│       ├── ApprovalListView.vue       # 列表视图
│       └── ApprovalDetailView.vue     # 详情视图
│
├── app/
│   ├── hooks/
│   │   ├── useAuditRealtime.ts        # 审计实时监听 Hook
│   │   ├── useAuditableFields.ts      # 可审计字段 Hook
│   │   └── useAuditLogs.ts            # 审计日志 Hook
│   ├── components/
│   │   └── audit/
│   │       └── GraphifyKnowledgeGraph.tsx  # 知识图谱组件
│   └── pages/
│       └── AssetDetailPage/
│           └── index.tsx              # 资产详情页
│
├── pages/
│   └── AssetDetailPage/
│       ├── types/
│       │   └── audit.types.ts         # 审计类型定义
│       ├── hooks/
│       │   ├── useAuditableFields.ts  # 可审计字段 Hook
│       │   └── useAuditLogs.ts        # 审计日志 Hook
│       ├── services/
│       │   └── auditApi.ts            # 审计 API
│       └── config/
│           └── auditableFieldMap.ts   # 字段映射配置
│
├── services/
│   ├── auditService.ts                # 审计服务
│   ├── auditApi.ts                   # 审计 API
│   └── assetService.ts               # 资产服务
│
├── hooks/
│   ├── useAuditRealtime.ts           # 审计实时监听
│   ├── useAuditableFields.ts         # 可审计字段
│   ├── useAuditLogs.ts              # 审计日志
│   ├── useAssetById.ts              # 资产查询
│   ├── useAuditLog.ts               # 单条审计
│   └── useAssetDetail.ts            # 资产详情
│
├── styles/
│   ├── audit-highlight.css           # 审计高亮样式
│   ├── theme.css                    # 主题样式
│   ├── index.css                    # 全局样式
│   ├── tailwind.css                 # Tailwind 样式
│   └── fonts.css                    # 字体样式
│
├── app/
│   ├── routes.ts                    # 路由配置
│   ├── types/
│   │   ├── asset.types.ts          # 资产类型
│   │   ├── audit.types.ts          # 审计类型
│   │   └── flow.ts                 # 流程类型
│   └── utils/
│       ├── api.ts                  # API 工具
│       └── permissionHooks.ts      # 权限 Hooks
│
├── mocks/
│   └── assetDetail.mock.ts          # 资产详情 Mock 数据
│
└── test/
    └── setup.ts                     # 测试配置
```

### 5.4 关键实现约束

#### 5.4.1 ApprovalService 实现约束

```typescript
/**
 * ApprovalService 单例模式约束
 * @description 确保全局只有一个 ApprovalService 实例
 */
class ApprovalService {
  private static instance: ApprovalService;
  
  /**
   * 获取单例实例
   * @returns ApprovalService 实例
   */
  public static getInstance(): ApprovalService {
    if (!ApprovalService.instance) {
      ApprovalService.instance = new ApprovalService();
    }
    return ApprovalService.instance;
  }
  
  /**
   * 获取审批列表
   * @param params - 查询参数
   * @returns 审批列表响应
   */
  public async fetchApprovalList(params: ListParams): Promise<ApprovalListResponse>;
  
  /**
   * 获取审批详情
   * @param id - 审批 ID
   * @returns 审批详情
   */
  public async getApprovalDetail(id: string): Promise<Approval>;
  
  /**
   * 提交审批
   * @param data - 审批数据
   * @returns 提交结果
   */
  public async submitApproval(data: ApprovalDTO): Promise<SubmitResponse>;
  
  /**
   * 更新审批状态
   * @param id - 审批 ID
   * @param status - 目标状态
   * @returns 更新结果
   */
  public async updateApprovalStatus(id: string, status: ApprovalStatus): Promise<UpdateResponse>;
  
  /**
   * 乐观更新 - 先更新本地状态
   * @private
   * @param id - 审批 ID
   * @param status - 目标状态
   */
  private applyOptimisticUpdate(id: string, status: ApprovalStatus): void;
  
  /**
   * 回滚到原始状态
   * @private
   * @param id - 审批 ID
   * @param originalState - 原始状态
   */
  private rollbackOnFailure(id: string, originalState: Approval): void;
}
```

#### 5.4.2 双向绑定约束

```typescript
/**
 * 双向绑定约束规则
 * 
 * ❌ 禁止模式:
 * store.approvalList = newList  // 直接修改 state
 * 
 * ✓ 正确模式:
 * await store.fetchApprovalList(params)  // 通过 Action 修改
 * 
 * ❌ 禁止模式:
 * this.approvalList = computed(() => store.approvalList)  // 遗漏 reactive
 * 
 * ✓ 正确模式:
 * const approvalList = computed(() => store.approvalList)  // computed 响应式
 * const isLoading = computed(() => store.loadingState.isLoading)
 * 
 * ❌ 禁止模式:
 * component.$el.querySelector('.title').textContent = 'new'  // 直接 DOM 操作
 * 
 * ✓ 正确模式:
 * {{ approval.title }}  // 模板响应式渲染
 */
```

#### 5.4.3 useAuditRealtime.ts 核心约束

```typescript
/**
 * useAuditRealtime Hook 核心约束
 * 
 * 职责:
 * - 监听资产变更事件
 * - 触发审计日志刷新
 * - 管理实时同步状态
 * 
 * 约束:
 * - 禁止直接修改审计日志数据
 * - 必须通过 emit 事件通知外部组件
 * - WebSocket 连接错误需要自动重连
 */
export function useAuditRealtime(options: AuditRealtimeOptions) {
  // ...
}
```

---

## 6. 附录

### 6.1 关键术语定义

| 术语 | 定义 | 英文对照 |
|------|------|----------|
| ApprovalService | 封装审批业务逻辑的服务类，负责 HTTP 请求编排与数据转换 | Approval Service |
| 双向绑定 | 前端状态与服务端数据保持同步的机制，任一方变更自动触发另一方更新 | Two-way Binding |
| 乐观更新 | 先更新本地 UI 再请求后端，若失败则回滚的策略 | Optimistic Update |
| 状态锁 | 防止并发操作冲突的机制，同一审批对象同时只允许一个待处理操作 | Operation Lock |
| 审计实时监听 | 监听资产变更并实时触发审计日志刷新的机制 | Audit Realtime Listening |
| Graphify 知识图谱 | 用于可视化展示审计变更关系的知识图谱组件 | Graphify Knowledge Graph |

### 6.2 参考文档清单

| 文档名称 | 文件路径 | 说明 |
|----------|----------|------|
| API 接口契约 | `docs/api/approval-api-contract.md` | 后端提供的审批相关 API 定义 |
| 审批状态机定义 | `docs/workflow/approval-state-machine.md` | 审批状态流转规则定义 |
| UI 设计规范 | `docs/design/approval-ui-spec.md` | 审批页面 UI 设计规范 |
| 审计模块设计 | `docs/audit/audit-module-design.md` | 审计模块整体设计文档 |
| Graphify 组件文档 | `docs/components/graphify-readme.md` | Graphify 知识图谱组件使用文档 |

### 6.3 相关文件关联

```
本次 Iteration 2 涉及的文件关联:

┌─────────────────────────────────────────────────────────────────────────────┐
│                              核心交付物                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐      ┌─────────────────────┐                       │
│  │ approvalService.ts  │ ──── │ approvalStore.ts    │                       │
│  │  (Service 层)       │      │  (State 层)          │                       │
│  └─────────┬───────────┘      └─────────┬───────────┘                       │
│            │                            │                                    │
│            │         双向绑定            │                                    │
│            └──────────┬─────────────────┘                                    │
│                       │                                                      │
│            ┌─────────▼─────────┐                                             │
│            │ useApprovalBinding│                                            │
│            │   (Hook 层)        │                                            │
│            └─────────┬─────────┘                                             │
│                      │                                                       │
│         ┌───────────┼───────────┐                                             │
│         ▼           ▼           ▼                                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                                   │
│  │ListView   │ │DetailView │ │ Components│                                   │
│  │(视图层)   │ │(视图层)   │ │(组件层)   │                                   │
│  └───────────┘ └───────────┘ └───────────┘                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           关联但不修改的文件                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  useAuditRealtime.ts ──────────► 监听资产变更事件                             │
│       │                                                                     │
│       └─── emit ──► useAuditLogs.ts ──► 审计日志刷新                          │
│                                                                              │
│  GraphifyKnowledgeGraph.tsx ──► 知识图谱可视化展示                            │
│       │                                                                     │
│       └─── 数据源 ──► useAuditLogs.ts (generateGraphifyNodes)               │
│                           │                                                 │
│                           └───► useAuditableFields.ts (convertChanges...)  │
│                                                                              │
│  AssetDetailPage/index.tsx ──► 资产详情页整合入口                             │
│       │                                                                     │
│       ├──► GraphifyKnowledgeGraph ──► 知识图谱展示                           │
│       ├──► useAuditLogs ──► 审计日志列表                                     │
│       └──► useAuditRealtime ──► 实时监听                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 问题排查指南

| 问题现象 | 可能原因 | 排查步骤 | 解决方案 |
|----------|----------|----------|----------|
| 审批列表为空 | API 返回空数据 | 检查 Network 面板 API 响应 | 确认后端数据是否存在 |
| 状态更新后 UI 未刷新 | 未通过 Action 修改 Store | 检查是否直接赋值 store | 改用 `store.fetchApprovalList()` |
| 乐观更新失败未回滚 | `rollbackOnFailure` 未调用 | 检查 Service 方法 try-catch | 确保所有异常路径调用回滚 |
| ImportError 循环依赖 | 文件间相互引用 | 检查 import 路径 | 重构为单向依赖或抽离类型 |
| docstring 缺失警告 | 函数缺少文档注释 | 运行 `test_docstring_coverage.py` | 为所有 public 函数补充注释 |

---

**文档版本**: v2.0  
**编制日期**: 2024  
**适用迭代**: SWARM-052 Iteration 2  
**状态**: 待评审  
**编制人**: SWARM-052 Team  
**审核人**: 待定