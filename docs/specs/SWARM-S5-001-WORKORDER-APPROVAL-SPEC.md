# 【SWARM-S5-001】工单审批流程 - 规格指导文档

## Iteration 1

---

## 1. 需求与背景

### 1.1 业务场景

某企业内部资产管理系统（AMS）需要实现完整的工单审批流程，覆盖从工单提交到最终审批完成的全生命周期管理。本系统作为资产管理系统的一部分，负责处理各类资产相关工单（如资产退役、转让、报废等）的审批流程。

### 1.2 核心功能需求

| 需求编号 | 功能描述 | 优先级 |
|----------|----------|--------|
| REQ-001 | **前端审批页面**：为审批人员提供直观的工单列表查看、详情浏览、一键审批/驳回操作界面 | P0 |
| REQ-002 | **后端状态机**：实现工单状态的精确流转控制，确保状态变更的合法性与可追溯性 | P0 |
| REQ-003 | **通知机制**：在关键状态变更时自动触发通知，触达相关干系人（申请人、审批人） | P0 |

### 1.3 技术栈约束

| 层级 | 技术选型 |
|------|----------|
| 前端 | Vue 3 + Element Plus + TypeScript |
| 后端 | Python FastAPI |
| 数据库 | PostgreSQL |
| 缓存层 | Redis |
| 状态存储 | 内存状态机 + PostgreSQL 持久化 |

### 1.4 业务规则定义

```
工单状态流转图:

    ┌─────────┐
    │  DRAFT  │ (草稿/待提交)
    └────┬────┘
         │ submit()
         ▼
    ┌─────────┐
    │ PENDING │ (待审批)
    └────┬────┘
         │ accept()
         ▼
    ┌─────────┐
    │APPROVING│ (审批中)
    └────┬────┘
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌────────┐
│APPROVED│ │REJECTED│
└───┬───┘ └───┬────┘
    │         │
    ▼         ▼
┌─────────┐ ┌─────────┐
│ARCHIVED │ │  DRAFT  │ (修改重提)
└─────────┘ └─────────┘
```

| 规则编号 | 业务规则 |
|----------|----------|
| RULE-001 | 工单初始状态为 `DRAFT`，仅申请人可提交 |
| RULE-002 | 审批权限：仅指定审批角色（`APPROVER`）可执行审批操作 |
| RULE-003 | 驳回操作必须填写驳回原因，支持驳回至 `DRAFT` 状态 |
| RULE-004 | 已归档（`ARCHIVED`）状态为终态，不可变更 |
| RULE-005 | 同一工单并发审批请求需防护（乐观锁/悲观锁） |

---

## 2. 当前 Phase 对应实施目标

### Phase 1: 基础设施层 (Foundation)

**目标**：构建工单审批系统的数据模型与基础后端框架

| 任务项 | 具体内容 | 交付物 | 依赖关系 |
|--------|----------|--------|----------|
| 1.1 数据库表设计 | 工单主表 `work_orders`、审批记录表 `approval_records`、状态变更日志表 `status_change_logs` | `alembic/versions/001_create_workorder_tables.py` | 无 |
| 1.2 后端项目初始化 | FastAPI 项目结构、依赖配置（`requirements.txt`） | 可运行的 API 骨架 (`backend/main.py`) | 无 |
| 1.3 状态机基础实现 | `StateMachine` 核心类定义、状态枚举 | `src/domain/state_machine/retirement_state_machine.py` | 1.1 |

### Phase 2: 核心业务层 (Core Business)

**目标**：实现工单 CRUD 与状态流转逻辑

| 任务项 | 具体内容 | 交付物 | 依赖关系 |
|--------|----------|--------|----------|
| 2.1 工单 CRUD API | 创建、查询、更新、删除接口 | RESTful API Endpoints (`src/api/routes/work_orders.py`) | Phase 1 |
| 2.2 状态流转引擎 | 状态机规则引擎、合法性校验 (`TransitionEngine`) | `src/domain/services/retirement_service.py` | 1.3 |
| 2.3 审批记录持久化 | 审批动作与理由的存储 | `src/models/approval_chain.py` | 2.1, 2.2 |

