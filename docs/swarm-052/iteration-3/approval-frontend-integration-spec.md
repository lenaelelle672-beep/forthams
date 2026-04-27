# SWARM-052 Iteration 3 - 审批流程前端集成规格指导文档

## 1. 需求与背景

### 1.1 业务背景

企业审批流程系统需支持用户通过前端界面完成审批请求的全生命周期管理，包括发起、查看、审批、驳回等操作，并实时感知审批状态变更。

### 1.2 技术栈约束

| 技术项 | 约束要求 | 备注 |
|--------|----------|------|
| 前端框架 | Vue 3 (Composition API) | 仅支持 `<script setup>` 语法 |
| 状态管理 | Pinia | 审批状态全局共享 |
| HTTP客户端 | Axios | 统一封装在 `src/utils/http.ts` |
| UI组件库 | Element Plus | 审批相关组件基于 El 组件封装 |
| 测试框架 | Vitest + Playwright | 单元测试 + E2E测试 |

### 1.3 本次迭代目标

完成审批流程前端集成，实现 ApprovalService 双向绑定，搭建审批状态流转 UI 组件与用户交互界面。

---

## 2. 当前 Phase 对应实施目标

根据项目迭代计划，Phase 3 为 **UI 交互层实现**，本次规格对标以下交付目标：

| 目标ID | 目标描述 | 交付物 | 优先级 |
|--------|----------|--------|--------|
| P3.1 | ApprovalService 前端 SDK 封装 | `useApproval` Composable | P0 |
| P3.2 | 审批状态流转图表组件开发 | `ApprovalFlowChart.vue` | P0 |
| P3.3 | 审批操作面板组件开发 | `ApprovalActionPanel.vue` | P0 |
| P3.4 | 审批列表页面集成 | `ApprovalListView.vue` | P1 |

---

## 3. 边界约束

### 3.1 作用域边界

| 类型 | 范围 | 说明 |
|------|------|------|
| **包含** | 审批流程前端组件开发 | 本次迭代核心交付 |
| **包含** | ApprovalService API 封装 | 与后端服务对接 |
| **包含** | 审批状态可视化 | 状态流转图、操作面板 |
| **排除** | 审批流程后端逻辑实现 | 由后端团队负责 |
| **排除** | 审批规则引擎配置 | 独立模块，不在本迭代范围 |

### 3.2 技术边界

- 仅支持 Vue 3 Composition API 写法（`defineProps` + `defineEmits` 模式）
- 组件内禁止直接调用 Axios，需通过 `useApproval` Composable
- 统一使用 Element Plus 组件库，禁止引入其他 UI 框架
- Graphify 知识图谱节点渲染依赖 `GraphifyKnowledgeGraph` 组件

### 3.3 数据边界

- 审批实例数据结构由后端 `ApprovalService` 决定，前端仅做展示适配
- 状态枚举值：`PENDING` | `APPROVED` | `REJECTED` | `CANCELLED`
- 审批历史记录通过 `approvalHistory[]` 数组传递

---

## 4. 接口契约

### 4.1 核心类型定义

#### ApprovalItem（审批项）

```typescript
interface ApprovalItem {
  id: string                    // 审批实例唯一标识
  title: string                 // 审批标题
  type: 'LEAVE' | 'EXPENSE' | 'PURCHASE' | 'ASSET_TRANSFER'
  applicant: {
    id: string
    name: string
    avatar?: string
  }
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  createdAt: string             // ISO 8601 时间格式
  updatedAt: string
  currentStep: number           // 当前审批步骤
  totalSteps: number            // 总审批步骤数
}
```

#### ApprovalHistoryItem（审批历史记录）

```typescript
interface ApprovalHistoryItem {
  id: string
  step: number                  // 步骤序号
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  operator: {
    id: string
    name: string
    avatar?: string
  }
  operatedAt: string            // 操作时间
  comment?: string              // 审批意见
  // Graphify 知识图谱节点数据
  graphifyNode?: {
    id: string
    type: 'approval_node'
    label: string
    entityId: string
  }
}
```

#### ApprovalAction（审批操作）

```typescript
interface ApprovalAction {
  approvalId: string
  action: 'APPROVE' | 'REJECT'
  comment: string
  timestamp: string
}
```

### 4.2 Graphify 知识图谱节点接口

