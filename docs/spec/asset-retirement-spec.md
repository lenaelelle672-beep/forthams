# 资产报废退役流程 - 规格指导文档 (Iteration 1)

## 1. 需求与背景

### 1.1 业务背景

资产报废退役是企业资产管理的重要环节，涉及资产的生命周期闭环管理。传统模式下，资产报废依赖线下纸质审批，存在以下痛点：

| 痛点 | 描述 | 影响 |
|------|------|------|
| 流程不透明 | 申请人无法实时追踪审批进度 | 协同效率低 |
| 状态不可追溯 | 审批流转记录分散 | 难以形成完整资产处置档案 |
| 审批周期长 | 跨部门审批依赖人工传递 | 易遗漏、易延误 |

### 1.2 功能目标

本次迭代（Iteration 1）实现资产报废申请与审批状态流转的可视化管理，支持用户在线提交报废申请并实时查看审批进度历史。

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 映射

| Plan.md Phase | 迭代目标 | 交付范围 | 状态 |
|---------------|----------|----------|------|
| Phase 1: 基础流程线上化 | 核心路径打通 | 申请发起 → 基础审批 → 状态追踪 | ✅ 迭代1 |
| Phase 2: 审批规则扩展 | 条件审批、多级会签 | 条件分支、多级审批 | ⏳ 迭代2 |
| Phase 3: 退役执行闭环 | 实物处置、账务处理 | 执行处置、出库、财务核销 | ⏳ 迭代2+ |

### 2.2 Iteration 1 交付范围

#### 核心功能

- [x] 资产报废申请单创建（单条资产）
- [x] 报废申请列表查询（按申请人/状态筛选）
- [x] 基础审批流程（单级审批：直线经理审批）
- [x] 审批状态流转历史展示
- [x] 申请状态变更通知（邮件/站内信）

#### 数据模型

- [x] `AssetRetirement` - 报废申请主表
- [x] `RetirementHistory` - 状态流转历史表
- [x] `ApprovalChain` - 审批链定义
- [x] `ApprovalNode` - 审批节点定义

#### API 端点

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/v1/retirements/` | 创建报废申请 |
| GET | `/api/v1/retirements/` | 查询报废申请列表 |
| GET | `/api/v1/retirements/{id}/` | 查询报废申请详情 |
| POST | `/api/v1/retirements/{id}/submit/` | 提交报废申请 |
| POST | `/api/v1/retirements/{id}/approve/` | 审批通过 |
| POST | `/api/v1/retirements/{id}/reject/` | 审批拒绝 |
| GET | `/api/v1/retirements/{id}/history/` | 查询流转历史 |

---

## 3. 边界约束

### 3.1 范围边界

| 约束类型 | 明确范围 | 排除范围 |
|----------|----------|----------|
| 资产范围 | 固定资产（设备、家具、IT资产） | 低值易耗品、耗材 |
| 申请粒度 | 单条资产提交报废申请 | 批量报废（Iteration 2+） |
| 审批层级 | 单级审批（直线经理） | 多级会签、条件分支审批 |
| 状态范围 | `PENDING` → `APPROVED`/`REJECTED` | 执行处置、出库、财务核销 |
| 组织范围 | 单租户/SaaS部署模式 | 多租户隔离（Phase 3） |

### 3.2 技术约束

| 约束项 | 具体要求 |
|--------|----------|
| 接口协议 | RESTful API，JSON 格式 |
| 认证方式 | JWT Bearer Token |
| 后端框架 | FastAPI + SQLAlchemy |
| 数据库 | PostgreSQL 13+ / SQLite（测试） |
| 状态机 | 自研 FSM（见 `src/state_machine/`） |
| 响应时限 | API 响应 < 200ms（P95） |
| 并发控制 | 乐观锁（version 字段） |

### 3.3 数据约束

| 约束项 | 约束条件 |
|--------|----------|
| 申请编号 | 全局唯一，格式：`RET-YYYYMMDD-XXXX` |
| 状态枚举 | `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| 审批超时 | 72小时内未审批自动发送催办通知 |
| 历史记录 | 不可删除/修改，仅追加（append-only） |
| 附件限制 | 单个附件 ≤ 10MB，支持格式：pdf, jpg, png, xlsx |
| 原因必填 | 报废原因字段最大长度 500 字符 |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 资产报废申请创建

