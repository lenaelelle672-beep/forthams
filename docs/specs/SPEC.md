# 资产报废退役流程 - 规格指导文档 (Iteration 1)

## 版本信息

| 属性 | 值 |
|------|-----|
| 文档版本 | v1.0.0 |
| 迭代周期 | Iteration 1 |
| 用户任务 | `feat(asset): 资产报废退役流程 - 用户现在可以发起资产报废申请并在系统中查看审批状态流转历史了` |
| 最后更新 | 2024-XX-XX |

---

## 1. 需求与背景

### 1.1 业务背景

资产报废退役是企业资产管理的重要环节，涉及资产的生命周期闭环管理。传统模式下，资产报废依赖线下纸质审批，存在以下痛点：

1. **流程不透明**：申请人无法实时追踪审批进度
2. **状态不可追溯**：审批流转记录分散，难以形成完整的资产处置档案
3. **协同效率低**：跨部门审批依赖人工传递，周期长、易遗漏

### 1.2 功能目标

本次迭代（Iteration 1）实现资产报废申请与审批状态流转的可视化管理，支持用户在线提交报废申请并实时查看审批进度历史。

---

## 2. 当前 Phase 对应实施目标

### 2.1 Plan.md Phase 映射

| Plan.md Phase | 迭代目标 | 交付范围 |
|---------------|----------|----------|
| Phase 1: 基础流程线上化 | 核心路径打通 | 申请发起 → 基础审批 → 状态追踪 |
| Phase 2: 审批规则扩展 | 条件审批、多级会签 | 延期至 Iteration 2 |
| Phase 3: 退役执行闭环 | 实物处置、账务处理 | 延期至 Iteration 2+ |

### 2.2 Iteration 1 交付范围

| 功能模块 | 功能点 | 优先级 | 状态 |
|----------|--------|--------|------|
| 报废申请 | 资产报废申请单创建（单条资产） | P0 | 待实现 |
| 报废申请 | 报废申请列表查询（按申请人/状态筛选） | P0 | 待实现 |
| 审批流程 | 基础审批流程（单级审批：直线经理审批） | P0 | 待实现 |
| 状态追踪 | 审批状态流转历史展示 | P0 | 待实现 |
| 通知提醒 | 申请状态变更通知（邮件/站内信） | P1 | 待实现 |

---

## 3. 边界约束

### 3.1 范围边界

| 约束类型 | 明确范围（In Scope） | 排除范围（Out of Scope） |
|----------|---------------------|------------------------|
| 资产范围 | 固定资产（设备、家具、IT资产） | 低值易耗品、耗材 |
| 申请粒度 | 单条资产提交报废申请 | 批量报废（Iteration 2+） |
| 审批层级 | 单级审批（直线经理） | 多级会签、条件分支审批 |
| 状态范围 | `DRAFT` → `PENDING` → `APPROVED`/`REJECTED` → `ARCHIVED` | 执行处置、出库、财务核销 |
| 组织范围 | 单租户/SaaS部署模式 | 多租户隔离（Phase 3） |

### 3.2 技术约束

| 约束项 | 具体要求 |
|--------|----------|
| 接口协议 | RESTful API，JSON 格式 |
| 认证方式 | JWT Bearer Token |
| 数据库 | PostgreSQL 13+ / MySQL 8.0+ |
| 后端框架 | Spring Boot 3.x (Java 17+) |
| 前端框架 | React 18 + TypeScript + Ant Design 5.x |
| 审批引擎 | 轻量级状态机（自研或 Spring StateMachine） |
| 消息队列 | Redis Pub/Sub（通知场景） |
| API 响应时限 | P95 < 200ms |

### 3.3 数据约束

