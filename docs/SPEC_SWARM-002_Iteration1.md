# SWARM-002 资产报废退役流程规格指导文档

**版本**: v1.0  
**迭代**: Iteration 1  
**状态**: 进行中  
**关联 Phase**: Phase 2（报废申请与状态校验）  
**最后更新**: 2024-01-15

---

## 1. 需求与背景

### 1.1 业务场景

资产管理系统需支持资产的全生命周期管理。当资产到达生命周期末端或因损毁、闲置等原因需退出使用序列时，需通过规范的报废退役流程进行处置，确保资产账实相符、审批合规可追溯。

### 1.2 功能目标

| 功能点 | 描述 | 优先级 |
|--------|------|--------|
| 报废申请发起 | 用户可对目标资产提交报废申请，填写报废原因及附件 | P0 |
| 状态自动校验 | 系统在校验资产当前状态是否符合报废前置条件 | P0 |
| 处置记录生成 | 审批通过后自动生成资产处置流水记录 | P1 |
| 审批链路触发 | 根据资产价值/类别匹配对应审批流程 | P1 |
| 生命周期状态更新 | 报废完成后更新资产状态为"已报废"，标记退役 | P0 |

### 1.3 用户故事

> **作为** 资产管理员  
> **我想要** 对到达生命周期的资产发起报废申请  
> **以便** 资产能够合规退出使用序列，同时保留完整的审批和处置记录

---

## 2. 当前 Phase 对应实施目标

### 2.1 参照 plan.md Phase 拆解

| Phase | 名称 | 实施范围 | 本次迭代 |
|-------|------|----------|----------|
| Phase 1 | 数据模型与状态定义 | 资产状态枚举、生命周期阶段模型 | ✅ 已完成 |
| **Phase 2** | **报废申请与状态校验** | **报废申请接口、状态前置校验逻辑** | **本期目标** |
| Phase 3 | 处置记录与审批集成 | 处置记录生成、审批链路触发 | 下期目标 |
| Phase 4 | 状态变更与通知 | 生命周期状态更新、通知机制 | 下期目标 |

### 2.2 本期具体目标（Phase 2）

#### 目标一：报废申请接口开发
- 资产报废申请 API 端点实现
- 请求体包含：`reason`（必填）、`description`（选填）、`attachments`（选填）
- 响应返回申请单编号和状态

#### 目标二：资产状态校验逻辑
- 校验资产是否存在
- 校验资产当前状态是否为可报废状态（`IN_USE` 或 `IDLE`）
- 校验资产是否已存在进行中的报废流程

#### 目标三：报废申请单数据模型
- 记录申请人、申请时间、报废原因
- 关联资产信息与处置意向
- 状态枚举：`PENDING`、`APPROVED`、`REJECTED`、`CANCELLED`

---

## 3. 边界约束

### 3.1 业务规则约束

| 约束编号 | 约束内容 | 违规响应 |
|----------|----------|----------|
| C-001 | 资产状态必须为 `IN_USE` 或 `IDLE` 才能发起报废申请 | 返回 400，提示"资产当前状态不允许报废" |
| C-002 | 资产不可存在 `PENDING_RETIRE` 或 `RETIRED` 状态的进行中流程 | 返回 409，提示"资产已存在进行中的报废流程" |
| C-003 | 报废原因 `reason` 字段必填，最小长度 10 字符 | 返回 400，提示"报废原因必填且不少于10字符" |
| C-004 | 仅资产责任人或管理员可发起报废申请 | 返回 403，提示"无操作权限" |
| C-005 | 单次报废申请仅针对单一资产，不支持批量 | 业务约束，前端表单限制 |

### 3.2 数据约束

| 约束编号 | 约束内容 |
|----------|----------|
| D-001 | 报废申请单编号格式：`RET-{YYYYMMDD}-{6位随机数}` |
| D-002 | 申请时间以服务器时间戳为准，格式 ISO 8601 |
| D-003 | 附件支持 PDF/图片格式，单文件最大 10MB |

### 3.3 外部依赖约束

| 约束编号 | 约束内容 | 影响说明 |
|----------|----------|----------|
| E-001 | 依赖 Phase 1 的资产状态枚举定义 | 状态值需保持一致 |
| E-002 | 依赖用户权限模块的用户身份校验 | 权限校验结果决定接口放行 |
| E-003 | 依赖资产服务查询资产详情 | 用于状态和归属校验 |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 报废申请接口正常提交流程

**测试场景**: 资产状态为 `IN_USE`，用户为资产责任人，发起报废申请

