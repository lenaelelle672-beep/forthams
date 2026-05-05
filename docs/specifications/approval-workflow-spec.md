# 工单审批流程规格指导文档

## 1 需求与背景

### 1.1 业务场景

企业内部资产管理系统需支持用户在线提交工单、选择审批人、审批人进行审批操作的完整业务流程。工单状态需遵循预定义的状态机规则进行流转，审批结果需实时通知相关方。

### 1.2 核心功能需求

| 序号 | 功能点 | 描述 |
|------|--------|------|
| F-01 | 工单创建 | 用户提交工单，包含标题、描述、附件、审批人选择 |
| F-02 | 审批人选择 | 支持单审批人或多审批人（串行审批） |
| F-03 | 状态机流转 | 草稿 → 待审批 → 审批中 → 通过/驳回 → 归档 |
| F-04 | 审批操作 | 审批人执行通过或驳回操作，填写审批意见 |
| F-05 | 通知提醒 | 审批状态变更时发送邮件/站内信通知 |

### 1.3 角色定义

| 角色 | 权限范围 |
|------|----------|
| 申请人 | 创建工单、查看自己的工单状态、撤回草稿状态的工单 |
| 审批人 | 查看待审批工单、执行审批操作、查看审批历史 |
| 管理员 | 管理工单模板、配置审批流程、管理用户权限 |

---

## 2 当前 Phase 对应实施目标

### 2.1 Phase 划分

```
Phase 1: 核心数据模型与 API 基础层 ✓ [本次实施]
Phase 2: 前端交互界面与状态管理
Phase 3: 通知系统集成与高级流程
```

### 2.2 Phase 1 实施范围

| 层级 | 交付物 | 里程碑 |
|------|--------|--------|
| 数据库层 | 工单表、审批记录表、状态流转日志表 | Day 1-2 |
| 领域模型层 | Ticket 实体、ApprovalWorkflow 状态机 | Day 3-5 |
| 服务层 | TicketService、ApprovalService、NotificationService | Day 6-8 |
| API 层 | RESTful API 接口定义与实现 | Day 9-12 |
| 测试层 | 单元测试、集成测试 | Day 13-14 |

### 2.3 本期不含范围

- 前端界面开发
- 真实邮件发送（仅实现通知接口抽象）
- 多级会签审批（限定为单审批人串行审批）

---

## 3 边界约束

### 3.1 功能边界

| 约束类型 | 具体约束 |
|----------|----------|
| 状态边界 | 工单状态仅允许按状态机定义的方向流转，不允许跨状态跳跃 |
| 权限边界 | 申请人不能审批自己的工单 |
| 审批边界 | 仅当前待审批人可执行审批操作 |
| 撤回边界 | 仅草稿状态工单允许撤回 |
| 通知边界 | 通知发送失败不影响工单状态变更（异步队列） |

### 3.2 技术边界

| 约束类型 | 具体约束 |
|----------|----------|
| 数据库 | PostgreSQL 12+ |
| 后端框架 | FastAPI 0.100+ / Django 4.2+ |
| 状态机实现 | 使用 PyGithub Actions 风格的有限状态机模式 |
| 通知队列 | Redis Stream 或 RabbitMQ |
| API 风格 | RESTful，JSON 格式 |
| 版本控制 | 状态机流转需校验版本号防止并发冲突 |

### 3.3 数据边界

| 约束 | 限制值 |
|------|--------|
| 工单标题长度 | 1-200 字符 |
| 工单描述长度 | 1-5000 字符 |
| 附件数量 | 最多 5 个，单个 ≤ 10MB |
| 审批意见长度 | 0-1000 字符 |

---

## 4 验收测试基准 (ATB)

### 4.1 ATB-01: 工单创建功能

| 测试编号 | 测试场景 | 测试数据 | 物理测试期待 | 测试工具 |
|----------|----------|----------|--------------|----------|
| ATB-01-01 | 创建草稿工单成功 | 标题:"测试工单", 描述:"测试描述", 审批人ID:101 | 返回 201，ticket_id 存在，status="draft" | pytest |
| ATB-01-02 | 创建工单缺失必填字段 | 标题:null | 返回 422，error_detail 包含 "title is required" | pytest |
| ATB-01-03 | 创建工单标题超长 | 标题:201字符 | 返回 422，error_detail 包含 "title max length" | pytest |
| ATB-01-04 | 创建工单选择不存在的审批人 | approver_id:99999 | 返回 422，error_detail 包含 "approver not found" | pytest |

### 4.2 ATB-02: 状态机流转功能

