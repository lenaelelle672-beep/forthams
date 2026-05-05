# 工单审批前端页面开发规格指导文档

## 需求与背景

### 业务背景

工单审批系统（SWARM-222）需要在前端实现完整的审批流程交互页面。终端用户为审批人，需要在工单详情页完成审批决策操作。

### 功能范围

| 功能模块 | 描述 |
|----------|------|
| **ApprovalWorkflow** | 审批流程状态可视化组件，展示审批节点流转状态 |
| **ApproverInfo** | 审批人信息展示组件，显示当前审批人/已审批人详情 |
| **ApprovalActions** | 审批操作按钮组，支持通过/驳回两种决策 |
| **ApprovalComment** | 审批意见输入区，支持审批人填写审批备注 |

### 技术栈约束

- React 18 + TypeScript
- Ant Design 5.x UI 组件库
- 基于现有工单详情页（`OrderDetail`）扩展审批区块

---

## 当前 Phase 对应实施目标

### Phase 对照（Iteration 1）

| Phase | 描述 | 状态 |
|-------|------|------|
| Phase 1 | 审批组件基础结构搭建 + ApproverInfo 展示 | **本次实施** |
| Phase 2 | Approve/Reject 操作逻辑 + 后端 API 联调 | 下次迭代 |
| Phase 3 | 审批意见持久化 + 流程状态联动 | 下次迭代 |

### 本次 Iteration 目标

**Iteration 1** 聚焦：

1. `ApprovalWorkflow` 组件渲染
2. `ApproverInfo` 数据展示
3. `ApprovalActions` 按钮 UI 占位（操作逻辑 placeholder）
4. `ApprovalComment` 输入框 UI 占位

---

## 边界约束

### 范围边界

| 约束项 | 内容 |
|--------|------|
| 组件粒度 | 仅覆盖 `ApprovalWorkflow`、`ApproverInfo`、`ApprovalActions`、`ApprovalComment` 四个组件 |
| 操作范围 | UI 按钮渲染（禁用状态），API 调用逻辑预留接口暂不实现 |
| 数据范围 | 使用 Mock 数据展示，不连接真实后端接口 |

### 非覆盖范围

- 后端 API 集成（Phase 2）
- 审批驳回后的工单状态回退逻辑
- 审批流程配置管理
- 多级审批链式流转

### 权限约束

- 仅处理前端组件渲染逻辑
- 按钮权限判断由后端返回，组件仅接收 `disabled` 属性控制

---

## 验收测试基准 (ATB)

### ATB-1: ApprovalWorkflow 组件渲染测试

**测试场景**：组件挂载后正确渲染审批流程节点

**物理测试代码（Playwright + React Testing Library）**：

```typescript
// tests/e2e/approval.spec.ts
import { test, expect } from '@playwright/test';

test('ApprovalWorkflow renders all approval nodes', async ({ page }) => {
  // Arrange: Mock 数据注入
  const mockNodes = [
    {
      nodeId: '1',
      nodeName: '部门主管审批',
      status: 'completed',
      approver: '张三',
      approveTime: '2024-01-15 10:30',
    },
    {
      nodeId: '2',
      nodeName: '财务复核',
      status: 'pending',
      approver: '李四',
      approveTime: null,
    },
  ];

  // Act: 渲染组件
  await page.goto('/order/ORDER-001');
  const workflowComponent = page.locator('[data-testid="approval-workflow"]');

  // Assert: 验证节点数量
  await expect(workflowComponent.locator('.workflow-node')).toHaveCount(2);

  // Assert: 验证节点状态正确渲染
  await expect(workflowComponent.locator('.node-status-completed')).toHaveCount(1);
  await expect(workflowComponent.locator('.node-status-pending')).toHaveCount(1);

  // Assert: 验证连接线渲染
  await expect(workflowComponent.locator('.workflow-connector')).toBeVisible();
});
```

**验收标准**：

| 检查项 | 期望结果 |
|--------|----------|
| 审批节点数 | 与 Mock 数据一致（2 个节点） |
| `status='completed'` 节点 | 显示绿色勾选图标 `.node-status-completed` |
| `status='pending'` 节点 | 显示灰色时钟图标 `.node-status-pending` |
| 节点间连接线 | 正确渲染 `.workflow-connector` |

---

### ATB-2: ApproverInfo 展示测试

**测试场景**：展示审批人信息列表

**物理测试代码**：

