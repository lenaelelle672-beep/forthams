# SWARM-052 前端集成-审批流程页面开发
## 规格指导文档 v2.0

---

## 1. 需求与背景

### 1.1 任务概述

**任务编号**: SWARM-052  
**任务名称**: 前端集成-审批流程页面开发  
**迭代版本**: Iteration 2  
**核心交付物**: 完成审批流程前端集成，实现 ApprovalService 双向绑定，搭建审批状态流转 UI 组件与用户交互界面

### 1.2 业务上下文

审批流程模块作为系统核心业务链路，承载以下职责：

- 提供审批任务的查看、提交、审批操作入口
- 实时同步后端审批状态变更
- 呈现审批流程状态机可视化流转
- 支持审批意见的录入与历史查看

### 1.3 技术栈基线

| 层级 | 技术选型 | 版本约束 |
|------|----------|----------|
| 框架 | Vue 3 | ^3.4.x |
| 状态管理 | Pinia | ^2.1.x |
| UI 组件库 | Element Plus | ^2.5.x |
| 状态绑定 | VueUse | ^10.x |
| 流程图渲染 | Mermaid.js | ^10.x |
| HTTP 客户端 | Axios | ^1.6.x |
| 单元测试 | Vitest | ^1.x |
| E2E 测试 | Playwright | ^1.40.x |

### 1.4 Graphify 知识图谱集成目标

本次迭代需解决 **Graphify 知识图谱组件** 显示 "No matching nodes found" 的问题，核心目标：

1. **节点数据映射**: 将审批日志数据正确转换为 Graphify 节点格式
2. **数据源绑定**: 建立审计日志与知识图谱组件的双向数据通道
3. **动态更新**: 实现审批状态变更时图谱节点的实时刷新

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解参照（plan.md 对照）

| Phase ID | Phase 名称 | 范围描述 | 交付状态 |
|----------|------------|----------|----------|
| **Phase 2** | **ApprovalService 双向绑定层** | **本次迭代核心** | **进行中** |
| Phase 1 | 页面骨架与路由配置 | 基础页面结构搭建 | 已完成 |
| Phase 3 | 审批状态流转可视化组件 | 流程图/状态机渲染 | 待后续迭代 |
| Phase 4 | 审批交互操作面板 | 提交/通过/驳回等操作表单 | 待后续迭代 |
| Phase 5 | 全链路联调与回归验证 | 前后端集成测试 | 待后续迭代 |

### 2.2 Iteration 2 核心目标

#### 2.2.1 功能性目标

| 目标编号 | 目标描述 | 验收标准 |
|----------|----------|----------|
| G-01 | ApprovalService 核心方法暴露 | 提供 `fetchApprovalList()`、`getApprovalDetail(id)`、`submitApproval(data)`、`updateApprovalStatus(id, status)` 四个核心方法 |
| G-02 | 双向绑定实现 | ApprovalService 内部状态变更时，UI 自动响应更新；用户操作触发状态变更后自动同步至服务端 |
| G-03 | 列表页数据绑定 | 审批列表页与 ApprovalService approvalList 状态保持同步，延迟不超过 500ms |
| G-04 | 详情页数据绑定 | 审批详情页与 ApprovalService currentApproval 状态保持同步 |
| G-05 | Graphify 节点数据生成 | 审计日志转换为 Graphify 节点数组，格式符合 `GraphifyNode` 接口定义 |

#### 2.2.2 非功能性目标

| 目标编号 | 目标描述 | 约束阈值 |
|----------|----------|----------|
| NF-01 | 初始化加载时间 | 审批列表首屏渲染 ≤ 1.5s |
| NF-02 | 状态更新响应 | 用户操作至 UI 更新 ≤ 300ms |
| NF-03 | 错误恢复 | 网络异常时自动重试 3 次，间隔 1s/2s/4s 指数退避 |

---

## 3. 边界约束