```typescript
interface GraphifyNode {
  id: string                    // 节点唯一ID
  type: 'approval_node' | 'approval_step' | 'approver'
  label: string                 // 节点显示标签
  entityId: string              // 关联实体ID
  x?: number                    // X轴坐标（布局后）
  y?: number                    // Y轴坐标（布局后）
  properties?: Record<string, unknown>  // 扩展属性
}
```

---

## 5. 验收测试基准 (ATB)

### 5.1 ATB-1: ApprovalService 前端 SDK 封装

| 测试ID | 测试描述 | 测试方法 | 物理期待结果 |
|--------|----------|----------|--------------|
| ATB-1.1 | `useApproval().fetchPendingApprovals()` 返回待审批列表 | Vitest + MSW Mock | 返回 `ApprovalItem[]`，数据条数 ≥ 0，接口调用成功 |
| ATB-1.2 | `useApproval().approve(id, comment)` 提交审批通过 | Vitest Mock | 返回 `{ success: true, approvalId }`，HTTP 状态码 200 |
| ATB-1.3 | `useApproval().reject(id, comment)` 提交审批驳回 | Vitest Mock | 返回 `{ success: true, approvalId }`，HTTP 状态码 200 |
| ATB-1.4 | 双向绑定：API 响应自动更新 Pinia Store | Vitest 集成测试 | 调用 action 后 store 中 `pendingApprovals` 同步减少 1 条 |
| ATB-1.5 | 错误处理：网络异常时抛出 `ApprovalServiceError` | Vitest Mock 500 | `error.code === 'NETWORK_ERROR'`，抛出异常被捕获 |
| ATB-1.6 | 实时订阅：后端推送状态变更时 Store 同步 | Vitest + FakeTimers | `currentApproval.status` 从 `PENDING` 更新为 `APPROVED` |

```typescript
// ATB-1.4 双向绑定测试代码示例
describe('useApproval - 双向绑定', () => {
  it('ATB-1.4: approve action 后 Store 状态同步更新', async () => {
    server.use(mockApproveSuccess)
    const store = useApprovalStore()
    const initialCount = store.pendingApprovals.length
    
    const { approve } = useApproval()
    await approve('approval-001', '同意')
    
    // Store 自动同步更新
    expect(store.pendingApprovals.length).toBe(initialCount - 1)
  })
})
```

### 5.2 ATB-2: 审批状态流转图表组件

| 测试ID | 测试描述 | 测试方法 | 物理期待结果 |
|--------|----------|----------|--------------|
| ATB-2.1 | 组件接收 `approvalHistory` prop 并正确渲染节点 | Vue Test Utils | 渲染出与 prop 数量一致的 `.flow-node` 元素 |
| ATB-2.2 | 当前审批节点高亮显示 | DOM 断言 | 当前节点添加 `.is-current` class，视觉高亮 |
| ATB-2.3 | 各状态节点显示正确的图标 | Playwright E2E | PENDING 显示时钟图标，APPROVED 显示勾选图标 |
| ATB-2.4 | 驳回状态显示驳回原因 | Vue Test Utils 快照 | 包含驳回原因文本的 tooltip 或文字描述 |
| ATB-2.5 | Graphify 节点数据结构正确 | 单元测试 | 每个节点包含 `id`, `type`, `label`, `entityId` 字段 |

```vue
<!-- ATB-2 对应组件接口定义 -->
<script setup lang="ts">
import type { ApprovalHistoryItem } from '@/types/approval'

defineProps<{
  approvalHistory: ApprovalHistoryItem[]
  currentStep: number
}>()
</script>
```

### 5.3 ATB-3: 审批操作面板组件

| 测试ID | 测试描述 | 测试方法 | 物理期待结果 |
|--------|----------|----------|--------------|
| ATB-3.1 | 通过按钮触发 `approve` 事件，携带 comment | Vue Test Utils emit | `emit('approve', { id, comment })` 被调用 |
| ATB-3.2 | 驳回按钮触发 `reject` 事件 | Vue Test Utils emit | `emit('reject', { id, comment })` 被调用 |
| ATB-3.3 | 无权限时操作按钮禁用 | props 控制 | 按钮添加 `disabled` 属性，不可点击 |
| ATB-3.4 | 空 comment 提交时提示必填 | Playwright E2E | 显示 Element Plus 表单校验错误 "请输入审批意见" |
| ATB-3.5 | 提交中显示 loading 状态 | Vue Test Utils | 按钮显示加载动画，`pointer-events: none` |
| ATB-3.6 | 提交成功后重置表单 | Vue Test Utils | `comment` 输入框清空，按钮恢复可点击 |

