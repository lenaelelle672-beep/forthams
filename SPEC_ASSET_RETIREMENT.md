# 资产报废退役流程 - 规格指导文档 (Iteration 1)

## 需求与背景

### 业务背景

资产报废退役是企业资产管理的重要环节，涉及资产的生命周期闭环管理。传统模式下，资产报废依赖线下纸质审批，存在以下痛点：

1. **流程不透明**：申请人无法实时追踪审批进度
2. **状态不可追溯**：审批流转记录分散，难以形成完整的资产处置档案
3. **协同效率低**：跨部门审批依赖人工传递，周期长、易遗漏

### 功能目标

本次迭代（Iteration 1）实现资产报废申请与审批状态流转的可视化管理，支持用户在线提交报废申请并实时查看审批进度历史。

---

## 当前 Phase 对应实施目标

### Phase 映射

| Plan.md Phase | 迭代目标 | 交付范围 |
|---------------|----------|----------|
| Phase 1: 基础流程线上化 | 核心路径打通 | 申请发起 → 基础审批 → 状态追踪 |
| Phase 2: 审批规则扩展 | 条件审批、多级会签 | 延期至 Iteration 2 |
| Phase 3: 退役执行闭环 | 实物处置、账务处理 | 延期至 Iteration 2+ |

### 本次 Iteration 1 交付范围

- [x] 资产报废申请单创建（单条资产）
- [x] 报废申请列表查询（按申请人/状态筛选）
- [x] 基础审批流程（单级审批：直线经理审批）
- [x] 审批状态流转历史展示
- [x] 申请状态变更通知（邮件/站内信）

---

## 边界约束

### 范围边界

| 约束类型 | 明确范围 | 排除范围 |
|----------|----------|----------|
| 资产范围 | 固定资产（设备、家具、IT资产） | 低值易耗品、耗材 |
| 申请粒度 | 单条资产提交报废申请 | 批量报废（Iteration 2+） |
| 审批层级 | 单级审批（直线经理） | 多级会签、条件分支审批 |
| 状态范围 | Pending → Approved/Rejected → Archived | 执行处置、出库、财务核销 |
| 组织范围 | 单租户/SaaS部署模式 | 多租户隔离（Phase 3） |

### 技术约束

| 约束项 | 具体要求 |
|--------|----------|
| 接口协议 | RESTful API，JSON 格式 |
| 认证方式 | JWT Bearer Token |
| 数据库 | PostgreSQL 13+ |
| 后端框架 | Django 4.x + Django REST Framework |
| 前端框架 | React 18 + Ant Design 5.x |
| 审批引擎 | 轻量级状态机（django-fsm 或自研） |
| 消息队列 | Redis Pub/Sub（通知场景） |
| 响应时限 | API 响应 < 200ms（P95） |

### 数据约束