### 3.1 职责边界

```
[前端边界]                              [后端边界]
     │                                       │
     ▼                                       ▼
┌─────────────┐                      ┌─────────────┐
│   UI Layer  │                      │  API Layer  │
│  (Vue SFC)  │                      │  (REST/WS)  │
└──────┬──────┘                      └──────┬──────┘
       │                                     │
       ▼                                     ▼
┌─────────────┐                      ┌─────────────┐
│  Pinia      │  ←─── HTTP/WS ───→   │ Approval    │
│  Store      │                      │ Controller  │
└──────┬──────┘                      └──────┬──────┘
       │                                     │
       ▼                                     ▼
┌─────────────┐                      ┌─────────────┐
│ Approval    │                      │  Service    │
│ Service     │                      │  Layer      │
└─────────────┘                      └─────────────┘
```

**前端职责范围**:

- ApprovalService 的实现与维护
- 双向绑定逻辑的编码
- UI 组件的状态驱动渲染
- 前端表单验证与预处理
- Graphify 节点数据转换与绑定

**非前端职责范围**:

- 后端审批业务逻辑实现
- 数据库持久化操作
- API 接口契约定义（由后端提供）
- 审批规则引擎配置

### 3.2 技术约束

| 约束编号 | 约束类型 | 约束描述 |
|----------|----------|----------|
| C-01 | 禁止直接操作 DOM | 所有状态更新必须通过 Vue 响应式系统，禁止使用 `ref.$el` 或原生 DOM 操作 |
| C-02 | 禁止绕过 Service 层 | UI 组件禁止直接调用 Axios 实例，必须经由 ApprovalService 封装方法 |
| C-03 | 禁止同步 XHR | 所有 HTTP 请求必须为异步，禁止使用 `async: false` 配置 |
| C-04 | 状态不可变原则 | Store 中的 approval 状态禁止直接修改，必须通过 mutations/actions |
| C-05 | Graphify 节点格式约束 | 节点必须包含 `id`、`type`、`label`、`x`、`y` 五个必填字段 |

### 3.3 数据边界

```
ApprovalService 状态树:
approvalStore/
├── approvalList: Approval[]           ← 列表数据（本次绑定范围）
├── currentApproval: Approval          ← 详情数据（本次绑定范围）
├── pendingOperations: Set<string>     ← 操作锁定（本次绑定范围）
├── errorState: Error | null           ← 错误状态（本次绑定范围）
└── loadingState: LoadingState         ← 加载状态（本次绑定范围）

Graphify 节点数据映射:
审计日志 (AuditLog[]) → GraphifyNode[]
├── id: string                        ← 节点唯一标识
├── type: 'asset' | 'approval' | 'user' | 'field'  ← 节点类型
├── label: string                     ← 节点显示名称
├── x: number                         ← 节点 X 坐标
├── y: number                         ← 节点 Y 坐标
├── properties: Record<string, any>   ← 节点属性
└── connections: string[]             ← 关联节点 ID

UI 绑定层:
├── ApprovalListView                  ← 绑定 approvalList
├── ApprovalDetailView                ← 绑定 currentApproval
├── ApprovalStatusBadge               ← 绑定 approval.status
├── ApprovalActionPanel               ← 绑定 pendingOperations
└── GraphifyKnowledgeGraph            ← 绑定审计日志节点
```

### 3.4 迭代范围裁剪声明

**明确排除范围**:

- 审批流程图可视化渲染（Phase 3）
- 审批操作的表单详细校验规则（Phase 4）
- WebSocket 实时推送对接（Phase 5）
- 移动端适配（独立迭代）
- 多语言国际化（独立迭代）

---

## 4. 验收测试基准 (ATB)

### 4.1 单元测试验收

#### 4.1.1 ApprovalService 方法测试

**测试文件**: `tests/unit/services/approvalService.test.ts`