| 测试编号 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 |
|----------|----------|----------|----------|----------|
| ATB-1.1 | 正常创建申请 | 用户已认证，资产状态为"在用" | `POST /api/v1/retirements/` with asset_id, reason | 返回 201，body 包含 `retirement_id`，状态为 `DRAFT` |
| ATB-1.2 | 重复申请校验 | 资产存在待审批/已通过申请 | `POST /api/v1/retirements/` with same asset_id | 返回 409 Conflict |
| ATB-1.3 | 无效资产校验 | 资产ID不存在 | `POST /api/v1/retirements/` with invalid asset_id | 返回 404 Not Found |
| ATB-1.4 | 已报废资产校验 | 资产状态为"已报废" | `POST /api/v1/retirements/` | 返回 422 Validation Error |
| ATB-1.5 | 原因字段校验 | 报废原因超过500字符 | `POST /api/v1/retirements/` with long reason | 返回 422 Validation Error |

### 4.2 ATB-2: 报废申请列表查询

| 测试编号 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 |
|----------|----------|----------|----------|----------|
| ATB-2.1 | 按申请人筛选 | 数据库存在多条申请记录 | `GET /api/v1/retirements/?applicant_id={user_id}` | 返回该用户的申请列表 |
| ATB-2.2 | 按状态筛选 | 数据库存在多种状态申请 | `GET /api/v1/retirements/?status=PENDING` | 仅返回待审批状态的申请 |
| ATB-2.3 | 组合筛选 | 同时筛选申请人和状态 | `GET /api/v1/retirements/?applicant_id=X&status=APPROVED` | 返回符合双重条件的交集结果 |
| ATB-2.4 | 分页校验 | 申请记录 > 20条 | `GET /api/v1/retirements/?page=2&page_size=20` | 返回第21-40条记录 |

### 4.3 ATB-3: 审批流程执行

| 测试编号 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 |
|----------|----------|----------|----------|----------|
| ATB-3.1 | 审批通过 | 存在 `PENDING` 状态申请，当前用户为审批人 | `POST /api/v1/retirements/{id}/approve/` with comment | 返回 200，状态变更为 `APPROVED` |
| ATB-3.2 | 审批拒绝 | 存在 `PENDING` 状态申请，审批人填写拒绝原因 | `POST /api/v1/retirements/{id}/reject/` with reason | 返回 200，状态变更为 `REJECTED` |
| ATB-3.3 | 越权审批拦截 | 当前用户非审批人 | `POST /api/v1/retirements/{id}/approve/` | 返回 403 Forbidden |
| ATB-3.4 | 状态变更幂等性 | 申请已 APPROVED | `POST /api/v1/retirements/{id}/approve/` | 返回 409 Conflict |
| ATB-3.5 | 提交草稿 | 申请状态为 `DRAFT` | `POST /api/v1/retirements/{id}/submit/` | 状态变更为 `PENDING` |

### 4.4 ATB-4: 审批状态流转历史

| 测试编号 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 |
|----------|----------|----------|----------|----------|
| ATB-4.1 | 正常查询历史 | 申请经过多次状态变更 | `GET /api/v1/retirements/{id}/history/` | 返回按时间正序的状态变更列表 |
| ATB-4.2 | 历史记录不可篡改 | 存在历史记录 | 尝试 `PUT /api/v1/retirements/{id}/history/{record_id}/` | 返回 405 Method Not Allowed |
| ATB-4.3 | 空历史校验 | 申请刚创建，无审批动作 | `GET /api/v1/retirements/{id}/history/` | 返回空数组 `[]` |
| ATB-4.4 | 历史记录完整性 | 完整审批流程 | 提交→通过 | 每次状态变更都生成历史记录 |

---

## 5. 开发切入层级序列

### 层级 L1: 数据模型层

```
src/models/
├── enums.py                 # RetirementStatus, ApprovalAction 枚举
├── asset_retirement.py      # RetirementApplication 主表模型
├── retirement_history.py    # RetirementHistory 流转历史表
├── approval_chain.py        # ApprovalChain 审批链定义
└── approval_node.py         # ApprovalNode 审批节点定义
```

**依赖关系**: 无前置依赖

### 层级 L2: 服务层（业务逻辑）

