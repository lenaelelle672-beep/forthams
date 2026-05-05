# SWARM-052 前端集成-审批流程页面开发
## 规格指导文档 v2.0（Iteration 2）

---

## 1. 需求与背景

### 1.1 任务概述

| 属性 | 值 |
|------|-----|
| 任务编号 | SWARM-052 |
| 任务名称 | 前端集成-审批流程页面开发 |
| 迭代版本 | Iteration 2 |
| 核心交付物 | 完成审批流程前端集成，实现 ApprovalService 双向绑定，搭建审批状态流转 UI 组件与用户交互界面 |

### 1.2 业务上下文

审批流程模块作为资产管理系统核心业务链路，承载以下关键职责：

- **审批任务管理**：提供审批任务的查看、提交、审批操作入口
- **状态实时同步**：双向绑定后端审批状态变更，前端即时响应
- **流程可视化呈现**：审批流程状态机可视化渲染与用户交互
- **审批意见追溯**：支持审批意见的录入与历史查看

### 1.3 技术栈基线

| 层级 | 技术选型 | 版本约束 | 备注 |
|------|----------|----------|------|
| 前端框架 | Vue 3 | ^3.4.x | Composition API |
| 状态管理 | Pinia | ^2.1.x | Store 管理 |
| HTTP 客户端 | Axios | ^1.6.x | API 通信 |
| 单元测试 | Vitest | ^1.x | 组件/服务测试 |
| E2E 测试 | Playwright | ^1.40.x | 端到端验证 |

### 1.4 焦点文件

根据 Localization Report，本 Iteration 核心实现文件：

```
frontend/src/services/approvalService.ts
```

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解对照（plan.md 标准迭代周期）

| Phase ID | Phase 名称 | 范围描述 | 迭代归属 | 交付状态 |
|----------|------------|----------|----------|----------|
| Phase 1 | 页面骨架与路由配置 | 基础页面结构、路由守卫 | Iteration 1 | 已完成 |
| **Phase 2** | **ApprovalService 双向绑定层** | **ApprovalService 核心实现、Pinia Store、状态同步** | **Iteration 2** | **进行中** |
| Phase 3 | 审批状态流转可视化 | 流程图/状态机渲染组件 | Iteration 3 | 待开发 |
| Phase 4 | 审批交互操作面板 | 提交/通过/驳回等操作表单 | Iteration 3 | 待开发 |
| Phase 5 | 全链路联调与回归 | 前后端集成测试、CI 验证 | Iteration 4 | 待开发 |

### 2.2 Iteration 2 核心目标

**Primary Goal**：实现 ApprovalService 与前端视图的双向数据绑定，建立实时状态同步通道。

#### 2.2.1 功能性目标

| 目标编号 | 目标描述 | 验收标准 | 验证方式 |
|----------|----------|----------|----------|
| G-01 | ApprovalService 核心方法暴露 | 提供 `fetchApprovalList()`、`getApprovalDetail(id)`、`submitApproval(data)`、`updateApprovalStatus(id, status)` 四个核心方法 | 单元测试 + AST 静态分析 |
| G-02 | 双向绑定实现 | ApprovalService 内部状态变更时，UI 自动响应更新；用户操作触发状态变更后自动同步至服务端 | 集成测试 |
| G-03 | 列表页数据绑定 | 审批列表页与 ApprovalService approvalList 状态保持同步，延迟不超过 500ms | E2E 测试 |
| G-04 | 详情页数据绑定 | 审批详情页与 ApprovalService currentApproval 状态保持同步 | 集成测试 |

#### 2.2.2 非功能性目标

| 目标编号 | 目标描述 | 约束阈值 | 测量方法 |
|----------|----------|----------|----------|
| NF-01 | 初始化加载时间 | 审批列表首屏渲染 ≤ 1.5s | Lighthouse CI / Playwright timing |
| NF-02 | 状态更新响应 | 用户操作至 UI 更新 ≤ 300ms | Performance API |
| NF-03 | 错误恢复 | 网络异常时自动重试 3 次，间隔 1s/2s/4s 指数退避 | 单元测试 mock |

