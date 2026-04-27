# SWARM-052 前端集成-审批流程页面开发
## 规格指导文档 (Iteration 2)

---

## 1. 需求与背景

### 1.1 任务概述

| 属性 | 值 |
|------|-----|
| **任务编号** | SWARM-052 |
| **任务名称** | 前端集成-审批流程页面开发 |
| **当前迭代** | Iteration 2 |
| **核心交付** | 完成审批流程前端集成，实现 ApprovalService 双向绑定，搭建审批状态流转 UI 组件与用户交互界面 |

### 1.2 业务上下文

审批流程模块作为资产管理系统（AMS）的核心业务链路，承担以下职责：

- **审批任务管理**：提供审批任务的查看、提交、审批操作入口
- **状态同步**：实时同步后端审批状态变更至前端视图
- **流程可视化**：呈现审批流程状态机可视化流转
- **意见管理**：支持审批意见的录入与历史查看

### 1.3 技术栈基线

| 层级 | 技术选型 | 版本约束 |
|------|----------|----------|
| 前端框架 | Vue 3 (Composition API) | ^3.4.x |
| 状态管理 | Pinia | ^2.1.x |
| UI 组件库 | Element Plus | ^2.5.x |
| 工具库 | VueUse | ^10.x |
| HTTP 客户端 | Axios | ^1.6.x |
| 图谱渲染 | 自定义 Canvas/Mermaid.js | ^10.x |
| 单元测试 | Vitest | ^1.x |
| E2E 测试 | Playwright | ^1.40.x |

### 1.4 涉及文件清单

| 文件路径 | 用途描述 | 变更类型 |
|----------|----------|----------|
| `frontend/src/app/hooks/useAuditableFields.ts` | 可审计字段管理 Hook（含 Graphify 节点转换） | 修改 |
| `frontend/src/styles/audit-highlight.css` | 审计日志高亮样式 | 修改 |
| `frontend/src/components/audit/GraphifyKnowledgeGraph.tsx` | Graphify 知识图谱组件 | 修改 |
| `frontend/src/hooks/useAuditLogs.ts` | 审计日志 Hook（含 Graphify 数据转换） | 修改 |
| `frontend/src/pages/AssetDetailPage/index.tsx` | 资产详情页（集成审批流程入口） | 修改 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解参照

基于审批流程模块开发生命周期，本次 Iteration 2 对准以下 Phase：

| Phase ID | Phase 名称 | 范围描述 | 迭代状态 |
|----------|------------|----------|----------|
| Phase 1 | 页面骨架与路由配置 | 基础页面结构搭建 | 已完成 (Iteration 1) |
| **Phase 2** | **ApprovalService 双向绑定层** | **本次迭代核心** | **进行中** |
| Phase 3 | 审批状态流转可视化组件 | 流程图/状态机渲染（Graphify 集成） | 待后续迭代 |
| Phase 4 | 审批交互操作面板 | 提交/通过/驳回等操作表单 | 待后续迭代 |
| Phase 5 | 全链路联调与回归验证 | 前后端集成测试 | 待后续迭代 |

### 2.2 Iteration 2 核心目标

#### 2.2.1 功能性目标

| 目标编号 | 目标描述 | 验收标准 |
|-----------|----------|----------|
| G-01 | ApprovalService 核心方法暴露 | 提供 `fetchApprovalList()`、`getApprovalDetail(id)`、`submitApproval(data)`、`updateApprovalStatus(id, status)` 四个核心方法 |
| G-02 | 双向绑定实现 | ApprovalService 内部状态变更时，UI 自动响应更新；用户操作触发状态变更后自动同步至服务端 |
| G-03 | Graphify 知识图谱集成 | 审计日志数据转换为 Graphify 节点，在资产详情页展示知识图谱 |
| G-04 | 审批状态 Badge 组件 | 支持待审批、审批中、已通过、已驳回等状态的视觉呈现 |

#### 2.2.2 非功能性目标

| 目标编号 | 目标描述 | 约束阈值 |
|-----------|----------|----------|
| NF-01 | 初始化加载时间 | 审批列表首屏渲染 ≤ 1.5s |
| NF-02 | 状态更新响应 | 用户操作至 UI 更新 ≤ 300ms |
| NF-03 | 图谱渲染性能 | 100 节点以内图谱渲染 ≤ 500ms |

