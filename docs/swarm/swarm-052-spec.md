# SWARM-052 前端集成-审批流程页面开发

## 规格指导文档 v2.0

---

## 1. 需求与背景

### 1.1 任务概述

| 属性 | 内容 |
|------|------|
| **任务编号** | SWARM-052 |
| **任务名称** | 前端集成-审批流程页面开发 |
| **迭代版本** | Iteration 2 |
| **核心交付物** | 完成审批流程前端集成，实现 ApprovalService 双向绑定，搭建审批状态流转 UI 组件与用户交互界面 |
| **状态** | 进行中 |

### 1.2 业务背景

审批流程模块作为资产管理系统的核心业务链路，承担以下职责：

1. **任务管理** - 提供审批任务的查看、提交、审批操作入口
2. **状态同步** - 实时同步后端审批状态变更
3. **流程可视化** - 呈现审批流程状态机可视化流转
4. **意见管理** - 支持审批意见的录入与历史查看

### 1.3 技术栈基线

| 层级 | 技术选型 | 版本约束 |
|------|----------|----------|
| 前端框架 | React 18 / Vue 3 | ^18.x / ^3.4.x |
| 状态管理 | Zustand / Pinia | ^4.x / ^2.1.x |
| UI 组件库 | Ant Design | ^5.x |
| HTTP 客户端 | Axios | ^1.6.x |
| 路由管理 | React Router / Vue Router | ^6.x / ^4.x |
| 单元测试 | Vitest / Jest | ^1.x / ^29.x |
| E2E 测试 | Playwright | ^1.40.x |

### 1.4 依赖关系

```
SWARM-052 依赖关系图:

┌─────────────────┐
│  SWARM-051      │  (后端审批服务 API 契约定义)
│  审批 API 定义   │
└────────┬────────┘
         │ API 契约文档
         ▼
┌─────────────────┐
│  SWARM-052      │◄── 本次迭代
│  前端集成       │
└────────┬────────┘
         │ 前端集成完成
         ▼
┌─────────────────┐
│  SWARM-053      │  (审批流程可视化开发)
│  流程图组件     │
└─────────────────┘
```

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解（基于 plan.md）

根据项目计划，审批流程前端开发分为以下 Phase：

| Phase ID | Phase 名称 | 范围描述 | 迭代归属 | 状态 |
|----------|------------|----------|----------|------|
| **Phase 1** | **页面骨架与路由配置** | 基础页面结构、路由定义、布局组件 | Iteration 1 | ✅ 已完成 |
| **Phase 2** | **ApprovalService 双向绑定层** | 核心服务类、数据绑定逻辑、状态管理 | **Iteration 2** | 🔄 进行中 |
| Phase 3 | 审批状态流转可视化组件 | 流程图/状态机渲染 | Iteration 3 | 📋 待开发 |
| Phase 4 | 审批交互操作面板 | 提交/通过/驳回等操作表单 | Iteration 3 | 📋 待开发 |
| Phase 5 | 全链路联调与回归验证 | 前后端集成测试、性能测试 | Iteration 4 | 📋 待开发 |

### 2.2 Iteration 2 核心目标

**Iteration 2 定位**：实现 ApprovalService 与前端视图的双向数据绑定，建立实时状态同步通道。

#### 2.2.1 功能性目标

| 目标编号 | 目标描述 | 验收标准 | 优先级 |
|----------|----------|----------|--------|
| G-01 | ApprovalService 核心方法暴露 | 提供 `fetchApprovalList()`、`getApprovalDetail(id)`、`submitApproval(data)`、`updateApprovalStatus(id, status)` 四个核心方法 | P0 |
| G-02 | 双向绑定实现 | ApprovalService 内部状态变更时，UI 自动响应更新；用户操作触发状态变更后自动同步至服务端 | P0 |
| G-03 | 列表页数据绑定 | 审批列表页与 ApprovalService approvalList 状态保持同步，延迟不超过 500ms | P0 |
| G-04 | 详情页数据绑定 | 审批详情页与 ApprovalService currentApproval 状态保持同步 | P1 |
| G-05 | 状态锁定机制 | 防止并发操作冲突，同一审批对象同时只允许一个待处理操作 | P1 |