---

## 3. 边界约束

### 3.1 职责边界

```
┌─────────────────────────────────────────────────────────────────────┐
│                          前端职责范围                                │
├─────────────────────────────────────────────────────────────────────┤
│  ● ApprovalService 核心实现与维护                                   │
│  ● 双向绑定逻辑编码（Pinia Store + Composables）                    │
│  ● UI 组件的状态驱动渲染                                            │
│  ● 前端表单预校验与数据预处理                                       │
│  ● 本地状态乐观更新与回滚机制                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          后端职责范围                                │
├─────────────────────────────────────────────────────────────────────┤
│  ● 审批业务逻辑实现（ApprovalService.java）                          │
│  ● 数据库持久化操作                                                 │
│  ● API 接口契约定义与维护                                           │
│  ● 审批规则引擎配置                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 技术约束

| 约束编号 | 约束类型 | 约束描述 | 违反后果 |
|----------|----------|----------|----------|
| C-01 | 禁止直接操作 DOM | 所有状态更新必须通过 Vue 响应式系统，禁止使用 `ref.$el` 或原生 DOM 操作 | 响应式失效，状态不同步 |
| C-02 | 禁止绕过 Service 层 | UI 组件禁止直接调用 Axios 实例，必须经由 ApprovalService 封装方法 | 违反双向绑定约束 |
| C-03 | 禁止同步 XHR | 所有 HTTP 请求必须为异步，禁止使用 `async: false` 配置 | 阻塞 UI 线程 |
| C-04 | 状态不可变原则 | Store 中的 approval 状态禁止直接修改，必须通过 mutations/actions | 状态不可追溯 |
| C-05 | 单例模式强制 | ApprovalService 必须实现为单例模式，保证全局状态一致性 | 多实例状态分裂 |

### 3.3 数据边界

```
ApprovalService 状态树（Pinia Store）:
approvalStore/
├── approvalList: Approval[]          ← 列表数据（Iteration 2 绑定范围）
├── currentApproval: Approval | null   ← 详情数据（Iteration 2 绑定范围）
├── pendingOperations: Set<string>     ← 操作锁定（Iteration 2 绑定范围）
├── errorState: Error | null          ← 错误状态（Iteration 2 绑定范围）
└── loadingState: LoadingState         ← 加载状态（Iteration 2 绑定范围）

