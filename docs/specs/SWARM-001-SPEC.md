# SWARM-001 工单审批流程全链路开发规格指导文档

**版本**: v1.0.0  
**迭代**: Iteration 1  
**状态**: 进行中  
**日期**: 2025-01-20  
**维护人**: Architecture Team

---

## 目录

1. [需求与背景](#1-需求与背景)
2. [当前 Phase 对应实施目标](#2-当前-phase-对应实施目标)
3. [边界约束](#3-边界约束)
4. [验收测试基准 (ATB)](#4-验收测试基准-atb)
5. [开发切入层级序列](#5-开发切入层级序列)
6. [附录](#6-附录)

---

## 1. 需求与背景

### 1.1 业务场景

工单审批流程是企业内部资产管理系统的核心工作流场景，涉及员工提交工单、审批人逐级审核、状态自动流转的全链路操作。当前系统缺失完整的审批链路实现，需从零构建前后端联动的工单审批能力。

**核心业务价值**：
- 实现工单从创建到完成的闭环管理
- 支持多级审批确保业务合规性
- 提供审批记录可追溯性

### 1.2 功能需求概述

| 编号 | 功能点 | 优先级 | 描述 |
|------|--------|--------|------|
| F-001 | 工单创建 | P0 | 用户可提交工单（标题、描述、附件、优先级） |
| F-002 | 状态机流转 | P0 | 草稿→待审批→审批中→已完成/已驳回 |
| F-003 | 多级审批 | P0 | 支持至少 3 级审批链（L1 → L2 → L3） |
| F-004 | 审批操作 | P0 | 支持审批通过/驳回/转交操作 |
| F-005 | 审批历史 | P0 | 审批记录持久化与历史追溯 |

### 1.3 技术栈选型

| 层级 | 技术选型 | 版本要求 |
|------|----------|----------|
| 前端框架 | React + TypeScript | React 18+ / TypeScript 4.9+ |
| UI 组件库 | Ant Design Pro | 5.x |
| 前端测试 | Playwright | 最新稳定版 |
| 后端框架 | Python FastAPI | 0.100+ |
| ORM | SQLAlchemy | 2.0+ |
| 数据库 | PostgreSQL | 14+ |
| 状态机 | PyOwn + 自定义枚举 | - |
| 后端测试 | pytest | 7.0+ |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 1: 核心审批链路 MVP

本阶段聚焦工单审批流程的最简可用版本，验证核心状态机与数据持久化能力。

#### 交付物清单

| 子目标 | 交付物 | 验收标准 | 责任人 |
|--------|--------|----------|--------|
| 1.1 | `Ticket` 表 + `TicketApproval` 表 | DDL 可执行，ORM 映射正确 | Backend-DBA |
| 1.2 | `POST /api/v1/tickets` | 返回 201，字段校验通过 | Backend-API |
| 1.3 | `TicketStateMachine` 类 | 状态转换符合状态图定义 | Backend-Domain |
| 1.4 | 审批操作 API | 状态变更原子性保证 | Backend-API |
| 1.5 | 前端工单列表 | 列表页 + 分页 + 状态筛选 | Frontend |
| 1.6 | 前端审批操作 | 审批抽屉 + 操作按钮 | Frontend |

#### 状态机流转定义

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           状态机流转图                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│    ┌─────────┐     ┌─────────────────────┐     ┌───────────┐            │
│    │  DRAFT  │────▶│ PENDING_FIRST_      │────▶│ APPROVING │            │
│    └─────────┘     │ APPROVAL            │     │           │            │
│                    └─────────────────────┘     └───────────┘            │
│                           │                         │                    │
│                           │                         │                    │
│                           ▼                         ▼                    │
│                    ┌───────────┐            ┌───────────┐               │
│                    │ REJECTED  │            │ TRANSFER  │               │
│                    └───────────┘            └───────────┘               │
│                           │                         │                    │
│                           │                         │                    │
│                           └────────────┬────────────┘                    │
│                                        │                                 │
│                                        ▼                                 │
│                              ┌─────────────────┐                         │
│                              │    APPROVED     │                         │
│                              └─────────────────┘                         │
│                                                                          │
│    说明:                                                                 │
│    1. DRAFT → PENDING_FIRST_APPROVAL: 工单提交审批                        │
│    2. PENDING_FIRST_APPROVAL → APPROVING: 一级审批通过                    │
│    3. APPROVING → APPROVED: 三级审批全部通过                              │
│    4. APPROVING → REJECTED: 任意层级驳回                                  │
│    5. APPROVING → TRANSFERRED: 转交给其他审批人                           │
│    6. REJECTED → DRAFT: 驳回后可重新编辑提交                               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

#### 状态枚举定义

```python
class TicketStatus(str, Enum):
    """工单状态枚举"""
    
    DRAFT = "draft"                           # 草稿
    PENDING_FIRST_APPROVAL = "pending_first_approval"  # 待一级审批
    APPROVING = "approving"                   # 审批中
    APPROVED = "approved"                     # 已批准
    REJECTED = "rejected"                     # 已驳回
    TRANSFERRED = "transferred"               # 已转交


class ApprovalAction(str, Enum):
    """审批操作枚举"""
    
    APPROVE = "approve"                       # 批准
    REJECT = "reject"                         # 驳回
    TRANSFER = "transfer"                     # 转交
```

#### 审批流程时序

```
┌─────────┐         ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  User   │         │  Frontend   │         │  Backend    │         │  Database   │
└────┬────┘         └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
     │                     │                       │                       │
     │  1. 创建工单         │                       │                       │
     │────────────────────▶│                       │                       │
     │                     │  2. POST /tickets      │                       │
     │                     │──────────────────────▶│                       │
     │                     │                       │  3. INSERT ticket     │
     │                     │                       │──────────────────────▶│
     │                     │                       │◀──────────────────────│
     │                     │◀──────────────────────│                       │
     │◀────────────────────│                       │                       │
     │                     │                       │                       │
     │  4. 提交审批         │                       │                       │
     │────────────────────▶│                       │                       │
     │                     │  5. POST submit        │                       │
     │                     │──────────────────────▶│                       │
     │                     │                       │  6. UPDATE status     │
     │                     │                       │──────────────────────▶│
     │                     │                       │◀──────────────────────│
     │                     │◀──────────────────────│                       │
     │◀────────────────────│                       │                       │
     │                     │                       │                       │
     │  7. L1 审批通过      │                       │                       │
     │────────────────────▶│                       │                       │
     │                     │  8. POST approve      │                       │
     │                     │──────────────────────▶│                       │
     │                     │                       │  9. 状态机转换检查     │
     │                     │                       │──────────────────────▶│
     │                     │                       │ 10. INSERT approval    │
     │                     │                       │──────────────────────▶│
     │                     │                       │◀──────────────────────│
     │                     │◀──────────────────────│                       │
     │◀────────────────────│                       │                       │
     │                     │                       │                       │
     │  (重复 7-10 直至 L3 审批完成)                │                       │
     │                     │                       │                       │
```

---

## 3. 边界约束

### 3.1 功能边界

| 约束类型 | 约束内容 | 备注 |
|----------|----------|------|
| 审批层级 | 本次 Phase 仅支持 3 级审批链 | 不包含加签、委托等高级功能 |
| 并发控制 | 同一工单同一时间仅允许一个审批操作 | 使用乐观锁 `version` 字段 |
| 附件限制 | 工单附件仅支持 `image/*`、`application/pdf` | 单文件 ≤ 10MB |
| 权限控制 | 本次 Phase 不实现细粒度 RBAC | 假设所有登录用户均可操作 |
| 数据删除 | 审批记录 `TicketApproval` 永久保留 | 不支持物理删除 |

### 3.2 技术边界

| 约束类型 | 约束内容 | 依据 |
|----------|----------|------|
| 数据库 | 仅支持 PostgreSQL 14+ | 兼容性要求 |
| API 风格 | RESTful，版本前缀 `/api/v1` | API 设计规范 |
| 事务要求 | 审批操作必须包在数据库事务内 | 数据一致性要求 |
| 响应规范 | 所有 API 响应遵循统一结构 | `{ "code": int, "data": any, "message": str }` |
| 状态机实现 | 必须使用 PyOwn 或等效状态机框架 | 可维护性要求 |

### 3.3 性能边界

| 指标 | 阈值 | 测试方法 |
|------|------|----------|
| 单次工单创建 API 响应时间 | ≤ 200ms (p95) | pytest-benchmark |
| 列表查询响应时间 | ≤ 500ms (p95) | pytest-benchmark |
| 工单总数上限 | 单租户 ≤ 100,000 条 | 压力测试验证 |

### 3.4 安全边界

| 约束项 | 要求 |
|--------|------|
| SQL 注入防护 | 所有输入参数必须参数化查询 |
| XSS 防护 | 前端对所有用户输入进行转义 |
| CSRF 防护 | API 实现 CSRF Token 验证 |

---

## 4. 验收测试基准 (ATB)

### 4.1 后端 API 测试 (pytest)

| ATB ID | 功能点 | 测试用例描述 | 物理测试期待 |
|--------|--------|--------------|--------------|
| ATB-B-001 | 工单创建 | `POST /api/v1/tickets` 传入有效参数 | HTTP 201，`data.id` 非空，`status` 为 `draft` |
| ATB-B-002 | 工单创建 | `POST /api/v1/tickets` 缺少必填字段 `title` | HTTP 422，`errors` 包含 `title` 字段 |
| ATB-B-003 | 工单创建 | `POST /api/v1/tickets` 传入空字符串 `title` | HTTP 422，校验拒绝 |
| ATB-B-004 | 工单提交审批 | `POST /api/v1/tickets/{id}/submit` 当前状态 `draft` | HTTP 200，状态变更为 `pending_first_approval` |
| ATB-B-005 | 工单提交审批 | `POST /api/v1/tickets/{id}/submit` 当前状态 `approving` | HTTP 400，错误码 `INVALID_STATUS_TRANSITION` |
| ATB-B-006 | 一级审批通过 | `POST /api/v1/tickets/{id}/approve` 当前 L1 审批人 | HTTP 200，`current_approval_level` → 2 |
| ATB-B-007 | 二级审批通过 | L2 审批人执行 `approve` | HTTP 200，`current_approval_level` → 3 |
| ATB-B-008 | 三级审批通过 | L3 审批人执行 `approve` | HTTP 200，状态变更为 `approved` |
| ATB-B-009 | 审批驳回 | `POST /api/v1/tickets/{id}/reject` 带 `reason` | HTTP 200，状态变更为 `rejected` |
| ATB-B-010 | 审批转交 | `POST /api/v1/tickets/{id}/transfer` 带 `target_user_id` | HTTP 200，`assignee_id` 更新 |
| ATB-B-011 | 并发审批 | 两请求同时对同一工单执行审批 | 第二个请求返回 HTTP 409 `Conflict` |
| ATB-B-012 | 审批历史查询 | `GET /api/v1/tickets/{id}/approvals` | HTTP 200，返回按时间正序的审批记录 |

**测试文件位置**: `tests/backend/test_ticket_api.py`

**测试执行命令**:
```bash
pytest tests/backend/test_ticket_api.py -v --tb=short
pytest tests/backend/test_approval_service.py -v
```

### 4.2 状态机单元测试

| ATB ID | 测试场景 | 测试用例描述 | 物理测试期待 |
|--------|----------|--------------|--------------|
| ATB-SM-001 | 正常流转 | DRAFT → submit → PENDING_FIRST_APPROVAL | 状态正确转换 |
| ATB-SM-002 | 一级审批 | PENDING_FIRST_APPROVAL → approve → APPROVING (level=2) | 状态和级别正确更新 |
| ATB-SM-003 | 三级审批完成 | APPROVING (level=3) → approve → APPROVED | 最终状态为 APPROVED |
| ATB-SM-004 | 驳回流转 | APPROVING → reject → REJECTED | 状态正确变更，记录驳回原因 |
| ATB-SM-005 | 转交流转 | APPROVING → transfer → TRANSFERRED | 审批人变更 |
| ATB-SM-006 | 非法转换 | APPROVED → submit | 抛出 `StateTransitionException` |
| ATB-SM-007 | 乐观锁 | 两个并发修改同一工单 | 第二个操作失败并抛出 `OptimisticLockException` |

**测试文件位置**: `tests/state_machine/test_retirement_sm.py`

### 4.3 前端 UI 测试 (Playwright)

| ATB ID | 功能点 | 测试用例描述 | 物理测试期待 |
|--------|--------|--------------|--------------|
| ATB-F-001 | 工单列表加载 | 访问 `/tickets` | 列表渲染，Loading 状态正确关闭，数据 ≥ 0 条 |
| ATB-F-002 | 工单创建表单 | 点击新建按钮 → 填写标题 → 提交 | Modal 关闭，列表新增一条记录 |
| ATB-F-003 | 状态筛选 | 选择状态筛选 `pending_first_approval` | 列表仅显示该状态工单 |
| ATB-F-004 | 审批操作入口 | 工单详情页 → 点击审批按钮 | 弹出审批抽屉，表单字段完整 |
| ATB-F-005 | 审批通过交互 | 填写审批意见 → 点击通过 | Toast 提示 `审批成功`，状态标签更新 |
| ATB-F-006 | 审批驳回交互 | 填写驳回原因 → 点击驳回 | Toast 提示 `工单已驳回`，状态标签变红 |
| ATB-F-007 | 转交操作 | 选择转交人 → 确认转交 | Toast 提示 `已转交至 {name}` |
| ATB-F-008 | 审批历史展示 | 工单详情页 → 审批历史 Tab | 时间线展示审批节点 |

**测试文件位置**: 
- `frontend/tests/e2e/approval.spec.ts`
- `frontend/tests/e2e/dashboard.spec.ts`

**测试执行命令**:
```bash
npx playwright test frontend/tests/e2e/approval.spec.ts --project=chromium
npx playwright test frontend/tests/e2e/dashboard.spec.ts --project=chromium
```

### 4.4 集成测试

| ATB ID | 测试场景 | 测试步骤 | 物理测试期待 |
|--------|----------|----------|--------------|
| ATB-I-001 | 完整审批链路 | 创建 → 提交 → L1通过 → L2通过 → L3通过 | 最终状态为 `approved` |
| ATB-I-002 | 驳回重提链路 | 创建 → 提交 → 驳回 → 修改 → 重新提交 → 审批通过 | 完整闭环 |
| ATB-I-003 | 转交后续审批 | 创建 → 提交 → L1转交 → 新审批人通过 → L2通过 | 审批人链正确 |

**测试文件位置**: `tests/integration/test_approval_chain.py`

---

## 5. 开发切入层级序列

### 5.1 开发阶段规划

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Phase 1 开发阶段规划                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Level 1: 数据库层 (Day 1)                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ • 编写 ticket 表 DDL                                                    │ │
│  │ • 编写 ticket_approval 表 DDL                                           │ │
│  │ • 创建 Alembic migration                                                │ │
│  │ • 验证: migration 可正向/反向执行                                        │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                              │                                               │
│                              ▼                                               │
│  Level 2: ORM 模型层 (Day 1-2)                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ • 定义 Ticket ORM 模型                                                  │ │
│  │ • 定义 TicketApproval ORM 模型                                          │ │
│  │ • 实现基础 CRUD Repository                                              │ │
│  │ • 验证: pytest tests/unit/test_ticket_model.py 通过                     │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                              │                                               │
│                              ▼                                               │
│  Level 3: 状态机引擎 (Day 2)                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ • 实现 TicketStateMachine 类                                           │ │
│  │ • 定义状态转换规则                                                      │ │
│  │ • 实现版本号乐观锁                                                      │ │
│  │ • 验证: pytest tests/state_machine/test_retirement_sm.py 通过           │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                              │                                               │
│                              ▼                                               │
│  Level 4: API 端点 (Day 3-4)                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ • POST /api/v1/tickets (创建)                                          │ │
│  │ • GET /api/v1/tickets (列表+分页+筛选)                                   │ │
│  │ • GET /api/v1/tickets/{id} (详情)                                       │ │
│  │ • POST /api/v1/tickets/{id}/submit                                      │ │
│  │ • POST /api/v1/tickets/{id}/approve                                     │ │
│  │ • POST /api/v1/tickets/{id}/reject                                      │ │
│  │ • POST /api/v1/tickets/{id}/transfer                                    │ │
│  │ • GET /api/v1/tickets/{id}/approvals                                    │ │
│  │ • 验证: pytest tests/backend/test_ticket_api.py 通过                    │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                              │                                               │
│                              ▼                                               │
│  Level 5: 前端页面 (Day 4-5)                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ • 工单列表页 TicketListPage                                             │ │
│  │ • 工单创建/编辑 Modal                                                   │ │
│  │ • 工单详情页 TicketDetailPage                                          │ │
│  │ │   ├─ 基本信息 Tab                                                    │ │
│  │ │   └─ 审批历史 Tab                                                    │ │
│  │ • 审批操作抽屉 ApprovalDrawer                                           │ │
│  │ • 验证: Playwright frontend/tests/e2e/approval.spec.ts 通过             │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                              │                                               │
│                              ▼                                               │
│  Level 6: 集成联调 (Day 6)                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ • 前后端接口联调                                                        │ │
│  │ • 端到端审批链路测试                                                    │ │
│  │ • 性能基准测试                                                          │ │
│  │ • 验证: ATB-I-001/002/003 全部通过                                      │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 依赖关系矩阵

```
         ┌─────────────┐
         │   Level 1   │
         │    (DB)     │
         └──────┬──────┘
                │
                ▼
    ┌───────────┴───────────┐
    │                       │
    ▼                       │
┌───────────┐               │
│  Level 2  │               │  ← Level 2 & 3 可并行开发
│   (ORM)   │               │
└─────┬─────┘               │
      │                     │
      └──────────┬──────────┘
                 │
                 ▼
         ┌───────────────┐
         │    Level 3    │
         │ (StateMachine)│
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │    Level 4    │
         │    (API)      │
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │    Level 5    │
         │  (Frontend)   │  ← 依赖 Level 4 API 就绪
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │    Level 6    │
         │ (Integration) │
         └───────────────┘
```

### 5.3 文件修改清单

根据 Iteration 1 需求，以下文件需要修改：

| 序号 | 文件路径 | 修改内容 | 优先级 |
|------|----------|----------|--------|
| 1 | `frontend/tests/unit/test_approval_chain.py` | 适配工单审批流程测试用例 | P0 |
| 2 | `frontend/tests/e2e/dashboard.spec.ts` | 添加工单审批 Dashboard 测试 | P0 |
| 3 | `frontend/tests/e2e/approval.spec.ts` | 审批流程端到端测试 | P0 |
| 4 | `frontend/src/app/pages/AuditDashboard/components/ActionTypePie/index.tsx` | 审批类型统计图表 | P1 |
| 5 | `frontend/src/app/pages/AuditDashboard/components/AuditTable/index.tsx` | 审批记录表格组件 | P1 |

---

## 6. 附录

### 6.1 数据库表结构

#### ticket 表

```sql
CREATE TABLE ticket (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'normal',  -- low/normal/high/urgent
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    current_approval_level INTEGER DEFAULT 0,
    creator_id UUID NOT NULL,
    assignee_id UUID,
    version INTEGER NOT NULL DEFAULT 1,     -- 乐观锁版本号
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_creator FOREIGN KEY (creator_id) REFERENCES users(id),
    CONSTRAINT fk_assignee FOREIGN KEY (assignee_id) REFERENCES users(id),
    CONSTRAINT chk_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    CONSTRAINT chk_status CHECK (status IN (
        'draft', 
        'pending_first_approval', 
        'approving', 
        'approved', 
        'rejected', 
        'transferred'
    ))
);

CREATE INDEX idx_ticket_status ON ticket(status);
CREATE INDEX idx_ticket_creator ON ticket(creator_id);
CREATE INDEX idx_ticket_created_at ON ticket(created_at DESC);
```

#### ticket_approval 表

```sql
CREATE TABLE ticket_approval (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL,
    approver_id UUID NOT NULL,
    approval_level INTEGER NOT NULL,        -- 1, 2, 3
    action VARCHAR(20) NOT NULL,             -- approve/reject/transfer
    comment TEXT,
    target_user_id UUID,                     -- for transfer action
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_ticket FOREIGN KEY (ticket_id) REFERENCES ticket(id),
    CONSTRAINT fk_approver FOREIGN KEY (approver_id) REFERENCES users(id),
    CONSTRAINT fk_target_user FOREIGN KEY (target_user_id) REFERENCES users(id),
    CONSTRAINT chk_action CHECK (action IN ('approve', 'reject', 'transfer'))
);

CREATE INDEX idx_ticket_approval_ticket_id ON ticket_approval(ticket_id);
CREATE INDEX idx_ticket_approval_approver ON ticket_approval(approver_id);
CREATE INDEX idx_ticket_approval_created_at ON ticket_approval(created_at);
```

### 6.2 API 响应格式

```typescript
// 成功响应
interface SuccessResponse<T> {
  code: 200 | 201;           // HTTP 状态码
  data: T;                   // 业务数据
  message: string;           // 成功信息
}

// 错误响应
interface ErrorResponse {
  code: 400 | 404 | 409 | 422 | 500;
  data: null;
  message: string;
  errors?: Record<string, string[]>;  // 字段级错误
}

// 示例
{
  "code": 200,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "draft",
    "title": "资产报废申请"
  },
  "message": "工单创建成功"
}
```

### 6.3 错误码定义

| 错误码 | 含义 | HTTP 状态码 |
|--------|------|-------------|
| `INVALID_STATUS_TRANSITION` | 非法的状态转换 | 400 |
| `TICKET_NOT_FOUND` | 工单不存在 | 404 |
| `UNAUTHORIZED_APPROVAL` | 无审批权限 | 403 |
| `CONCURRENT_MODIFICATION` | 并发修改冲突 | 409 |
| `VALIDATION_ERROR` | 参数校验失败 | 422 |

### 6.4 关键代码引用

| 模块 | 文件路径 | 说明 |
|------|----------|------|
| 状态机 | `backend/state_machine/ticket_state_machine.py` | 工单状态机核心实现 |
| 工单模型 | `backend/models/ticket.py` | Ticket ORM 模型 |
| 审批服务 | `backend/services/approval_service.py` | 审批业务逻辑 |
| API 路由 | `backend/api/v1/approval.py` | 审批相关 API 端点 |

---

**文档版本历史**:

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0.0 | 2025-01-20 | Architecture Team | 初始版本 |

---

*本文档为 SWARM-001 工单审批流程全链路开发项目的正式规格指导，所有开发活动应遵循本文档定义的范围和约束。*