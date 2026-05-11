# SWARM-052 Iteration 3 - 审批流程前端集成规格指导文档

## 1. 需求与背景

### 业务背景

企业资产管理系统中的审批流程模块需支持用户通过前端界面完成以下操作：
- 查看待审批事项列表
- 发起新的审批请求
- 审批/驳回待审批事项
- 实时感知审批状态变更
- 查看审批历史流转记录

### 技术栈约束

| 技术项 | 版本要求 | 说明 |
|--------|----------|------|
| 前端框架 | React 18.3+ | 使用 Hooks 函数式组件 |
| 编程语言 | TypeScript 5.x | 类型安全 |
| 构建工具 | Vite 6+ | 开发与构建 |
| CSS 框架 | Tailwind CSS 4+ | 样式方案 |
| 状态管理 | React Context + Custom Hooks | 管理审批状态全局共享 |
| HTTP 客户端 | Axios 1.6+ | API 请求封装 |
| UI 组件库 | MUI (Material UI) 7.3+ | 基础 UI 组件 |
| 路由 | React Router 7+ | 页面路由 |
| 测试框架 | Vitest 3.x + @testing-library/react / Playwright 1.49+ | 单元测试与 E2E 测试 |
| Mock 服务 | MSW 2.0+ | API Mock |

### 本次迭代目标 (Iteration 3)

完成审批流程前端集成的最后一个阶段，重点实现：
1. **ApprovalService 前端 SDK 封装** - 提供统一的 API 调用接口
2. **状态同步** - 实现 React Context Store 与 API 的实时同步
3. **审批状态流转 UI 组件** - 可视化展示审批流程
4. **用户交互界面** - 支持审批操作的面板组件

---

## 2. 当前 Phase 对应实施目标

根据 SWARM-052 项目计划，Iteration 3 对准 **Phase 3: UI 交互层实现**。

### 子目标分解

| 子目标 ID | 描述 | 交付物 | 优先级 |
|-----------|------|--------|--------|
| P3.1 | ApprovalService 前端 SDK 封装 | `useApproval` Hook | P0 |
| P3.2 | 审批状态流转图表组件 | `ApprovalFlowChart.tsx` | P0 |
| P3.3 | 审批操作面板组件 | `ApprovalActionPanel.tsx` | P0 |
| P3.4 | 审批列表页面集成 | `ApprovalListView.tsx` | P0 |
| P3.5 | Graphify 知识图谱节点生成 | `find_graphify_nodes` 函数 | P1 |

---

## 3. 边界约束

### 作用域边界

#### ✅ 在范围内 (In Scope)
- 审批流程前端组件开发（React + TypeScript）
- ApprovalService API 封装与调用
- 审批状态可视化组件
- React Context Store 状态同步实现
- Graphify 知识图谱节点生成
- 单元测试与 E2E 测试编写

#### ❌ 不在范围内 (Out of Scope)
- 审批流程后端逻辑实现（后端团队负责）
- 审批规则引擎配置
- CI/CD 流水线配置
- 生产环境部署
- 非 spec 指定的文件修改

### 技术边界

| 约束项 | 规定 |
|--------|------|
| 编程范式 | 仅支持 React Hooks 函数式组件，使用 TypeScript |
| 组件通信 | 采用 Props + Callbacks 模式（`props` 传入，`onXxx` 回调传出） |
| HTTP 调用 | 禁止在组件内直接调用 Axios，必须通过 `useApproval` Hook |
| 状态管理 | 审批相关状态必须存储在 React Context Store 中 |
| 类型安全 | 所有接口必须定义 TypeScript 类型 |

### 数据边界

- 审批实例数据结构由后端 ApprovalService 决定，前端仅做展示适配
- 审批状态枚举：`PENDING | APPROVED | REJECTED | CANCELLED`
- 审批类型枚举：`LEAVE | EXPENSE | PURCHASE`

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: ApprovalService 前端 SDK 封装

**测试目标**: 验证 `useApproval` Hook 的功能正确性