```
src/services/
├── retirement_service.py      # 核心业务逻辑
├── approval_service.py        # 审批服务
├── approval_chain_service.py  # 审批链服务
└── notification_service.py    # 通知服务
```

**依赖关系**: 依赖 L1 数据模型

### 层级 L3: API 接口层

```
src/api/
├── routers/
│   ├── retirement_router.py   # 报废申请路由
│   └── workorder_router.py    # 工单路由
├── deps/
│   └── auth.py                # 认证依赖
└── middleware/
    └── audit_logger.py        # 审计日志中间件
```

**依赖关系**: 依赖 L2 服务层

### 层级 L4: 状态机引擎层

```
src/state_machine/
├── states.py                    # 状态定义
├── retirement_state_machine.py  # 报废状态机
├── approval_state_machine.py    # 审批状态机
├── transitions.py               # 状态转换定义
└── guards.py                    # 状态转换守卫
```

**依赖关系**: 依赖 L1 数据模型

### 层级 L5: 测试层

```
tests/
├── services/
│   └── test_retirement_service.py  # 核心测试
├── api/
│   └── test_retirement_api.py      # API 测试
└── e2e/
    └── retirement_flow.spec.ts     # E2E 测试
```

---

## 6. 数据模型 ERD 概要

```
┌──────────────────┐       ┌───────────────────────────┐       ┌──────────────────────────────┐
│      Asset       │       │  RetirementApplication    │       │    RetirementHistory         │
├──────────────────┤       ├───────────────────────────┤       ├──────────────────────────────┤
│ id (PK)          │──┐    │ id (PK)                    │──┐    │ id (PK)                     │
│ asset_no         │  │    │ asset_id (FK) ─────────────┘  │    │ application_id (FK) ────────┘
│ name             │  └───▶│ applicant_id (FK)             │    │ from_status                 │
│ status           │       │ reason                       │    │ to_status                   │
│ owner_id         │       │ attachments                  │    │ operator_id (FK)            │
│ ...              │       │ status                       │    │ comment                     │
└──────────────────┘       │ approval_chain_id (FK)       │    │ created_at                  │
                          │ created_at                   │    └──────────────────────────────┘
                          │ updated_at                   │
                          └───────────────────────────┘    ┌───────────────────────────┐
                                                           │     ApprovalChain        │
                          ┌───────────────────────────┐    ├───────────────────────────┤
                          │      ApprovalNode          │    │ id (PK)                   │
                          ├───────────────────────────┤    │ name                      │
                          │ id (PK)                    │    │ nodes (JSON)              │
                          │ chain_id (FK) ─────────────┴───▶│ created_at                │
                          │ approver_role              │    └───────────────────────────┘
                          │ approval_order             │
                          └───────────────────────────┘
```

---

## 7. 状态流转图

```
                    ┌─────────┐
                    │  DRAFT  │ ◀── 创建申请
                    └────┬────┘
                         │ submit()
                         ▼
                   ┌───────────┐
                   │  PENDING  │ ◀── 提交申请，等待审批
                   └─────┬─────┘
                         │
           ┌─────────────┴─────────────┐
           │                           │
           ▼                           ▼
    ┌────────────┐              ┌───────────┐
    │ APPROVED   │              │ REJECTED  │
    └────────────┘              └───────────┘
           │                           │
           ▼                           ▼
    ┌────────────┐              ┌───────────┐
    │ ARCHIVED   │              │ CANCELLED │
    └────────────┘              └───────────┘
```

---

## 8. 附录

### 8.1 测试命令

```bash
# 单元测试 - 退休服务
pytest tests/services/test_retirement_service.py -v

# API 测试 - 退休申请
pytest tests/api/test_retirement_api.py -v

# E2E 测试 - 退休流程
playwright test tests/e2e/retirement_flow.spec.ts
```

### 8.2 术语表

| 术语 | 英文 | 定义 |
|------|------|------|
| 报废 | Retirement | 资产因老化、损坏等原因退出使用的过程 |
| 退役 | Disposal | 报废后的实物处置（变卖、捐赠、报废） |
| 审批链 | Approval Chain | 多级审批节点的顺序链 |
| 直线经理 | Line Manager | 资产使用者的直接上级 |

---

**文档版本**: v1.0.0  
**迭代周期**: Iteration 1  
**创建日期**: 2024-XX-XX  
**最后更新**: 2024-XX-XX