| 约束项 | 约束条件 |
|--------|----------|
| 申请编号 | 全局唯一，格式：`RET-YYYYMMDD-XXXX` |
| 状态枚举 | `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `ARCHIVED` |
| 审批超时 | 72小时内未审批自动发送催办通知 |
| 历史记录 | 不可删除/修改，仅追加（Immutable Append-Only） |
| 附件限制 | 单个附件 ≤ 10MB，支持格式：pdf, jpg, png, xlsx, docx |

---

## 4. 数据模型

### 4.1 核心实体关系图

```
┌─────────────────┐       ┌─────────────────────────────┐       ┌──────────────────────────────┐
│     Asset       │       │   RetirementApplication      │       │   RetirementHistory          │
├─────────────────┤       ├─────────────────────────────┤       ├──────────────────────────────┤
│ id (PK, Long)   │──┐    │ id (PK, Long)                │──┐    │ id (PK, Long)                │
│ assetNo (String)│  │    │ assetId (FK) ────────────────┘  │    │ applicationId (FK) ──────────┘
│ name (String)   │  └───▶│ applicantId (FK)               │    │ fromStatus (Enum)            │
│ status (Enum)   │       │ reason (String)                │    │ toStatus (Enum)              │
│ categoryId (FK) │       │ attachments (JSON Array)      │    │ operatorId (FK)              │
│ deptId (FK)     │       │ status (Enum)                 │    │ comment (String)             │
│ ...             │       │ createdAt (Timestamp)         │    │ createdAt (Timestamp)        │
└─────────────────┘       │ updatedAt (Timestamp)         │    └──────────────────────────────┘
                          └─────────────────────────────┘
                                 ▲
                                 │ 1:N
                          ┌──────┴─────────┐
                          │ ApprovalRecord │
                          ├────────────────┤
                          │ id (PK, Long)  │
                          │ applicationId  │
                          │ approverId     │
                          │ action (Enum)  │
                          │ comment        │
                          │ createdAt      │
                          └────────────────┘
```

### 4.2 状态枚举定义

```java
public enum RetirementStatus {
    DRAFT("草稿"),
    PENDING("待审批"),
    APPROVED("已批准"),
    REJECTED("已拒绝"),
    CANCELLED("已取消"),
    ARCHIVED("已归档");
    
    private final String description;
}
```

### 4.3 状态流转规则

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
┌───────┐    submit    ┌─────────┐    approve    ┌──────────┐ │
│ DRAFT │ ─────────▶  │ PENDING │ ────────────▶ │ APPROVED │ │
└───────┘              └────┬────┘               └────┬─────┘ │
      │                     │                        │       │
      │ cancel               │ reject                 │ archive
      ▼                     ▼                        ▼       │
┌───────────┐         ┌──────────┐              ┌──────────┐  │
│ CANCELLED │         │ REJECTED │              │ ARCHIVED │◀─┘
└───────────┘         └──────────┘              └──────────┘
```

---

## 5. API 接口规格

### 5.1 报废申请接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/retirements` | 创建报废申请 |
| GET | `/api/v1/retirements` | 查询报废申请列表（支持分页、筛选） |
| GET | `/api/v1/retirements/{id}` | 查询报废申请详情 |
| PUT | `/api/v1/retirements/{id}` | 更新报废申请（仅 DRAFT 状态） |
| DELETE | `/api/v1/retirements/{id}` | 删除报废申请（仅 DRAFT 状态） |
| POST | `/api/v1/retirements/{id}/submit` | 提交报废申请 |
| POST | `/api/v1/retirements/{id}/cancel` | 取消报废申请 |

### 5.2 审批接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/retirements/{id}/approve` | 审批通过 |
| POST | `/api/v1/retirements/{id}/reject` | 审批拒绝 |
| GET | `/api/v1/retirements/{id}/history` | 查询审批流转历史 |

### 5.3 请求/响应示例

**POST /api/v1/retirements - 创建报废申请**

Request:
```json
{
  "assetId": 12345,
  "reason": "设备老化，无法正常使用",
  "description": "该设备已使用10年，多次维修仍无法恢复正常功能",
  "attachments": [
    {
      "fileName": "maintenance_record.pdf",
      "fileUrl": "/uploads/attachments/maintenance_record.pdf"
    }
  ]
}
```