| 测试编号 | 测试描述 | 测试方法 | 期待结果 |
|----------|----------|----------|----------|
| ATB-1.1 | `fetchPendingApprovals()` 返回待审批列表 | Vitest 单元测试 + MSW mock | 返回 `ApprovalItem[]`，数据条数与 mock 一致 |
| ATB-1.2 | `approve(id, comment)` 提交审批通过 | Vitest 单元测试 | 返回 `{ success: true, approvalId }` |
| ATB-1.3 | `reject(id, comment)` 提交审批驳回 | Vitest 单元测试 | 返回 `{ success: true, approvalId }` |
| ATB-1.4 | 状态同步：API 响应自动更新 Context Store | Vitest 集成测试 | 调用 action 后 store 状态同步更新 |
| ATB-1.5 | 错误处理：网络异常时抛出 `ApprovalServiceError` | Vitest 单元测试 | 捕获错误并验证 `error.code === 'NETWORK_ERROR'` |

```typescript
// ATB-1.4 对应测试代码片段
describe('useApproval - 状态同步', () => {
  it('ATB-1.4: 调用 approve 后 Store 状态同步更新', async () => {
    const { result } = renderHook(() => useApprovalStore(), {
      wrapper: ApprovalStoreProvider,
    })
    const initialCount = result.current.pendingApprovals.length

    server.use(mockApproveSuccess)
    await act(async () => {
      await result.current.approve(1, '同意')
    })

    expect(result.current.pendingApprovals.length).toBe(initialCount - 1)
  })
})
```

### 4.2 ATB-2: 审批状态流转图表组件

**测试目标**: 验证 `ApprovalFlowChart.tsx` 组件的渲染正确性

| 测试编号 | 测试描述 | 测试方法 | 期待结果 |
|----------|----------|----------|----------|
| ATB-2.1 | 组件接收 `approvalHistory` prop 并正确渲染节点 | Vitest + @testing-library/react | 渲染出对应状态的节点数量 |
| ATB-2.2 | 当前节点高亮显示 | Vitest + DOM 断言 | 当前节点添加 `.is-current` class |
| ATB-2.3 | 各状态节点显示正确的图标 | Playwright E2E | PENDING 显示时钟图标，APPROVED 显示勾选 |
| ATB-2.4 | 驳回状态显示驳回原因 | Vitest + 快照测试 | 包含驳回原因的 tooltip 或文字 |

```tsx
// ATB-2 对应组件接口定义
import type { FC } from 'react'
import type { ApprovalHistoryItem } from '../services/approval/types'

interface ApprovalFlowChartProps {
  approvalHistory: ApprovalHistoryItem[]
}

const ApprovalFlowChart: FC<ApprovalFlowChartProps> = ({ approvalHistory }) => {
  // ...
}
```

### 4.3 ATB-3: 审批操作面板组件

**测试目标**: 验证 `ApprovalActionPanel.tsx` 组件的用户交互

| 测试编号 | 测试描述 | 测试方法 | 期待结果 |
|----------|----------|----------|----------|
| ATB-3.1 | 通过按钮触发 `onApprove` 回调，携带 comment | @testing-library/react fireEvent | `onApprove({ id, comment })` 被调用 |
| ATB-3.2 | 驳回按钮触发 `onReject` 回调 | @testing-library/react fireEvent | `onReject({ id, comment })` 被调用 |
| ATB-3.3 | 无权限时操作按钮禁用 | @testing-library/react + props.disabled | 按钮添加 `disabled` 属性 |
| ATB-3.4 | 空 comment 提交时提示必填 | Playwright E2E | 显示 MUI 表单校验错误 |
| ATB-3.5 | 提交中显示 loading 状态 | @testing-library/react + loading prop | 按钮显示 loading 动画 |

### 4.4 ATB-4: 审批列表页面集成

**测试目标**: 验证 `ApprovalListView.tsx` 页面的完整功能

| 测试编号 | 测试描述 | 测试方法 | 期待结果 |
|----------|----------|----------|----------|
| ATB-4.1 | 页面挂载时自动加载待审批列表 | Playwright E2E + MSW mock | 列表渲染出 mock 数据 |
| ATB-4.2 | 点击审批项展开详情 | Playwright E2E | 显示 `ApprovalFlowChart` 和 `ApprovalActionPanel` |
| ATB-4.3 | 审批完成后列表自动刷新 | Playwright E2E + 断言 | 已审批项从列表消失 |
| ATB-4.4 | 空状态显示"暂无待审批项" | Playwright E2E | 渲染空状态插画和文案 |

