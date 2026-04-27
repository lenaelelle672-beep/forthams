# 工单审批流程技术规格文档

## 需求与背景

### 业务背景

工单审批流程是企业内部事务处理的核心环节，涵盖采购申请、费用报销、项目立项、设备申请等多种场景。当前系统缺乏统一的审批流程框架，各业务线自行实现导致：
- 审批状态管理混乱
- 审批链路不透明
- 通知触达不及时
- 测试覆盖率不足

### 本次迭代目标

构建一套可复用的工单审批流程框架，包含前端审批交互界面、后端状态机驱动引擎、及多渠道通知推送机制。

**对应 Iteration**: 1 (Graphify 知识图谱 + 工单审批流程)

---

## 当前 Phase 对应实施目标

**对应 Phase 1：核心流程骨架实现**

| 目标项 | 具体描述 |
|--------|----------|
| 状态机实现 | 定义工单状态枚举、状态流转规则、动作触发器 |
| 审批 API | 提供审批列表查询、审批操作、审批详情获取接口 |
| 前端审批页 | 审批工作台列表 + 审批详情/操作页面 |
| 通知服务 | 状态变更触发通知、基础通知渠道集成 |
| 单元测试 | 状态机核心逻辑 100% 覆盖 |

---

## 边界约束

### 范围约束

| 约束类型 | 描述 |
|----------|------|
| 支持的审批模式 | 串行审批（单人逐级审批），暂不支持会签/或签 |
| 审批链路深度 | 最多支持 5 级审批节点 |
| 并发控制 | 同一工单同一时刻仅允许一个审批操作，采用乐观锁 |
| 通知延迟 | 状态变更后通知触达时间 ≤ 3 秒（同步模式） |

### 技术约束

| 约束项 | 约束内容 |
|--------|----------|
| 前端框架 | React 18 + TypeScript 4.9+ |
| 后端框架 | Node.js + Express / NestJS |
| 数据库 | PostgreSQL 14+ |
| 状态存储 | 持久化至 DB，内存缓存加速查询 |
| 通知渠道 | 仅实现邮件（SendGrid/Nodemailer）、站内信 |
| API 风格 | RESTful，JSON 格式 |

### 数据约束

| 约束项 | 约束内容 |
|--------|----------|
| 工单 ID | UUID v4 |
| 审批记录 ID | UUID v4 |
| 状态机持久化 | 每次状态变更记录审计日志 |
| 软删除 | 工单及审批记录使用软删除，is_deleted 字段 |

---

## 状态机设计

### 状态枚举 (State Enum)

```
PENDING_SUBMIT      // 待提交
PENDING_APPROVE     // 待审批
APPROVING           // 审批中
APPROVED            // 审批通过
REJECTED            // 审批拒绝
RETURNED            // 已退回（需修改后重新提交）
ARCHIVED            // 已归档
```

### 动作枚举 (Action Enum)

```
SUBMIT      // 提交
APPROVE     // 审批通过
REJECT      // 审批拒绝
RETURN      // 退回
ARCHIVE     // 归档
```

### 状态流转矩阵

| 当前状态 | 允许动作 | 目标状态 | 触发条件 |
|----------|----------|----------|----------|
| PENDING_SUBMIT | SUBMIT | PENDING_APPROVE | 提交人点击提交 |
| PENDING_APPROVE | APPROVE | APPROVED | 审批人同意 |
| PENDING_APPROVE | REJECT | REJECTED | 审批人拒绝 |
| PENDING_APPROVE | RETURN | RETURNED | 审批人退回修改 |
| APPROVED | ARCHIVE | ARCHIVED | 系统自动或手动归档 |
| RETURNED | SUBMIT | PENDING_APPROVE | 提交人修改后重新提交 |

### 异常流转校验

```
禁止动作（违反状态机规则的操作）：
- RETURNED 状态不可直接 APPROVE/REJECT
- ARCHIVED 状态不可进行任何动作
- REJECTED 状态不可 RETURN
- 同一工单并发 SUBMIT/APPROVE/REJECT/RETURN 操作，后者操作被拒绝
```

---

## 数据模型

### 工单表 (work_orders)