Response (201 Created):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1001,
    "applicationNo": "RET-20240115-0001",
    "assetId": 12345,
    "assetNo": "AST-2020-001",
    "assetName": "Dell 服务器 PowerEdge R740",
    "applicantId": 501,
    "applicantName": "张三",
    "reason": "设备老化，无法正常使用",
    "status": "DRAFT",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**GET /api/v1/retirements/{id}/history - 查询流转历史**

Response (200 OK):
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": 1,
      "fromStatus": null,
      "toStatus": "DRAFT",
      "operatorId": 501,
      "operatorName": "张三",
      "comment": "创建报废申请",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": 2,
      "fromStatus": "DRAFT",
      "toStatus": "PENDING",
      "operatorId": 501,
      "operatorName": "张三",
      "comment": "提交审批",
      "createdAt": "2024-01-15T10:35:00Z"
    },
    {
      "id": 3,
      "fromStatus": "PENDING",
      "toStatus": "APPROVED",
      "operatorId": 601,
      "operatorName": "李四（部门经理）",
      "comment": "同意报废，设备确实已达到使用年限",
      "createdAt": "2024-01-15T14:20:00Z"
    }
  ]
}
```

---

## 6. 验收测试基准 (ATB)

### 6.1 ATB-1: 资产报废申请创建

| 测试编号 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 |
|----------|----------|----------|----------|----------|
| ATB-1.1 | 正常创建申请 | 用户已登录，资产状态为"在用" | POST `/api/v1/retirements` with payload | 返回 201，body 包含 `applicationNo`，状态为 `DRAFT` |
| ATB-1.2 | 重复申请校验 | 资产存在待审批/已通过申请 | POST `/api/v1/retirements` | 返回 409 Conflict，提示"该资产存在进行中的报废申请" |
| ATB-1.3 | 无效资产校验 | 资产ID不存在 | POST `/api/v1/retirements` with invalid assetId | 返回 404 Not Found |
| ATB-1.4 | 附件上传 | 申请包含附件 | POST with multipart/form-data | 文件成功上传，返回 fileId |
| ATB-1.5 | 权限校验 | 当前用户无资产所属部门权限 | POST `/api/v1/retirements` | 返回 403 Forbidden |

**物理测试命令（pytest）**：
```bash
pytest tests/api/test_retirement_api.py::TestRetirementCreation -v
```

### 6.2 ATB-2: 报废申请列表查询

| 测试编号 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 |
|----------|----------|----------|----------|----------|
| ATB-2.1 | 按申请人筛选 | 数据库存在多条申请记录 | GET `/api/v1/retirements?applicantId={userId}` | 返回该用户的申请列表 |
| ATB-2.2 | 按状态筛选 | 数据库存在多种状态申请 | GET `/api/v1/retirements?status=PENDING` | 仅返回待审批状态的申请 |
| ATB-2.3 | 组合筛选 | 同时筛选申请人和状态 | GET `/api/v1/retirements?applicantId=X&status=APPROVED` | 返回符合双重条件的交集结果 |
| ATB-2.4 | 分页校验 | 申请记录 > 20条 | GET `/api/v1/retirements?page=2&pageSize=20` | 返回第21-40条记录，response 包含 `totalCount`, `page`, `pageSize` |
| ATB-2.5 | 时间范围筛选 | 数据库存在历史申请记录 | GET `/api/v1/retirements?startDate=2024-01-01&endDate=2024-01-31` | 仅返回指定时间范围内的申请 |

**物理测试命令（pytest）**：
```bash
pytest tests/api/test_retirement_api.py::TestRetirementListQuery -v
```

### 6.3 ATB-3: 审批流程执行

| 测试编号 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 |
|----------|----------|----------|----------|----------|
| ATB-3.1 | 审批通过 | 存在 PENDING 状态申请，当前用户为审批人 | POST `/api/v1/retirements/{id}/approve` with comment | 返回 200，状态变更为 `APPROVED`，生成状态流转记录 |
| ATB-3.2 | 审批拒绝 | 存在 PENDING 状态申请，审批人填写拒绝原因 | POST `/api/v1/retirements/{id}/reject` with reason | 返回 200，状态变更为 `REJECTED` |
| ATB-3.3 | 越权审批拦截 | 当前用户非审批人 | POST `/api/v1/retirements/{id}/approve` | 返回 403 Forbidden |
| ATB-3.4 | 状态变更幂等性 | 申请已 APPROVED | POST `/api/v1/retirements/{id}/approve` | 返回 409 Conflict，提示"当前状态不允许此操作" |
| ATB-3.5 | 提交申请 | 申请状态为 DRAFT | POST `/api/v1/retirements/{id}/submit` | 返回 200，状态变更为 `PENDING` |
| ATB-3.6 | 取消申请 | 申请状态为 PENDING | POST `/api/v1/retirements/{id}/cancel` | 返回 200，状态变更为 `CANCELLED` |

**物理测试命令（pytest）**：
```bash
pytest tests/api/test_retirement_api.py::TestRetirementApproval -v
```

### 6.4 ATB-4: 审批状态流转历史

| 测试编号 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 |
|----------|----------|----------|----------|----------|
| ATB-4.1 | 正常查询历史 | 申请经过多次状态变更 | GET `/api/v1/retirements/{id}/history` | 返回按时间正序的状态变更列表 |
| ATB-4.2 | 历史记录不可篡改 | 存在历史记录 | 尝试 PUT `/api/v1/retirements/{id}/history/{recordId}` | 返回 405 Method Not Allowed |
| ATB-4.3 | 空历史校验 | 申请刚创建，无审批动作 | GET `/api/v1/retirements/{id}/history` | 返回空数组 `[]` |
| ATB-4.4 | 历史记录字段完整性 | 存在历史记录 | 检查返回字段 | 包含 `fromStatus`, `toStatus`, `operatorId`, `operatorName`, `comment`, `createdAt` |

**物理测试命令（pytest）**：
```bash
pytest tests/api/test_retirement_api.py::TestRetirementHistory -v
```

### 6.5 ATB-5: E2E 场景验证（Playwright）

| 测试编号 | 测试场景 | 测试步骤 |
|----------|----------|----------|
| ATB-5.1 | 完整报废申请链路 | 登录 → 进入资产详情 → 点击"申请报废" → 填写报废原因 → 提交 → 查看申请详情 → 审批通过 → 查看流转历史 |
| ATB-5.2 | 审批拒绝后重新申请 | 提交申请 → 审批拒绝 → 修改原因 → 重新提交 → 审批通过 |
| ATB-5.3 | 状态筛选与搜索 | 创建多条不同状态申请 → 使用状态筛选器 → 验证列表正确过滤 |

**物理测试命令（Playwright）**：
```bash
playwright test tests/e2e/retirement_flow.spec.ts
```

---

## 7. 开发切入层级序列

### 7.1 层级 L1: 数据模型层

**优先级**: P0（无前置依赖）

```
1.1 实体类开发
    ├── Asset 实体扩展
    │   ├── 添加字段: retirementStatus (ENUM: NONE, PENDING, APPROVED)
    │   └── 添加索引: retirementStatus
    │
    ├── RetirementApplication 实体
    │   ├── 字段: id, applicationNo, assetId, applicantId, reason, description
    │   ├── 字段: attachments (JSON), status, createdAt, updatedAt
    │   └── 约束: status 状态机约束
    │
    ├── RetirementHistory 实体
    │   ├── 字段: id, applicationId, fromStatus, toStatus, operatorId, comment, createdAt
    │   └── 约束: only_insert (禁止 UPDATE/DELETE)
    │
    └── ApprovalRecord 实体
        ├── 字段: id, applicationId, applicationType, approverId, action, comment, createdAt
        └── 枚举: action (APPROVE, REJECT)
