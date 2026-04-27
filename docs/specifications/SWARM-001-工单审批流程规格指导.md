# SWARM-001 工单审批流程规格指导文档

---

## 需求与背景

### 业务场景

企业日常运营中存在大量需要多层级审批的工单场景（如采购、请假、报销、项目立项等），传统纸质或邮件审批存在效率低、流程不透明、状态难追踪等问题。

### 核心诉求

| 诉求编号 | 描述 | 涉及模块 |
|----------|------|----------|
| R-001 | 用户通过前端界面填写工单信息并提交审批申请 | `frontend/src/router/approval.ts` |
| R-002 | 后端基于状态机引擎控制工单生命周期流转 | `src/application/services/work_order_service.py` |
| R-003 | 审批人接收通知、在前端完成在线审批并记录意见 | `src/notifications/events.py` |
| R-004 | 各角色实时掌握工单所处阶段与历史记录 | `src/application/services/approval_service.py` |

### 技术目标

构建一套可复用、可配置的状态机驱动的工单审批微服务，具备良好的扩展性以适配未来多类型工单的接入。

---

## 当前 Phase 对应实施目标

> **注**：本 Iteration 1 对准 **Phase 1 - 基础审批流程构建**

| Phase | 名称 | 对应 Iteration | 本次 Scope |
|-------|------|----------------|------------|
| Phase 1 | 基础审批流程构建 | Iteration 1（本期） | 工单创建→提交→状态机驱动流转→单人审批→完成 |
| Phase 2 | 通知增强 | Iteration 2 | 邮件/站内信/钉钉通知集成 |
| Phase 3 | 高级规则引擎 | Iteration 3 | 会签、条件分支、委托、代办 |
| Phase 4 | 数据分析与可视化 | Iteration 4 | 审批效率统计、流程瓶颈分析 |

### 本次 Phase 1 明确范围

```
┌─────────┐  submit   ┌─────────────────┐  approve  ┌──────────┐
│  draft  │ ─────────> │ pending_approval │ ────────> │ approved │
└─────────┘            └─────────────────┘           └──────────┘
                              │    ▲
                              │    │
                            reject│reason
                              │    │
                              ▼    │
                         ┌──────────┐
                         │ rejected │
                         └──────────┘
```

**包含功能点：**

| 功能编号 | 功能描述 | 对应文件 |
|----------|----------|----------|
| F1.1 | 前端工单表单填写与预览 | `frontend/src/router/approval.ts` |
| F1.2 | 前端工单列表（按状态筛选） | `frontend/tests/e2e/approval.spec.ts` |
| F1.3 | 后端工单 CRUD API | `src/application/services/work_order_service.py` |
| F1.4 | 状态机引擎实现（含状态定义与合法转换校验） | `src/services/approval_service.py` |
| F1.5 | 审批操作 API（含意见回写） | `src/services/approval_chain_service.py` |
| F1.6 | 工单详情查询 API（含状态变更历史） | `src/application/services/notification_service.py` |
| F1.7 | 基础数据模型设计与数据库 Schema | `src/notifications/events.py` |

**不包含（移至后续 Phase）：**

- 多级审批链、会签
- 通知推送（邮件/IM）
- 草稿自动保存
- 工单模板配置
- 移动端适配

---

## 边界约束

### 技术约束

| 约束项 | 具体要求 | 验证方式 |
|--------|----------|----------|
| 技术栈 | Python FastAPI（后端）+ React 18（前端） | 静态检查 |
| 数据库 | PostgreSQL（工单数据）+ Redis（状态机锁/缓存） | 集成测试 |
| 部署形态 | Docker 容器化，支持 K8s 水平扩展 | 部署验证 |
| 状态机实现 | 必须基于事件驱动，禁止在 Controller 层硬编码状态判断 | 代码审查 |

### 业务约束

| 约束项 | 具体要求 | 违反处理 |
|--------|----------|----------|
| 状态流转 | 必须严格遵循预定义状态图，禁止跨状态跳转 | 抛出 `InvalidStateTransitionError` |
| 审批权限 | 仅审批人可操作「审批中→已批准/已拒绝」 | 抛出 `PermissionDeniedError` |
| 意见必填 | 审批拒绝时意见字段强制必填，批准时可选 | 返回 HTTP 422 |
| 并发控制 | 同一工单同一时刻仅允许一个操作，使用分布式锁防重 | 抛出 `ConcurrentModificationError` |
| 数据保留 | 工单数据永久保留，审计日志保留 3 年 | 备份策略 |