#### 2.2.2 非功能性目标

| 目标编号 | 目标描述 | 约束阈值 | 验证方法 |
|----------|----------|----------|----------|
| NF-01 | 初始化加载时间 | 审批列表首屏渲染 ≤ 1.5s | Lighthouse CI |
| NF-02 | 状态更新响应 | 用户操作至 UI 更新 ≤ 300ms | Playwright Performance API |
| NF-03 | 错误恢复 | 网络异常时自动重试 3 次，间隔 1s/2s/4s 指数退避 | 单元测试 |
| NF-04 | 代码覆盖率 | 核心业务逻辑覆盖率 ≥ 80% | Vitest coverage |

---

## 3. 边界约束

### 3.1 职责边界

```
┌─────────────────────────────────────────────────────────────────────┐
│                          前端边界                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐           │
│  │  UI Layer   │     │   Store     │     │  Service    │           │
│  │  (Views)    │◄───►│  (Zustand)  │◄───►│  (Service)  │           │
│  └─────────────┘     └─────────────┘     └──────┬──────┘           │
│                                                 │                   │
└─────────────────────────────────────────────────│───────────────────┘
                                                  │ HTTP/WebSocket
┌─────────────────────────────────────────────────│───────────────────┐
│                          后端边界               │                   │
├─────────────────────────────────────────────────┼───────────────────┤
│                                                 ▼                   │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐           │
│  │ Controller  │────►│   Service   │────►│ Repository  │           │
│  │   Layer     │     │   Layer     │     │   Layer     │           │
│  └─────────────┘     └─────────────┘     └─────────────┘           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**前端职责范围**：

| 职责域 | 具体内容 |
|--------|----------|
| ApprovalService 实现 | 服务类封装、HTTP 请求编排、数据转换 |
| 双向绑定逻辑 | 状态同步机制、响应式更新 |
| UI 组件开发 | 审批列表、详情页、操作面板等 |
| 前端表单验证 | 客户端输入校验、格式校验 |

**非前端职责范围**（由后端或独立迭代负责）：

| 排除项 | 说明 |
|--------|------|
| 后端审批业务逻辑 | 数据库持久化、业务规则引擎 |
| WebSocket 实时推送 | 推送服务配置、消息队列 |
| 移动端适配 | 响应式布局、移动端特定交互 |
| 多语言国际化 | i18n 配置、翻译资源 |

### 3.2 技术约束

| 约束编号 | 约束类型 | 约束描述 |
|----------|----------|----------|
| C-01 | 禁止直接操作 DOM | 所有状态更新必须通过响应式系统，禁止使用 `document.querySelector` 或 `ref.$el` |
| C-02 | 禁止绕过 Service 层 | UI 组件禁止直接调用 Axios 实例，必须经由 ApprovalService 封装方法 |
| C-03 | 禁止同步 XHR | 所有 HTTP 请求必须为异步，禁止使用 `async: false` 配置 |
| C-04 | 状态不可变原则 | Store 中的 approval 状态禁止直接修改，必须通过 actions |
| C-05 | 错误边界 | 组件必须实现 ErrorBoundary 捕获渲染错误 |

### 3.3 数据边界

```typescript
// ApprovalService 状态树定义
interface ApprovalState {
  // 列表数据（本次绑定范围）
  approvalList: Approval[];
  
  // 详情数据（本次绑定范围）
  currentApproval: Approval | null;
  
  // 操作锁定状态（本次绑定范围）
  pendingOperations: Set<string>;
  
  // 错误状态
  errorState: ErrorState | null;
  
  // 加载状态
  loadingState: LoadingState;
}