```

**涉及文件**:
- `backend/src/main/java/com/ams/entity/Asset.java`
- `backend/src/main/java/com/ams/entity/RetirementApplication.java` (新建)
- `backend/src/main/java/com/ams/entity/RetirementHistory.java` (新建)
- `backend/src/main/java/com/ams/entity/ApprovalRecord.java`

### 7.2 层级 L2: 服务层（业务逻辑）

**优先级**: P0（依赖 L1）

```
2.1 RetirementService
    ├── createApplication(assetId, applicantId, reason, description, attachments)
    │   └── 校验: 资产是否存在、是否可报废、是否已有进行中申请
    │
    ├── submitApplication(applicationId)
    │   └── 状态变更: DRAFT → PENDING，发送审批通知
    │
    ├── cancelApplication(applicationId)
    │   └── 状态变更: PENDING → CANCELLED
    │
    ├── approveApplication(applicationId, approverId, comment)
    │   └── 状态变更: PENDING → APPROVED，更新资产状态
    │
    ├── rejectApplication(applicationId, approverId, reason)
    │   └── 状态变更: PENDING → REJECTED
    │
    └── getApplicationDetail(applicationId)

2.2 RetirementHistoryService
    ├── appendHistory(applicationId, fromStatus, toStatus, operatorId, comment)
    └── getHistory(applicationId)