---

## 3. 边界约束

### 3.1 职责边界

```
┌─────────────────────────────────────────────────────────────────────┐
│                           前端边界                                   │
├─────────────────────────────────────────────────────────────────────┤
│  [UI Layer]            [Service Layer]         [Store Layer]        │
│  Vue SFC Components  ←  ApprovalService      ←  Pinia Store         │
│                                                                      │
│  职责：               职责：                  职责：                   │
│  - 状态驱动渲染       - HTTP 请求编排         - 单一数据源            │
│  - 用户交互处理       - 数据转换格式化         - 派生状态计算          │
│  - 表单验证           - 错误处理与重试         - 状态变更追踪          │
└─────────────────────────────────────────────────────────────────────┘
                              ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────────┐
│                           后端边界                                   │
├─────────────────────────────────────────────────────────────────────┤
│  [Controller]          [Service]              [Repository]          │
│  REST API 入口        业务逻辑编排           数据持久化              │
└─────────────────────────────────────────────────────────────────────┘
```

**前端职责范围**:
- ApprovalService 的实现与维护
- 双向绑定逻辑的编码
- Graphify 知识图谱组件渲染
- 审计日志数据转换

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
| C-05 | Graphify 节点必填字段 | 节点必须包含 `id`、`type`、`entityId`、`x`、`y` 五个必填字段 |

### 3.3 数据边界

```
ApprovalService 状态树:
approvalStore/
├── approvalList: Approval[]           ← 列表数据
├── currentApproval: Approval          ← 详情数据
├── pendingOperations: Set<string>     ← 操作锁定
├── errorState: Error | null           ← 错误状态
└── loadingState: LoadingState         ← 加载状态

Graphify 节点数据结构:
GraphifyNode {
  id: string              ← 节点唯一标识
  type: 'asset' | 'field' | 'user' | 'action'  ← 节点类型
  entityId: string        ← 关联实体 ID
  label: string           ← 显示标签
  x: number               ← 画布 X 坐标
  y: number               ← 画布 Y 坐标
  properties: object      ← 扩展属性
}

Graphify 边数据结构:
GraphifyEdge {
  id: string
  source: string           ← 源节点 ID
  target: string           ← 目标节点 ID
  label: string            ← 边标签（如 "修改"、"审批"）
  type: 'association' | 'causation' | 'temporal'
}
```

### 3.4 迭代范围声明

**明确纳入范围 (Iteration 2)**:
- Graphify 知识图谱组件核心渲染
- 审计日志到 Graphify 节点的数据转换
- ApprovalService 双向绑定实现
- 审批状态 Badge 组件

**明确排除范围**:
- 审批流程图可视化渲染（Phase 3）
- 审批操作的表单详细校验规则（Phase 4）
- WebSocket 实时推送对接（Phase 5）
- 移动端适配（独立迭代）
- 多语言国际化（独立迭代）

---

## 4. 验收测试基准 (ATB)

### 4.1 单元测试验收

#### 4.1.1 Graphify 节点转换测试

**测试文件**: `frontend/tests/unit/auditService.test.ts`

| Test ID | 测试描述 | 测试输入 | 预期输出 | 验证方式 |
|---------|----------|----------|----------|----------|
| UT-G01 | `convertChangesToGraphifyNodes` 正确转换 | FieldChange[] | GraphifyNode[] 包含正确的节点属性 | Vitest + `expect(nodes[0]).toMatchObject({ type: 'field' })` |
| UT-G02 | `generateGraphifyNodes` 生成资产节点 | AuditLog[] | 首个节点类型为 'asset' | Vitest + `expect(nodes[0].type).toBe('asset')` |
| UT-G03 | `formatAuditLogsToGraphifyNodes` 节点定位 | AssetAuditLog[] | 节点包含 x, y 坐标 | Vitest + `expect(node.x).toBeDefined()` |
| UT-G04 | `validateGraphifyNodes` 空数组验证 | `[]` | 返回 `true` | Vitest + `expect(validateGraphifyNodes([])).toBe(true)` |
| UT-G05 | `validateGraphifyNodes` 缺少必填字段 | 缺少 entityId | 返回 `false` | Vitest + `expect(validateGraphifyNodes(invalidNodes)).toBe(false)` |