UI 绑定层映射:
├── ApprovalListView    ←→  approvalList
├── ApprovalDetailView  ←→  currentApproval
├── ApprovalStatusBadge ←→  currentApproval.status
└── ApprovalActionPanel ←→  pendingOperations
```

### 3.4 迭代范围声明

**明确包含范围**：
- `frontend/src/services/approvalService.ts` 核心实现
- Pinia Store 双向绑定实现
- 审批列表/详情视图组件
- 相关类型定义与接口

**明确排除范围**：
- 审批流程图可视化渲染（Phase 3）
- WebSocket 实时推送对接（Phase 5）
- 移动端适配（独立迭代）
- 多语言国际化（独立迭代）
- 后端 ApprovalService.java 修改（非前端职责）

---

## 4. 验收测试基准 (ATB)

### 4.1 单元测试验收

#### 4.1.1 ApprovalService 方法测试

**测试文件**: `frontend/tests/unit/approvalService.test.ts`

| Test ID | 测试描述 | 测试输入 | 预期输出 | 物理验证方式 |
|---------|----------|----------|----------|--------------|
| UT-01 | `fetchApprovalList()` 返回正确数据结构 | 调用方法，无参数 | 返回 `{ data: Approval[], total: number }` | `expect().toMatchObject()` |
| UT-02 | `fetchApprovalList()` 正确处理空数据 | 后端返回 `[]` | Store.approvalList = `[]` | `expect(store.approvalList).toHaveLength(0)` |
| UT-03 | `fetchApprovalList()` 错误处理 | 后端返回 500 | Store.errorState 非空，抛出 `ServiceError` | `expect().toThrow()` |
| UT-04 | `getApprovalDetail(id)` 返回正确详情 | 传入有效 `id` | 返回对应 Approval 对象 | `expect().toMatchObject({ id })` |
| UT-05 | `getApprovalDetail(id)` 处理不存在 ID | 传入无效 `id` | 抛出 `NotFoundError` | `expect().rejects.toThrow('NotFoundError')` |
| UT-06 | `submitApproval(data)` 正确提交 | 有效 ApprovalDTO | 返回 `{ success: true, id }` | `expect().resolves.toMatchObject({ success: true })` |
| UT-07 | `updateApprovalStatus()` 乐观更新 | 传入 `{ id, status }` | Store 立即更新，异步请求后端 | Vitest mock + `expect(store.currentApproval.status).toBe(newStatus)` |
| UT-08 | `updateApprovalStatus()` 失败回滚 | 更新后后端返回 400 | Store 回滚至原状态，errorState 置位 | `expect(store.currentApproval.status).toBe(originalStatus)` |

#### 4.1.2 双向绑定测试

**测试文件**: `frontend/tests/unit/approvalBinding.test.ts`

| Test ID | 测试描述 | 测试输入 | 预期输出 | 物理验证方式 |
|---------|----------|----------|----------|--------------|
| UT-09 | Service 状态变更触发 UI 更新 | 外部修改 `store.approvalList` | Vue 组件 `data` 属性同步变更 | Vitest + `nextTick()` + `expect(wrapper.vm.listData).toEqual(...)` |
| UT-10 | UI 操作触发 Service 更新 | 用户触发 `handleApprove()` | `service.updateApprovalStatus()` 被调用 | Vitest + `vi.fn()` spy + `wrapper.vm.handleApprove()` |
| UT-11 | 并发操作互斥验证 | 同时触发多个审批操作 | 第二个操作进入 `pendingOperations` 队列 | `expect(store.pendingOperations.size).toBe(1)` |

### 4.2 组件测试验收

**测试文件**: `frontend/tests/unit/components/approvalList.test.ts`

| Test ID | 测试描述 | 测试输入 | 预期输出 | 物理验证方式 |
|---------|----------|----------|----------|--------------|
| UT-12 | 列表渲染正确数量 | `approvalList = [A, B, C]` | 渲染 3 个 ApprovalItem 组件 | `findAllComponents(ApprovalItem).length` |
| UT-13 | 加载状态显示 | `loadingState.isLoading = true` | 显示 Loading 骨架屏 | `expect(wrapper.find('.loading-skeleton').exists()).toBe(true)` |
| UT-14 | 空状态显示 | `approvalList = []` 且 `!loading` | 显示空状态插画与文案 | `expect(wrapper.find('.empty-state').exists()).toBe(true)` |
| UT-15 | 错误状态显示 | `errorState` 非空 | 显示错误提示与重试按钮 | `expect(wrapper.find('.error-alert').exists()).toBe(true)` |

### 4.3 E2E 测试验收

**测试文件**: `frontend/tests/e2e/approval.spec.ts`

#### 4.3.1 审批列表页测试

| Test ID | 测试场景 | 操作步骤 | 预期结果 | 物理验证方式 |
|---------|----------|----------|----------|--------------|
| E2E-01 | 审批列表正常加载 | 访问 `/approval/list` | 列表显示且数据与后端一致 | `page.locator('.approval-item').toHaveCount(n)` |
| E2E-02 | 审批列表分页 | 点击第二页 | URL 更新，列表切换，数据正确 | `expect(request).toMatch(/page=2/)` |
| E2E-03 | 审批列表筛选 | 选择状态筛选「待审批」 | 仅显示待审批项 | `page.selectOption()` + `toHaveCount(filtered)` |
| E2E-04 | 审批列表搜索 | 输入关键词搜索 | 返回匹配结果 | `page.fill('.search-input')` + debounce 等待 |

#### 4.3.2 审批详情页测试

| Test ID | 测试场景 | 操作步骤 | 预期结果 | 物理验证方式 |
|---------|----------|----------|----------|--------------|
| E2E-05 | 详情页加载 | 点击列表项进入详情 | 详情数据完整展示 | `expect(page.locator('.approval-title')).toBeVisible()` |
| E2E-06 | 详情页状态同步 | 详情页打开时后端状态变更 | 页面显示最新状态（≤ 500ms） | `page.evaluate()` 模拟后端推送 |
| E2E-07 | 返回列表状态保留 | 从详情页返回列表 | 列表保持之前的筛选/分页状态 | `expect(sessionStorage.getItem())` |

#### 4.3.3 审批操作测试

| Test ID | 测试场景 | 操作步骤 | 预期结果 | 物理验证方式 |
|---------|----------|----------|----------|--------------|
| E2E-08 | 提交审批 | 填写表单并点击提交 | 加载指示器 → 成功提示 → 跳转列表 | `page.click('.submit-btn')` + `toHaveURL(/list/)` |
| E2E-09 | 操作锁定验证 | 提交审批后快速点击 | 按钮禁用，无重复提交 | `expect(page.locator('.submit-btn')).toBeDisabled()` |
| E2E-10 | 操作失败提示 | 模拟提交失败 | 显示错误提示，按钮恢复 | mock API 500 + `expect(page.locator('.error-toast')).toBeVisible()` |
| E2E-11 | 操作成功状态更新 | 审批通过操作 | 列表项状态立即更新为「已通过」 | `expect(page.locator('.status-badge')).toHaveText('已通过')` |

### 4.4 性能测试验收

| Test ID | 测试指标 | 测试方法 | 阈值要求 | 物理验证方式 |
|---------|----------|----------|----------|--------------|
| PERF-01 | 首屏加载时间 | Lighthouse CI | FCP ≤ 1.5s | Playwright + `performance.now()` |
| PERF-02 | 列表渲染性能 | 100 条数据渲染 | TTI ≤ 2s | Performance API |
| PERF-03 | 状态更新响应 | 触发审批操作 | UI 更新 ≤ 300ms | Playwright timing |
| PERF-04 | 内存泄漏检测 | 多次进出审批页面 | 无 detached 组件 | Chrome DevTools Protocol |

---

## 5. 开发切入层级序列

### 5.1 依赖关系图

```
Layer 0: 环境与配置层
    ↓ 依赖: Node.js, pnpm, TypeScript
    │