| 约束项 | 约束条件 |
|--------|----------|
| 申请编号 | 全局唯一，格式：`SC-YYYYMMDD-XXXX` |
| 状态枚举 | `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| 审批超时 | 72小时内未审批自动发送催办通知 |
| 历史记录 | 不可删除/修改，仅追加 |
| 附件限制 | 单个附件 ≤ 10MB，支持格式：pdf, jpg, png, xlsx |

---

## 验收测试基准 (ATB)

### ATB-1: 资产报废申请创建

| 测试编号 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 |
|----------|----------|----------|----------|----------|
| ATB-1.1 | 正常创建申请 | 用户已登录，资产状态为"在用" | POST `/api/v1/assets/{asset_id}/retirement/` with payload | 返回 201，body 包含 `application_id`，状态为 `PENDING` |
| ATB-1.2 | 重复申请校验 | 资产存在待审批/已通过申请 | POST `/api/v1/assets/{asset_id}/retirement/` | 返回 409 Conflict，提示"该资产存在进行中的报废申请" |
| ATB-1.3 | 无效资产校验 | 资产ID不存在 | POST `/api/v1/assets/invalid-id/retirement/` | 返回 404 Not Found |
| ATB-1.4 | 附件上传 | 申请包含附件 | POST with multipart/form-data | 文件成功上传，返回 file_id |

**物理测试命令（pytest）**：
```bash
pytest tests/api/v1/test_asset_retirement.py::TestAssetRetirementCreation -v
```

### ATB-2: 报废申请列表查询

| 测试编号 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 |
|----------|----------|----------|----------|----------|
| ATB-2.1 | 按申请人筛选 | 数据库存在多条申请记录 | GET `/api/v1/retirements/?applicant_id={user_id}` | 返回该用户的申请列表 |
| ATB-2.2 | 按状态筛选 | 数据库存在多种状态申请 | GET `/api/v1/retirements/?status=PENDING` | 仅返回待审批状态的申请 |
| ATB-2.3 | 组合筛选 | 同时筛选申请人和状态 | GET `/api/v1/retirements/?applicant_id=X&status=APPROVED` | 返回符合双重条件的交集结果 |
| ATB-2.4 | 分页校验 | 申请记录 > 20条 | GET `/api/v1/retirements/?page=2&page_size=20` | 返回第21-40条记录，response 包含 `total_count`, `page`, `page_size` |

**物理测试命令（pytest）**：
```bash
pytest tests/api/v1/test_retirement_list.py::TestRetirementListQuery -v
```

### ATB-3: 审批流程执行

| 测试编号 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 |
|----------|----------|----------|----------|----------|
| ATB-3.1 | 审批通过 | 存在 PENDING 状态申请，当前用户为审批人 | POST `/api/v1/retirements/{id}/approve/` with comment | 返回 200，状态变更为 `APPROVED`，生成状态流转记录 |
| ATB-3.2 | 审批拒绝 | 存在 PENDING 状态申请，审批人填写拒绝原因 | POST `/api/v1/retirements/{id}/reject/` with reason | 返回 200，状态变更为 `REJECTED` |
| ATB-3.3 | 越权审批拦截 | 当前用户非审批人 | POST `/api/v1/retirements/{id}/approve/` | 返回 403 Forbidden |
| ATB-3.4 | 状态变更幂等性 | 申请已 APPROVED | POST `/api/v1/retirements/{id}/approve/` | 返回 409 Conflict，提示"当前状态不允许此操作" |

**物理测试命令（pytest）**：
```bash
pytest tests/api/v1/test_retirement_approval.py -v
```

### ATB-4: 审批状态流转历史

| 测试编号 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 |
|----------|----------|----------|----------|----------|
| ATB-4.1 | 正常查询历史 | 申请经过多次状态变更 | GET `/api/v1/retirements/{id}/history/` | 返回按时间正序的状态变更列表，包含每次的 `from_status`, `to_status`, `operator`, `timestamp`, `comment` |
| ATB-4.2 | 历史记录不可篡改 | 存在历史记录 | 尝试 PUT `/api/v1/retirements/{id}/history/{record_id}/` | 返回 405 Method Not Allowed |
| ATB-4.3 | 空历史校验 | 申请刚创建，无审批动作 | GET `/api/v1/retirements/{id}/history/` | 返回空数组 `[]` |

**物理测试命令（pytest）**：
```bash
pytest tests/api/v1/test_retirement_history.py -v
```

### ATB-5: E2E 场景验证（Playwright）

| 测试编号 | 测试场景 | 测试步骤 |
|----------|----------|----------|
| ATB-5.1 | 完整报废申请链路 | 登录 → 选择资产 → 填写报废原因 → 提交 → 查看申请详情 → 审批通过 → 查看流转历史 |
| ATB-5.2 | 审批拒绝后重新申请 | 提交申请 → 审批拒绝 → 修改原因 → 重新提交 → 审批通过 |

**物理测试命令（Playwright）**：
```bash
playwright test tests/e2e/asset_retirement_flow.spec.ts
```

---

## 开发切入层级序列

### 层级 L1: 数据模型层

```
1.1 Asset 模型扩展
    - 添加字段: status (ENUM: IN_USE, PENDING_RETIREMENT, RETIRED)
    - 添加索引: asset_id, status

1.2 RetirementApplication 模型
    - 字段: id, asset_id, applicant_id, reason, attachments, status, created_at, updated_at
    - 状态机定义: DRAFT → PENDING → APPROVED/REJECTED → ARCHIVED

1.3 RetirementHistory 模型
    - 字段: id, application_id, from_status, to_status, operator_id, comment, created_at
    - 约束: only_insert (禁止 UPDATE/DELETE via model)
```

**依赖关系**: 无前置依赖

### 层级 L2: 服务层（业务逻辑）

```
2.1 RetirementApplicationService
    - create_application(asset_id, applicant_id, reason, attachments)
    - validate_asset_retirement_eligibility(asset_id)
    - submit_application(application_id)