| Test ID | 测试描述 | 测试输入 | 预期输出 | 物理验证方式 |
|---------|----------|----------|----------|--------------|
| UT-01 | `fetchApprovalList()` 返回正确数据结构 | 调用方法，无参数 | 返回 `{ data: Approval[], total: number }` | Vitest + `expect().toMatchObject()` |
| UT-02 | `fetchApprovalList()` 正确处理空数据 | 后端返回 `[]` | Store.approvalList = `[]` | Vitest + `expect(store.approvalList).toHaveLength(0)` |
| UT-03 | `fetchApprovalList()` 错误处理 | 后端返回 500 | Store.errorState 非空，抛出 `ServiceError` | Vitest + `expect().toThrow()` |
| UT-04 | `getApprovalDetail(id)` 返回正确详情 | 传入有效 `id` | 返回对应 Approval 对象 | Vitest + `expect().toMatchObject({ id })` |
| UT-05 | `getApprovalDetail(id)` 处理不存在 ID | 传入无效 `id` | 抛出 `NotFoundError` | Vitest + `expect().rejects.toThrow('NotFoundError')` |
| UT-06 | `submitApproval(data)` 正确提交 | 有效 ApprovalDTO | 返回 `{ success: true, id }` | Vitest + `expect().resolves.toMatchObject({ success: true })` |
| UT-07 | `updateApprovalStatus()` 乐观更新 | 传入 `{ id, status }` | Store 立即更新，异步请求后端 | Vitest mock + `expect(store.currentApproval.status).toBe(newStatus)` |
| UT-08 | `updateApprovalStatus()` 失败回滚 | 更新后后端返回 400 | Store 回滚至原状态，errorState 置位 | Vitest + `expect(store.currentApproval.status).toBe(originalStatus)` |

#### 4.1.2 Graphify 节点转换测试

**测试文件**: `tests/unit/auditService.test.ts`

| Test ID | 测试描述 | 测试输入 | 预期输出 | 物理验证方式 |
|---------|----------|----------|----------|--------------|
| UT-09 | `convertChangesToGraphifyNodes()` 生成有效节点 | FieldChange[] | 返回 GraphifyNode[] 且 `validateGraphifyNodes()` 为 true | Vitest + `expect(validateGraphifyNodes(result)).toBe(true)` |
| UT-10 | `convertChangesToGraphifyNodes()` 处理空变更 | 空数组 | 返回空数组 | Vitest + `expect(result).toHaveLength(0)` |
| UT-11 | `formatAuditLogsToGraphifyNodes()` 节点定位 | AuditLog[] | 每个节点包含 `x`, `y` 坐标 | Vitest + `expect(node.x).toBeDefined()` |
| UT-12 | `validateGraphifyNodes()` 验证必填字段 | GraphifyNode[] | 缺少必填字段时返回 false | Vitest + `expect(validateGraphifyNodes(invalidNodes)).toBe(false)` |

#### 4.1.3 双向绑定测试

**测试文件**: `tests/unit/auditableBinding.test.ts`

| Test ID | 测试描述 | 测试输入 | 预期输出 | 物理验证方式 |
|---------|----------|----------|----------|--------------|
| UT-13 | Service 状态变更触发 UI 更新 | 外部修改 `store.approvalList` | Vue 组件 `data` 属性同步变更 | Vitest + `nextTick()` + `expect(wrapper.vm.listData).toEqual(...)` |
| UT-14 | UI 操作触发 Service 更新 | 用户触发 `handleApprove()` | `service.updateApprovalStatus()` 被调用 | Vitest + `vi.fn()` spy + `wrapper.vm.handleApprove()` |
| UT-15 | 并发操作互斥验证 | 同时触发多个审批操作 | 第二个操作进入 `pendingOperations` 队列 | Vitest + `expect(store.pendingOperations.size).toBe(1)` |

### 4.2 组件测试验收

**测试文件**: `tests/unit/components/approvalBinding.test.ts`

