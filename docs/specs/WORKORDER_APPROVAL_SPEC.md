# 工单审批流程规格指导文档

> **文档版本**: Iteration 1 / Phase 1  
> **维护者**: 待定  
> **最后更新**: 2025-01-15

---

## 1. 需求与背景

### 1.1 业务场景

工单审批流程是数字化资产管理系统的核心模块。用户（审批人）通过前端审批页面完成工单审批操作（通过/拒绝/驳回），后端驱动状态机状态流转并触发对应的通知机制（站内信/邮件/短信）。

### 1.2 当前痛点

- 审批操作需跳转到独立管理系统，操作割裂
- 状态变更依赖硬编码逻辑，缺乏统一状态机管理
- 审批结果通知被动触发，存在时延或遗漏

### 1.3 核心目标

建立统一的状态机驱动审批引擎，实现前端审批页面与后端状态流转的闭环，同时确保状态变更后即时触发多渠道通知机制。

---

## 2. 当前 Phase 对应实施目标

| Phase | 阶段名称 | 交付范围 |
|-------|----------|----------|
| **Phase 1** | 审批核心链路 | 状态机定义、前端审批 UI、后端审批 API、基础状态流转 |
| **Phase 2** | 通知机制集成 | 事件驱动通知、通知渠道集成、通知模板管理 |
| **Phase 3** | 高级审批特性 | 批量审批、审批历史、审批代理、条件审批规则 |

### 本次 Iteration 归属

**Iteration 1** 对准 **Phase 1**，聚焦审批核心链路的端到端打通。

---

## 3. 边界约束

### 3.1 功能边界

| 约束项 | 约束内容 |
|--------|----------|
| **审批操作类型** | 支持通过（APPROVED）、拒绝（REJECTED）、驳回（REVISION_REQUIRED）三种操作 |
| **状态机定义** | 必须遵循：`PENDING` → `APPROVED` / `REJECTED` / `REVISION_REQUIRED`，状态不可逆 |
| **审批权限** | 仅工单指定审批人或审批角色组可执行审批操作 |
| **并发控制** | 同工单并发审批操作必须加分布式锁，防止重复审批 |
| **通知触发时机** | 状态变更成功后**同步**触发通知事件（异步队列处理） |
| **前端协议** | 前后端通过 RESTful API 交互，数据格式为 JSON |

### 3.2 技术边界

| 约束项 | 约束内容 |
|--------|----------|
| **状态机实现** | 后端采用状态模式（State Pattern）或规则引擎实现，禁止硬编码 if-else 分支 |
| **事务要求** | 审批状态写入与事件发布必须在同一事务内完成（Outbox Pattern 或本地消息表） |
| **通知幂等性** | 通知发送必须具备幂等性（基于 notification_id），防止重复推送 |
| **API 响应时间** | 单次审批操作 P99 ≤ 500ms |
| **前端框架** | Vue 3 + Element Plus（若项目另有约定除外） |

### 3.3 数据边界

| 约束项 | 约束内容 |
|--------|----------|
| **工单状态字段** | `status`（PENDING/APPROVED/REJECTED/REVISION_REQUIRED）、`updated_at`、`updated_by` |
| **审批记录字段** | `approval_id`、`work_order_id`、`action`、`approver_id`、`comment`、`created_at` |
| **通知记录字段** | `notification_id`、`recipient_id`、`channel`、`template_id`、`status`、`sent_at` |

---

## 4. 验收测试基准 (ATB)

### 4.1 单元测试（pytest）