### 性能约束

| 指标 | 目标值 | 测试方法 |
|------|--------|----------|
| 单一工单创建响应时间 | P95 ≤ 200ms | 性能测试 |
| 审批操作响应时间 | P95 ≤ 300ms | 性能测试 |
| 列表查询响应时间（单页 20 条） | P95 ≤ 100ms | 性能测试 |
| 系统并发支持 | ≥ 200 QPS | 负载测试 |

### 安全约束

| 约束项 | 要求 | 验证方式 |
|--------|------|----------|
| 认证方式 | JWT Bearer Token | 安全测试 |
| 权限模型 | RBAC（基于角色的访问控制） | 权限测试 |
| 敏感操作审计 | 所有状态变更写入审计日志表 | 集成测试 |
| 输入校验 | 拒绝一切未经验证的外部输入 | 模糊测试 |

---

## 验收测试基准 (ATB)

### 测试策略概述

| 测试类型 | 覆盖率目标 | 工具 |
|----------|------------|------|
| 单元测试 | 后端核心业务逻辑覆盖率 ≥ 85% | pytest |
| 集成测试 | API 端到端覆盖所有 Happy Path + 主要异常路径 | pytest |
| E2E 测试 | 前端关键用户操作路径覆盖 | Playwright |

---

### ATB-1: 工单创建功能

| 测试编号 | 测试类型 | 测试步骤 | 物理期待 |
|----------|----------|----------|----------|
| ATB-1.1 | pytest | POST `/api/v1/workorders`，携带完整必填字段 | HTTP 201，响应体包含 `id`、`status: "draft"` |
| ATB-1.2 | pytest | POST `/api/v1/workorders`，缺少必填字段 `title` | HTTP 422，响应体 `detail` 包含字段校验错误 |
| ATB-1.3 | pytest | 未认证用户 POST `/api/v1/workorders` | HTTP 401 |
| ATB-1.4 | pytest | 创建工单后查询数据库 | 工单状态为 `draft`，创建时间戳非空 |
| ATB-1.5 | playwright | 用户填写表单所有字段后点击「保存草稿」 | 页面跳转至工单详情页，显示「待提交」状态 |

---

### ATB-2: 工单提交功能

| 测试编号 | 测试类型 | 测试步骤 | 物理期待 |
|----------|----------|----------|----------|
| ATB-2.1 | pytest | POST `/api/v1/workorders/{id}/submit`，工单当前状态为 `draft` | HTTP 200，状态变更为 `pending_approval` |
| ATB-2.2 | pytest | POST `/api/v1/workorders/{id}/submit`，工单当前状态已为 `pending_approval` | HTTP 409，响应体 `detail` 提示「状态不允许此操作」 |
| ATB-2.3 | pytest | POST `/api/v1/workorders/{id}/submit`，工单不存在 | HTTP 404 |
| ATB-2.4 | pytest | 提交操作写入审计日志 | 审计日志表存在 `event: "submit"`，`from_status: "draft"` |
| ATB-2.5 | playwright | 用户在工单详情页点击「提交审批」按钮 | 页面弹出确认框，确认后状态更新为「待审批」 |

---

### ATB-3: 状态机引擎流转规则

| 测试编号 | 测试类型 | 测试步骤 | 物理期待 |
|----------|----------|----------|----------|
| ATB-3.1 | pytest | 状态机接受 `submit` 事件，`draft` → `pending_approval` | 状态正确更新，无异常抛出 |
| ATB-3.2 | pytest | 状态机接受 `approve` 事件，`pending_approval` → `approved` | 状态正确更新 |
| ATB-3.3 | pytest | 状态机接受 `reject` 事件，`pending_approval` → `rejected` | 状态正确更新 |
| ATB-3.4 | pytest | 状态机接受非法事件序列（如 `draft` 状态接受 `approve`） | 抛出 `InvalidStateTransitionError` |
| ATB-3.5 | pytest | 并发提交同一工单（模拟双击） | 仅一次成功写入数据库，另一次返回 409 |
| ATB-3.6 | pytest | Redis 分布式锁获取与释放 | 锁 key 存在，TTL 正确，超时后自动释放 |