| Test ID | 测试描述 | 测试输入 | 预期输出 | 物理验证方式 |
|---------|----------|----------|----------|--------------|
| UT-16 | 列表渲染正确数量 | `approvalList = [A, B, C]` | 渲染 3 个 `ApprovalItem` 组件 | Vue Test Utils + `findAllComponents(ApprovalItem).length` |
| UT-17 | 加载状态显示 | `loadingState.isLoading = true` | 显示 Loading 骨架屏 | Vue Test Utils + `expect(wrapper.find('.loading-skeleton').exists()).toBe(true)` |
| UT-18 | 空状态显示 | `approvalList = []` 且 `!loading` | 显示空状态插画与文案 | Vue Test Utils + `expect(wrapper.find('.empty-state').exists()).toBe(true)` |
| UT-19 | 错误状态显示 | `errorState` 非空 | 显示错误提示与重试按钮 | Vue Test Utils + `expect(wrapper.find('.error-alert').exists()).toBe(true)` |

### 4.3 E2E 测试验收

**测试文件**: `tests/e2e/assetDetail.audit.spec.ts`

#### 4.3.1 Graphify 知识图谱测试

| Test ID | 测试场景 | 操作步骤 | 预期结果 | 物理验证方式 |
|---------|----------|----------|----------|--------------|
| E2E-01 | 图谱正常渲染 | 进入资产详情页 | 显示 Graphify 图谱组件，无 "No matching nodes" 提示 | Playwright + `expect(page.locator('.graph-container')).toBeVisible()` |
| E2E-02 | 节点数量正确 | 存在 5 条审计日志 | 渲染 5 个资产相关节点 | Playwright + `expect(page.locator('.graph-node')).toHaveCount(5)` |
| E2E-03 | 节点悬停显示详情 | 鼠标悬停节点 | 显示 Tooltip 包含变更字段信息 | Playwright + `page.hover('.graph-node')` + `expect('.node-tooltip').toBeVisible()` |
| E2E-04 | 节点点击交互 | 点击节点 | 高亮显示关联边 | Playwright + `page.click('.graph-node')` + `expect('.edge-active').toHaveCount(n)` |
| E2E-05 | 审批状态变更刷新 | 执行审批操作后 | 图谱节点状态同步更新 | Playwright + 触发审批 + `expect(page.locator('.node-status')).toHaveText('已通过')` |

#### 4.3.2 审批列表页测试

| Test ID | 测试场景 | 操作步骤 | 预期结果 | 物理验证方式 |
|---------|----------|----------|----------|--------------|
| E2E-06 | 审批列表正常加载 | 访问 `/approval/list` | 列表显示且数据与后端一致 | Playwright + `expect(page.locator('.approval-item')).toHaveCount(n)` |
| E2E-07 | 审批列表分页 | 点击第二页 | URL 更新，列表切换，数据正确 | Playwright + `expect(request).toMatch(/page=2/)` |
| E2E-08 | 审批列表筛选 | 选择状态筛选「待审批」 | 仅显示待审批项 | Playwright + `page.selectOption()` + `expect().toHaveCount(filtered)` |

#### 4.3.3 审批详情页测试

| Test ID | 测试场景 | 操作步骤 | 预期结果 | 物理验证方式 |
|---------|----------|----------|----------|--------------|
| E2E-09 | 详情页加载 | 点击列表项进入详情 | 详情数据完整展示 | Playwright + `expect(page.locator('.approval-title')).toBeVisible()` |
| E2E-10 | 详情页状态同步 | 详情页打开时后端状态变更 | 页面显示最新状态（≤ 500ms） | Playwright + `page.evaluate()` 模拟后端推送 |
| E2E-11 | 返回列表状态保留 | 从详情页返回列表 | 列表保持之前的筛选/分页状态 | Playwright + `expect(sessionStorage.getItem())` |