```
测试步骤:
1. 创建测试资产，状态设为 IN_USE
2. 使用责任人身份调用 POST /api/v1/assets/{asset_id}/retire
3. 请求体包含有效 reason（≥10字符）

物理测试期待:
1. HTTP 响应码 201
2. 响应体包含 retire_application_id
3. 响应体包含 application_no
4. 数据库 assets 表状态未变更（等待审批后变更）
5. 数据库 retire_applications 表插入新记录，status 为 PENDING
```

### 4.2 ATB-2: 资产状态校验 - 不允许报废状态

**测试场景**: 资产状态为 `RETIRED`，尝试发起报废申请

```
测试步骤:
1. 创建测试资产，状态设为 RETIRED
2. 调用 POST /api/v1/assets/{asset_id}/retire

物理测试期待:
1. HTTP 响应码 400
2. 错误码 RETIRE_STATUS_NOT_ALLOWED
3. 数据库无新增记录
4. 响应消息包含"资产当前状态不允许报废"
```

### 4.3 ATB-3: 重复报废申请校验

**测试场景**: 资产已存在 `PENDING` 状态的申请，再次发起申请

```
测试步骤:
1. 创建测试资产，状态设为 IN_USE
2. 发起第一笔报废申请（状态变为 PENDING_RETIRE）
3. 再次调用 POST /api/v1/assets/{asset_id}/retire

物理测试期待:
1. HTTP 响应码 409
2. 错误码 RETIRE_APPLICATION_CONFLICT
3. 响应消息包含"资产已存在进行中的报废流程"
```

### 4.4 ATB-4: 报废原因必填校验

**测试场景**: 提交报废申请时未填写原因或原因过短

```
测试步骤:
1. 创建测试资产，状态设为 IN_USE
2. 分别测试以下场景:
   - reason 为空字符串
   - reason 长度 < 10 字符

物理测试期待:
1. HTTP 响应码 400
2. 空字符串: 错误码 RETIRE_REASON_REQUIRED
3. 长度不足: 错误码 RETIRE_REASON_TOO_SHORT
```

### 4.5 ATB-5: 权限校验 - 非资产责任人

**测试场景**: 非资产责任人用户尝试发起报废申请

```
测试步骤:
1. 创建测试资产，owner_id 为 user_A
2. 使用 user_B 身份调用 POST /api/v1/assets/{asset_id}/retire

物理测试期待:
1. HTTP 响应码 403
2. 错误码 PERMISSION_DENIED
3. 响应消息包含"无操作权限"
```

### 4.6 ATB-6: 资产不存在场景

**测试场景**: 针对不存在的资产 ID 发起报废申请

```
测试步骤:
1. 调用 POST /api/v1/assets/nonexistent-id/retire

物理测试期待:
1. HTTP 响应码 404
2. 错误码 ASSET_NOT_FOUND
```

### 4.7 ATB-7: 申请单查询接口

**测试场景**: 报废申请创建后，支持通过 ID 查询详情

```
测试步骤:
1. 创建报废申请
2. 调用 GET /api/v1/retire-applications/{id}

物理测试期待:
1. HTTP 响应码 200
2. 响应包含申请单完整信息（asset_id, applicant_id, reason, status, created_at）
```

---

## 5. 开发切入层级序列

### 5.1 层级一：数据层（优先）

```
backend/
├── entity/
│   └── RetirementApplication.java      # 报废申请单实体
│   └── RetirementRequest.java           # 报废请求领域实体
├── repository/
│   └── RetirementApplicationRepository.java  # 数据访问层
```

**交付物**:
- `RetirementApplication` 实体类
- `RetirementApplicationRepository` 数据访问接口

### 5.2 层级二：服务层（核心）

```
backend/
└── service/
    └── RetirementService.java           # 报废业务服务接口
    └── impl/
        └── RetirementServiceImpl.java   # 报废业务服务实现 ⭐
```

**交付物**:
- `RetirementService.createRetireApplication()` - 创建报废申请
- `RetirementService.validateAssetRetireEligibility()` - 资产报废资格校验
- `RetirementService.getRetireApplication()` - 查询申请详情
- 状态校验规则实现
- 权限校验逻辑集成

### 5.3 层级三：接口层（API）

```
backend/
└── controller/
    └── RetirementController.java       # 报废申请 REST 接口
```

**交付物**:
- `POST /api/v1/assets/{assetId}/retire` - 发起报废申请
- `GET /api/v1/retire-applications/{id}` - 查询申请详情
- `GET /api/v1/assets/{assetId}/retire-applications` - 查询资产报废历史

### 5.4 层级四：集成层（依赖接入）

```
backend/
├── service/
│   └── AssetService.java                # 资产服务依赖
│   └── NotificationService.java         # 通知服务依赖
├── validator/
│   └── AssetValidator.java              # 资产验证器
```

**交付物**:
- 资产服务客户端封装
- 用户身份解析与权限校验
- 请求上下文注入

---

## 6. 数据模型定义