// UI 绑定层职责划分
const BindingScope = {
  // 绑定 approvalList
  ApprovalListView: ['approvalList', 'loadingState.isLoading', 'errorState'],
  
  // 绑定 currentApproval
  ApprovalDetailView: ['currentApproval', 'loadingState.isDetailLoading'],
  
  // 绑定审批状态
  ApprovalStatusBadge: ['approval.status'],
  
  // 绑定操作状态
  ApprovalActionPanel: ['pendingOperations', 'errorState']
} as const;
```

### 3.4 迭代范围裁剪声明

**本次迭代明确排除**：

| 排除项 | 排除原因 | 归属迭代 |
|--------|----------|----------|
| 审批流程图可视化渲染 | 需要 Mermaid.js 集成 | Iteration 3 |
| 审批操作表单详细校验规则 | 表单验证逻辑复杂 | Iteration 3 |
| WebSocket 实时推送对接 | 需要后端推送服务支持 | Iteration 5 |
| 审批历史时间线组件 | UI 组件独立可测试 | Iteration 3 |
| 移动端适配 | 需要专项测试 | 独立迭代 |

---

## 4. 验收测试基准 (ATB)

### 4.1 测试分层架构

```
┌─────────────────────────────────────────┐
│         E2E Tests (Playwright)          │  ← 用户视角端到端验证
├─────────────────────────────────────────┤
│       Component Tests (Vitest)          │  ← 组件行为验证
├─────────────────────────────────────────┤
│      Service/Store Tests (Vitest)       │  ← 业务逻辑验证
├─────────────────────────────────────────┤
│        Unit Tests (Vitest)              │  ← 工具函数/类型验证
└─────────────────────────────────────────┘
```

### 4.2 单元测试验收

**测试文件路径**: `frontend/tests/unit/auditLog.test.ts`

#### 4.2.1 ApprovalService 方法测试

| Test ID | 测试描述 | 测试输入 | 预期输出 | 验证方式 |
|---------|----------|----------|----------|----------|
| UT-01 | `fetchApprovalList()` 返回正确数据结构 | 调用方法，无参数 | 返回 `{ data: Approval[], total: number }` | `expect().toMatchObject()` |
| UT-02 | `fetchApprovalList()` 处理空数据 | 后端返回 `[]` | Store.approvalList = `[]` | `expect().toHaveLength(0)` |
| UT-03 | `fetchApprovalList()` 错误处理 | 后端返回 500 | 抛出 `ServiceError`，errorState 置位 | `expect().toThrow()` |
| UT-04 | `getApprovalDetail(id)` 返回正确详情 | 传入有效 `id` | 返回对应 Approval 对象 | `expect().toMatchObject({ id })` |
| UT-05 | `getApprovalDetail(id)` 处理不存在 ID | 传入无效 `id` | 抛出 `NotFoundError` | `expect().rejects.toThrow()` |
| UT-06 | `submitApproval(data)` 正确提交 | 有效 ApprovalDTO | 返回 `{ success: true, id }` | `expect().resolves.toMatchObject()` |
| UT-07 | `updateApprovalStatus()` 乐观更新 | 传入 `{ id, status }` | Store 立即更新，异步请求后端 | Vitest mock + `expect().toBe()` |
| UT-08 | `updateApprovalStatus()` 失败回滚 | 更新后后端返回 400 | Store 回滚至原状态 | `expect().toBe(originalStatus)` |

#### 4.2.2 双向绑定测试

| Test ID | 测试描述 | 测试输入 | 预期输出 | 验证方式 |
|---------|----------|----------|----------|----------|
| UT-09 | Service 状态变更触发 UI 更新 | 外部修改 store.approvalList | Vue 组件 data 属性同步变更 | `nextTick()` + `expect()` |
| UT-10 | UI 操作触发 Service 更新 | 用户触发 handleApprove() | `service.updateApprovalStatus()` 被调用 | `vi.fn()` spy |
| UT-11 | 并发操作互斥验证 | 同时触发多个审批操作 | 第二个操作进入 pendingOperations 队列 | `expect().toBe(1)` |

### 4.3 组件测试验收

**测试文件**: `frontend/tests/unit/components/approvalList.test.ts`

| Test ID | 测试描述 | 测试输入 | 预期输出 | 验证方式 |
|---------|----------|----------|----------|----------|
| UT-12 | 列表渲染正确数量 | approvalList = [A, B, C] | 渲染 3 个 ApprovalItem 组件 | `findAllComponents().length` |
| UT-13 | 加载状态显示 | loadingState.isLoading = true | 显示 Loading 骨架屏 | `expect().toBeVisible()` |
| UT-14 | 空状态显示 | approvalList = [] 且 !loading | 显示空状态插画与文案 | `expect().toBeVisible()` |
| UT-15 | 错误状态显示 | errorState 非空 | 显示错误提示与重试按钮 | `expect().toBeVisible()` |

### 4.4 E2E 测试验收

**测试文件**: `frontend/tests/e2e/assetDetail.audit.spec.ts`

#### 4.4.1 审批列表页测试

| Test ID | 测试场景 | 操作步骤 | 预期结果 | 验证方式 |
|---------|----------|----------|----------|----------|
| E2E-01 | 审批列表正常加载 | 访问 /approval/list | 列表显示且数据与后端一致 | `toHaveCount(n)` |
| E2E-02 | 审批列表分页 | 点击第二页 | URL 更新，列表切换，数据正确 | `toMatch(/page=2/)` |
| E2E-03 | 审批列表筛选 | 选择状态筛选「待审批」 | 仅显示待审批项 | `selectOption()` |
| E2E-04 | 审批列表搜索 | 输入关键词搜索 | 返回匹配结果（debounce 300ms） | `fill()` + wait |

#### 4.4.2 审批详情页测试

| Test ID | 测试场景 | 操作步骤 | 预期结果 | 验证方式 |
|---------|----------|----------|----------|----------|
| E2E-05 | 详情页加载 | 点击列表项进入详情 | 详情数据完整展示 | `toBeVisible()` |
| E2E-06 | 详情页状态同步 | 详情页打开时后端状态变更 | 页面显示最新状态（≤ 500ms） | `evaluate()` 模拟 |
| E2E-07 | 返回列表状态保留 | 从详情页返回列表 | 列表保持之前的筛选/分页状态 | `sessionStorage` |

#### 4.4.3 审批操作测试

| Test ID | 测试场景 | 操作步骤 | 预期结果 | 验证方式 |
|---------|----------|----------|----------|----------|
| E2E-08 | 提交审批 | 填写表单并点击提交 | 加载指示器 → 成功提示 → 跳转列表 | `click()` + `toHaveURL()` |
| E2E-09 | 操作锁定验证 | 提交审批后快速点击 | 按钮禁用，无重复提交 | `toBeDisabled()` |
| E2E-10 | 操作失败提示 | 模拟提交失败 | 显示错误提示，按钮恢复 | mock API 500 |
| E2E-11 | 操作成功状态更新 | 审批通过操作 | 列表项状态立即更新为「已通过」 | `toHaveText()` |

### 4.5 性能测试验收

| Test ID | 测试指标 | 测试方法 | 阈值要求 | 验证方式 |
|---------|----------|----------|----------|----------|
| PERF-01 | 首屏加载时间 | Lighthouse CI FCP | ≤ 1.5s | Playwright timing |
| PERF-02 | 列表渲染性能 | 100 条数据渲染 TTI | ≤ 2s | Performance API |
| PERF-03 | 状态更新响应 | 触发审批操作 | ≤ 300ms | `performance.now()` |
| PERF-04 | 内存泄漏检测 | 多次进出审批页面 | 无 detached 组件 | heap snapshot |

---

## 5. 开发切入层级序列

### 5.1 依赖关系图

```
Layer 0: 环境与配置层
    │
    │ 依赖: Node.js 18+, pnpm, TypeScript 5.x
    │
    ▼