Layer 1: 基础设施层
    ↓ 依赖: axios 实例, Vue Router, Pinia
    │
Layer 2: 服务抽象层 (ApprovalService)  ← 【焦点文件 Iteration 2】
    ↓ 依赖: Layer 1
    │
Layer 3: 状态管理层 (approvalStore)
    ↓ 依赖: Layer 2
    │
Layer 4: 组件层 (UI Components)
    ↓ 依赖: Layer 3
    │
Layer 5: 视图层 (Views)
    ↓ 依赖: Layer 4
    │
Layer 6: 测试与验证层
    ↓ 依赖: Layer 0-5
```

### 5.2 编码切入顺序

#### Phase 1: 基础设施配置 (预计 0.5d)

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 1.1 | 配置 API Base URL 环境变量 | `.env.production` | 无 |
| 1.2 | 配置 Axios 实例拦截器 | `frontend/src/utils/http.ts` | 无 |
| 1.3 | 配置 Vue Router 审批路由 | `frontend/src/router/approval.ts` | 无 |
| 1.4 | 初始化 Pinia Store 骨架 | `frontend/src/stores/approvalStore.ts` | 无 |

#### Phase 2: ApprovalService 核心实现 (预计 2d) ⭐

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 2.1 | 定义 TypeScript 类型接口 | `frontend/src/types/approval.ts` | 无 |
| 2.2 | 实现 ApprovalService 类骨架（单例模式） | `frontend/src/services/approvalService.ts` | 2.1 |
| 2.3 | 实现 `fetchApprovalList()` 方法 | `frontend/src/services/approvalService.ts` | 2.2 |
| 2.4 | 实现 `getApprovalDetail()` 方法 | `frontend/src/services/approvalService.ts` | 2.2 |
| 2.5 | 实现 `submitApproval()` 方法 | `frontend/src/services/approvalService.ts` | 2.2 |
| 2.6 | 实现 `updateApprovalStatus()` 方法（含乐观更新） | `frontend/src/services/approvalService.ts` | 2.2 |
| 2.7 | 实现错误处理与指数退避重试逻辑 | `frontend/src/services/approvalService.ts` | 2.6 |
| 2.8 | 单元测试覆盖 ApprovalService | `frontend/tests/unit/approvalService.test.ts` | 2.3-2.7 |

#### Phase 3: Pinia Store 双向绑定实现 (预计 1.5d)

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 3.1 | 定义 Store State 结构 | `frontend/src/stores/approvalStore.ts` | 2.1 |
| 3.2 | 实现 Getters（派生状态） | `frontend/src/stores/approvalStore.ts` | 3.1 |
| 3.3 | 实现 Actions（调用 Service） | `frontend/src/stores/approvalStore.ts` | 3.2, 2.3-2.6 |
| 3.4 | 实现 Mutators（状态修改） | `frontend/src/stores/approvalStore.ts` | 3.3 |
| 3.5 | 实现双向绑定 Hook | `frontend/src/composables/useApprovalBinding.ts` | 3.4 |
| 3.6 | 单元测试覆盖 Store 与 Binding | `frontend/tests/unit/approvalStore.test.ts` | 3.1-3.5 |

#### Phase 4: UI 组件开发 (预计 2d)

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 4.1 | 开发 `ApprovalListItem` 组件 | `frontend/src/components/approval/ApprovalListItem.vue` | 3.5 |
| 4.2 | 开发 `ApprovalStatusBadge` 组件 | `frontend/src/components/approval/ApprovalStatusBadge.vue` | 4.1 |
| 4.3 | 开发 `ApprovalFilter` 组件 | `frontend/src/components/approval/ApprovalFilter.vue` | 4.2 |
| 4.4 | 开发 `ApprovalActionPanel` 组件 | `frontend/src/components/approval/ApprovalActionPanel.vue` | 3.5 |
| 4.5 | 组件单元测试覆盖 | `frontend/tests/unit/components/*.test.ts` | 4.1-4.4 |

#### Phase 5: 视图层组装 (预计 1d)

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 5.1 | 组装 `ApprovalListView` | `frontend/src/views/approval/ApprovalListView.vue` | 4.1-4.3 |
| 5.2 | 组装 `ApprovalDetailView` | `frontend/src/views/approval/ApprovalDetailView.vue` | 4.4 |
| 5.3 | 集成路由守卫（权限控制） | `frontend/src/router/approval.ts` | 5.1, 5.2 |
| 5.4 | 视图层集成测试 | `frontend/tests/unit/views/*.test.ts` | 5.1-5.3 |

#### Phase 6: E2E 验证 (预计 0.5d)

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 6.1 | 编写 E2E 测试用例 | `frontend/tests/e2e/approval.spec.ts` | 5.1-5.4 |
| 6.2 | 执行 Playwright E2E 测试 | CI/CD Pipeline | 6.1 |
| 6.3 | 修复 E2E 失败用例并回归 | - | 6.2 |

### 5.3 代码路径规范

```
frontend/src/
├── api/
│   └── approval.ts              # API 请求函数封装
├── components/
│   └── approval/
│       ├── ApprovalListItem.vue
│       ├── ApprovalStatusBadge.vue
│       ├── ApprovalFilter.vue
│       ├── ApprovalActionPanel.vue
│       └── index.ts             # 组件导出
├── composables/
│   ├── useApprovalBinding.ts    # 双向绑定 Hook
│   └── useApprovalPermission.ts # 权限判断 Hook
├── services/
│   ├── approvalService.ts       # ApprovalService 核心类 ⭐
│   └── approvalService.test.ts  # Service 单元测试
├── stores/
│   ├── approvalStore.ts         # Pinia Store
│   └── approvalStore.test.ts    # Store 单元测试
├── types/
│   └── approval.ts              # 类型定义
├── utils/
│   └── http.ts                  # Axios 实例配置
├── views/
│   └── approval/
│       ├── ApprovalListView.vue
│       └── ApprovalDetailView.vue
└── router/
    └── approval.ts              # 审批路由配置
```

### 5.4 ApprovalService 核心实现约束

```typescript
// ============================================================
// ApprovalService 实现约束（Iteration 2 焦点）
// 文件: frontend/src/services/approvalService.ts
// ============================================================

/**
 * ApprovalService - 审批服务核心类
 * 
 * 职责：
 * - 封装审批业务 HTTP 请求
 * - 实现数据转换与错误处理
 * - 提供乐观更新与回滚机制
 * - 维护操作锁状态
 * 
 * 约束：
 * - 必须为单例模式
 * - 必须暴露统一的 fetch/update 接口
 * - 必须实现乐观更新与失败回滚
 * - 禁止直接操作 DOM 或绕过 Store
 */