### Phase 3: 前端交互层 (UI Layer)

**目标**：构建审批人员操作界面

| 任务项 | 具体内容 | 交付物 | 依赖关系 |
|--------|----------|--------|----------|
| 3.1 工单列表页 | 筛选、排序、分页列表展示 | Vue Component (`frontend/src/pages/WorkOrder/WorkOrderList.vue`) | Phase 2 API |
| 3.2 工单详情页 | 完整信息展示、审批历史时间线 | Vue Component (`frontend/src/pages/WorkOrder/components/WorkOrderDetailCard.tsx`) | 2.3 |
| 3.3 审批操作面板 | 批准/驳回按钮、原因输入框 | Vue Component (`frontend/src/app/pages/Approval/ApprovalPanel.vue`) | 2.2, 3.1 |

### Phase 4: 通知机制层 (Notification Layer)

**目标**：实现状态变更的自动通知

| 任务项 | 具体内容 | 交付物 | 依赖关系 |
|--------|----------|--------|----------|
| 4.1 通知触发器 | 状态变更事件的发布 | `src/notifications/events.py` EventPublisher | 2.2 |
| 4.2 通知通道 | 站内信通知发送 | `src/services/notification_service.py` | 4.1 |

---

## 3. 边界约束

### 3.1 功能边界

| 约束项 | 约束内容 | 迭代范围 |
|--------|----------|----------|
| 审批层级 | 本次迭代仅实现单级审批，不支持多级审批链 | Iteration 1 |
| 通知渠道 | 仅实现站内通知，邮件通道作为扩展项待后续迭代 | Iteration 1 |
| 并发控制 | 使用乐观锁机制，防止同一工单被并发审批 | Iteration 1 |
| 数据隔离 | 多租户场景暂不考虑，单租户实现 | Iteration 1 |
| 附件功能 | 本次迭代不包含附件上传 | Iteration 1 |

### 3.2 技术边界

| 约束项 | 约束内容 |
|--------|----------|
| API 版本 | v1 固定为 `/api/v1/workorders/*` |
| 前端路由 | 使用 Vue Router 4，路由模式为 history |
| 认证机制 | 本次迭代使用简化的 token 认证，不对接 SSO |
| 文件上传 | 本次迭代不包含附件功能 |

### 3.3 性能约束

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| API 响应时间 (P95) | < 200ms | pytest-benchmark |
| 列表查询响应时间 | < 500ms (1000条数据量) | 性能测试 |
| 前端首屏加载时间 | < 2s | Lighthouse CI |

### 3.4 安全约束

| 约束项 | 约束内容 |
|--------|----------|
| 输入校验 | 所有 API 入参必须经过 Pydantic 校验 |
| SQL 注入 | 使用 ORM 查询，禁止字符串拼接 SQL |
| XSS | 前端渲染用户输入必须做转义处理 |
| 审批权限 | 后端必须二次校验用户审批角色 |
| CSRF | API 需验证请求来源 |

---

## 4. 验收测试基准 (ATB)

### 4.1 测试脚本命名规范

```
测试文件命名: test_<模块>_<功能点>.py
前端测试文件: *.spec.ts
后端测试文件: *.py
```

### 4.2 核心测试用例 - 工单提交 (Submit)

#### 4.2.1 后端 API 测试 - `tests/api/test_work_order_submit.py`