#### 4.3.4 审批操作测试

| Test ID | 测试场景 | 操作步骤 | 预期结果 | 物理验证方式 |
|---------|----------|----------|----------|--------------|
| E2E-12 | 提交审批 | 填写表单并点击提交 | 加载指示器 → 成功提示 → 跳转列表 | Playwright + `page.click('.submit-btn')` + `expect().toHaveURL(/list/)` |
| E2E-13 | 操作锁定验证 | 提交审批后快速点击 | 按钮禁用，无重复提交 | Playwright + `expect(page.locator('.submit-btn')).toBeDisabled()` |
| E2E-14 | 操作失败提示 | 模拟提交失败 | 显示错误提示，按钮恢复 | Playwright + mock API 500 + `expect(page.locator('.error-toast')).toBeVisible()` |
| E2E-15 | 操作成功状态更新 | 审批通过操作 | 列表项状态立即更新为「已通过」 | Playwright + `expect(page.locator('.status-badge')).toHaveText('已通过')` |

### 4.4 性能测试验收

| Test ID | 测试指标 | 测试方法 | 阈值要求 | 物理验证方式 |
|---------|----------|----------|----------|--------------|
| PERF-01 | 首屏加载时间 | Lighthouse CI | FCP ≤ 1.5s | Playwright + `page.evaluate()` timing |
| PERF-02 | 列表渲染性能 | 100 条数据渲染 | TTI ≤ 2s | Playwright + Performance API |
| PERF-03 | 状态更新响应 | 触发审批操作 | UI 更新 ≤ 300ms | Playwright + `performance.now()` |
| PERF-04 | 图谱渲染性能 | 50 个节点渲染 | 渲染时间 ≤ 500ms | Playwright + `performance.mark()` |
| PERF-05 | 内存泄漏检测 | 多次进出审批页面 | 无 detached 组件 | Chrome DevTools Protocol + `takeHeapSnapshot()` |

---

## 5. 开发切入层级序列

### 5.1 依赖关系图

```
Layer 0: 环境与配置层
    ↓ 依赖: Node.js, pnpm, TypeScript
Layer 1: 基础设施层
    ↓ 依赖: axios 实例, Vue Router, Pinia
Layer 2: 服务抽象层 (ApprovalService)
    ↓ 依赖: Layer 1
Layer 3: 状态管理层 (approvalStore)
    ↓ 依赖: Layer 2
Layer 4: 节点转换层 (Graphify 节点生成)
    ↓ 依赖: Layer 1-2
Layer 5: 组件层 (UI Components)
    ↓ 依赖: Layer 3-4
Layer 6: 视图层 (Views)
    ↓ 依赖: Layer 5
Layer 7: 测试与验证层
    ↓ 依赖: Layer 0-6
```

### 5.2 编码切入顺序

#### Phase 1: 基础设施配置 (预计 0.5d)

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 1.1 | 配置 API Base URL 环境变量 | `.env.production` | 无 |
| 1.2 | 配置 Axios 实例拦截器 | `src/utils/http.ts` | 无 |
| 1.3 | 配置 Vue Router 审批路由 | `src/router/approval.ts` | 无 |
| 1.4 | 初始化 Pinia Store 骨架 | `src/stores/approvalStore.ts` | 无 |

#### Phase 2: ApprovalService 核心实现 (预计 2d)

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 2.1 | 定义 TypeScript 类型接口 | `src/types/approval.ts` | 无 |
| 2.2 | 实现 ApprovalService 类骨架 | `src/services/approvalService.ts` | 2.1 |
| 2.3 | 实现 `fetchApprovalList()` 方法 | `src/services/approvalService.ts` | 2.2 |
| 2.4 | 实现 `getApprovalDetail()` 方法 | `src/services/approvalService.ts` | 2.2 |
| 2.5 | 实现 `submitApproval()` 方法 | `src/services/approvalService.ts` | 2.2 |
| 2.6 | 实现 `updateApprovalStatus()` 方法（含乐观更新） | `src/services/approvalService.ts` | 2.2 |
| 2.7 | 实现错误处理与重试逻辑 | `src/services/approvalService.ts` | 2.6 |
| 2.8 | 单元测试覆盖 ApprovalService | `tests/unit/services/approvalService.test.ts` | 2.3-2.7 |