class ApprovalService {
  // 单例实例
  private static instance: ApprovalService;
  
  // HTTP 客户端（经由 http.ts 封装的 Axios 实例）
  private http: AxiosInstance;
  
  // 操作锁集合
  private pendingOperations: Set<string> = new Set();
  
  // 重试配置
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 2000, 4000]; // 指数退避

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
   * 私有构造函数（强制单例）
   */
  private constructor() {
    this.http = http; // 从 http.ts 导入的 Axios 实例
  }

  /**
   * 获取审批列表
   * @param params - 分页与筛选参数
   * @returns 审批列表响应
   */
  public async fetchApprovalList(params: ListParams): Promise<ApprovalListResponse> {
    const response = await this.http.get<ApprovalListResponse>('/api/approvals', { params });
    return response.data;
  }

  /**
   * 获取审批详情
   * @param id - 审批 ID
   * @returns 审批详情
   * @throws NotFoundError - 审批不存在
   */
  public async getApprovalDetail(id: string): Promise<Approval> {
    try {
      const response = await this.http.get<Approval>(`/api/approvals/${id}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new NotFoundError(`Approval ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * 提交审批
   * @param data - 审批数据
   * @returns 提交响应
   */
  public async submitApproval(data: ApprovalDTO): Promise<SubmitResponse> {
    const response = await this.http.post<SubmitResponse>('/api/approvals', data);
    return response.data;
  }

  /**
   * 更新审批状态（带乐观更新）
   * @param id - 审批 ID
   * @param status - 新状态
   * @param originalState - 原状态（用于回滚）
   * @returns 更新响应
   */
  public async updateApprovalStatus(
    id: string,
    status: ApprovalStatus,
    originalState: Approval
  ): Promise<UpdateResponse> {
    // 1. 乐观更新：立即标记操作锁
    this.applyOptimisticUpdate(id, status);
    
    // 2. 异步请求后端
    try {
      const response = await this.retryRequest(() =>
        this.http.patch<UpdateResponse>(`/api/approvals/${id}/status`, { status })
      );
      return response.data;
    } catch (error) {
      // 3. 失败回滚
      this.rollbackOnFailure(id, originalState);
      throw error;
    }
  }

  /**
   * 应用乐观更新
   * @private
   */
  private applyOptimisticUpdate(id: string, status: ApprovalStatus): void {
    this.pendingOperations.add(id);
    // 触发 Store 更新（经由 Pinia action）
    approvalStore.updateApprovalStatus(id, status);
  }

  /**
   * 失败回滚
   * @private
   */
  private rollbackOnFailure(id: string, originalState: Approval): void {
    this.pendingOperations.delete(id);
    // 回滚 Store 至原状态
    approvalStore.rollbackApproval(id, originalState);
  }

  /**
   * 指数退避重试
   * @private
   */
  private async retryRequest<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    attempt = 0
  ): Promise<T> {
    try {
      const response = await requestFn();
      return response.data;
    } catch (error) {
      if (attempt < this.MAX_RETRIES && this.isRetryableError(error)) {
        await this.delay(this.RETRY_DELAYS[attempt]);
        return this.retryRequest(requestFn, attempt + 1);
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRetryableError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      return [408, 429, 500, 502, 503, 504].includes(error.response?.status ?? 0);
    }
    return false;
  }
}

export default ApprovalService.getInstance();
```

### 5.5 双向绑定约束

```typescript
// ============================================================
// 双向绑定约束
// ============================================================

// ❌ 禁止：直接修改 store.approvalList = newList
// ❌ 禁止：组件内直接调用 axios.get()
// ❌ 禁止：在 setup 外直接修改响应式状态

// ✓ 正确：必须通过 Pinia Action 触发所有状态变更
const handleApprove = async (id: string) => {
  try {
    await store.updateApprovalStatus(id, 'APPROVED');
  } catch (error) {
    console.error('Approval failed:', error);
  }
};

// ✓ 正确：UI 组件必须使用 computed 属性绑定
const approvalList = computed(() => store.approvalList);
const isLoading = computed(() => store.loadingState.isLoading);
const errorState = computed(() => store.errorState);
```

---

## 6. 附录

### 6.1 关键术语定义

| 术语 | 定义 |
|------|------|
| ApprovalService | 封装审批业务逻辑的服务类，负责 HTTP 请求编排与数据转换，前端唯一入口 |
| 双向绑定 | 前端状态（Pinia Store）与服务端数据保持同步的机制，任一方变更自动触发另一方更新 |
| 乐观更新 | 先更新本地 UI 再请求后端，若失败则回滚的策略，提升用户感知性能 |
| 状态锁 | 防止并发操作冲突的机制，同一审批对象同时只允许一个待处理操作 |
| 指数退避 | 重试间隔时间以指数增长的策略（1s → 2s → 4s），避免雪崩效应 |

### 6.2 类型定义参考

```typescript
// frontend/src/types/approval.ts

export type ApprovalStatus = 
  | 'PENDING'      // 待审批
  | 'APPROVED'     // 已通过
  | 'REJECTED'     // 已驳回
  | 'CANCELLED';   // 已撤回

export interface Approval {
  id: string;
  title: string;
  type: ApprovalType;
  status: ApprovalStatus;
  applicant: User;
  approver?: User;
  createTime: string;
  updateTime: string;
  comment?: string;
}

export interface ApprovalDTO {
  title: string;
  type: ApprovalType;
  content: Record<string, unknown>;
}

export interface ListParams {
  page: number;
  pageSize: number;
  status?: ApprovalStatus;
  keyword?: string;
}

export interface ApprovalListResponse {
  data: Approval[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SubmitResponse {
  success: boolean;
  id: string;
  message?: string;
}

export interface UpdateResponse {
  success: boolean;
  approval: Approval;
}
```

### 6.3 参考文档

| 文档名称 | 路径 | 说明 |
|----------|------|------|
| API 接口契约 | `docs/api/approval-api-contract.md` | 后端提供的 REST API 定义 |
| 审批状态机定义 | `docs/workflow/approval-state-machine.md` | 审批状态流转规则 |
| UI 设计规范 | `docs/design/approval-ui-spec.md` | Figma 设计稿对应说明 |
| Vitest 配置 | `frontend/vitest.config.ts` | 单元测试配置 |
| Playwright 配置 | `frontend/playwright.config.ts` | E2E 测试配置 |

---

## 7. 变更记录

| 版本 | 日期 | 变更描述 | 作者 |
|------|------|----------|------|
| v1.0 | - | 初始版本 | - |
| v2.0 | - | 增加 Iteration 2 详细规格，聚焦 ApprovalService 实现 | - |

---

**文档状态**: 待评审  
**适用迭代**: SWARM-052 Iteration 2  
**最后更新**: 2024