---

### ATB-4: 审批操作功能

| 测试编号 | 测试类型 | 测试步骤 | 物理期待 |
|----------|----------|----------|----------|
| ATB-4.1 | pytest | POST `/api/v1/workorders/{id}/approve`，审批人匹配 | HTTP 200，状态变更为 `approved` |
| ATB-4.2 | pytest | POST `/api/v1/workorders/{id}/reject`，附意见 `"材料不全"` | HTTP 200，状态变更为 `rejected`，意见已回写 |
| ATB-4.3 | pytest | POST `/api/v1/workorders/{id}/reject`，未附意见 | HTTP 422，拒绝必须填写意见的校验错误 |
| ATB-4.4 | pytest | POST `/api/v1/workorders/{id}/approve`，审批人非指定审批人 | HTTP 403 |
| ATB-4.5 | pytest | POST `/api/v1/workorders/{id}/approve`，工单状态非 `pending_approval` | HTTP 409 |
| ATB-4.6 | playwright | 审批人在「待我审批」列表点击工单，进入详情 | 显示审批操作面板，含「批准」「拒绝」按钮 |
| ATB-4.7 | playwright | 审批人点击「拒绝」，填写意见后点击确认 | 页面更新状态为「已拒绝」，列表刷新 |

---

### ATB-5: 工单查询与状态历史

| 测试编号 | 测试类型 | 测试步骤 | 物理期待 |
|----------|----------|----------|----------|
| ATB-5.1 | pytest | GET `/api/v1/workorders?status=pending_approval` | HTTP 200，返回分页结果，仅包含待审批工单 |
| ATB-5.2 | pytest | GET `/api/v1/workorders/{id}` | HTTP 200，返回完整工单信息，含审批人字段 |
| ATB-5.3 | pytest | GET `/api/v1/workorders/{id}/history` | HTTP 200，返回按时间正序的状态变更记录列表 |
| ATB-5.4 | pytest | 查询不存在的工单 ID | HTTP 404 |
| ATB-5.5 | playwright | 用户按状态筛选工单列表（待提交/待审批/已批准） | 列表正确过滤，显示对应状态的工单 |
| ATB-5.6 | playwright | 用户查看工单详情页状态历史时间线 | 显示完整的状态流转节点与时间戳 |

---

### ATB-6: 权限与安全

| 测试编号 | 测试类型 | 测试步骤 | 物理期待 |
|----------|----------|----------|----------|
| ATB-6.1 | pytest | 普通用户尝试审批他人工单 | HTTP 403 |
| ATB-6.2 | pytest | 使用过期 JWT Token 调用 API | HTTP 401 |
| ATB-6.3 | pytest | SQL 注入尝试（`' OR 1=1 --`） | 参数化查询执行，不影响结果集 |
| ATB-6.4 | pytest | XSS 注入尝试（`<script>alert(1)</script>`） | 输入被转义存储，不执行脚本 |

---

## 开发切入层级序列

### 阶段一：数据层（Day 1-2）

| 序号 | 任务 | 交付物 | 验证方式 |
|------|------|--------|----------|
| 1.1 | 设计并创建数据库 Schema | `alembic/versions/001_create_workorder_tables.py` | 数据库迁移 |
| 1.2 | 实现 SQLAlchemy ORM 模型 | `src/models/workorder.py` | 模型导入测试 |
| 1.3 | 基础 Repository 层 CRUD 操作 | `src/infrastructure/database/repositories.py` | 单元测试 |

### 阶段二：状态机核心（Day 3-4）

| 序号 | 任务 | 交付物 | 验证方式 |
|------|------|--------|----------|
| 2.1 | 定义状态枚举与事件枚举 | `src/models/enums.py` | 枚举值验证 |
| 2.2 | 实现状态机类（StateMachine） | `src/state_machine/approval_state_machine.py` | 状态转换测试 |
| 2.3 | 集成 Redis 分布式锁 | `src/state_machine/transitions.py` | 并发测试 |
| 2.4 | 状态机单元测试 | `tests/unit/test_state_machine.py` | 测试通过 |

### 阶段三：API 层（Day 5-7）