#### 4.1.2 ApprovalService 方法测试

**测试文件**: `frontend/tests/unit/auditService.test.ts`

| Test ID | 测试描述 | 测试输入 | 预期输出 | 验证方式 |
|---------|----------|----------|----------|----------|
| UT-A01 | `fetchApprovalList()` 返回正确数据结构 | 调用方法 | 返回 `{ data: Approval[], total: number }` | Vitest + `expect().toMatchObject()` |
| UT-A02 | `fetchApprovalList()` 错误处理 | 后端返回 500 | Store.errorState 非空 | Vitest + `expect(store.errorState).not.toBeNull()` |
| UT-A03 | `getApprovalDetail(id)` 正确返回 | 传入有效 `id` | 返回对应 Approval 对象 | Vitest + `expect().toMatchObject({ id })` |
| UT-A04 | `updateApprovalStatus()` 乐观更新 | `{ id, status }` | Store 立即更新 | Vitest + `expect(store.currentApproval.status).toBe(newStatus)` |

#### 4.1.3 组件渲染测试

**测试文件**: `frontend/tests/unit/auditableBinding.test.ts`

| Test ID | 测试描述 | 测试输入 | 预期输出 | 验证方式 |
|---------|----------|----------|----------|----------|
| UT-C01 | 知识图谱 Canvas 渲染 | 有效 GraphifyNode[] | Canvas 正确绘制节点 | Vitest + `expect(canvas.getContext).toBeCalled()` |
| UT-C02 | 节点悬停高亮 | 鼠标移入节点 | 节点边框颜色变化 | Vitest + `expect(ctx.strokeStyle).toBe('#FFFFFF')` |
| UT-C03 | 状态 Badge 颜色 | 状态为 'approved' | 显示绿色 Badge | Vitest + `expect(badge.className).toContain('status-approved')` |

### 4.2 E2E 测试验收

**测试文件**: `frontend/tests/e2e/assetDetail.audit.spec.ts`

| Test ID | 测试场景 | 操作步骤 | 预期结果 | 验证方式 |
|---------|----------|----------|----------|----------|
| E2E-01 | Graphify 图谱加载 | 访问资产详情页 | 知识图谱正确渲染 | Playwright + `expect(page.locator('.graphify-canvas')).toBeVisible()` |
| E2E-02 | 图谱节点交互 | 点击节点 | 显示节点详情面板 | Playwright + `expect(page.locator('.node-detail-panel')).toBeVisible()` |
| E2E-03 | 审批列表加载 | 访问审批列表页 | 列表显示且数据正确 | Playwright + `expect(page.locator('.approval-item')).toHaveCount(n)` |
| E2E-04 | 审批操作提交流程 | 填写表单并提交 | 加载 → 成功 → 跳转 | Playwright + `page.click('.submit-btn')` |
| E2E-05 | 操作锁定验证 | 提交后快速点击 | 按钮禁用，无重复提交 | Playwright + `expect(page.locator('.submit-btn')).toBeDisabled()` |
| E2E-06 | 操作失败提示 | 模拟提交失败 | 显示错误 Toast | Playwright + `expect(page.locator('.error-toast')).toBeVisible()` |

### 4.3 集成测试验收

**测试文件**: `tests/test_service_integration.py`

| Test ID | 测试描述 | 测试方法 | 验收标准 |
|---------|----------|----------|----------|
| INT-01 | 前后端联调 | 启动前后端服务，调用审批 API | HTTP 200，响应数据结构正确 |
| INT-02 | Graphify 数据流 | 创建审计日志后刷新页面 | 图谱包含新节点 |
| INT-03 | 状态同步 | 多端同时操作 | 状态最终一致 |

### 4.4 性能测试基准

| Test ID | 测试指标 | 阈值要求 | 测试方法 |
|---------|----------|----------|----------|
| PERF-01 | 首屏加载时间 | FCP ≤ 1.5s | Lighthouse CI |
| PERF-02 | 图谱渲染性能 | 100 节点 ≤ 500ms | Playwright + Performance API |
| PERF-03 | 状态更新响应 | UI 更新 ≤ 300ms | Playwright timing |
| PERF-04 | 内存占用 | 无内存泄漏 | Chrome DevTools heap snapshot |