| 测试编号 | 测试项 | 前置条件 | 测试步骤 | 物理测试期待 | 测试脚本 |
|----------|--------|----------|----------|--------------|----------|
| SUB-001 | 成功提交工单 | 存在草稿状态工单，用户为申请人 | 调用 `POST /api/v1/workorders/{id}/submit` | 返回 200，状态变更为 `PENDING`，响应包含 `submit_time` | `test_submit_success` |
| SUB-002 | 重复提交校验 | 工单已处于 `PENDING` 状态 | 调用 `POST /api/v1/workorders/{id}/submit` | 返回 409，错误码 `DUPLICATE_SUBMISSION` | `test_submit_duplicate` |
| SUB-003 | 非申请人提交 | 当前用户非工单申请人 | 调用 `POST /api/v1/workorders/{id}/submit` | 返回 403，错误码 `FORBIDDEN` | `test_submit_unauthorized` |
| SUB-004 | 提交草稿外状态 | 工单处于 `APPROVED` 状态 | 调用 `POST /api/v1/workorders/{id}/submit` | 返回 422，错误码 `INVALID_STATE_TRANSITION` | `test_submit_invalid_state` |
| SUB-005 | 提交不存在的工单 | 工单 ID 不存在 | 调用 `POST /api/v1/workorders/{invalid_id}/submit` | 返回 404，错误码 `WORKORDER_NOT_FOUND` | `test_submit_not_found` |
| SUB-006 | 参数校验失败 | 请求体缺少必填字段 | 调用 `POST /api/v1/workorders/{id}/submit` with empty body | 返回 422，响应包含校验错误详情 | `test_submit_validation_error` |

#### 4.2.2 测试脚本样例

```python
# tests/api/test_work_order_submit.py
"""
工单提交 API 测试用例

ATB Reference: SUB-001 ~ SUB-006
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime


class TestWorkOrderSubmit:
    """工单提交功能测试套件"""

    @pytest.fixture
    def client(self):
        """创建测试客户端"""
        from backend.main import app
        return TestClient(app)

    @pytest.fixture
    def draft_workorder(self):
        """创建草稿状态工单 fixture"""
        # 实现: 创建测试数据并返回工单 ID
        pass

    def test_submit_success(self, client, draft_workorder):
        """
        SUB-001: 成功提交工单
        
        验证点:
        - HTTP 状态码为 200
        - 响应体包含 workorder_id 和 submit_time
        - 数据库中工单状态已更新为 PENDING
        """
        response = client.post(f"/api/v1/workorders/{draft_workorder}/submit")
        
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert data["data"]["status"] == "PENDING"
        assert "submit_time" in data["data"]

    def test_submit_duplicate(self, client, draft_workorder):
        """
        SUB-002: 重复提交校验
        
        验证点:
        - 首次提交成功返回 200
        - 二次提交返回 409 Conflict
        - 错误码为 DUPLICATE_SUBMISSION
        """
        # 首次提交
        client.post(f"/api/v1/workorders/{draft_workorder}/submit")
        
        # 二次提交
        response = client.post(f"/api/v1/workorders/{draft_workorder}/submit")
        
        assert response.status_code == 409
        assert response.json()["code"] == "DUPLICATE_SUBMISSION"

    def test_submit_unauthorized(self, client, draft_workorder):
        """
        SUB-003: 非申请人提交校验
        
        验证点:
        - 使用非申请人身份提交
        - 返回 403 Forbidden
        """
        # 使用其他用户 token
        unauthorized_client = TestClient(app)
        unauthorized_client.headers["Authorization"] = "Bearer <other_user_token>"
        
        response = unauthorized_client.post(
            f"/api/v1/workorders/{draft_workorder}/submit"
        )
        
        assert response.status_code == 403

    def test_submit_invalid_state(self, client, draft_workorder):
        """
        SUB-004: 非法状态提交校验
        
        验证点:
        - 工单处于 APPROVED 状态
        - 提交请求返回 422
        """
        # 先审批通过
        client.post(f"/api/v1/workorders/{draft_workorder}/approve")
        
        # 尝试提交
        response = client.post(f"/api/v1/workorders/{draft_workorder}/submit")
        
        assert response.status_code == 422
        assert response.json()["code"] == "INVALID_STATE_TRANSITION"

    def test_submit_not_found(self, client):
        """
        SUB-005: 工单不存在校验
        
        验证点:
        - 提交不存在的工单 ID
        - 返回 404 Not Found
        """
        response = client.post("/api/v1/workorders/non-existent-id/submit")
        
        assert response.status_code == 404
        assert response.json()["code"] == "WORKORDER_NOT_FOUND"

    def test_submit_validation_error(self, client):
        """
        SUB-006: 参数校验失败
        
        验证点:
        - 请求体格式错误
        - 返回 422 Unprocessable Entity
        - 响应包含详细校验错误
        """
        response = client.post(
            "/api/v1/workorders/123/submit",
            json={"invalid_field": "value"}
        )
        
        assert response.status_code == 422
        assert "detail" in response.json()
```