2.3 ApprovalChainService
    ├── getApprover(assetId) → 返回直线经理
    └── validateApproverPermission(applicationId, approverId)
```

**涉及文件**:
- `backend/src/main/java/com/ams/service/RetirementService.java` (扩展)
- `backend/src/main/java/com/ams/service/ApprovalChainService.java` (扩展)

### 7.3 层级 L3: API 接口层

**优先级**: P0（依赖 L2）

```
3.1 RetirementController
    ├── POST   /api/v1/retirements              # 创建申请
    ├── GET    /api/v1/retirements              # 列表查询
    ├── GET    /api/v1/retirements/{id}         # 详情查询
    ├── PUT    /api/v1/retirements/{id}         # 更新申请
    ├── DELETE /api/v1/retirements/{id}         # 删除申请
    ├── POST   /api/v1/retirements/{id}/submit  # 提交申请
    ├── POST   /api/v1/retirements/{id}/cancel  # 取消申请
    ├── POST   /api/v1/retirements/{id}/approve # 审批通过
    ├── POST   /api/v1/retirements/{id}/reject  # 审批拒绝
    └── GET    /api/v1/retirements/{id}/history # 流转历史

3.2 DTO/Request/Response 定义
    ├── RetirementCreateRequest
    ├── RetirementUpdateRequest
    ├── RetirementResponse
    ├── ApprovalRequest
    └── RetirementHistoryResponse

3.3 统一认证中间件
    ├── JWT Token 校验
    └── 用户上下文注入 (request.user, request.orgId)
```

**涉及文件**:
- `backend/src/main/java/com/ams/controller/RetirementController.java` (新建)
- `backend/src/main/java/com/ams/dto/RetirementCreateRequest.java` (新建)
- `backend/src/main/java/com/ams/dto/RetirementResponse.java` (新建)

### 7.4 层级 L4: 前端交互层

**优先级**: P1（依赖 L3 API）

```
4.1 资产报废申请表单组件
    ├── AssetRetirementButton: 资产详情页"申请报废"按钮
    ├── RetirementApplicationModal: 报废申请弹窗表单
    │   ├── AssetSelector: 资产搜索与选择（从详情页自动带入）
    │   ├── RetirementReasonForm: 报废原因填写（必填）
    │   ├── DescriptionInput: 详细说明（选填）
    │   └── AttachmentUploader: 附件上传组件
    └── RetirementApplicationConfirm: 提交确认

4.2 报废申请列表页
    ├── RetirementListView: 申请列表主视图
    ├── StatusFilter: 状态筛选器（全部/草稿/待审批/已批准/已拒绝）
    ├── ApplicantFilter: 申请人筛选
    ├── DateRangePicker: 日期范围筛选
    └── RetirementTable: 申请表格（分页）

4.3 报废申请详情页
    ├── RetirementDetailView: 申请详情展示
    ├── AssetInfoCard: 资产信息卡片
    ├── ApplicationInfoCard: 申请信息卡片
    ├── ApprovalActions: 审批操作按钮（通过/拒绝）
    └── HistoryTimeline: 流转历史时间线

4.4 通知消息组件
    └── RetirementNotification: 申请状态变更通知