### 5.4 ATB-4: 审批列表页面集成

| 测试ID | 测试描述 | 测试方法 | 物理期待结果 |
|--------|----------|----------|--------------|
| ATB-4.1 | 页面挂载时自动加载待审批列表 | Playwright E2E + MSW | 列表渲染出 mock 数据对应数量的 `.approval-card` |
| ATB-4.2 | 点击审批项展开详情 | Playwright E2E 点击 | 显示 `ApprovalFlowChart` 和 `ApprovalActionPanel` |
| ATB-4.3 | 审批完成后列表自动刷新 | Playwright E2E + 断言 | 已审批项从列表消失，新数据请求触发 |
| ATB-4.4 | 空状态显示"暂无待审批项" | Playwright E2E | 渲染空状态插画和文案提示 |
| ATB-4.5 | 加载状态显示骨架屏 | Vue Test Utils | 渲染 `.el-skeleton` 组件 |

```typescript
// ATB-4.1 Playwright 测试代码示例
test('ATB-4.1: 页面加载时获取待审批列表', async ({ page }) => {
  await page.goto('/approvals')
  await expect(page.locator('.approval-card')).toHaveCount(3)
})
```

### 5.5 ATB-5: Graphify 知识图谱集成

| 测试ID | 测试描述 | 测试方法 | 物理期待结果 |
|--------|----------|----------|--------------|
| ATB-5.1 | 审批历史转换为图谱节点 | 单元测试 | `generateGraphifyNodes()` 返回有效节点数组 |
| ATB-5.2 | 图谱节点数据结构验证 | 单元测试 | 所有节点包含必需字段，无 undefined |
| ATB-5.3 | 空变更列表返回有效资产节点 | 单元测试 | 返回包含资产节点的有效数组，长度 ≥ 1 |
| ATB-5.4 | 图谱组件正确渲染节点 | Playwright E2E | Canvas 或 SVG 中渲染出对应节点 |

---

## 6. 开发切入层级序列

### 6.1 Phase 1: 基础设施层（第 1 天）

#### 文件结构

```
src/
├── services/
│   └── approval/
│       ├── types.ts              # 类型定义
│       ├── errors.ts             # 错误类定义
│       └── api.ts                # API 调用封装
├── stores/
│   └── approvalStore.ts          # Pinia Store
└── composables/
    └── useApproval.ts            # Composable 封装
```

#### 交付物清单

| 文件 | 职责 | 关键导出 |
|------|------|----------|
| `services/approval/types.ts` | 定义审批相关 TypeScript 接口 | `ApprovalItem`, `ApprovalHistoryItem`, `GraphifyNode` |
| `services/approval/errors.ts` | 定义审批服务错误类型 | `ApprovalServiceError` |
| `services/approval/api.ts` | 封装 Axios API 调用 | `fetchApprovals`, `submitApproval` |
| `stores/approvalStore.ts` | Pinia 状态管理 | `pendingApprovals`, `currentApproval`, `isLoading` |
| `composables/useApproval.ts` | 响应式 API 封装 | `fetchPendingApprovals()`, `approve()`, `reject()` |

### 6.2 Phase 2: UI 组件层（第 2-3 天）

#### 文件结构

```
src/
└── components/
    └── approval/
        ├── ApprovalFlowChart.vue       # 状态流转图
        ├── ApprovalActionPanel.vue      # 操作面板
        ├── ApprovalCard.vue            # 列表项卡片
        ├── ApprovalDetailDrawer.vue     # 详情抽屉
        └── index.ts                     # 统一导出
```

#### 组件规格

| 组件 | Props | Emits | 职责 |
|------|-------|-------|------|
| `ApprovalFlowChart` | `approvalHistory[]`, `currentStep` | - | 渲染审批状态节点和连线 |
| `ApprovalActionPanel` | `approvalId`, `disabled`, `loading` | `approve`, `reject` | 审批操作按钮和意见输入 |
| `ApprovalCard` | `item: ApprovalItem` | `select` | 列表项卡片展示 |
| `ApprovalDetailDrawer` | `visible`, `approvalId` | `update:visible` | 整合详情和操作 |