#### Phase 3: Graphify 节点转换实现 (预计 1.5d)

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 3.1 | 定义 GraphifyNode 接口 | `src/types/audit.types.ts` | 无 |
| 3.2 | 实现 `convertChangesToGraphifyNodes()` | `src/app/hooks/useAuditableFields.ts` | 3.1 |
| 3.3 | 实现 `formatAuditLogsToGraphifyNodes()` | `src/pages/AssetDetailPage/types/audit.types.ts` | 3.1 |
| 3.4 | 实现 `validateGraphifyNodes()` | `src/pages/AssetDetailPage/types/audit.types.ts` | 3.3 |
| 3.5 | 单元测试覆盖节点转换函数 | `tests/unit/auditService.test.ts` | 3.2-3.4 |

#### Phase 4: Pinia Store 双向绑定实现 (预计 1.5d)

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 4.1 | 定义 Store State 结构 | `src/stores/approvalStore.ts` | 2.1 |
| 4.2 | 实现 Getters（派生状态） | `src/stores/approvalStore.ts` | 4.1 |
| 4.3 | 实现 Actions（调用 Service） | `src/stores/approvalStore.ts` | 4.2, 2.3-2.6 |
| 4.4 | 实现 Mutators（状态修改） | `src/stores/approvalStore.ts` | 4.3 |
| 4.5 | 实现双向绑定 Hook | `src/composables/useApprovalBinding.ts` | 4.4 |
| 4.6 | 单元测试覆盖 Store 与 Binding | `tests/unit/stores/approvalStore.test.ts` | 4.1-4.5 |

#### Phase 5: UI 组件开发 (预计 2d)

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 5.1 | 开发 `ApprovalListItem` 组件 | `src/components/approval/ApprovalListItem.vue` | 4.5 |
| 5.2 | 开发 `ApprovalStatusBadge` 组件 | `src/components/approval/ApprovalStatusBadge.vue` | 5.1 |
| 5.3 | 开发 `ApprovalFilter` 组件 | `src/components/approval/ApprovalFilter.vue` | 5.2 |
| 5.4 | 开发 `ApprovalActionPanel` 组件 | `src/components/approval/ApprovalActionPanel.vue` | 4.5 |
| 5.5 | 集成 GraphifyKnowledgeGraph 组件 | `src/components/audit/GraphifyKnowledgeGraph.tsx` | 3.5 |
| 5.6 | 组件单元测试覆盖 | `tests/unit/components/*.test.ts` | 5.1-5.5 |

#### Phase 6: 视图层组装 (预计 1d)

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 6.1 | 组装 `ApprovalListView` | `src/views/approval/ApprovalListView.vue` | 5.1-5.3 |
| 6.2 | 组装 `ApprovalDetailView` | `src/views/approval/ApprovalDetailView.vue` | 5.4, 5.5 |
| 6.3 | 集成路由守卫（权限控制） | `src/router/approval.ts` | 6.1, 6.2 |
| 6.4 | 视图层集成测试 | `tests/unit/views/*.test.ts` | 6.1-6.3 |

#### Phase 7: E2E 验证 (预计 0.5d)

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 7.1 | 编写 E2E 测试用例 | `tests/e2e/*.spec.ts` | 6.1-6.4 |
| 7.2 | 执行 Playwright E2E 测试 | CI/CD Pipeline | 7.1 |
| 7.3 | 修复 E2E 失败用例并回归 | - | 7.2 |

### 5.3 代码路径规范