2.2 RetirementApprovalService
    - approve(application_id, approver_id, comment)
    - reject(application_id, approver_id, reason)
    - get_approver(asset_id) → 返回直线经理

2.3 RetirementHistoryService
    - append_history(application_id, from_status, to_status, operator_id, comment)
    - get_history(application_id)
```

**依赖关系**: 依赖 L1 数据模型

### 层级 L3: API 接口层

```
3.1 RetirementAPIViewSet (DRF ViewSet)
    - POST /retirements/                    # 创建申请
    - GET /retirements/                     # 列表查询
    - GET /retirements/{id}/                # 详情查询
    - POST /retirements/{id}/submit/        # 提交申请

3.2 ApprovalAPIView
    - POST /retirements/{id}/approve/       # 审批通过
    - POST /retirements/{id}/reject/        # 审批拒绝

3.3 HistoryAPIView
    - GET /retirements/{id}/history/        # 流转历史查询

3.4 统一认证中间件
    - JWT Token 校验
    - 用户上下文注入 (request.user, request.org_id)
```

**依赖关系**: 依赖 L2 服务层

### 层级 L4: 前端交互层

```
4.1 资产报废申请表单组件
    - AssetSelector: 资产搜索与选择
    - RetirementReasonForm: 报废原因填写
    - AttachmentUploader: 附件上传

4.2 报废申请列表页
    - RetirementListView: 列表展示与筛选
    - StatusFilter: 状态筛选器
    - Pagination: 分页组件

4.3 审批操作面板
    - ApprovalActions: 通过/拒绝按钮
    - CommentInput: 审批意见输入

4.4 流转历史展示组件
    - TimelineView: 时间线展示状态变更
```

**依赖关系**: 依赖 L3 API 接口层

### 层级 L5: 通知集成层

```
5.1 NotificationService
    - send_retirement_submitted(application_id)    # 申请提交通知审批人
    - send_retirement_approved(application_id)     # 审批通过通知申请人
    - send_retirement_rejected(application_id)     # 审批拒绝通知申请人
    - send_approval_reminder(application_id)       # 72h超时催办

5.2 通知渠道实现
    - EmailChannel: SMTP 发送邮件
    - InAppChannel: 站内信写入 notification 表
```

**依赖关系**: 依赖 L2 服务层，可与 L3 并行开发

---

## 附录：数据模型 ERD 概要

```
┌─────────────────┐       ┌─────────────────────────┐       ┌──────────────────────────┐
│     Asset       │       │ RetirementApplication   │       │   RetirementHistory       │
├─────────────────┤       ├─────────────────────────┤       ├──────────────────────────┤
│ id (PK)         │──┐    │ id (PK)                 │──┐    │ id (PK)                  │
│ asset_no        │  │    │ asset_id (FK) ──────────┘  │    │ application_id (FK) ─────┘
│ name            │  └───▶│ applicant_id (FK)         │    │ from_status              │
│ status          │       │ reason                   │    │ to_status                │
│ ...             │       │ status                   │    │ operator_id (FK)         │
└─────────────────┘       │ created_at               │    │ comment                  │
                          │ updated_at               │    │ created_at               │
                          └─────────────────────────┘    └──────────────────────────┘
```

---

## 聚焦文件实现要求

### `backend/src/main/java/com/ams/service/RetirementService.java`

根据规格指导文档，该服务类需要实现以下核心方法：

| 方法签名 | 职责描述 | 状态约束 |
|----------|----------|----------|
| `createRetirementRequest(assetId, reason, attachments)` | 创建报废申请单 | 资产状态必须为 IN_USE |
| `submitRetirementRequest(requestId)` | 提交申请进入审批流程 | 仅 DRAFT → PENDING |
| `approveRetirement(requestId, approverId, comment)` | 审批通过 | 仅 PENDING → APPROVED |
| `rejectRetirement(requestId, approverId, reason)` | 审批拒绝 | 仅 PENDING → REJECTED |
| `getRetirementHistory(requestId)` | 查询流转历史 | 返回按时间正序的记录列表 |

**关键约束**：
- 状态转换必须通过状态机引擎验证
- 所有操作必须记录到 `RetirementHistory`
- 审批人必须是资产所属部门的直线经理

---

**文档版本**: v1.0.0  
**迭代周期**: Iteration 1  
**最后更新**: 2024-XX-XX