```typescript
// ATB-4.1 Playwright 测试示例
test('ATB-4.1: 页面加载时获取待审批列表', async ({ page }) => {
  await page.goto('/approvals')
  await expect(page.locator('.approval-item')).toHaveCount(3)
})
```

### 4.5 ATB-5: Graphify 知识图谱节点生成

**测试目标**: 验证 `find_graphify_nodes` 函数的正确性（修复 AC-001）

| 测试编号 | 测试描述 | 测试方法 | 期待结果 |
|----------|----------|----------|----------|
| ATB-5.1 | `find_graphify_nodes` 返回有效的数据结构 | 单元测试 | 返回的 nodes 数组包含必要字段 |
| ATB-5.2 | 空变更列表时返回资产节点 | 单元测试 | 返回至少包含一个资产节点 |
| ATB-5.3 | 变更字段正确映射为节点 | 单元测试 | 每个 AuditChange 对应一个 field 节点 |
| ATB-5.4 | 节点数组通过 `validate_graphify_nodes` 验证 | 单元测试 | 验证函数返回 True |

```typescript
// ATB-5.1 对应测试代码片段
describe('find_graphify_nodes', () => {
  it('ATB-5.1: 返回有效的数据结构', () => {
    const assetId = 'AST-2024-001'
    const nodes = findGraphifyNodes(sampleAuditChanges, assetId)

    expect(Array.isArray(nodes)).toBe(true)
    expect(nodes.length).toBeGreaterThan(0)

    const assetNode = nodes.find((n) => n.type === 'asset')
    expect(assetNode).toBeDefined()
  })
})
```

### 4.6 ATB-6: 代码质量验证

| 测试编号 | 测试描述 | 测试方法 | 期待结果 |
|----------|----------|----------|----------|
| ATB-6.1 | 代码变更不引入新的语法错误 | TypeScript 编译检查 | 所有文件通过 `tsc --noEmit` |
| ATB-6.2 | 所有修改的函数包含 JSDoc | 静态分析 | 每个导出函数包含非空 JSDoc |
| ATB-6.3 | 变更后的模块可被正常 import | Vitest unit_test | 无 ImportError 抛出 |

---

## 5. 开发切入层级序列

### Phase 1: 基础设施层（Day 1）

#### 目录结构
```
frontend/src/
├── app/
│   ├── services/
│   │   └── approval/
│   │       ├── types.ts              # 类型定义
│   │       ├── errors.ts             # 错误类定义
│   │       └── api.ts                # API 调用封装
│   ├── stores/
│   │   └── approvalStore.ts          # React Context Store
│   └── hooks/
│       └── useApproval.ts            # Hook 封装
```

#### 交付物清单

| 文件 | 描述 | 产出标准 |
|------|------|----------|
| `types.ts` | 定义 `ApprovalItem`, `ApprovalHistoryItem`, `ApprovalAction` 接口 | 类型定义完整，无 `any` |
| `errors.ts` | 定义 `ApprovalServiceError` 错误类 | 包含 NETWORK_ERROR, VALIDATION_ERROR 等错误码 |
| `api.ts` | 封装 Axios 调用，定义请求/响应拦截器 | 返回标准化响应格式 |
| `approvalStore.ts` | 包含 `pendingApprovals`, `currentApproval`, `isLoading` 状态 | 支持 Actions 和 Getters |
| `useApproval.ts` | 封装 `fetchPendingApprovals()`, `approve()`, `reject()`, `subscribe()` 方法 | 实现状态同步逻辑 |

### Phase 2: UI 组件层（Day 2-3）

#### 目录结构
```
frontend/src/
└── app/
    └── components/
        └── approval/
            ├── ApprovalFlowChart.tsx       # 状态流转图
            ├── ApprovalActionPanel.tsx     # 操作面板
            ├── ApprovalCard.tsx            # 列表项卡片
            └── ApprovalDetailDrawer.tsx    # 详情抽屉
```

#### 交付物清单

| 组件 | Props | Events | 说明 |
|------|-------|--------|------|
| `ApprovalFlowChart.tsx` | `approvalHistory: ApprovalHistoryItem[]` | - | 渲染状态节点和连线 |
| `ApprovalActionPanel.tsx` | `approvalId: string`, `disabled: boolean`, `loading: boolean` | `onApprove`, `onReject` | 通过/驳回按钮 + 审批意见 |
| `ApprovalCard.tsx` | `item: ApprovalItem` | `onClick` | 列表项卡片展示 |
| `ApprovalDetailDrawer.tsx` | `open: boolean`, `approvalId: string` | `onClose` | 整合 flow + action 的抽屉 |

