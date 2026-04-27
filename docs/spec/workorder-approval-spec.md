# 工单审批流程 - 规格指导文档

**版本**: v1.0.0  
**迭代**: Iteration 1  
**状态**: Draft  
**日期**: 2024-01-XX

---

## 需求与背景

### 业务背景

随着企业运营规模扩大，内部工单审批流程存在以下痛点：

1. **流程不透明**：申请人无法实时追踪工单审批状态
2. **审批效率低**：单级审批机制导致高优先级工单积压
3. **通知滞后**：审批人依赖主动查询，遗漏关键工单
4. **责任不清**：缺少明确的审批链路记录

### 功能目标

实现一套支持多级审批链路的工单审批系统，包含状态机流转、实时通知与可追溯的审批记录。

### 关键术语

| 术语 | 定义 |
|------|------|
| 工单 (WorkOrder) | 具有唯一ID的审批请求实体 |
| 状态机 (StateMachine) | 定义工单状态及其合法转换规则 |
| 审批链 (ApprovalChain) | 预定义的审批人层级序列 |
| 审批节点 (ApprovalNode) | 审批链中的单一审批步骤 |
| 消息推送 (MessagePush) | 异步通知审批人/申请人的机制 |

---

## 当前 Phase 对应实施目标

### Phase 1: 核心闭环 (Iteration 1)

本迭代聚焦**最小可审批闭环**，不追求完整功能覆盖。

| 子模块 | 具体目标 | 排除范围 |
|--------|----------|----------|
| 状态机 | 单向审批流转（不支持驳回/撤回） | 驳回重提、撤回取消 |
| 审批链 | 固定2级审批链（组长→经理） | 动态审批链、条件分支 |
| 通知 | 站内消息通知 | 邮件通知、短信通知、企微/钉钉集成 |
| 前端 | 提交表单 + 我的工单列表 | 审批工作台（审批人在各自业务系统操作） |
| 持久化 | 工单/审批记录落库 | 审计日志归档、附件存储 |

### Phase 2: 增强能力（后续迭代）

- 支持驳回重提与主动撤回
- 多级动态审批链配置
- 邮件/短信通知渠道
- 审批工作台前端

---

## 边界约束

### 技术约束

| 约束项 | 描述 |
|--------|------|
| 数据库 | MySQL 8.0+，需支持事务与外键约束 |
| 消息队列 | Redis Stream（用于消息异步投递） |
| API风格 | RESTful，JSON格式 |
| 认证 | JWT Token（从现有鉴权体系继承） |

### 业务约束

| 约束项 | 描述 |
|--------|------|
| 审批时效 | 审批人72小时未操作触发超时提醒 |
| 并发控制 | 同一工单同一时刻仅允许一个审批操作 |
| 数据隔离 | 用户仅可见自己提交或需自己审批的工单 |

### 非功能约束

| 约束项 | 描述 |
|--------|------|
| 响应时间 | API P99 < 500ms |
| 可用性 | 系统可用性 >= 99.5% |
| 消息送达 | 通知送达率 >= 99%（站内消息） |

### 明确排除

以下功能**不在本迭代范围**，严禁在本迭代中实现：

- ❌ 驳回重提流程
- ❌ 工单撤回/取消
- ❌ 审批委托/转交
- ❌ 外部通知渠道（邮件/短信/企微/钉钉）
- ❌ 审批加签/减签
- ❌ 工单催办
- ❌ 移动端审批

---

## 验收测试基准 (ATB)

### 测试文件命名规范

```
tests/
├── unit/
│   ├── test_state_machine.py
│   ├── test_approval_chain.py
│   └── test_notification_service.py
├── integration/
│   ├── test_workorder_submit.py
│   ├── test_approval_flow.py
│   └── test_message_delivery.py
└── e2e/
    └── test_approval_workflow.spec.py
```

---

### ATB-001: 工单提交

| 测试ID | 测试描述 | 测试输入 | 物理期待 |
|--------|----------|----------|----------|
| ATB-001-01 | 正常提交工单 | 登录用户，提交有效工单数据 | HTTP 201，数据库存在对应记录，status='PENDING' |
| ATB-001-02 | 缺少必填字段 | 提交缺少 title 字段 | HTTP 400，error_code='VALIDATION_ERROR' |
| ATB-001-03 | 未认证提交 | 无Token请求 | HTTP 401 |
| ATB-001-04 | 标题超长 | title 字段 256 字符 | HTTP 400，field='title' |
| ATB-001-05 | 提交后触发第一级审批通知 | 工单提交成功 | Redis Stream 存在审批人消息记录，message_type='APPROVAL_REQUIRED' |