| 测试编号 | 测试场景 | 初始状态 | 操作 | 期待结果 | 测试工具 |
|----------|----------|----------|------|----------|----------|
| ATB-02-01 | 提交草稿工单 | draft | POST /tickets/{id}/submit | status → pending_approval | pytest |
| ATB-02-02 | 审批通过 | pending_approval | POST /tickets/{id}/approve | status → approved | pytest |
| ATB-02-03 | 审批驳回 | pending_approval | POST /tickets/{id}/reject | status → rejected | pytest |
| ATB-02-04 | 非法状态跳转 | draft | POST /tickets/{id}/approve | 返回 400，error: "invalid state transition" | pytest |
| ATB-02-05 | 重复审批 | approved | POST /tickets/{id}/approve | 返回 400，error: "already approved" | pytest |
| ATB-02-06 | 版本冲突 | pending_approval | 旧版本号提交审批 | 返回 409，error: "version conflict" | pytest |

### 4.3 ATB-03: 权限校验功能

| 测试编号 | 测试场景 | 测试数据 | 期待结果 | 测试工具 |
|----------|----------|----------|----------|----------|
| ATB-03-01 | 非审批人执行审批 | 当前用户非审批人 | 返回 403，error: "not authorized" | pytest |
| ATB-03-02 | 申请人审批自己的工单 | 申请人与审批人为同一人 | 返回 403，error: "cannot approve own ticket" | pytest |
| ATB-03-03 | 未登录用户访问 | 无 token | 返回 401，error: "unauthorized" | pytest |

### 4.4 ATB-04: 通知发送功能

| 测试编号 | 测试场景 | Mock 期待 | 测试工具 |
|----------|----------|-----------|----------|
| ATB-04-01 | 审批通过触发通知 | NotificationService.send() 被调用 1 次，channel="email" | pytest (unittest.mock) |
| ATB-04-02 | 审批驳回触发通知 | NotificationService.send() 被调用 1 次，包含 rejection_reason | pytest (unittest.mock) |
| ATB-04-03 | 通知发送失败不影响主流程 | NotificationService.send() 抛出异常 | 工单状态仍正常变更，记录错误日志 | pytest |

### 4.5 ATB-05: API 端点清单

| 方法 | 端点 | 功能 | ATB 覆盖 |
|------|------|------|----------|
| POST | /api/v1/tickets | 创建工单 | ATB-01 |
| GET | /api/v1/tickets/{id} | 获取工单详情 | - |
| GET | /api/v1/tickets | 列表查询（分页、筛选） | - |
| POST | /api/v1/tickets/{id}/submit | 提交工单 | ATB-02-01 |
| POST | /api/v1/tickets/{id}/approve | 审批通过 | ATB-02-02, ATB-03 |
| POST | /api/v1/tickets/{id}/reject | 审批驳回 | ATB-02-03, ATB-03 |
| GET | /api/v1/tickets/{id}/history | 获取审批历史 | - |

### 4.6 测试通过标准

```
测试覆盖率: ≥ 80%
所有 ATB 用例必须通过
集成测试: POST /api/v1/tickets 完整流程测试
```

---

## 5 开发切入层级序列

### 5.1 Level 1: 数据库层 (Day 1-2)

```
database/
├── migrations/
│   └── 001_create_ticket_tables.sql
└── schemas/
    └── ticket_schema.sql
```

**交付物**：
- `tickets` 表：id, title, description, status, creator_id, approver_id, version, created_at, updated_at
- `approval_records` 表：id, ticket_id, approver_id, action, comment, created_at
- `state_transition_logs` 表：id, ticket_id, from_status, to_status, triggered_by, created_at

### 5.2 Level 2: 领域模型层 (Day 3-5)

```
domain/
├── models/
│   ├── ticket.py          # Ticket 实体
│   └── approval.py        # ApprovalRecord 实体
├── state_machine/
│   ├── states.py          # 状态枚举
│   ├── events.py          # 事件枚举
│   └── ticket_state_machine.py  # 状态机核心
└── exceptions/
    └── ticket_exceptions.py
```

**状态机定义**：

```
draft ──[submit]──> pending_approval ──[approve]──> approved ──[archive]──> archived
                    │                              │
                    └──[reject]──> rejected        │
                                  │                │
                                  └──[archive]──> archived
```

**守卫链设计**（参照 `src/engine/guards.py`）：

| 守卫函数 | 作用 |
|----------|------|
| `guard_draft_to_pending_approval` | 验证工单完整性、审批人有效性 |
| `guard_pending_approval_to_approved` | 验证审批人身份、非自审批 |
| `guard_pending_approval_to_rejected` | 验证审批人身份、填写驳回原因 |
| `guard_approved_to_archived` | 验证归档权限 |
| `guard_rejected_to_archived` | 验证归档权限 |

### 5.3 Level 3: 服务层 (Day 6-8)

```
services/
├── ticket_service.py
├── approval_service.py
└── notification_service.py
```

**核心接口**：