```

**涉及文件**:
- `frontend/src/app/components/AssetDetailModal.tsx` (修改 - 集成报废申请入口)
- `frontend/src/pages/AssetDetailPage/hooks/useAuditableFields.ts` (修改 - 添加退役相关可审计字段)

### 7.5 层级 L5: 通知集成层

**优先级**: P2（可与 L2/L3 并行开发）

```
5.1 NotificationService 扩展
    ├── sendRetirementSubmitted(applicationId)    # 申请提交通知审批人
    ├── sendRetirementApproved(applicationId)    # 审批通过通知申请人
    ├── sendRetirementRejected(applicationId)    # 审批拒绝通知申请人
    └── sendApprovalReminder(applicationId)      # 72h超时催办

5.2 通知渠道实现
    ├── EmailChannel: SMTP 发送邮件
    └── InAppChannel: 站内信写入 notification 表
```

---

## 8. 迭代实施计划

### 8.1 Sprint 1 任务拆分

| 任务 ID | 任务描述 | 负责方 | 预计工时 | 优先级 |
|---------|----------|--------|----------|--------|
| TASK-101 | 数据模型设计与创建 | Backend | 4h | P0 |
| TASK-102 | RetirementService 核心逻辑实现 | Backend | 8h | P0 |
| TASK-103 | RetirementController API 开发 | Backend | 6h | P0 |
| TASK-104 | 状态流转历史功能实现 | Backend | 4h | P0 |
| TASK-105 | 权限校验逻辑（AssetPermissionValidator） | Backend | 2h | P0 |
| TASK-106 | 前端报废申请表单开发 | Frontend | 8h | P0 |
| TASK-107 | 前端申请列表与详情页开发 | Frontend | 8h | P0 |
| TASK-108 | 前端流转历史展示组件开发 | Frontend | 4h | P0 |
| TASK-109 | E2E 测试用例编写 | QA | 4h | P1 |
| TASK-110 | 单元测试覆盖 | Backend | 4h | P1 |

### 8.2 依赖关系图

```
[TASK-101] ──┬──▶ [TASK-102] ──▶ [TASK-103] ──▶ [TASK-109]
             │        │               │
             │        ▼               │
             │   [TASK-104] ──────────┘
             │
             └──▶ [TASK-105]

[TASK-103] ─────────────────────▶ [TASK-106] ──▶ [TASK-107] ──▶ [TASK-108]
                                  (API定义后)        │              │
                                                   ▼              │
                                              [TASK-109] ◀───────┘
```

---

## 9. 风险与缓解措施

| 风险 ID | 风险描述 | 可能性 | 影响 | 缓解措施 |
|---------|----------|--------|------|----------|
| RISK-01 | 资产状态与申请状态不一致 | 中 | 高 | 增加状态同步校验逻辑，定时任务检查 |
| RISK-02 | 并发提交导致重复申请 | 低 | 高 | 数据库唯一索引 + 乐观锁 |
| RISK-03 | 审批人离职/岗位变更 | 中 | 中 | 审批链自动重新计算，支持委托审批 |
| RISK-04 | 大附件上传导致超时 | 低 | 低 | 分片上传 + 异步处理 |

---

## 10. 附录

### 10.1 相关文档链接

| 文档 | 路径 |
|------|------|
| API 接口文档 | `/docs/api/retirement-api.md` |
| 数据库设计文档 | `/docs/database/retirement-schema.md` |
| 前端组件文档 | `/docs/frontend/components.md` |
| 测试报告模板 | `/docs/testing/templates/` |

### 10.2 术语表

| 术语 | 英文 | 定义 |
|------|------|------|
| 资产报废 | Asset Retirement | 资产因老化、损坏等原因退出使用状态的过程 |
| 退役申请 | Retirement Application | 用户提交的资产报废请求 |
| 审批链 | Approval Chain | 资产报废需要经过的审批节点序列 |
| 流转历史 | Transition History | 申请状态变更的完整记录 |

---

**文档状态**: 已审核通过  
**审核日期**: 2024-XX-XX