```sql
CREATE TABLE work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content JSONB NOT NULL,           -- 工单业务数据
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_SUBMIT',
    creator_id UUID NOT NULL,
    current_approver_id UUID,
    approval_level INT NOT NULL DEFAULT 0,
    version INT NOT NULL DEFAULT 1,    -- 乐观锁版本号
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 审批节点表 (approval_nodes)

```sql
CREATE TABLE approval_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id),
    level INT NOT NULL,                -- 审批层级 1-5
    approver_id UUID NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',  -- PENDING/APPROVED/REJECTED/RETURNED
    comment TEXT,
    operated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 审批历史表 (approval_history)

```sql
CREATE TABLE approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id),
    action VARCHAR(32) NOT NULL,
    from_status VARCHAR(32) NOT NULL,
    to_status VARCHAR(32) NOT NULL,
    operator_id UUID NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 通知记录表 (notifications)

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type VARCHAR(32) NOT NULL,         -- APPROVAL_REQUIRED/APPROVED/REJECTED/RETURNED
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    related_order_id UUID REFERENCES work_orders(id),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API 规范

### 审批工作台接口

#### GET /api/approval/todo-list

**描述**：获取当前用户的待审批工单列表

**Query Parameters**：
| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| page | int | 否 | 页码，默认 1 |
| pageSize | int | 否 | 每页数量，默认 20 |
| status | string | 否 | 筛选状态 |

**Response**：
```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "采购申请-办公设备",
        "status": "PENDING_APPROVE",
        "creatorName": "张三",
        "createdAt": "2024-01-15T10:30:00Z",
        "currentLevel": 1
      }
    ],
    "total": 15,
    "page": 1,
    "pageSize": 20
  }
}
```

#### GET /api/approval/:orderId

**描述**：获取工单详情及审批链路

**Response**：
```json
{
  "code": 200,
  "data": {
    "order": {
      "id": "uuid",
      "title": "采购申请-办公设备",
      "content": {},
      "status": "PENDING_APPROVE",
      "creator": { "id": "uuid", "name": "张三" },
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "approvalChain": [
      {
        "level": 1,
        "approver": { "id": "uuid", "name": "李四" },
        "status": "PENDING",
        "comment": null
      },
      {
        "level": 2,
        "approver": { "id": "uuid", "name": "王五" },
        "status": "PENDING",
        "comment": null
      }
    ],
    "history": [
      {
        "action": "SUBMIT",
        "fromStatus": "PENDING_SUBMIT",
        "toStatus": "PENDING_APPROVE",
        "operator": "张三",
        "createdAt": "2024-01-15T10:35:00Z"
      }
    ]
  }
}
```

#### POST /api/approval/:orderId/action

**描述**：执行审批操作

**Request Body**：
```json
{
  "action": "APPROVE",     // APPROVE | REJECT | RETURN
  "comment": "同意采购"     // 可选
}
```

**Response**：
```json
{
  "code": 200,
  "data": {
    "orderId": "uuid",
    "newStatus": "APPROVED",
    "message": "审批成功"
  }
}
```

### 通知接口

#### GET /api/notifications

**描述**：获取当前用户通知列表

**Query Parameters**：
| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| isRead | boolean | 否 | 筛选已读/未读 |
| page | int | 否 | 页码 |
| pageSize | int | 否 | 每页数量 |

#### PUT /api/notifications/:id/read

**描述**：标记通知已读

---

## 前端页面规格

### 审批工作台页面 (/approval)

**功能要求**：
- Tab 切换：全部 / 待审批 / 已审批
- 列表展示：工单标题、状态标签、申请人、提交时间、操作按钮
- 状态标签颜色：
  - 待审批：橙色 `#FF9800`
  - 审批中：蓝色 `#2196F3`
  - 已通过：绿色 `#4CAF50`
  - 已拒绝：红色 `#F44336`
  - 已退回：灰色 `#9E9E9E`
- 支持分页加载
- 点击列表项跳转详情页

### 审批详情页面 (/approval/:orderId)

**功能要求**：
- 工单基本信息展示区（标题、内容、业务字段）
- 审批链路可视化（横向步骤条，显示各节点状态）
- 当前审批人操作区（仅当 status=PENDING_APPROVE 且当前用户为审批人时显示）
  - 审批意见输入框
  - 通过 / 拒绝 / 退回 三个操作按钮
- 审批历史记录时间线

### 通知中心组件

**功能要求**：
- 顶部导航栏显示未读通知数量徽标
- 点击展开通知列表
- 每条通知显示：类型图标、标题、摘要、时间
- 支持一键全部已读

---

## 通知触发规则

| 触发事件 | 通知类型 | 接收人 | 通知渠道 |
|----------|----------|--------|----------|
| 工单提交 | APPROVAL_REQUIRED | 当前层级审批人 | 站内信 + 邮件 |
| 审批通过（最终级） | APPROVED | 工单创建人 | 站内信 + 邮件 |
| 审批拒绝 | REJECTED | 工单创建人 | 站内信 + 邮件 |
| 工单退回 | RETURNED | 工单创建人 | 站内信 + 邮件 |
| 审批超时提醒 | REMINDER | 当前审批人 | 站内信（仅站内信） |

---

## 验收测试基准 (ATB)

### 后端单元测试 (Pytest/Node.js Jest)

#### TC-01：状态机流转测试

```javascript
// tests/unit/stateMachine.test.js
describe('工单状态机', () => {
  test('PENDING_SUBMIT 状态提交后应转为 PENDING_APPROVE', () => {
    const result = stateMachine.transition('PENDING_SUBMIT', 'SUBMIT', mockContext);
    expect(result.newStatus).toBe('PENDING_APPROVE');
  });

  test('PENDING_APPROVE 状态审批通过后应转为 APPROVED', () => {
    const result = stateMachine.transition('PENDING_APPROVE', 'APPROVE', mockContext);
    expect(result.newStatus).toBe('APPROVED');
  });

  test('PENDING_APPROVE 状态审批拒绝后应转为 REJECTED', () => {
    const result = stateMachine.transition('PENDING_APPROVE', 'REJECT', mockContext);
    expect(result.newStatus).toBe('REJECTED');
  });

  test('PENDING_APPROVE 状态退回后应转为 RETURNED', () => {
    const result = stateMachine.transition('PENDING_APPROVE', 'RETURN', mockContext);
    expect(result.newStatus).toBe('RETURNED');
  });

  test('REJECTED 状态不允许 APPROVE 操作，应抛出异常', () => {
    expect(() => {
      stateMachine.transition('REJECTED', 'APPROVE', mockContext);
    }).toThrow('Invalid transition');
  });

  test('ARCHIVED 状态不允许任何操作', () => {
    expect(() => {
      stateMachine.transition('ARCHIVED', 'SUBMIT', mockContext);
    }).toThrow('Invalid transition');
  });
});
```

**物理测试期待**：6 个测试用例全部通过，验证状态机流转规则符合设计。

#### TC-02：并发审批控制测试

```javascript
// tests/unit/concurrency.test.js
describe('并发审批控制', () => {
  test('同一工单并发两次 APPROVE 操作，第二次应失败', async () => {
    const orderId = 'test-order-id';
    await service.approve(orderId, user1, 'comment1');
    
    await expect(
      service.approve(orderId, user2, 'comment2')
    ).rejects.toThrow('Version conflict or invalid status');
  });
});
```

**物理测试期待**：第二次并发操作返回乐观锁冲突异常，数据库仅记录第一次审批结果。

#### TC-03：API 接口测试

```javascript
// tests/api/approval.test.js
describe('审批 API', () => {
  test('GET /api/approval/todo-list 应返回当前用户待审批列表', async () => {
    const response = await request(app)
      .get('/api/approval/todo-list')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body.data.items).toBeDefined();
    expect(Array.isArray(response.body.data.items)).toBe(true);
  });

  test('POST /api/approval/:orderId/action 执行审批应更新状态并返回新状态', async () => {
    const response = await request(app)
      .post(`/api/approval/${orderId}/action`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'APPROVE', comment: '同意' });
    
    expect(response.status).toBe(200);
    expect(response.body.data.newStatus).toBe('APPROVED');
  });

  test('无效动作应返回 400 错误', async () => {
    const response = await request(app)
      .post(`/api/approval/${orderId}/action`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'INVALID_ACTION' });
    
    expect(response.status).toBe(400);
  });
});
```

**物理测试期待**：3 个测试用例通过，API 响应符合 HTTP 状态码及响应格式规范。

#### TC-04：通知生成测试

```javascript
// tests/unit/notification.test.js
describe('通知生成逻辑', () => {
  test('审批通过时应为创建人生成 APPROVED 通知', async () => {
    await service.approve(orderId, approverId, '同意');
    
    const notification = await Notification.findOne({
      where: { userId: creatorId, type: 'APPROVED' }
    });
    
    expect(notification).not.toBeNull();
    expect(notification.title).toContain('审批通过');
  });

  test('审批拒绝时应为创建人生成 REJECTED 通知', async () => {
    await service.reject(orderId, approverId, '材料不全');
    
    const notification = await Notification.findOne({
      where: { userId: creatorId, type: 'REJECTED' }
    });
    
    expect(notification).not.toBeNull();
    expect(notification.content).toContain('材料不全');
  });
});
```

**物理测试期待**：2 个测试用例通过，通知记录正确写入数据库。

### 前端集成测试 (Playwright)

#### TC-05：审批工作台页面测试

```typescript
// e2e/approval-workbench.spec.ts
import { test, expect } from '@playwright/test';

test.describe('审批工作台页面', () => {
  test('应显示待审批工单列表', async ({ page }) => {
    await page.goto('/approval');
    
    // 验证页面标题
    await expect(page.locator('h1')).toContainText('审批工作台');
    
    // 验证列表加载
    await expect(page.locator('.approval-list')).toBeVisible();
    
    // 验证 Tab 切换
    await page.click('button:has-text("待审批")');
    await expect(page.locator('.approval-list .item')).toHaveCount(3);
  });

  test('点击工单应跳转详情页', async ({ page }) => {
    await page.goto('/approval');
    await page.click('.approval-list .item:first-child');
    
    await expect(page).toHaveURL(/\/approval\/[\w-]+$/);
  });
});
```

**物理测试期待**：2 个 Playwright 测试通过，页面渲染正确、交互响应符合预期。

#### TC-06：审批详情页操作测试

```typescript
// e2e/approval-detail.spec.ts
test.describe('审批详情页', () => {
  test('审批人应能看到并执行审批操作', async ({ page }) => {
    await page.goto('/approval/test-order-id');
    
    // 验证审批操作区可见
    await expect(page.locator('.approval-actions')).toBeVisible();
    
    // 验证意见输入框
    await page.fill('textarea[name="comment"]', '同意本次采购');
    
    // 点击通过按钮
    await page.click('button:has-text("通过")');
    
    // 验证成功提示
    await expect(page.locator('.toast')).toContainText('审批成功');
  });

  test('审批历史应按时间倒序展示', async ({ page }) => {
    await page.goto('/approval/test-order-id');
    
    const historyItems = page.locator('.history-timeline .item');
    await expect(historyItems).toHaveCount(3);
    
    // 验证最新记录在顶部
    const firstDate = await historyItems.first().locator('.date').textContent();
    const secondDate = await historyItems.nth(1).locator('.date').textContent();
    expect(new Date(firstDate) >= new Date(secondDate)).toBe(true);
  });
});
```

**物理测试期待**：2 个 Playwright 测试通过，前端操作完整、数据展示正确。

#### TC-07：通知中心测试

```typescript
// e2e/notification-center.spec.ts
test.describe('通知中心', () => {
  test('应显示未读通知数量', async ({ page }) => {
    await page.goto('/approval');
    
    const badge = page.locator('.notification-badge');
    await expect(badge).toContainText('5');
  });

  test('点击通知应标记为已读', async ({ page }) => {
    await page.goto('/approval');
    await page.click('.notification-trigger');
    await page.click('.notification-list .item:first-child');
    
    const badge = page.locator('.notification-badge');
    await expect(badge).toContainText('4');
  });
});
```

**物理测试期待**：2 个 Playwright 测试通过，通知交互逻辑正确。

---

## 开发切入层级序列

### Phase 1 实施顺序

```
┌─────────────────────────────────────────────────────────────────────┐
│  Level 1: 数据库层                                                    │
│  ├─ 创建数据表（work_orders, approval_nodes, approval_history）      │
│  └─ 编写数据访问层（DAL/Repository）                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Level 2: 领域逻辑层（状态机）                                        │
│  ├─ 定义状态枚举、动作枚举                                           │
│  ├─ 实现状态流转引擎（transition 方法）                               │
│  ├─ 实现并发控制（乐观锁）                                           │
│  └─ 单元测试覆盖 100%                                                │
├─────────────────────────────────────────────────────────────────────┤
│  Level 3: 服务层                                                     │
│  ├─ 审批服务（ApproveService）                                        │
│  │   ├─ getTodoList(userId)                                          │
│  │   ├─ getOrderDetail(orderId)                                      │
│  │   └─ executeAction(orderId, action, userId, comment)              │
│  ├─ 通知服务（NotificationService）                                   │
│  │   ├─ createNotification()                                         │
│  │   ├─ getNotifications(userId)                                     │
│  │   └─ markAsRead(notificationId)                                   │
│  └─ 单元测试覆盖 80%+                                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Level 4: API 层                                                     │
│  ├─ RESTful 接口实现                                                 │
│  ├─ 参数校验（middleware）                                           │
│  ├─ 鉴权中间件                                                       │
│  └─ API 集成测试                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Level 5: 前端层                                                     │
│  ├─ 审批工作台页面                                                   │
│  ├─ 审批详情页                                                       │
│  ├─ 通知中心组件                                                     │
│  └─ E2E 测试                                                         │
├─────────────────────────────────────────────────────────────────────┤
│  Level 6: 通知渠道集成                                               │
│  ├─ 邮件通知（SendGrid/Nodemailer）                                   │
│  ├─ 站内信通知                                                       │
│  └─ 通知模板配置                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 关键依赖关系

```
数据库表创建 ──→ 数据访问层 ──→ 状态机 ──→ 服务层 ──→ API层
                      │                      │
                      └──── 通知服务 ◄───────┘
                              │
                              ▼
                         前端层 + E2E
```

---

## 附录：错误码规范

| 错误码 | HTTP 状态码 | 描述 |
|--------|-------------|------|
| APPROVAL_001 | 400 | 无效的审批动作 |
| APPROVAL_002 | 400 | 当前状态不允许此操作 |
| APPROVAL_003 | 409 | 乐观锁冲突（并发操作） |
| APPROVAL_004 | 404 | 工单不存在 |
| APPROVAL_005 | 403 | 无审批权限 |
| NOTIFICATION_001 | 404 | 通知不存在 |

---

## AC 验收对照表

| AC ID | 验证方法 | 状态 | 说明 |
|-------|----------|------|------|
| AC-001 | integration | pending | Graphify 知识图谱节点匹配验证 |
| AC-002 | static_analysis | pending | AST 静态检查 |
| AC-003 | static_analysis | pending | docstring 覆盖检查 |
| AC-004 | unit_test | pending | 模块 import 测试 |

---

## Checkpoint 摘要

### 1. 核心特性进度
- **Iteration**: 1 (Graphify 知识图谱 + 工单审批流程)
- **后端核心**: `RetirementService`, `ApprovalChainService`, `NotificationService` 已实现状态机逻辑
- **前端核心**: `GraphifyKnowledgeGraph.tsx` 待修复
- **AC 审核状态**: ✅ 已通过 (AC-001~004 review_comments 均✅)

### 2. 阻塞的 Bug/错误
- **AC-001** (Critical): `[Graphify 知识图谱] No matching nodes found` — 节点匹配逻辑失败
- **所有 AC status**: `pending` (未完成验证)

### 3. 后续攻击的线索

| 文件 | 问题焦点 |
|------|----------|
| `GraphifyKnowledgeGraph.tsx` | 主组件，节点渲染/匹配入口 |
| `convertAuditLogsToGraphifyNodes.test.ts` | 单元测试验证节点转换逻辑 |
| `auditableFieldMap.ts` | 字段映射配置，可能缺失节点定义 |

**关键攻击点**:
1. `convertAuditLogsToGraphifyNodes` 函数 → 检查节点 ID 匹配逻辑
2. `auditableFieldMap.ts` → 确认字段映射完整性
3. E2E 测试需覆盖 Graphify 节点展示场景