### 6.1 RetirementApplication（报废申请单）

| 字段 | 类型 | 约束 | 描述 |
|------|------|------|------|
| id | Long | PK | 主键 |
| applicationNo | String | UNIQUE, NOT NULL | 申请单编号 |
| assetId | Long | FK, NOT NULL | 关联资产ID |
| applicantId | Long | NOT NULL | 申请人ID |
| reason | String | NOT NULL, max=500 | 报废原因 |
| description | String | NULLABLE | 补充说明 |
| attachments | String | NULLABLE | 附件URLs，JSON数组 |
| status | Enum | NOT NULL | 申请状态 |
| createdAt | LocalDateTime | NOT NULL | 创建时间 |
| updatedAt | LocalDateTime | NOT NULL | 更新时间 |

### 6.2 状态枚举（RetireApplicationStatus）

| 状态值 | 描述 |
|--------|------|
| `PENDING` | 待审批 |
| `APPROVED` | 已审批通过 |
| `REJECTED` | 已驳回 |
| `CANCELLED` | 已撤回 |

### 6.3 资产状态枚举（AssetStatus）

| 状态值 | 描述 | 可发起报废 |
|--------|------|------------|
| `IN_USE` | 使用中 | ✅ |
| `IDLE` | 闲置 | ✅ |
| `IN_TRANSFER` | 调拨中 | ❌ |
| `MAINTENANCE` | 维修中 | ❌ |
| `RETIRED` | 已报废 | ❌ |

---

## 7. API 规格

### 7.1 POST /api/v1/assets/{assetId}/retire

**请求**

```http
POST /api/v1/assets/123/retire
Content-Type: application/json
Authorization: Bearer {token}

{
  "reason": "设备老旧无法修复，需报废处理",
  "description": "经维修评估，修复成本超过资产原值50%",
  "attachments": ["https://storage.example.com/attaches/xxx.pdf"]
}
```

**成功响应 (201)**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "retireApplicationId": 1,
    "applicationNo": "RET-20240115-A3B7C9",
    "assetId": 123,
    "status": "PENDING",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**错误响应 (400)**

```json
{
  "code": 40000,
  "message": "资产当前状态不允许报废",
  "errorCode": "RETIRE_STATUS_NOT_ALLOWED"
}
```

**错误响应 (403)**

```json
{
  "code": 40300,
  "message": "无操作权限",
  "errorCode": "PERMISSION_DENIED"
}
```

**错误响应 (409)**

```json
{
  "code": 40900,
  "message": "资产已存在进行中的报废流程",
  "errorCode": "RETIRE_APPLICATION_CONFLICT"
}
```

**错误响应 (404)**

```json
{
  "code": 40400,
  "message": "资产不存在",
  "errorCode": "ASSET_NOT_FOUND"
}
```

### 7.2 GET /api/v1/retire-applications/{id}

**成功响应 (200)**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "applicationNo": "RET-20240115-A3B7C9",
    "assetId": 123,
    "assetName": "Dell 服务器 R740",
    "applicantId": 456,
    "applicantName": "张三",
    "reason": "设备老旧无法修复，需报废处理",
    "description": "经维修评估，修复成本超过资产原值50%",
    "status": "PENDING",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## 8. 错误码定义

| 错误码 | 英文码 | 描述 |
|--------|--------|------|
| 40001 | RETIRE_REASON_REQUIRED | 报废原因必填 |
| 40002 | RETIRE_REASON_TOO_SHORT | 报废原因不少于10字符 |
| 40003 | RETIRE_STATUS_NOT_ALLOWED | 资产当前状态不允许报废 |
| 40300 | PERMISSION_DENIED | 无操作权限 |
| 40400 | ASSET_NOT_FOUND | 资产不存在 |
| 40900 | RETIRE_APPLICATION_CONFLICT | 资产已存在进行中的报废流程 |

---

## 9. 风险项与依赖说明

| 风险项 | 影响 | 缓解措施 |
|--------|------|----------|
| Phase 1 状态枚举未完成 | 无法进行状态校验开发 | 先行定义枚举常量，待 Phase 1 完成后对齐 |
| 审批链路依赖 Phase 3 | 本期仅完成申请提交，审批功能后续迭代 | 接口设计预留审批字段 |
| 资产服务尚未封装 | 状态查询依赖不稳定 | 使用 Mock 进行单元测试 |

---

## 10. 验收清单

- [ ] `RetirementServiceImpl.java` 实现完成
- [ ] 所有 public 方法包含 docstring 文档注释
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] AST 静态检查通过（无语法错误）
- [ ] 模块可被正常 import
- [ ] API 接口返回符合响应规格

---

*本文档为 SWARM-002 迭代1 的规格指导依据，开发过程中如需变更请同步更新本文档。*