### 4.3 后端状态机测试

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| SM-001 | 合法状态流转 - DRAFT→PENDING | 状态机返回成功，新状态为 `PENDING` | `test_state_machine.py` |
| SM-002 | 合法状态流转 - PENDING→APPROVING | 审批人接受后状态变更为 `APPROVING` | `test_state_machine.py` |
| SM-003 | 合法状态流转 - APPROVING→APPROVED | 审批通过后状态变更为 `APPROVED` | `test_state_machine.py` |
| SM-004 | 合法状态流转 - APPROVING→REJECTED | 驳回操作成功，状态变更为 `REJECTED`，驳回原因已记录 | `test_state_machine.py` |
| SM-005 | 非法状态流转 - APPROVED→APPROVING | 状态机拒绝非法流转，抛出 `InvalidStateTransitionError` | `test_state_machine.py` |
| SM-006 | 状态重复提交校验 | 同一状态重复提交返回错误码 `DUPLICATE_TRANSITION` | `test_state_machine.py` |

### 4.4 后端 API 测试 (审批/驳回)

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| API-001 | 创建工单 | POST `/api/v1/workorders` 返回 201 | `test_workorder_api.py` |
| API-002 | 查询工单列表 | GET `/api/v1/workorders` 返回分页数据 | `test_workorder_api.py` |
| API-003 | 查询工单详情 | GET `/api/v1/workorders/{id}` 返回完整工单与审批历史 | `test_workorder_api.py` |
| API-004 | 提交审批 | POST `/api/v1/workorders/{id}/submit` 触发状态流转 | `test_work_order_submit.py` |
| API-005 | 执行审批 | POST `/api/v1/workorders/{id}/approve` 返回 200 | `test_work_order_approve.py` |
| API-006 | 执行驳回 | POST `/api/v1/workorders/{id}/reject` 返回 200，驳回原因已持久化 | `test_work_order_reject.py` |
| API-007 | 审批权限校验 | 无审批权限用户调用审批接口返回 403 | `test_approval_api.py` |
| API-008 | 并发审批防护 | 两个并发审批请求仅一个成功，另一个返回 409 | `test_concurrency.py` |

### 4.5 前端 UI 测试 (Playwright)

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| UI-001 | 工单列表页加载 | 页面加载完成，工单列表正确渲染 | `test_workorder_list.spec.ts` |
| UI-002 | 工单列表筛选 | 筛选条件变更后，列表数据正确过滤 | `test_workorder_list.spec.ts` |
| UI-003 | 工单详情页跳转 | 点击工单行跳转至详情页 | `test_workorder_list.spec.ts` |
| UI-004 | 审批历史时间线 | 详情页正确渲染审批历史，按时间倒序排列 | `test_work_order_detail.spec.ts` |
| UI-005 | 审批操作 - 批准 | 点击批准按钮，工单状态变更为「已通过」 | `test_approval.spec.ts` |
| UI-006 | 审批操作 - 驳回 | 点击驳回按钮，弹出原因输入框 | `test_approval.spec.ts` |
| UI-007 | 无权限状态隐藏 | 无审批权限用户界面不显示审批按钮 | `test_approval_permission.spec.ts` |