**Pytest 测试函数**：
```python
def test_submit_workorder_success():
    # 登录 → 提交 → 断言 201 + DB记录

def test_submit_workorder_validation_error():
    # 提交无效数据 → 断言 400

def test_submit_triggers_notification():
    # 提交 → 检查 Redis Stream 消息
```

---

### ATB-002: 状态机流转

| 测试ID | 测试描述 | 测试输入 | 物理期待 |
|--------|----------|----------|----------|
| ATB-002-01 | 合法状态转换 | PENDING → APPROVED | 状态更新为 APPROVED，审批时间戳记录 |
| ATB-002-02 | 非法状态转换 | DRAFT → APPROVED（不支持） | HTTP 422，error_code='INVALID_TRANSITION' |
| ATB-002-03 | 重复审批 | 同一工单二次审批 | HTTP 409，error_code='ALREADY_PROCESSED' |
| ATB-002-04 | 并发审批竞争 | 两进程同时审批同一工单 | 仅一进程成功，另一返回 409 |
| ATB-002-05 | 非审批人操作 | 非指定审批人执行审批 | HTTP 403，error_code='FORBIDDEN' |

**状态转换图**：

```
                    ┌─────────┐
                    │ PENDING │ (等待第一级审批)
                    └────┬────┘
                         │ 组长审批通过
                         ▼
                  ┌──────────────┐
                  │ PENDING_L2   │ (等待第二级审批)
                  └──────┬───────┘
                         │ 经理审批通过
                         ▼
                   ┌──────────┐
                   │ APPROVED │ (终态)
                   └──────────┘
```

**Pytest 测试函数**：
```python
def test_valid_state_transition():
    # 创建工单 → 第一级审批 → 第二级审批 → 断言 APPROVED

def test_invalid_transition_rejected():
    # 尝试非法转换 → 断言 422

def test_concurrent_approval_one_wins():
    # 使用 threading 同时发起两个审批请求 → 断言只有一个成功
```

---

### ATB-003: 审批链验证

| 测试ID | 测试描述 | 测试输入 | 物理期待 |
|--------|----------|----------|----------|
| ATB-003-01 | 按审批链顺序审批 | 第一级未审批直接操作第二级 | HTTP 400，error_code='SEQUENCE_VIOLATION' |
| ATB-003-02 | 审批链配置正确加载 | 工单创建后检查审批人 | 第一级审批人=工单创建者组长，第二级=部门经理 |

**Pytest 测试函数**：
```python
def test_cannot_skip_approval_sequence():
    # 直接操作第二级审批 → 断言 400
```

---

### ATB-004: 消息通知

| 测试ID | 测试描述 | 测试输入 | 物理期待 |
|--------|----------|----------|----------|
| ATB-004-01 | 审批完成通知申请人 | 工单最终审批通过 | Redis Stream 存在申请人消息记录，message_type='APPROVED' |
| ATB-004-02 | 新工单通知审批人 | 工单提交成功 | Redis Stream 存在审批人消息记录 |
| ATB-004-03 | 消息内容包含工单ID | 检查消息payload | payload 包含 workorder_id 和跳转链接 |

**Pytest 测试函数**：
```python
def test_approval_notification_to_requester():
    # 工单通过 → 消费 Redis Stream → 断言申请人收到通知

def test_new_workorder_notification_to_approver():
    # 工单提交 → 断言 Redis Stream 有审批人消息
```

---

### ATB-005: 前端 E2E (Playwright)

| 测试ID | 测试描述 | 操作步骤 | 物理期待 |
|--------|----------|----------|----------|
| ATB-005-01 | 提交工单流程 | 登录 → 点击提交 → 填写表单 → 提交 | 页面提示"提交成功"，跳转至工单列表 |
| ATB-005-02 | 查看工单列表 | 登录 → 进入我的工单 | 列表展示所有相关工单，显示状态标签 |
| ATB-005-03 | 工单详情查看 | 点击工单列表项 | 展示工单详情、审批历史时间线 |

**Playwright 测试**：
```python
def test_workflow_e2e(page: Page):
    page.goto("/workorder/submit")
    page.fill('[name="title"]', "测试工单")
    page.click('button[type="submit"]')
    expect(page.locator(".toast")).to_contain_text("提交成功")
```

---

## 开发切入层级序列

### 阶段一：数据层 (Day 1-2)

**目标**：完成数据库表设计与基础模型

```
db/migrations/
├── 001_create_workorders.sql
├── 002_create_approval_nodes.sql
├── 003_create_approval_records.sql
└── 004_create_notifications.sql
```