| 测试用例 ID | 测试描述 | 物理测试期待 |
|-------------|----------|--------------|
| UT-001 | 状态机从 PENDING 流转至 APPROVED | 调用 `approve()` 后 `current_state == State.APPROVED` |
| UT-002 | 状态机从 PENDING 流转至 REJECTED | 调用 `reject()` 后 `current_state == State.REJECTED` |
| UT-003 | 状态机从 PENDING 流转至 REVISION_REQUIRED | 调用 `request_revision()` 后 `current_state == State.REVISION_REQUIRED` |
| UT-004 | 非法状态流转（PENDING → PENDING） | 调用 `approve()` 后抛出 `InvalidStateTransitionError` |
| UT-005 | 审批记录正确写入 | 执行审批后 `ApprovalRecord` 表含对应记录 |
| UT-006 | 通知事件在状态变更后触发 | 执行审批后 `NotificationEvent` 被发布（mock 验证） |
| UT-007 | 并发审批互斥 | 两个线程同时调用 `approve()` 只有一个成功，另一个抛出 `ConcurrencyConflictError` |
| UT-008 | 审批权限校验 | 非审批人调用 `approve()` 抛出 `PermissionDeniedError` |

### 4.2 集成测试（pytest + testclient）

| 测试用例 ID | 测试描述 | 物理测试期待 |
|-------------|----------|--------------|
| IT-001 | 完整审批流程 API 交互 | POST `/api/v1/work-orders/{id}/approve` 返回 200，工单状态更新 |
| IT-002 | 审批拒绝 API 交互 | POST `/api/v1/work-orders/{id}/reject` 返回 200，状态为 REJECTED |
| IT-003 | 审批驳回 API 交互 | POST `/api/v1/work-orders/{id}/revise` 返回 200，状态为 REVISION_REQUIRED |
| IT-004 | 重复审批防护 | 对已 APPROVED 工单再次调用 approve 返回 409 Conflict |
| IT-005 | 审批记录审计 | GET `/api/v1/work-orders/{id}/approvals` 返回完整审批历史 |

### 4.3 端到端测试（Playwright）

| 测试用例 ID | 测试描述 | 物理测试期待 |
|-------------|----------|--------------|
| E2E-001 | 审批人登录 → 打开工单详情 → 点击"通过" → 页面提示"审批成功" → 工单状态更新 | `page.locator('.status-badge').text_content() == '已通过'` |
| E2E-002 | 审批人登录 → 打开工单详情 → 点击"拒绝" → 输入拒绝理由 → 页面提示"已拒绝" | `page.locator('.status-badge').text_content() == '已拒绝'` |
| E2E-003 | 审批人登录 → 打开工单详情 → 点击"驳回" → 输入驳回意见 → 页面提示"请修改" | `page.locator('.status-badge').text_content() == '待修改'` |
| E2E-004 | 非审批人访问工单详情 | 审批操作按钮不可见或点击后返回 403 |
| E2E-005 | 审批成功后通知展示 | 审批后右上角通知铃铛出现红点，数量 +1 |

### 4.4 测试覆盖率要求

| 指标 | 阈值 |
|------|------|
| 单元测试覆盖率 | ≥ 80% |
| 关键路径（状态机 + 通知触发）覆盖率 | ≥ 95% |

---

## 5. 开发切入层级序列

### 5.1 Phase 1 实施路径

```
层级 1: 数据模型层
  ├── 工单表（work_orders）新增 status 字段
  ├── 审批记录表（approval_records）设计与创建
  ├── 通知事件表（notification_events）设计与创建
  └── 数据库迁移脚本编写

层级 2: 状态机引擎层
  ├── StateMachine 基类实现
  ├── PENDING / APPROVED / REJECTED / REVISION_REQUIRED 状态定义
  ├── 状态转换规则配置化（配置文件或数据库驱动）
  └── InvalidStateTransitionError 异常定义

层级 3: 领域服务层
  ├── ApprovalService 审批服务
  │   ├── approve(work_order_id, approver_id, comment)
  │   ├── reject(work_order_id, approver_id, comment)
  │   └── request_revision(work_order_id, approver_id, comment)
  ├── 权限校验逻辑
  ├── 并发锁控制（Redis 分布式锁或数据库行锁）
  └── 事件发布（Outbox Pattern）

层级 4: 通知事件层
  ├── NotificationEvent 事件定义
  ├── 事件总线（EventBus）实现
  └── 通知处理器接口定义（具体实现接入 Phase 2）

层级 5: API 层
  ├── POST /api/v1/work-orders/{id}/approve
  ├── POST /api/v1/work-orders/{id}/reject
  ├── POST /api/v1/work-orders/{id}/revise
  ├── GET /api/v1/work-orders/{id}
  ├── GET /api/v1/work-orders/{id}/approvals
  └── 统一异常处理（400 / 403 / 404 / 409）

层级 6: 前端页面层
  ├── 工单详情页审批面板组件
  ├── 审批操作按钮组（通过 / 拒绝 / 驳回）
  ├── 审批意见输入弹窗
  ├── 审批历史记录展示组件
  └── 权限控制（v-if 基于用户角色）
```