```typescript
// tests/e2e/approval.spec.ts
test('ApproverInfo displays approver details correctly', async ({ page }) => {
  // Arrange
  const mockApprovers = [
    {
      id: 'u001',
      name: '张三',
      department: '研发部',
      approveTime: '2024-01-15 10:30',
    },
    {
      id: 'u002',
      name: '李四',
      department: '财务部',
      approveTime: null,
    },
  ];

  // Act
  await page.goto('/order/ORDER-001');
  const approverSection = page.locator('[data-testid="approver-info"]');

  // Assert: 姓名展示
  await expect(approverSection.getByText('张三')).toBeVisible();
  await expect(approverSection.getByText('李四')).toBeVisible();

  // Assert: 部门信息
  await expect(approverSection.getByText('研发部')).toBeVisible();

  // Assert: 已审批显示时间戳
  await expect(approverSection.getByText('2024-01-15 10:30')).toBeVisible();

  // Assert: 待审批时间戳不显示
  const nullTimeElements = approverSection.locator('.approve-time');
  await expect(nullTimeElements).toHaveCount(1);
});
```

**验收标准**：

| 检查项 | 期望结果 |
|--------|----------|
| `approveTime` 有值 | 显示时间戳格式 `YYYY-MM-DD HH:mm` |
| `approveTime` 为 `null` | 不渲染时间戳字段（仅显示 "-"） |
| 部门信息 | 正确显示 |
| 审批人姓名 | 正确显示 |

---

### ATB-3: Approve/Reject 按钮 UI 占位测试

**测试场景**：审批按钮正确渲染且置灰（操作逻辑暂未实现）

**物理测试代码**：

```typescript
// tests/e2e/approval.spec.ts
test('Approval buttons render with disabled state in Iteration 1', async ({ page }) => {
  // Act
  await page.goto('/order/ORDER-001');
  const actionSection = page.locator('[data-testid="approval-actions"]');

  // Assert: 按钮存在
  await expect(actionSection.getByRole('button', { name: '通过' })).toBeVisible();
  await expect(actionSection.getByRole('button', { name: '驳回' })).toBeVisible();

  // Assert: Iteration 1 阶段禁用
  await expect(actionSection.getByRole('button', { name: '通过' })).toBeDisabled();
  await expect(actionSection.getByRole('button', { name: '驳回' })).toBeDisabled();

  // Assert: 禁用原因 tooltip
  await expect(
    actionSection.getByRole('button', { name: '通过' })
  ).toHaveAttribute('title', '操作逻辑 Phase 2 实现');
});
```

**验收标准**：

| 检查项 | 期望结果 |
|--------|----------|
| "通过" 按钮 | 存在且 `disabled={true}` |
| "驳回" 按钮 | 存在且 `disabled={true}` |
| Tooltip 提示 | `title='操作逻辑 Phase 2 实现'` |

---

### ATB-4: 审批意见输入框测试

**测试场景**：文本输入框正常渲染（暂不支持提交）

**物理测试代码**：

```typescript
// tests/e2e/approval.spec.ts
test('Approval comment input renders correctly', async ({ page }) => {
  // Act
  await page.goto('/order/ORDER-001');
  const commentInput = page.locator('[data-testid="approval-comment-input"]');

  // Assert: 输入框存在
  await expect(commentInput).toBeVisible();

  // Assert: Placeholder 文本
  await expect(commentInput).toHaveAttribute(
    'placeholder',
    '请输入审批意见（选填）'
  );

  // Assert: 可输入但无提交触发（Phase 2 前）
  await commentInput.fill('测试审批意见');
  await expect(commentInput).toHaveValue('测试审批意见');
});
```

**验收标准**：

| 检查项 | 期望结果 |
|--------|----------|
| 文本域 | 存在且可见 |
| `placeholder` | `'请输入审批意见（选填）'` |
| 输入绑定 | 值可正常绑定到 state |

---

## 开发切入层级序列

### Layer 1: 数据模型层（优先级最高）

**目标**：定义 TypeScript 类型与 Mock 数据结构

```
src/types/approval.ts   ← 新建
├── ApprovalNode        ← 审批节点类型
├── ApproverInfo        ← 审批人信息类型
└── ApprovalAction      ← 审批操作类型（预留）
```

```typescript
// src/types/approval.ts

/**
 * 审批节点状态枚举
 */
export enum ApprovalNodeStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * 审批节点类型定义
 */
export interface ApprovalNode {
  nodeId: string;
  nodeName: string;
  status: ApprovalNodeStatus;
  approverId: string;
  approverName: string;
  approveTime: string | null;
}

/**
 * 审批人信息类型定义
 */
export interface ApproverInfo {
  id: string;
  name: string;
  department: string;
  approveTime: string | null;
}

/**
 * 审批操作类型定义（预留 Phase 2）
 */
export type ApprovalAction = 'APPROVE' | 'REJECT';

/**
 * 审批意见类型定义
 */
export interface ApprovalComment {
  workOrderId: string;
  comment: string;
  action: ApprovalAction;
  operatorId: string;
  operatorName: string;
  operateTime: string;
}
```