```
src/
├── api/
│   └── approval.ts                    # API 请求函数封装
├── components/
│   ├── audit/
│   │   ├── GraphifyKnowledgeGraph.tsx # Graphify 知识图谱组件
│   │   └── FieldChangeDiff.tsx        # 字段变更差异组件
│   └── approval/
│       ├── ApprovalListItem.vue
│       ├── ApprovalStatusBadge.vue
│       ├── ApprovalFilter.vue
│       ├── ApprovalActionPanel.vue
│       └── index.ts                   # 组件导出
├── composables/
│   ├── useApprovalBinding.ts          # 双向绑定 Hook
│   ├── useAuditLogs.ts                # 审计日志 Hook
│   └── useApprovalPermission.ts       # 权限判断 Hook
├── hooks/
│   └── useAuditLogs.ts                # 审计日志数据源
├── pages/
│   └── AssetDetailPage/
│       ├── index.tsx                  # 资产详情页（集成 Graphify）
│       ├── types/
│       │   └── audit.types.ts         # Graphify 节点类型与转换函数
│       ├── hooks/
│       │   └── useAuditLogs.ts       # 资产审计日志 Hook
│       └── config/
│           └── auditableFieldMap.ts  # 可审计字段映射
├── services/
│   ├── approvalService.ts              # ApprovalService 核心类
│   ├── auditService.ts                 # 审计服务
│   └── auditApi.ts                    # 审计 API 调用
├── stores/
│   ├── approvalStore.ts                # Pinia Store
│   └── approvalStore.test.ts           # Store 单元测试
├── styles/
│   └── audit-highlight.css             # 审计高亮样式
├── types/
│   └── approval.ts                     # 审批类型定义
├── utils/
│   └── http.ts                         # Axios 实例配置
├── views/
│   └── approval/
│       ├── ApprovalListView.vue
│       └── ApprovalDetailView.vue
└── router/
    └── approval.ts                     # 审批路由配置
```

### 5.4 关键实现约束

#### 5.4.1 ApprovalService 实现约束

```typescript
/**
 * ApprovalService 单例模式约束
 * @description 强制约束: ApprovalService 必须为单例模式
 */
class ApprovalService {
  private static instance: ApprovalService;
  
  public static getInstance(): ApprovalService {
    if (!ApprovalService.instance) {
      ApprovalService.instance = new ApprovalService();
    }
    return ApprovalService.instance;
  }
  
  /**
   * 获取审批列表
   * @param params - 分页与筛选参数
   * @returns 审批列表响应
   */
  public async fetchApprovalList(params: ListParams): Promise<ApprovalListResponse>;
  
  /**
   * 获取审批详情
   * @param id - 审批记录 ID
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
   * @param id - 审批记录 ID
   * @param status - 新状态
   * @returns 更新结果
   */
  public async updateApprovalStatus(id: string, status: ApprovalStatus): Promise<UpdateResponse>;
  
  // 内部方法约束
  private applyOptimisticUpdate(id: string, status: ApprovalStatus): void;
  private rollbackOnFailure(id: string, originalState: Approval): void;
}
```

#### 5.4.2 Graphify 节点转换约束

```typescript
/**
 * 字段变更转 Graphify 节点
 * @param changes - 字段变更数组
 * @param assetId - 资产 ID
 * @returns Graphify 节点数组
 */
export function convertChangesToGraphifyNodes(
  changes: FieldChange[],
  assetId: string
): GraphifyNode[] {
  return changes.map((change, index) => {
    // 必须包含的字段
    const node: GraphifyNode = {
      id: `${assetId}-${change.fieldName}-${index}`,
      type: 'field',                    // 节点类型
      label: change.fieldName,          // 显示名称
      x: calculateNodeX(index),         // X 坐标
      y: calculateNodeY(index),         // Y 坐标
      properties: {
        oldValue: change.oldValue,
        newValue: change.newValue,
        assetId: assetId
      }
    };
    return node;
  });
}

/**
 * 验证 Graphify 节点数组有效性
 * @param nodes - 节点数组
 * @returns 是否有效
 */
export function validateGraphifyNodes(nodes: GraphifyNode[]): boolean {
  if (!Array.isArray(nodes)) return false;
  if (nodes.length === 0) return true;
  
  return nodes.every(
    (node) =>
      node.id &&                    // 必填: 节点 ID
      node.type &&                  // 必填: 节点类型
      node.label &&                // 必填: 节点标签
      typeof node.x === 'number' && // 必填: X 坐标
      typeof node.y === 'number'    // 必填: Y 坐标
  );
}
```