| 文件 | 内容 |
|------|------|
| `workorders` | id, title, description, status, priority, created_by, created_at, updated_at |
| `approval_nodes` | id, workorder_id, level, approver_id, status (PENDING/APPROVED), sequence |
| `approval_records` | id, workorder_id, approver_id, action, comment, created_at |
| `notifications` | id, user_id, type, payload(JSON), read_status, created_at |

**交付物**：DB migration脚本 + SQLAlchemy 模型类

---

### 阶段二：核心业务层 (Day 3-5)

**目标**：实现状态机与审批链核心逻辑

```
backend/services/
├── workorder_service.py      # 工单CRUD
├── state_machine.py           # 状态转换引擎
├── approval_chain_service.py # 审批链解析
└── notification_service.py    # 消息投递
```

**关键实现**：

1. **StateMachine 类**
   - `can_transition(current_state, target_state) -> bool`
   - `transition(workorder_id, target_state, actor_id) -> bool`
   - 使用乐观锁防止并发冲突

2. **ApprovalChainService**
   - `resolve_chain(workorder) -> List[Approver]`
   - 硬编码2级链：查询创建者 → 获取组长 → 获取部门经理

**交付物**：核心业务逻辑代码 + 单元测试覆盖率 >= 80%

---

### 阶段三：API 层 (Day 6-7)

**目标**：暴露 RESTful 接口

```
backend/routers/
├── workorders.py     # POST /api/v1/workorders
├── approvals.py      # POST /api/v1/workorders/{id}/approve
└── notifications.py  # GET /api/v1/notifications
```

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/workorders` | POST | 提交工单 |
| `/api/v1/workorders/{id}` | GET | 获取工单详情 |
| `/api/v1/workorders/{id}/approve` | POST | 执行审批 |
| `/api/v1/notifications` | GET | 获取当前用户通知列表 |
| `/api/v1/notifications/{id}/read` | PUT | 标记通知已读 |

**交付物**：API 接口 + 请求/响应 schema + 接口文档

---

### 阶段四：消息队列集成 (Day 8)

**目标**：实现异步消息通知

```
backend/consumers/
└── notification_consumer.py  # 消费 Redis Stream → 写入通知表
```

**Redis Stream 结构**：

```
Stream Key: notification:pending
Entry: {
  "user_id": "xxx",
  "type": "APPROVAL_REQUIRED",
  "workorder_id": "xxx",
  "title": "xxx"
}
```

**交付物**：消息生产者代码 + 消费者服务 + 集成测试

---

### 阶段五：前端开发 (Day 9-10)

**目标**：完成用户提交与查看功能

```
frontend/src/
├── pages/
│   ├── WorkOrderSubmit.tsx   # 工单提交表单
│   ├── WorkOrderList.tsx     # 我的工单列表
│   └── WorkOrderDetail.tsx   # 工单详情
├── components/
│   ├── StatusTag.tsx
│   └── ApprovalTimeline.tsx
└── api/
    └── workorder.ts
```

**交付物**：可运行的前端页面 + E2E 测试用例

---

### 阶段六：联调与回归 (Day 11-12)

| 任务 | 描述 |
|------|------|
| API 联调 | 前后端接口对接 |
| 异常场景测试 | 网络超时、数据库异常、并发竞争 |
| 性能测试 | 100并发工单提交场景验证 |
| 回归测试 | 核心路径无退化 |

---

### 阶段七：交付 (Day 13)

- [ ] 所有 ATB 测试用例通过
- [ ] 代码 Review 通过
- [ ] 部署文档编写完成
- [ ] 监控告警配置完成

---

## 附录

### 数据库 ER 图

```
┌─────────────┐       ┌─────────────────┐       ┌──────────────────┐
│  workorders │───1:N─│  approval_nodes │───1:N─│  approval_records│
└─────────────┘       └─────────────────┘       └──────────────────┘
       │
       │ 1:N
       ▼
┌─────────────────┐
│  notifications  │
└─────────────────┘
```

### 状态枚举

| 状态值 | 描述 |
|--------|------|
| `PENDING` | 等待第一级审批 |
| `PENDING_L2` | 等待第二级审批 |
| `APPROVED` | 审批通过（终态） |
| `REJECTED` | 审批驳回（本迭代不实现） |

### 错误码规范

| 错误码 | HTTP状态 | 描述 |
|--------|----------|------|
| `VALIDATION_ERROR` | 400 | 请求参数校验失败 |
| `UNAUTHORIZED` | 401 | 未认证 |
| `FORBIDDEN` | 403 | 无权限执行该操作 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `INVALID_TRANSITION` | 422 | 非法状态转换 |
| `ALREADY_PROCESSED` | 409 | 资源已被处理 |
| `SEQUENCE_VIOLATION` | 400 | 违反审批顺序 |

---

**文档结束**