### 5.2 技术选型建议

| 层级 | 推荐技术栈 |
|------|------------|
| 后端框架 | FastAPI / Spring Boot（按项目技术栈） |
| 状态机库 | Python: `transitions` / Java: `spring-statemachine` |
| 分布式锁 | Redis SETNX + Redisson |
| 事件总线 | 类型化事件（Typed Events），避免匿名事件 |
| 前端 UI | Element Plus `el-dialog` + `el-form` + `el-button` |

### 5.3 迭代节奏建议

| 迭代 | 交付内容 |
|------|----------|
| **Iteration 1** | 层级 1~4（数据模型 + 状态机 + 领域服务 + 事件层） |
| **Iteration 2** | 层级 5（API 层） + 后端 UT/IT |
| **Iteration 3** | 层级 6（前端页面） + E2E 测试 |

---

## 6. 关键接口定义

### 6.1 审批操作接口

```python
# 审批通过
POST /api/v1/work-orders/{work_order_id}/approve
Request Body:
{
    "approver_id": str,
    "comment": str (optional)
}
Response: 200 OK
{
    "work_order_id": str,
    "status": "APPROVED",
    "approval_id": str,
    "updated_at": datetime
}

# 审批拒绝
POST /api/v1/work-orders/{work_order_id}/reject
Request Body:
{
    "approver_id": str,
    "comment": str (required)
}
Response: 200 OK
{
    "work_order_id": str,
    "status": "REJECTED",
    "approval_id": str,
    "updated_at": datetime
}

# 审批驳回（要求修改）
POST /api/v1/work-orders/{work_order_id}/revise
Request Body:
{
    "approver_id": str,
    "comment": str (required)
}
Response: 200 OK
{
    "work_order_id": str,
    "status": "REVISION_REQUIRED",
    "approval_id": str,
    "updated_at": datetime
}
```

### 6.2 查询接口

```python
# 获取工单详情
GET /api/v1/work-orders/{work_order_id}
Response: 200 OK
{
    "work_order_id": str,
    "title": str,
    "status": str,
    "current_approver": {...},
    "created_at": datetime,
    "updated_at": datetime
}

# 获取审批历史
GET /api/v1/work-orders/{work_order_id}/approvals
Response: 200 OK
{
    "approvals": [
        {
            "approval_id": str,
            "action": str,
            "approver_id": str,
            "comment": str,
            "created_at": datetime
        }
    ]
}
```

---

## 7. 错误码定义

| 错误码 | HTTP 状态码 | 描述 |
|--------|-------------|------|
| `INVALID_STATE_TRANSITION` | 400 | 状态机不允许的转换 |
| `PERMISSION_DENIED` | 403 | 当前用户无审批权限 |
| `WORK_ORDER_NOT_FOUND` | 404 | 工单不存在 |
| `DUPLICATE_APPROVAL` | 409 | 工单已审批，不可重复操作 |
| `CONCURRENCY_CONFLICT` | 409 | 并发冲突，请重试 |
| `COMMENT_REQUIRED` | 400 | 拒绝/驳回时必须填写意见 |

---

## 8. 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2025-01-15 | 1.0 | 初始版本 | 待定 |