### 6.3 Phase 3: 页面集成层（第 4 天）

#### 文件结构

```
src/
└── views/
    └── ApprovalListView.vue
```

#### 交付物清单

- `ApprovalListView.vue`：完整的审批列表页面
- 集成 `useApproval` 获取数据
- 处理空状态、加载状态、错误状态
- 响应式状态同步

### 6.4 Phase 4: 测试与验收（第 5 天）

| 任务 | 交付物 | 验收标准 |
|------|--------|----------|
| 单元测试 | `*.test.ts` 文件 | Vitest 通过率 100% |
| E2E 测试 | `*.spec.ts` 文件 | Playwright 通过率 100% |
| PR 提交 | 关联 SWARM-052 | 代码审查通过 |

---

## 7. 依赖关系

### 7.1 项目内部依赖

| 依赖项 | 版本 | 来源 | 用途 |
|--------|------|------|------|
| Vue 3 | ^3.4.0 | 项目已有 | 前端框架 |
| Pinia | ^2.1.0 | 项目已有 | 状态管理 |
| Element Plus | ^2.5.0 | 项目已有 | UI 组件库 |
| Axios | ^1.6.0 | 项目已有 | HTTP 客户端 |

### 7.2 开发依赖

| 依赖项 | 版本 | 用途 |
|--------|------|------|
| vitest | ^1.2.0 | 单元测试框架 |
| @vue/test-utils | ^2.4.0 | Vue 组件测试 |
| playwright | ^1.40.0 | E2E 测试框架 |
| msw | ^2.0.0 | API Mock 服务 |
| @playwright/test | ^1.40.0 | Playwright 测试运行器 |

---

## 8. 已知问题与解决方向

### 8.1 AC-001: Graphify 知识图谱节点匹配失败

| 项目 | 说明 |
|------|------|
| 问题描述 | 集成测试报告 "No matching nodes found" |
| 根因分析 | 审批历史转换为图谱节点时数据结构不匹配 |
| 解决方向 | 确保 `generateGraphifyNodes()` 返回有效节点数组，包含资产节点 |

### 8.2 AC-003: 文档注释缺失

| 项目 | 说明 |
|------|------|
| 问题描述 | `tests/test_audit_aspect.py` 中 13 个函数缺少 docstring |
| 解决方向 | 为所有修改的测试函数补充完整 docstring |

### 8.3 AC-004: 模块导入错误

| 项目 | 说明 |
|------|------|
| 问题描述 | pytest 返回 Unknown Failure，模块导入链断裂 |
| 解决方向 | 检查 `frontend/src/components/approval/index.ts` 导出配置 |

---

## 9. 附录

### 9.1 审批状态流转规则

```
┌─────────┐     ┌───────────┐     ┌───────────┐     ┌─────────────┐
│ PENDING │ ──► │ APPROVING │ ──► │ APPROVED  │     │ CANCELLED   │
└─────────┘     └───────────┘     └───────────┘     └─────────────┘
     │                                       ▲
     │                                       │
     └───────────────────────────────────────┘
                    (REJECTED)
```

### 9.2 错误码定义

| 错误码 | 说明 | HTTP 状态码 |
|--------|------|-------------|
| `NETWORK_ERROR` | 网络连接异常 | - |
| `APPROVAL_NOT_FOUND` | 审批记录不存在 | 404 |
| `UNAUTHORIZED` | 无审批权限 | 403 |
| `INVALID_STATUS` | 状态不允许操作 | 400 |
| `SERVER_ERROR` | 服务器内部错误 | 500 |

### 9.3 Mock 数据示例

```typescript
// 待审批列表 Mock 数据
const mockPendingApprovals: ApprovalItem[] = [
  {
    id: 'approval-001',
    title: '设备采购申请 - 办公电脑 5 台',
    type: 'PURCHASE',
    applicant: { id: 'user-001', name: '张三', avatar: '/avatars/u1.png' },
    status: 'PENDING',
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-01-15T09:00:00Z',
    currentStep: 1,
    totalSteps: 3
  }
]
```