---

## 5. 开发切入层级序列

### 5.1 依赖关系图

```
Layer 0: 环境与配置层
    ↓ 依赖: Node.js, pnpm, TypeScript, Vite
Layer 1: 类型定义层
    ↓ 依赖: TypeScript interfaces, Graphify types
Layer 2: 工具层
    ↓ 依赖: Axios 实例, VueUse composables
Layer 3: Service 层 (ApprovalService)
    ↓ 依赖: Layer 1-2
Layer 4: Hook 层 (useAuditLogs, useAuditableFields)
    ↓ 依赖: Layer 3
Layer 5: 组件层 (GraphifyKnowledgeGraph, StatusBadge)
    ↓ 依赖: Layer 4
Layer 6: 视图层 (AssetDetailPage, ApprovalListView)
    ↓ 依赖: Layer 5
Layer 7: 测试与验证层
    ↓ 依赖: Layer 0-6
```

### 5.2 编码切入顺序

#### Phase 1: 类型定义与接口 (预计 0.5d)

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 1.1 | 定义 GraphifyNode/GraphifyEdge 类型 | `frontend/src/types/graphify.types.ts` | 无 |
| 1.2 | 定义 Approval 相关类型 | `frontend/src/types/approval.types.ts` | 无 |
| 1.3 | 验证类型定义正确性 | TypeScript 编译检查 | 1.1, 1.2 |

#### Phase 2: Graphify 工具函数实现 (预计 1d)

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 2.1 | 实现 `convertChangesToGraphifyNodes` | `useAuditableFields.ts` | 1.1 |
| 2.2 | 实现 `generateGraphifyNodes` | `useAuditLogs.ts` | 1.1 |
| 2.3 | 实现 `formatAuditLogsToGraphifyNodes` | `audit.types.ts` | 1.1 |
| 2.4 | 实现 `validateGraphifyNodes` | `audit.types.ts` | 2.3 |
| 2.5 | 单元测试覆盖 | `tests/unit/auditService.test.ts` | 2.1-2.4 |

#### Phase 3: GraphifyKnowledgeGraph 组件 (预计 1d)

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 3.1 | Canvas 初始化与节点渲染 | `GraphifyKnowledgeGraph.tsx` | 2.4 |
| 3.2 | 节点交互（悬停、点击） | `GraphifyKnowledgeGraph.tsx` | 3.1 |
| 3.3 | 边渲染与连接线 | `GraphifyKnowledgeGraph.tsx` | 3.2 |
| 3.4 | 响应式尺寸适配 | `GraphifyKnowledgeGraph.tsx` | 3.3 |
| 3.5 | 组件单元测试 | `tests/unit/graphify.test.ts` | 3.1-3.4 |

#### Phase 4: ApprovalService 实现 (预计 1.5d)

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 4.1 | ApprovalService 类骨架 | `approvalService.ts` | 1.2 |
| 4.2 | `fetchApprovalList()` 方法 | `approvalService.ts` | 4.1 |
| 4.3 | `getApprovalDetail()` 方法 | `approvalService.ts` | 4.1 |
| 4.4 | `updateApprovalStatus()` 乐观更新 | `approvalService.ts` | 4.3 |
| 4.5 | 错误处理与重试逻辑 | `approvalService.ts` | 4.4 |
| 4.6 | 单元测试覆盖 | `tests/unit/approvalService.test.ts` | 4.1-4.5 |

#### Phase 5: UI 样式与组件 (预计 0.5d)

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 5.1 | 审计高亮样式 | `audit-highlight.css` | 无 |
| 5.2 | 审批状态 Badge 样式 | `audit-highlight.css` | 5.1 |

#### Phase 6: 视图层集成 (预计 1d)

| 序号 | 任务 | 交付物 | 依赖前置 |
|------|------|--------|----------|
| 6.1 | AssetDetailPage 集成 Graphify | `AssetDetailPage/index.tsx` | 3.4, 5.2 |
| 6.2 | 资产详情页集成测试 | `tests/e2e/assetDetail.audit.spec.ts` | 6.1 |