---

### Layer 2: 组件结构层

**目标**：基于 Ant Design 搭建基础组件骨架

```
src/components/approval/
├── ApprovalWorkflow.tsx     ← 流程图组件
├── ApproverInfo.tsx          ← 审批人信息卡片
├── ApprovalActions.tsx       ← 操作按钮组（Disabled）
└── ApprovalComment.tsx       ← 审批意见输入
```

**组件开发顺序**：

1. `ApproverInfo.tsx` — 最简单，先行验证 Mock 数据渲染
2. `ApprovalComment.tsx` — 独立文本域，便于单独测试
3. `ApprovalWorkflow.tsx` — 流程可视化，依赖 ApproverInfo 数据结构
4. `ApprovalActions.tsx` — 按钮组，整合到页面

**组件核心实现**：

```tsx
// src/components/approval/ApproverInfo.tsx
import React from 'react';
import { Card, Descriptions, Tag } from 'antd';
import { ApproverInfo as ApproverInfoType } from '@/types/approval';

interface ApproverInfoProps {
  approvers: ApproverInfoType[];
}

/**
 * 审批人信息展示组件
 * @param approvers - 审批人列表
 */
export const ApproverInfo: React.FC<ApproverInfoProps> = ({ approvers }) => {
  return (
    <Card
      title="审批人信息"
      data-testid="approver-info"
      className="approver-info-card"
    >
      <Descriptions column={1}>
        {approvers.map((approver) => (
          <Descriptions.Item
            key={approver.id}
            label={approver.name}
          >
            <span className="department">{approver.department}</span>
            <span className="approve-time">
              {approver.approveTime || '-'}
            </span>
            {approver.approveTime && (
              <Tag color="green" className="ml-2">
                已审批
              </Tag>
            )}
          </Descriptions.Item>
        ))}
      </Descriptions>
    </Card>
  );
};
```

```tsx
// src/components/approval/ApprovalWorkflow.tsx
import React from 'react';
import { Steps, Tag } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { ApprovalNode, ApprovalNodeStatus } from '@/types/approval';

interface ApprovalWorkflowProps {
  nodes: ApprovalNode[];
}

/**
 * 审批流程状态可视化组件
 * @param nodes - 审批节点列表
 */
export const ApprovalWorkflow: React.FC<ApprovalWorkflowProps> = ({ nodes }) => {
  const getStepStatus = (status: ApprovalNodeStatus) => {
    switch (status) {
      case ApprovalNodeStatus.APPROVED:
        return 'finish';
      case ApprovalNodeStatus.REJECTED:
        return 'error';
      default:
        return 'wait';
    }
  };

  const getStepIcon = (status: ApprovalNodeStatus, index: number) => {
    if (status === ApprovalNodeStatus.APPROVED) {
      return <CheckCircleOutlined className="node-status-completed" />;
    }
    if (status === ApprovalNodeStatus.REJECTED) {
      return <CloseCircleOutlined className="node-status-rejected" />;
    }
    return <ClockCircleOutlined className="node-status-pending" />;
  };

  return (
    <div
      className="workflow-container"
      data-testid="approval-workflow"
    >
      <Steps
        current={nodes.findIndex((n) => n.status === ApprovalNodeStatus.PENDING)}
        items={nodes.map((node, index) => ({
          title: node.nodeName,
          description: node.approverName,
          status: getStepStatus(node.status),
          icon: getStepIcon(node.status, index),
        }))}
      />
    </div>
  );
};
```

```tsx
// src/components/approval/ApprovalActions.tsx
import React from 'react';
import { Button, Space } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';

interface ApprovalActionsProps {
  disabled?: boolean;
}

/**
 * 审批操作按钮组组件（Iteration 1 禁用占位）
 * @param disabled - 是否禁用按钮
 */
export const ApprovalActions: React.FC<ApprovalActionsProps> = ({
  disabled = true,
}) => {
  return (
    <Space data-testid="approval-actions" className="approval-actions">
      <Button
        type="primary"
        icon={<CheckOutlined />}
        disabled={disabled}
        title="操作逻辑 Phase 2 实现"
      >
        通过
      </Button>
      <Button
        danger
        icon={<CloseOutlined />}
        disabled={disabled}
        title="操作逻辑 Phase 2 实现"
      >
        驳回
      </Button>
    </Space>
  );
};
```