| 序号 | 任务 | 交付物 | 验证方式 |
|------|------|--------|----------|
| 3.1 | 实现工单 CRUD API | `src/api/routes/work_orders.py` | API 测试 |
| 3.2 | 实现状态流转操作 API | `src/application/services/work_order_service.py` | 集成测试 |
| 3.3 | 实现查询与历史 API | `src/services/approval_service.py` | API 测试 |
| 3.4 | 全局异常处理中间件 | `src/api/middleware/audit_logger.py` | 异常场景测试 |
| 3.5 | JWT 认证中间件 | `src/api/deps/auth.py` | 安全测试 |
| 3.6 | 输入校验（Pydantic） | `src/schemas/approval.py` | 校验测试 |

### 阶段四：前端基础（Day 8-10）

| 序号 | 任务 | 交付物 | 验证方式 |
|------|------|--------|----------|
| 4.1 | 工单列表页（状态筛选、分页） | `frontend/src/router/approval.ts` | E2E 测试 |
| 4.2 | 工单表单页（创建/编辑） | `frontend/src/router/approval.ts` | E2E 测试 |
| 4.3 | 工单详情页 | `frontend/src/router/approval.ts` | E2E 测试 |
| 4.4 | 状态历史时间线组件 | `frontend/src/app/pages/AuditDashboard/AuditDashboard.module.css` | 视觉验证 |
| 4.5 | 审批操作面板 | `frontend/tests/e2e/approval.spec.ts` | E2E 测试 |

### 阶段五：集成联调与测试（Day 11-12）

| 序号 | 任务 | 交付物 | 验证方式 |
|------|------|--------|----------|
| 5.1 | API 集成测试 | `tests/integration/test_workorder_api.py` | 测试通过 |
| 5.2 | E2E 测试编写 | `frontend/tests/e2e/approval.spec.ts` | Playwright 通过 |
| 5.3 | 性能测试 | `tests/benchmark/test_dead_code_performance.py` | P95 达标 |
| 5.4 | 安全测试 | `tests/api/test_data_masking.py` | 无漏洞 |
| 5.5 | Bug 修复与回归 | - | 全部测试通过 |

### 阶段六：交付（Day 13-14）

| 序号 | 任务 | 交付物 | 验证方式 |
|------|------|--------|----------|
| 6.1 | 部署脚本编写 | `Dockerfile`、`docker-compose.yml` | 部署验证 |
| 6.2 | 文档完善 | API 文档、运维手册 | 评审通过 |
| 6.3 | 验收测试执行 | ATB 全量执行 | 100% 通过 |
| 6.4 | 上线评审 | 评审会议纪要 | 签字确认 |

---

## 附录

### A. 状态机定义

```python
# src/models/enums.py
class WorkOrderState(str, Enum):
    DRAFT = "draft"                    # 草稿/待提交
    PENDING_APPROVAL = "pending_approval"  # 等待审批
    APPROVED = "approved"              # 已批准
    REJECTED = "rejected"              # 已拒绝

class WorkOrderEvent(str, Enum):
    SUBMIT = "submit"      # 起草人提交工单
    APPROVE = "approve"    # 审批人批准工单
    REJECT = "reject"      # 审批人拒绝工单（需附意见）
```

### B. 核心类依赖关系

```
WorkOrderService
    ├── WorkOrderRepository
    ├── ApprovalStateMachine
    ├── ApprovalChainService
    └── NotificationService
            └── ApprovalPending Event
```

### C. 修改文件清单

| 文件路径 | 修改类型 | 主要变更 |
|----------|----------|----------|
| `src/application/services/notification_service.py` | 修改 | 集成审批通知事件处理 |
| `src/notifications/events.py` | 修改 | 新增 `ApprovalPendingEvent`、`WorkOrderSubmittedEvent` |
| `frontend/src/router/approval.ts` | 修改 | 路由与审批页面组件 |
| `frontend/tests/e2e/approval.spec.ts` | 修改 | 新增工单审批 E2E 测试用例 |
| `frontend/src/app/pages/AuditDashboard/AuditDashboard.module.css` | 修改 | 审批状态时间线样式 |

---

**文档版本**: v1.0  
**创建日期**: 2024-XX-XX  
**评审状态**: 待评审  
**维护责任人**: SWARM-001 Team