### 4.6 通知机制测试

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| NOTIFY-001 | 审批通过通知 | 状态变更为「已通过」后，触发通知事件 | `test_notification.py` |
| NOTIFY-002 | 工单驳回通知 | 状态变更为「已驳回」后，触发通知事件，包含驳回原因 | `test_notification.py` |
| NOTIFY-003 | 通知事件格式 | 事件 payload 包含工单 ID、变更状态、操作人、时间戳 | `test_notification.py` |
| NOTIFY-004 | 提交成功通知 | 工单提交后，申请人收到待审批通知 | `test_notification.py` |

### 4.7 集成测试

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| INT-001 | 完整审批流程 | 创建 → 提交 → 审批通过 → 归档，全流程成功 | `test_integration_flow.py` |
| INT-002 | 完整驳回流程 | 创建 → 提交 → 驳回 → 修改重提 → 审批通过 | `test_integration_reject.py` |
| INT-003 | 并发审批防护 | 两个并发审批请求仅一个成功 | `test_concurrency.py` |

---

## 5. 开发切入层级序列

### 5.1 开发顺序规划

```
Phase 1 (Foundation)
    │
    ├── Step 1.1: 数据库 Schema 设计 & migrations
    │       ├── 输出: alembic/versions/001_create_workorder_tables.py
    │       └── 依赖: 无
    │
    ├── Step 1.2: FastAPI 项目骨架搭建
    │       ├── 输出: backend/main.py, src/api/routes/work_orders.py
    │       └── 依赖: 无
    │
    └── Step 1.3: 状态机核心类实现
            ├── 输出: src/domain/state_machine/retirement_state_machine.py
            └── 依赖: 1.1

Phase 2 (Core Business)
    │
    ├── Step 2.1: 工单 CRUD API 实现
    │       ├── 输出: POST/GET/PUT/DELETE /api/v1/workorders/*
    │       └── 依赖: Phase 1
    │
    ├── Step 2.2: 状态流转引擎 & 权限校验
    │       ├── 输出: src/domain/services/retirement_service.py
    │       └── 依赖: 1.3
    │
    └── Step 2.3: 审批记录持久化
            ├── 输出: src/models/approval_chain.py
            └── 依赖: 2.1, 2.2

Phase 3 (UI Layer)
    │
    ├── Step 3.1: 工单列表页开发
    │       ├── 输出: frontend/src/pages/WorkOrder/WorkOrderList.vue
    │       └── 依赖: Phase 2 API
    │
    ├── Step 3.2: 工单详情页开发
    │       ├── 输出: frontend/src/pages/WorkOrder/components/WorkOrderDetailCard.tsx
    │       └── 依赖: 2.3
    │
    └── Step 3.3: 审批操作面板开发
            ├── 输出: frontend/src/app/pages/Approval/ApprovalPanel.vue
            └── 依赖: 2.2, 3.1, 3.2

Phase 4 (Notification Layer)
    │
    ├── Step 4.1: 通知事件触发器接入
    │       ├── 输出: src/notifications/events.py EventPublisher
    │       └── 依赖: 2.2
    │
    └── Step 4.2: 站内通知服务实现
            ├── 输出: src/services/notification_service.py
            └── 依赖: 4.1

Phase 5 (Testing & Integration)
    │
    ├── Step 5.1: 后端单元测试 & 集成测试
    │       ├── 输出: tests/api/test_work_order_*.py
    │       └── 依赖: Phase 1, 2
    │
    ├── Step 5.2: 前端 E2E 测试
    │       ├── 输出: frontend/tests/e2e/*.spec.ts
    │       └── 依赖: Phase 3
    │
    └── Step 5.3: 通知机制测试
            ├── 输出: tests/test_notification.py
            └── 依赖: Phase 4
```

### 5.2 关键技术决策点

| 决策点 | 方案选型 | 决策依据 |
|--------|----------|----------|
| 状态存储介质 | PostgreSQL + Redis 双写 | 热数据走 Redis 加速查询，冷数据持久化至 PG |
| 状态变更事件 | 观察者模式 + Async Event | 解耦通知逻辑，支持后续扩展消息队列 |
| 前端状态管理 | Pinia Store | 与 Vue 3 深度集成，TypeScript 支持良好 |
| 权限校验层级 | 后端强制校验 + 前端路由守卫 | 双重保障，防止越权操作 |
| 并发控制 | 乐观锁 (version field) | 相比悲观锁对性能影响小 |