### Phase 3: 页面集成层（Day 4）

#### 目录结构
```
frontend/src/
└── app/
    └── pages/
        └── ApprovalListView.tsx
```

#### 交付物清单

| 文件 | 描述 | 功能点 |
|------|------|--------|
| `ApprovalListView.tsx` | 审批列表页面主视图 | 自动加载数据、空状态处理、详情展开、审批操作 |

### Phase 4: 测试与验收（Day 5）

- 完成所有 ATB 测试用例编写
- 执行 `vitest run` 单元测试，通过率 100%
- 执行 `playwright test` E2E 测试，通过率 100%
- 提交 PR 并关联 SWARM-052

---

## 6. 接口契约

### 6.1 前端类型定义

```typescript
// ApprovalItem 接口
interface ApprovalItem {
  id: number;
  processNo: string;
  type: ApprovalType;
  applicant: number;
  status: ApprovalStatus;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
  history: ApprovalHistoryItem[];
}

// ApprovalHistoryItem 接口
interface ApprovalHistoryItem {
  id: number;
  processId: number;
  stepNo: number;
  operator: number;
  status: ApprovalResult;
  operatedAt: string;
  comment: string;
}

// ApprovalAction 接口
interface ApprovalAction {
  approvalId: number;
  action: ApprovalResult;
  comment: string;
}
```

---

## 7. 依赖关系

### 7.1 前端依赖

| 依赖项 | 版本要求 | 来源 | 用途 |
|--------|----------|------|------|
| react | ^18.3.0 | 项目已有 | 前端框架 |
| react-dom | ^18.3.0 | 项目已有 | DOM 渲染 |
| @mui/material | ^7.3.0 | 项目已有 | UI 组件库 |
| axios | ^1.6.0 | 项目已有 | HTTP 客户端 |
| react-router-dom | ^7.0.0 | 项目已有 | 路由 |
| vitest | ^3.0.0 | 开发依赖 | 单元测试 |
| @testing-library/react | ^16.0.0 | 开发依赖 | React 组件测试 |
| @testing-library/jest-dom | ^6.0.0 | 开发依赖 | DOM 断言扩展 |
| playwright | ^1.49.0 | 开发依赖 | E2E 测试 |
| msw | ^2.0.0 | 开发依赖 | API Mock |

---

## 8. 风险与注意事项

### 8.1 已识别风险

| 风险 ID | 描述 | 影响 | 缓解措施 |
|---------|------|------|----------|
| RISK-001 | Graphify 知识图谱节点数据结构与 UI 组件不匹配 | AC-001 失败 | 确保 `find_graphify_nodes` 返回符合组件要求的节点格式 |
| RISK-002 | 前端审批操作与后端实时同步延迟 | 用户体验问题 | 实现轮询机制 |
| RISK-003 | 并发审批操作导致状态不一致 | 数据一致性 | 后端加锁 + 前端乐观更新 |

### 8.2 注意事项

1. **API Mock**: 开发阶段使用 MSW mock 所有 API 调用，确保前后端解耦
2. **错误处理**: 所有 API 调用必须包含 try-catch，友好展示错误信息
3. **类型安全**: 禁止使用 `any` 类型，所有数据结构必须有明确类型定义
4. **测试覆盖**: 核心业务逻辑必须包含单元测试，覆盖率 ≥ 80%

---

## 9. 里程碑定义

| 里程碑 | 完成标准 | 预计时间 |
|--------|----------|----------|
| M1: 基础设施完成 | `useApproval` Hook 可用，Store 状态管理正常 | Day 1 |
| M2: UI 组件完成 | 4 个审批组件通过组件级测试 | Day 3 |
| M3: 页面集成完成 | 审批列表页面通过 E2E 测试 | Day 4 |
| M4: 验收完成 | 所有 ATB 测试通过率 100% | Day 5 |

---

## 10. 参考文档

- [React 18 文档](https://react.dev/)
- [React Router 7 文档](https://reactrouter.com/)
- [MUI (Material UI) 文档](https://mui.com/)
- [Vitest 测试框架](https://vitest.dev/)
- [Playwright E2E 测试](https://playwright.dev/)