#### 5.4.3 双向绑定约束

```typescript
// 强制约束: 必须通过 Pinia Action 触发所有状态变更
// ❌ 禁止: 直接修改 store.approvalList = newList
// ✓ 正确: await store.fetchApprovalList(params)

// 强制约束: UI 组件必须使用 computed 属性绑定
const approvalList = computed(() => store.approvalList);
const isLoading = computed(() => store.loadingState.isLoading);

// 强制约束: Graphify 组件必须接收有效节点数据
const graphifyNodes = computed(() => {
  const nodes = formatAuditLogsToGraphifyNodes(auditLogs.value);
  return validateGraphifyNodes(nodes) ? nodes : [];
});
```

---

## 6. 附录

### 6.1 关键术语定义

| 术语 | 定义 |
|------|------|
| ApprovalService | 封装审批业务逻辑的服务类，负责 HTTP 请求编排与数据转换 |
| 双向绑定 | 前端状态与服务端数据保持同步的机制，任一方变更自动触发另一方更新 |
| 乐观更新 | 先更新本地 UI 再请求后端，若失败则回滚的策略 |
| 状态锁 | 防止并发操作冲突的机制，同一审批对象同时只允许一个待处理操作 |
| GraphifyNode | 知识图谱组件的节点数据结构定义 |
| 节点转换 | 将审计日志数据转换为 Graphify 组件可识别的节点格式 |

### 6.2 参考文档

| 文档名称 | 路径 |
|----------|------|
| API 接口契约 | `docs/api/approval-api-contract.md` |
| 审批状态机定义 | `docs/workflow/approval-state-machine.md` |
| UI 设计规范 | `docs/design/approval-ui-spec.md` |
| Graphify 组件文档 | `src/components/audit/GraphifyKnowledgeGraph.tsx` |

### 6.3 类型接口定义

```typescript
/**
 * Graphify 节点接口定义
 */
interface GraphifyNode {
  /** 节点唯一标识 */
  id: string;
  /** 节点类型: asset | approval | user | field */
  type: 'asset' | 'approval' | 'user' | 'field';
  /** 节点显示名称 */
  label: string;
  /** 节点 X 坐标 */
  x: number;
  /** 节点 Y 坐标 */
  y: number;
  /** 节点附加属性 */
  properties?: Record<string, any>;
  /** 关联节点 ID 列表 */
  connections?: string[];
  /** 节点尺寸（可选） */
  size?: number;
}

/**
 * 审计日志接口
 */
interface AuditLog {
  id: string;
  assetId: string;
  action: string;
  operator: string;
  timestamp: number;
  changes?: FieldChange[];
}

/**
 * 字段变更接口
 */
interface FieldChange {
  fieldName: string;
  oldValue: string;
  newValue: string;
}
```

---

**文档版本**: v2.0  
**编制日期**: 2024  
**适用迭代**: SWARM-052 Iteration 2  
**状态**: 待评审  
**审核记录**:

| 版本 | 日期 | 审核人 | 变更说明 |
|------|------|--------|----------|
| v1.0 | - | - | 初始版本 |
| v2.0 | - | - | 新增 Graphify 知识图谱集成目标与验收标准 |