Layer 1: 基础设施层
    │
    │ 依赖: axios 实例, React Router/Vue Router, Zustand/Pinia
    │
    ▼
Layer 2: 服务抽象层 (ApprovalService)
    │
    │ 依赖: Layer 1
    │
    ▼
Layer 3: 状态管理层 (approvalStore)
    │
    │ 依赖: Layer 2
    │
    ▼
Layer 4: 组件层 (UI Components)
    │
    │ 依赖: Layer 3
    │
    ▼
Layer 5: 视图层 (Views)
    │
    │ 依赖: Layer 4
    │
    ▼
Layer 6: 测试与验证层
    │
    │ 依赖: Layer 0-5
    │
    ▼
完成
```

### 5.2 编码切入顺序

#### Phase 1: 基础设施配置 (预计 0.5d)

| 序号 | 任务 | 交付物 | 依赖前置 | 状态 |
|------|------|--------|----------|------|
| 1.1 | 配置 API Base URL 环境变量 | `.env.production` | 无 | ✅ |
| 1.2 | 配置 Axios 实例拦截器 | `frontend/src/utils/http.ts` | 无 | ✅ |
| 1.3 | 配置路由审批模块 | `frontend/src/app/routes.ts` | 无 | ✅ |
| 1.4 | 初始化 Store 骨架 | `frontend/src/stores/approvalStore.ts` | 无 | ✅ |

#### Phase 2: ApprovalService 核心实现 (预计 2d)

| 序号 | 任务 | 交付物 | 依赖前置 | 状态 |
|------|------|--------|----------|------|
| 2.1 | 定义 TypeScript 类型接口 | `frontend/src/types/audit.types.ts` | 无 | ✅ |
| 2.2 | 实现 ApprovalService 类骨架 | `frontend/src/services/approvalService.ts` | 2.1 | ✅ |
| 2.3 | 实现 `fetchApprovalList()` 方法 | `frontend/src/services/approvalService.ts` | 2.2 | ✅ |
| 2.4 | 实现 `getApprovalDetail()` 方法 | `frontend/src/services/approvalService.ts` | 2.2 | ✅ |
| 2.5 | 实现 `submitApproval()` 方法 | `frontend/src/services/approvalService.ts` | 2.2 | ✅ |
| 2.6 | 实现 `updateApprovalStatus()` 方法（含乐观更新） | `frontend/src/services/approvalService.ts` | 2.2 | ✅ |
| 2.7 | 实现错误处理与重试逻辑 | `frontend/src/services/approvalService.ts` | 2.6 | ✅ |
| 2.8 | 单元测试覆盖 ApprovalService | `frontend/tests/unit/auditService.test.ts` | 2.3-2.7 | 🔄 |

#### Phase 3: 双向绑定实现 (预计 1.5d)

| 序号 | 任务 | 交付物 | 依赖前置 | 状态 |
|------|------|--------|----------|------|
| 3.1 | 定义 Store State 结构 | `frontend/src/stores/approvalStore.ts` | 2.1 | ✅ |
| 3.2 | 实现 Getters（派生状态） | `frontend/src/stores/approvalStore.ts` | 3.1 | ✅ |
| 3.3 | 实现 Actions（调用 Service） | `frontend/src/stores/approvalStore.ts` | 3.2, 2.3-2.6 | ✅ |
| 3.4 | 实现 Mutators（状态修改） | `frontend/src/stores/approvalStore.ts` | 3.3 | ✅ |
| 3.5 | 实现双向绑定 Hook | `frontend/src/hooks/useAuditLogs.ts` | 3.4 | ✅ |
| 3.6 | 单元测试覆盖 Store 与 Binding | `frontend/tests/unit/auditableBinding.test.ts` | 3.1-3.5 | 🔄 |

#### Phase 4: UI 组件开发 (预计 2d)

| 序号 | 任务 | 交付物 | 依赖前置 | 状态 |
|------|------|--------|----------|------|
| 4.1 | 开发 ApprovalListItem 组件 | `frontend/src/components/audit/...` | 3.5 | ✅ |
| 4.2 | 开发 ApprovalStatusBadge 组件 | `frontend/src/components/audit/...` | 4.1 | ✅ |
| 4.3 | 开发 ApprovalFilter 组件 | `frontend/src/components/audit/...` | 4.2 | ✅ |
| 4.4 | 开发 ApprovalActionPanel 组件 | `frontend/src/components/audit/...` | 3.5 | ✅ |
| 4.5 | 组件单元测试覆盖 | `frontend/tests/unit/components/*.test.ts` | 4.1-4.4 | 🔄 |

#### Phase 5: 视图层组装 (预计 1d)

| 序号 | 任务 | 交付物 | 依赖前置 | 状态 |
|------|------|--------|----------|------|
| 5.1 | 组装 ApprovalListView | `frontend/src/pages/AssetDetailPage/index.tsx` | 4.1-4.3 | ✅ |
| 5.2 | 组装 ApprovalDetailView | `frontend/src/pages/AssetDetailPage/index.tsx` | 4.4 | ✅ |
| 5.3 | 集成路由守卫（权限控制） | `frontend/src/app/routes.ts` | 5.1, 5.2 | ✅ |
| 5.4 | 视图层集成测试 | `frontend/tests/unit/auditLog.test.ts` | 5.1-5.3 | 🔄 |

#### Phase 6: E2E 验证 (预计 0.5d)

| 序号 | 任务 | 交付物 | 依赖前置 | 状态 |
|------|------|--------|----------|------|
| 6.1 | 编写 E2E 测试用例 | `frontend/tests/e2e/assetDetail.audit.spec.ts` | 5.1-5.4 | 🔄 |
| 6.2 | 执行 Playwright E2E 测试 | CI/CD Pipeline | 6.1 | 📋 |
| 6.3 | 修复 E2E 失败用例并回归 | - | 6.2 | 📋 |

### 5.3 代码路径规范

```
frontend/
├── src/
│   ├── api/
│   │   └── approval.ts              # API 请求函数封装
│   │
│   ├── components/
│   │   └── audit/
│   │       ├── ApprovalListItem.tsx
│   │       ├── ApprovalStatusBadge.tsx
│   │       ├── ApprovalFilter.tsx
│   │       ├── ApprovalActionPanel.tsx
│   │       ├── GraphifyKnowledgeGraph.tsx  # 知识图谱组件
│   │       └── index.ts             # 组件导出
│   │
│   ├── hooks/
│   │   ├── useAuditLogs.ts          # 审计日志 Hook (双向绑定核心)
│   │   ├── useAuditableFields.ts    # 可审计字段 Hook
│   │   ├── useAuditRealtime.ts      # 实时推送 Hook
│   │   └── useAuditLog.ts           # 单条日志 Hook
│   │
│   ├── services/
│   │   ├── approvalService.ts       # ApprovalService 核心类
│   │   ├── auditService.ts          # 审计服务
│   │   ├── auditApi.ts              # 审计 API
│   │   └── ...
│   │
│   ├── stores/
│   │   └── approvalStore.ts          # Zustand/Pinia Store
│   │
│   ├── types/
│   │   ├── audit.types.ts           # 类型定义
│   │   └── approval.types.ts         # 审批类型定义
│   │
│   ├── pages/
│   │   └── AssetDetailPage/
│   │       ├── index.tsx             # 资产详情页（含审批）
│   │       ├── hooks/
│   │       │   ├── useAuditLogs.ts   # 页面级 Hook
│   │       │   └── useAuditableFields.ts
│   │       ├── types/
│   │       │   └── audit.types.ts
│   │       ├── config/
│   │       │   └── auditableFieldMap.ts
│   │       └── services/
│   │           └── auditApi.ts
│   │
│   ├── utils/
│   │   └── http.ts                  # Axios 实例配置
│   │
│   ├── app/
│   │   ├── routes.ts                # 路由配置
│   │   ├── utils/
│   │   │   └── permissionHooks.ts   # 权限 Hook
│   │   └── components/
│   │       └── ui/
│   │
│   ├── styles/
│   │   ├── audit-highlight.css      # 审计高亮样式
│   │   └── ...
│   │
│   └── mocks/
│       └── assetDetail.mock.ts      # Mock 数据
│
├── tests/
│   ├── unit/
│   │   ├── auditService.test.ts      # Service 单元测试
│   │   ├── auditableBinding.test.ts  # 双向绑定测试
│   │   └── auditLog.test.ts          # 审计日志测试
│   │
│   └── e2e/
│       ├── assetDetail.audit.spec.ts # E2E 测试
│       └── assetDetail.spec.ts       # 资产详情 E2E
│
└── vitest.config.ts                 # Vitest 配置
```

### 5.4 关键实现约束

#### 5.4.1 ApprovalService 实现约束

```typescript
/**
 * ApprovalService 单例模式约束
 * 所有审批操作必须通过此服务类代理
 */