### 5.3 代码路径规范

```
frontend/src/
├── components/audit/
│   └── GraphifyKnowledgeGraph.tsx      # Graphify 图谱组件
├── hooks/
│   ├── useAuditLogs.ts                  # 审计日志 Hook
│   └── useAuditableFields.ts            # 可审计字段 Hook
├── pages/AssetDetailPage/
│   ├── index.tsx                        # 资产详情页视图
│   └── types/
│       └── audit.types.ts               # 审计类型定义
├── services/
│   └── approvalService.ts               # ApprovalService
├── styles/
│   └── audit-highlight.css              # 审计高亮样式
└── types/
    ├── approval.types.ts                # 审批类型定义
    └── graphify.types.ts                # Graphify 类型定义

frontend/tests/
├── unit/
│   ├── auditService.test.ts             # 审计服务测试
│   ├── auditableBinding.test.ts         # 绑定测试
│   └── graphify.test.ts                 # 图谱组件测试
└── e2e/
    └── assetDetail.audit.spec.ts        # 资产详情 E2E 测试
```

### 5.4 关键实现约束

#### 5.4.1 Graphify 节点转换约束

```typescript
// 约束: 所有 Graphify 节点必须包含必填字段
interface GraphifyNode {
  id: string;                    // 必填：节点唯一标识
  type: 'asset' | 'field' | 'user' | 'action';  // 必填：节点类型
  entityId: string;              // 必填：关联实体 ID
  x: number;                     // 必填：画布 X 坐标
  y: number;                     // 必填：画布 Y 坐标
  label?: string;                // 可选：显示标签
  properties?: Record<string, any>;  // 可选：扩展属性
}

// 约束: 节点验证函数必须检查必填字段
export function validateGraphifyNodes(nodes: GraphifyNode[]): boolean {
  return nodes.every(
    (node) =>
      node.id &&
      node.type &&
      node.entityId &&
      typeof node.x === 'number' &&
      typeof node.y === 'number'
  );
}
```

#### 5.4.2 ApprovalService 单例约束

```typescript
// 约束: ApprovalService 必须为单例模式
class ApprovalService {
  private static instance: ApprovalService;
  
  public static getInstance(): ApprovalService {
    if (!ApprovalService.instance) {
      ApprovalService.instance = new ApprovalService();
    }
    return ApprovalService.instance;
  }
  
  // 约束: 必须实现乐观更新与回滚
  private applyOptimisticUpdate(id: string, status: ApprovalStatus): void;
  private rollbackOnFailure(id: string, originalState: Approval): void;
}
```

#### 5.4.3 双向绑定约束

```typescript
// 约束: 必须通过 Pinia Action 触发所有状态变更
// ❌ 禁止: 直接修改 store.approvalList = newList
// ✓ 正确: await store.fetchApprovalList(params)

// 约束: UI 组件必须使用 computed 属性绑定
const approvalList = computed(() => store.approvalList);
const isLoading = computed(() => store.loadingState.isLoading);
```

---

## 6. 附录

### 6.1 术语定义

| 术语 | 定义 |
|------|------|
| ApprovalService | 封装审批业务逻辑的服务类，负责 HTTP 请求编排与数据转换 |
| 双向绑定 | 前端状态与服务端数据保持同步的机制，任一方变更自动触发另一方更新 |
| 乐观更新 | 先更新本地 UI 再请求后端，若失败则回滚的策略 |
| Graphify | 知识图谱可视化组件，用于展示审计实体间的关联关系 |
| 状态锁 | 防止并发操作冲突的机制，同一审批对象同时只允许一个待处理操作 |

### 6.2 参考文档

| 文档名称 | 路径 |
|----------|------|
| API 接口契约 | `docs/api/approval-api-contract.md` |
| Graphify 组件设计 | `docs/components/graphify-design.md` |
| 审批状态机定义 | `docs/workflow/approval-state-machine.md` |

---

**文档版本**: v1.0  
**编制日期**: 2024  
**适用迭代**: SWARM-052 Iteration 2  
**状态**: 待评审