### 5.3 风险识别与应对

| 风险编号 | 风险描述 | 概率 | 影响 | 应对策略 |
|----------|----------|------|------|----------|
| RISK-001 | 状态机状态转换规则复杂，可能遗漏边界条件 | 中 | 高 | 补充完整的状态转换矩阵测试用例 |
| RISK-002 | 通知机制与核心业务耦合 | 低 | 中 | 使用事件驱动解耦 |
| RISK-003 | 前端审批页面与后端状态机集成问题 | 中 | 中 | 提前进行 API 契约测试 |
| RISK-004 | 并发审批导致数据不一致 | 低 | 高 | 实施乐观锁 + 数据库事务 |

---

## 6. 附录

### 6.1 状态机状态定义

```python
# src/domain/state_machine/retirement_state_machine.py

class WorkOrderState(str, Enum):
    """
    工单状态枚举
    
    状态流转规则:
    - DRAFT: 初始状态，可提交
    - PENDING: 待审批，可接受或驳回
    - APPROVING: 审批中，可批准或驳回
    - APPROVED: 已通过，可归档
    - REJECTED: 已驳回，可修改重提
    - ARCHIVED: 已归档，终态
    """
    DRAFT = "draft"                    # 草稿/待提交
    PENDING = "pending"               # 待审批
    APPROVING = "approving"           # 审批中
    APPROVED = "approved"             # 已通过
    REJECTED = "rejected"             # 已驳回
    ARCHIVED = "archived"             # 已归档
```

### 6.2 状态流转矩阵

| 当前状态 | 允许目标状态 | 触发操作 | 触发角色 |
|----------|--------------|----------|----------|
| DRAFT | PENDING | submit | 申请人 |
| PENDING | APPROVING, REJECTED | accept, reject | 审批人 |
| APPROVING | APPROVED, REJECTED | approve, reject | 审批人 |
| APPROVED | ARCHIVED | archive | 系统/管理员 |
| REJECTED | DRAFT, PENDING | revise_and_resubmit | 申请人 |
| ARCHIVED | - | (终态) | - |

### 6.3 API 端点清单

| 方法 | 端点 | 描述 | 状态码 |
|------|------|------|--------|
| POST | `/api/v1/workorders` | 创建工单 | 201 |
| GET | `/api/v1/workorders` | 查询工单列表 | 200 |
| GET | `/api/v1/workorders/{id}` | 查询工单详情 | 200 |
| PUT | `/api/v1/workorders/{id}` | 更新工单 | 200 |
| DELETE | `/api/v1/workorders/{id}` | 删除工单 | 204 |
| POST | `/api/v1/workorders/{id}/submit` | 提交工单 | 200 |
| POST | `/api/v1/workorders/{id}/accept` | 接受审批 | 200 |
| POST | `/api/v1/workorders/{id}/approve` | 审批通过 | 200 |
| POST | `/api/v1/workorders/{id}/reject` | 审批驳回 | 200 |
| POST | `/api/v1/workorders/{id}/archive` | 归档工单 | 200 |

### 6.4 错误码定义

| 错误码 | HTTP 状态码 | 描述 |
|--------|-------------|------|
| WORKORDER_NOT_FOUND | 404 | 工单不存在 |
| DUPLICATE_SUBMISSION | 409 | 重复提交 |
| INVALID_STATE_TRANSITION | 422 | 非法状态转换 |
| FORBIDDEN | 403 | 无权限操作 |
| UNAUTHORIZED | 401 | 未认证 |
| CONCURRENT_MODIFICATION | 409 | 并发冲突 |

---

**文档版本**: v1.0  
**创建日期**: Iteration 1  
**状态**: Draft - 待评审  
**评审人**: [待指定]  
**评审日期**: [待指定]

---

## 变更历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2024-XX-XX | [作者] | 初始版本创建 |