```tsx
// src/components/approval/ApprovalComment.tsx
import React from 'react';
import { Input } from 'antd';

const { TextArea } = Input;

interface ApprovalCommentProps {
  value?: string;
  onChange?: (value: string) => void;
}

/**
 * 审批意见输入组件
 * @param value - 意见内容
 * @param onChange - 变更回调
 */
export const ApprovalComment: React.FC<ApprovalCommentProps> = ({
  value,
  onChange,
}) => {
  return (
    <TextArea
      data-testid="approval-comment-input"
      placeholder="请输入审批意见（选填）"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      rows={3}
      maxLength={500}
      showCount
    />
  );
};
```

---

### Layer 3: 页面集成层

**目标**：在 `OrderDetail` 页面中嵌入审批区块

```
src/pages/WorkOrder/
├── ApprovalPage.tsx          ← 审批页面主入口
├── components/
│   └── ApprovalSection.tsx   ← 审批区块容器
└── hooks/
    └── useApprovalData.ts     ← 审批数据获取 hook（Mock）
```

**集成点**：

- 在工单详情页 `StatusSection` 下方嵌入 `ApprovalWorkflow`
- 审批操作区 `ApprovalActions` 放置于页面底部固定区域

```tsx
// src/pages/WorkOrder/hooks/useApprovalData.ts
import { useState, useEffect } from 'react';
import { ApprovalNode, ApproverInfo, ApprovalNodeStatus } from '@/types/approval';

/**
 * 审批数据获取 Hook（Mock 实现，Phase 2 替换为 API 调用）
 */
export const useApprovalData = (workOrderId: string) => {
  const [nodes, setNodes] = useState<ApprovalNode[]>([]);
  const [approvers, setApprovers] = useState<ApproverInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock 数据
    const mockNodes: ApprovalNode[] = [
      {
        nodeId: '1',
        nodeName: '部门主管审批',
        status: ApprovalNodeStatus.APPROVED,
        approverId: 'u001',
        approverName: '张三',
        approveTime: '2024-01-15 10:30',
      },
      {
        nodeId: '2',
        nodeName: '财务复核',
        status: ApprovalNodeStatus.PENDING,
        approverId: 'u002',
        approverName: '李四',
        approveTime: null,
      },
    ];

    const mockApprovers: ApproverInfo[] = [
      {
        id: 'u001',
        name: '张三',
        department: '研发部',
        approveTime: '2024-01-15 10:30',
      },
      {
        id: 'u002',
        name: '李四',
        department: '财务部',
        approveTime: null,
      },
    ];

    setNodes(mockNodes);
    setApprovers(mockApprovers);
    setLoading(false);
  }, [workOrderId]);

  return { nodes, approvers, loading };
};
```

---

### Layer 4: 样式与主题层

**约束**：使用 Ant Design token，保持与现有工单详情页风格一致

- 审批节点图标使用 Ant Design Icons
- 卡片阴影、间距沿用工单详情页已有样式变量

---

### 开发时序图

```
[Week 1 Day 1-2] Layer 1: 类型定义 + Mock 数据准备
        ↓
[Week 1 Day 3-4] Layer 2: ApproverInfo + ApprovalComment 组件
        ↓
[Week 1 Day 5]   Layer 2: ApprovalWorkflow 组件
        ↓
[Week 2 Day 1]   Layer 2: ApprovalActions 组件
        ↓
[Week 2 Day 2-3] Layer 3: ApprovalPage 页面集成
        ↓
[Week 2 Day 4-5] Layer 4: 样式调优 + ATB 全量测试
```

---

## 交付清单

| 交付物 | 路径 | 说明 |
|--------|------|------|
| 类型定义 | `src/types/approval.ts` | ApprovalNode、ApproverInfo、ApprovalComment |
| 组件代码 | `src/components/approval/` | 4 个组件 TSX |
| 页面集成 | `src/pages/WorkOrder/` | ApprovalPage + hooks |
| 单元测试 | `tests/e2e/approval.spec.ts` | 4 个 ATB 对应测试用例 |
| 本文档 | `docs/spec-swarm-222-iteration1.md` | 规格指导文档 |

---

## 后续迭代规划

### Iteration 2 目标（Phase 2）

1. **后端 API 联调**：对接 `approvalStore.ts` 中的 `submitApproval`、`rejectApproval` 接口
2. **操作逻辑实现**：移除 `disabled` 属性，绑定实际操作处理函数
3. **审批意见持久化**：集成 `ApprovalComment` 提交逻辑

### Iteration 3 目标（Phase 3）

1. **流程状态联动**：审批完成后自动更新 `ApprovalWorkflow` 节点状态
2. **多级审批支持**：扩展 `ApprovalNode[]` 支持任意层级审批链
3. **权限精细化**：基于 `useApprovalPermission.ts` 实现按钮级权限控制