class ApprovalService {
  private static instance: ApprovalService;
  
  public static getInstance(): ApprovalService {
    if (!ApprovalService.instance) {
      ApprovalService.instance = new ApprovalService();
    }
    return ApprovalService.instance;
  }
  
  // 核心方法约束：必须暴露统一接口
  public async fetchApprovalList(params: ListParams): Promise<ApprovalListResponse>;
  public async getApprovalDetail(id: string): Promise<Approval>;
  public async submitApproval(data: ApprovalDTO): Promise<SubmitResponse>;
  public async updateApprovalStatus(id: string, status: ApprovalStatus): Promise<UpdateResponse>;
  
  // 内部方法约束：必须实现乐观更新
  private applyOptimisticUpdate(id: string, status: ApprovalStatus): void;
  private rollbackOnFailure(id: string, originalState: Approval): void;
}
```

#### 5.4.2 双向绑定约束

```typescript
// 约束：必须通过 Store Action 触发所有状态变更
// ❌ 禁止：直接修改 store.approvalList = newList
// ✅ 正确：await store.fetchApprovalList(params)

// 约束：UI 组件必须使用 computed/selector 绑定
const approvalList = useStore(state => state.approvalList);
const isLoading = useStore(state => state.loadingState.isLoading);

// 约束：禁止绕过 Service 层直接调用 Axios
// ❌ 禁止：直接 await axios.get('/api/approvals')
// ✅ 正确：await approvalService.fetchApprovalList(params)
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
| Graphify | 知识图谱可视化组件，用于展示资产变更关系网络 |

### 6.2 参考文档

| 文档名称 | 路径 |
|----------|------|
| API 接口契约 | `docs/api/approval-api-contract.md` |
| 审批状态机定义 | `docs/workflow/approval-state-machine.md` |
| UI 设计规范 | `docs/design/approval-ui-spec.md` |
| Graphify 组件文档 | `frontend/src/components/audit/GraphifyKnowledgeGraph.tsx` |

### 6.3 AC 验证矩阵

| AC ID | 验收条件 | 验证方法 | 当前状态 |
|-------|----------|----------|----------|
| AC-001 | Graphify 知识图谱节点正确渲染 | Integration Test | 🔴 Pending |
| AC-002 | 代码变更不引入新的语法错误 | AST 静态检查 | ✅ 通过 |
| AC-003 | 所有修改的函数包含 docstring | 静态分析 | 🔴 Pending (10个) |
| AC-004 | 变更后的模块可被正常 import | pytest | 🔴 ImportError |

---

**文档版本**: v2.0  
**编制日期**: 2024  
**适用迭代**: SWARM-052 Iteration 2  
**状态**: 待评审  
**下一步行动**: 修复 AC-003 (补充 docstring) 和 AC-004 (ImportError)