```python
# TicketService
def create_ticket(creator_id: str, title: str, description: str, approver_id: str) -> Ticket
def submit_ticket(ticket_id: str, version: int) -> Ticket

# ApprovalService (参照 src/services/approval_service.py)
def approve(ticket_id: str, approver_id: str, comment: str, version: int) -> Ticket
def reject(ticket_id: str, approver_id: str, reason: str, version: int) -> Ticket
def get_progress(ticket_id: str) -> ApprovalProgress

# NotificationService (参照 src/services/notification_service.py)
def publish_approval(ticket_id: str, approver_id: str, comment: str)
def publish_rejection(ticket_id: str, approver_id: str, reason: str)
```

### 5.4 Level 4: API 层 (Day 9-12)

```
api/
├── routes/
│   └── v1/
│       └── tickets.py
├── schemas/
│   ├── ticket_request.py
│   └── ticket_response.py
├── dependencies/
│   └── auth.py
└── main.py
```

**依赖注入层级**：

```
HTTP Request
    ↓
[Auth Middleware] → 验证 JWT Token
    ↓
[Dependency: get_current_user] → 注入当前用户
    ↓
[Route Handler] → 调用 Service 层
    ↓
[Service Layer] → 调用 Repository 层
    ↓
[Repository Layer] → 操作数据库
```

### 5.5 Level 5: 前端集成层 (Day 13-14)

**待修改文件**（参照 Localization Report）：

| 文件 | 修改内容 |
|------|----------|
| `frontend/tests/e2e/approval.spec.ts` | E2E 测试用例覆盖审批流程 |
| `frontend/src/composables/useApprovalBinding.ts` | 审批绑定逻辑，连接后端 API |
| `frontend/src/app/components/AssetDetailModal.tsx` | 资产详情弹窗集成审批入口 |
| `frontend/src/app/pages/Settings.tsx` | 设置页添加审批流程配置 |
| `frontend/src/app/services/userService.ts` | 用户服务支持审批人查询 |

### 5.6 技术栈选型

| 层级 | 技术选型 | 理由 |
|------|----------|------|
| 后端框架 | FastAPI | 高性能、自动 OpenAPI 文档 |
| ORM | SQLAlchemy 2.0 | 类型提示完善、异步支持 |
| 数据库 | PostgreSQL | JSON 支持、事务可靠 |
| 状态机 | 轻量自研（参照 `src/state_machine/`） | 避免引入重型库，保持可控性 |
| 通知队列 | Redis Stream | 轻量、支持持久化 |
| 前端测试 | Playwright | E2E 测试支持 |
| 后端测试 | pytest + pytest-asyncio | 异步支持、丰富插件生态 |

---

## 6 关键实现参考

### 6.1 审批链服务（参照 `src/services/approval_chain_service.py`）

```python
class ApprovalChain:
    """审批链核心类，管理多级审批顺序"""
    
    def _level_order(self, request_id: str) -> List[ApprovalLevel]:
        """获取审批层级顺序"""
        pass
    
    def validate_approval_chain_version(self, version: int) -> bool:
        """验证审批链版本，防止并发冲突"""
        pass
```

### 6.2 审批服务（参照 `src/services/approval_service.py`）

```python
class ApprovalService:
    def approve(self, ticket_id: str, approver_id: str, comment: str, version: int) -> Ticket:
        """审批通过入口"""
        # 1. 验证状态机转换
        # 2. 执行守卫链检查
        # 3. 更新工单状态
        # 4. 发送通知
        pass
    
    def reject(self, ticket_id: str, approver_id: str, reason: str, version: int) -> Ticket:
        """审批驳回入口"""
        # 1. 验证状态机转换
        # 2. 执行守卫链检查
        # 3. 更新工单状态
        # 4. 发送通知
        pass
```

### 6.3 通知服务（参照 `src/services/notification_service.py`）

```python
class NotificationService:
    def publish_approval(self, ticket_id: str, approver_id: str, comment: str):
        """发布审批通过通知"""
        # 异步发送邮件/站内信
        pass
    
    def publish_rejection(self, ticket_id: str, approver_id: str, reason: str):
        """发布审批驳回通知"""
        # 异步发送邮件/站内信
        pass
```

---

## 7 附录：待确认事项

| 序号 | 问题 | 优先级 | 状态 |
|------|------|--------|------|
| Q-01 | 审批人选择是否支持组织架构自动匹配？ | P2 | 待确认 |
| Q-02 | 是否需要工单抄送功能？ | P2 | 待确认 |
| Q-03 | 审批超时是否需要自动转交？ | P1 | 待确认 |
| Q-04 | 是否需要移动端支持？ | P3 | 待确认 |

---

*文档版本：v1.0.0*
*创建日期：2024-01-15*
*适用迭代：Iteration 1*
*关联后端代码：src/services/approval_service.py, src/services/notification_service.py, src/engine/guards.py*