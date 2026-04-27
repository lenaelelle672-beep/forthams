# SWARM-002 资产报废退役流程规格指导文档

**版本**: v1.0  
**迭代**: Iteration 1  
**状态**: 审核通过  
**关联 Phase**: Phase 2 - 报废申请与状态校验  
**最后更新**: 2024-01-15  

---

## 1. 需求与背景

### 1.1 业务场景

资产管理系统需支持资产的全生命周期管理。当资产到达生命周期末端或因损毁、闲置等原因需退出使用序列时，需通过规范的报废退役流程进行处置，确保：

- 资产账实相符
- 审批合规可追溯
- 生命周期状态完整记录

### 1.2 功能目标

| 功能点 | 描述 | 涉及文件 |
|--------|------|----------|
| 报废申请发起 | 用户对目标资产提交报废申请，填写报废原因及附件 | `retirement_request.py` |
| 状态自动校验 | 系统校验资产当前状态是否符合报废前置条件 | `retirement_service.py` |
| 申请单数据模型 | 报废申请单Schema定义与响应结构 | `retirement_response.py` |
| 审批链路触发 | 根据资产价值/类别匹配对应审批流程 | `approval_service.py` |
| 生命周期状态更新 | 报废完成后更新资产状态为"已报废" | `asset_state_machine.py` |

### 1.3 迭代范围（Iteration 1）

本期为 **Phase 2** 实施阶段，聚焦于：

1. **报废申请接口 Schema 定义**
2. **报废申请单响应结构**
3. **基础校验逻辑**
4. **E2E 测试用例补充**

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解总览

| Phase | 名称 | 实施范围 | 状态 |
|-------|------|----------|------|
| Phase 1 | 数据模型与状态定义 | 资产状态枚举、生命周期阶段模型 | ✅ 已完成 |
| **Phase 2** | **报废申请与状态校验** | **报废申请Schema、状态前置校验逻辑** | **本期目标** |
| Phase 3 | 处置记录与审批集成 | 处置记录生成、审批链路触发 | 下期目标 |
| Phase 4 | 状态变更与通知 | 生命周期状态更新、通知机制 | 下期目标 |

### 2.2 本期具体目标

#### 目标 2.2.1: 报废申请请求 Schema

文件：`src/api/schemas/retirement_request.py`

```python
class RetirementApplicationRequest(BaseModel):
    """
    报废申请请求Schema
    
    Attributes:
        reason: 报废原因（必填，最小10字符）
        description: 补充说明（选填）
        attachments: 附件URL列表（选填）
    """
    reason: str = Field(..., min_length=10, description="报废原因")
    description: Optional[str] = Field(None, max_length=1000)
    attachments: Optional[List[str]] = Field(default_factory=list)
```

#### 目标 2.2.2: 报废申请响应 Schema

文件：`src/api/schemas/retirement_response.py`

```python
class RetirementApplicationResponse(BaseModel):
    """
    报废申请响应Schema
    
    Attributes:
        application_id: 申请单ID
        application_no: 申请单编号
        asset_id: 关联资产ID
        status: 当前状态
        created_at: 创建时间
    """
    application_id: UUID
    application_no: str
    asset_id: UUID
    status: RetirementStatus
    created_at: datetime
```

#### 目标 2.2.3: 状态校验逻辑

```python
def validate_retirement_eligibility(asset: Asset) -> ValidationResult:
    """
    校验资产是否符合报废条件
    
    校验规则:
    1. 资产状态必须为 IN_USE 或 IDLE
    2. 不存在进行中的报废申请
    3. 申请人是否为资产责任人或管理员
    
    Returns:
        ValidationResult: 校验结果
    """
```

#### 目标 2.2.4: E2E 测试用例

文件：`frontend/tests/e2e/retirement_flow.spec.ts`

覆盖场景：
- 正常提交报废申请
- 状态不允许时拒绝申请
- 重复申请冲突检测
- 权限校验

---

## 3. 边界约束

### 3.1 业务规则约束

| 约束ID | 约束内容 | 违规响应 |
|--------|----------|----------|
| C-001 | 资产状态必须为 `IN_USE` 或 `IDLE` 才能发起报废申请 | HTTP 400, `RETIRE_STATUS_NOT_ALLOWED` |
| C-002 | 资产不可存在 `PENDING_RETIRE` 或 `RETIRED` 状态的进行中流程 | HTTP 409, `RETIRE_APPLICATION_CONFLICT` |
| C-003 | 报废原因 `reason` 字段必填，最小长度 10 字符 | HTTP 400, `RETIRE_REASON_TOO_SHORT` |
| C-004 | 仅资产责任人或管理员可发起报废申请 | HTTP 403, `PERMISSION_DENIED` |
| C-005 | 单次报废申请仅针对单一资产，不支持批量 | 前端表单限制 |

### 3.2 数据约束

| 约束ID | 约束内容 |
|--------|----------|
| D-001 | 报废申请单编号格式：`RET-{YYYYMMDD}-{6位随机字符}` |
| D-002 | 申请时间以服务器时间戳为准，格式 ISO 8601 |
| D-003 | 附件支持 PDF/图片格式，单文件最大 10MB |
| D-004 | 附件URL必须为有效的HTTPS地址 |

### 3.3 API 约束

| 约束ID | 约束内容 |
|--------|----------|
| A-001 | 请求体Content-Type必须为 `application/json` |
| A-002 | 认证Token通过 `Authorization: Bearer {token}` 传递 |
| A-003 | 分页查询默认每页20条，最大100条 |

### 3.4 外部依赖约束

| 约束ID | 约束内容 | 影响说明 |
|--------|----------|----------|
| E-001 | 依赖 Phase 1 的资产状态枚举定义 | 状态值需保持一致 |
| E-002 | 依赖用户权限模块的用户身份校验 | 权限校验结果决定接口放行 |
| E-003 | 依赖资产服务获取资产详情 | 资产不存在时返回404 |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 正常提交报废申请

**测试场景**: 资产状态为 `IN_USE`，用户为资产责任人，发起报废申请

```typescript
// frontend/tests/e2e/retirement_flow.spec.ts
describe('ATB-1: 正常提交报废申请', () => {
  test('应成功创建报废申请单', async ({ page }) => {
    // 物理测试期待:
    // 1. POST /api/v1/assets/{asset_id}/retire 返回 201
    // 2. 响应体包含 retire_application_id
    // 3. 申请单状态为 PENDING
    // 4. 数据库 retire_applications 表插入新记录
  });
});
```

### 4.2 ATB-2: 资产状态校验 - 不允许报废状态

**测试场景**: 资产状态为 `RETIRED`，尝试发起报废申请

```typescript
describe('ATB-2: 资产状态校验 - 不允许报废状态', () => {
  test('应拒绝已报废资产的再次申请', async ({ page }) => {
    // 物理测试期待:
    // 1. POST /api/v1/assets/{asset_id}/retire 返回 400
    // 2. 错误码 RETIRE_STATUS_NOT_ALLOWED
    // 3. 提示信息 "资产当前状态不允许报废"
  });
});
```

### 4.3 ATB-3: 重复报废申请校验

**测试场景**: 资产已存在 `PENDING` 状态的申请，再次发起申请

```typescript
describe('ATB-3: 重复报废申请校验', () => {
  test('应拒绝已存在进行中申请的资产', async ({ page }) => {
    // 物理测试期待:
    // 1. POST /api/v1/assets/{asset_id}/retire 返回 409
    // 2. 错误码 RETIRE_APPLICATION_CONFLICT
    // 3. 提示信息 "资产已存在进行中的报废流程"
  });
});
```

### 4.4 ATB-4: 报废原因必填校验

**测试场景**: 提交报废申请时未填写原因或原因过短

```typescript
describe('ATB-4: 报废原因必填校验', () => {
  test.each([
    { reason: '', expected: 'RETIRE_REASON_REQUIRED' },
    { reason: '太旧了', expected: 'RETIRE_REASON_TOO_SHORT' },
  ])('原因 "$reason" 应返回错误 $expected', async ({ reason, expected }) => {
    // 物理测试期待:
    // 1. POST /api/v1/assets/{asset_id}/retire 返回 400
    // 2. 对应错误码
  });
});
```

### 4.5 ATB-5: 权限校验

**测试场景**: 非资产责任人用户尝试发起报废申请

```typescript
describe('ATB-5: 权限校验', () => {
  test('非责任人应无法发起报废申请', async ({ page }) => {
    // 物理测试期待:
    // 1. POST /api/v1/assets/{asset_id}/retire 返回 403
    // 2. 错误码 PERMISSION_DENIED
  });
});
```

### 4.6 ATB-6: 资产不存在场景

**测试场景**: 针对不存在的资产 ID 发起报废申请

```typescript
describe('ATB-6: 资产不存在场景', () => {
  test('应返回404资产不存在', async ({ page }) => {
    // 物理测试期待:
    // 1. POST /api/v1/assets/{nonexistent_id}/retire 返回 404
    // 2. 错误码 ASSET_NOT_FOUND
  });
});
```

### 4.7 ATB-7: 申请单查询接口

**测试场景**: 报废申请创建后，支持通过 ID 查询详情

```typescript
describe('ATB-7: 申请单查询接口', () => {
  test('应能查询申请单详情', async ({ page }) => {
    // 物理测试期待:
    // 1. GET /api/v1/retire-applications/{id} 返回 200
    // 2. 响应包含申请单完整信息
    // 3. 状态与申请时一致
  });
});
```

---

## 5. 开发切入层级序列

### 5.1 层级一：Schema 层（优先）

```
src/api/schemas/
├── retirement_request.py      # 报废申请请求Schema
└── retirement_response.py     # 报废申请响应Schema
```

**交付物**:

| 文件 | 类/函数 | 职责 |
|------|---------|------|
| `retirement_request.py` | `RetirementApplicationRequest` | 请求体验证 |
| `retirement_request.py` | `validate_retirement_request()` | 请求体校验函数 |
| `retirement_response.py` | `RetirementApplicationResponse` | 成功响应结构 |
| `retirement_response.py` | `RetirementApplicationListResponse` | 列表响应结构 |
| `retirement_response.py` | `RetirementErrorResponse` | 错误响应结构 |

### 5.2 层级二：Domain 层

```
src/domain/
├── entities/
│   └── retirement_request.py  # 报废申请实体
├── services/
│   └── retirement_service.py  # 报废服务
└── state_machine/
    └── retirement_state_machine.py  # 状态机
```

**交付物**:

| 文件 | 类/函数 | 职责 |
|------|---------|------|
| `retirement_request.py` | `RetirementRequest` | 领域实体 |
| `retirement_service.py` | `RetirementService` | 业务服务 |
| `retirement_service.py` | `create_application()` | 创建申请 |
| `retirement_service.py` | `validate_eligibility()` | 资格校验 |
| `retirement_state_machine.py` | `RetirementStateMachine` | 状态流转 |

### 5.3 层级三：API 层

```
src/api/
├── routes/
│   └── retirement_routes.py   # 路由定义
└── dependencies/
    └── auth.py                # 认证依赖
```

**交付物**:

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/assets/{asset_id}/retire` | POST | 发起报废申请 |
| `/api/v1/retire-applications/{id}` | GET | 查询申请详情 |
| `/api/v1/assets/{asset_id}/retire-applications` | GET | 查询资产报废历史 |

### 5.4 层级四：测试层

```
frontend/tests/e2e/
├── retirement_flow.spec.ts    # 退役流程E2E测试
└── dashboard.spec.ts         # 仪表盘相关测试

tests/integration/
└── test_retirement_api.py     # API集成测试
```

**交付物**:

| 文件 | 测试内容 |
|------|----------|
| `retirement_flow.spec.ts` | ATB-1 ~ ATB-7 完整覆盖 |
| `dashboard.spec.ts` | 仪表盘交互测试 |
| `test_retirement_api.py` | API接口集成测试 |

---

## 6. 数据模型定义

### 6.1 RetirementApplication（报废申请单）

```python
class RetirementApplication(BaseModel):
    """
    报废申请单
    
    对应数据库表: retirement_applications
    """
    id: UUID                           # 主键
    application_no: str                # 申请单编号，格式: RET-{YYYYMMDD}-{6位}
    asset_id: UUID                     # 关联资产ID
    applicant_id: UUID                # 申请人ID
    reason: str                        # 报废原因
    description: Optional[str]        # 补充说明
    attachments: List[str]             # 附件URL列表
    status: RetirementStatus           # 申请状态
    created_at: datetime               # 创建时间
    updated_at: datetime               # 更新时间
```

### 6.2 状态枚举（RetirementStatus）

```python
class RetirementStatus(str, Enum):
    """
    报废申请状态枚举
    """
    PENDING = "PENDING"           # 待审批
    APPROVED = "APPROVED"         # 已审批通过
    REJECTED = "REJECTED"         # 已驳回
    CANCELLED = "CANCELLED"       # 已撤回
    IN_PROGRESS = "IN_PROGRESS"   # 处置中
    COMPLETED = "COMPLETED"       # 已完成
```

### 6.3 资产状态（AssetStatus）

```python
class AssetStatus(str, Enum):
    """
    资产状态枚举
    """
    IN_USE = "IN_USE"             # 使用中
    IDLE = "IDLE"                 # 闲置
    IN_TRANSFER = "IN_TRANSFER"   # 调拨中
    MAINTENANCE = "MAINTENANCE"   # 维护中
    PENDING_RETIRE = "PENDING_RETIRE"  # 待报废
    RETIRED = "RETIRED"           # 已报废
```

---

## 7. API 规格

### 7.1 POST /api/v1/assets/{asset_id}/retire

**发起报废申请**

#### 请求

```http
POST /api/v1/assets/123e4567-e89b-12d3-a456-426614174000/retire
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "设备老旧无法修复，需报废处理",
  "description": "经维修评估，修复成本超过资产原值50%",
  "attachments": [
    "https://storage.example.com/attaches/maintenance-report.pdf"
  ]
}
```

#### 成功响应 (201 Created)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "application_id": "550e8400-e29b-41d4-a716-446655440000",
    "application_no": "RET-20240115-A3B7C9",
    "asset_id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "PENDING",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

#### 错误响应

| 状态码 | 错误码 | 说明 |
|--------|--------|------|
| 400 | `RETIRE_STATUS_NOT_ALLOWED` | 资产当前状态不允许报废 |
| 400 | `RETIRE_REASON_REQUIRED` | 报废原因为空 |
| 400 | `RETIRE_REASON_TOO_SHORT` | 报废原因少于10字符 |
| 403 | `PERMISSION_DENIED` | 无操作权限 |
| 404 | `ASSET_NOT_FOUND` | 资产不存在 |
| 409 | `RETIRE_APPLICATION_CONFLICT` | 已存在进行中的报废申请 |

### 7.2 GET /api/v1/retire-applications/{id}

**查询申请单详情**

#### 请求

```http
GET /api/v1/retire-applications/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {token}
```

#### 成功响应 (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "application_id": "550e8400-e29b-41d4-a716-446655440000",
    "application_no": "RET-20240115-A3B7C9",
    "asset_id": "123e4567-e89b-12d3-a456-426614174000",
    "asset_name": "Dell PowerEdge R740 服务器",
    "applicant_id": "user-001",
    "applicant_name": "张三",
    "reason": "设备老旧无法修复，需报废处理",
    "description": "经维修评估，修复成本超过资产原值50%",
    "attachments": [
      "https://storage.example.com/attaches/maintenance-report.pdf"
    ],
    "status": "PENDING",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

---

## 8. 错误码定义

| 错误码 | 常量名 | HTTP状态 | 说明 |
|--------|--------|----------|------|
| 40001 | `RETIRE_STATUS_NOT_ALLOWED` | 400 | 资产当前状态不允许报废 |
| 40002 | `RETIRE_REASON_REQUIRED` | 400 | 报废原因为空 |
| 40003 | `RETIRE_REASON_TOO_SHORT` | 400 | 报废原因长度不足 |
| 40004 | `RETIRE_INVALID_ATTACHMENT` | 400 | 附件格式或大小不符合要求 |
| 40301 | `PERMISSION_DENIED` | 403 | 无操作权限 |
| 40401 | `ASSET_NOT_FOUND` | 404 | 资产不存在 |
| 40901 | `RETIRE_APPLICATION_CONFLICT` | 409 | 已存在进行中的报废申请 |

---

## 9. 风险项与依赖说明

### 9.1 风险项

| 风险项 | 影响 | 缓解措施 |
|--------|------|----------|
| Phase 1 状态枚举未完成 | 无法进行状态校验开发 | 先行定义枚举常量，待 Phase 1 完成后对齐 |
| 审批链路依赖 Phase 3 | 本期仅完成申请提交，审批功能后续迭代 | 接口设计预留审批字段 |
| 资产服务尚未封装 | 状态查询依赖不稳定 | 使用 Mock 进行单元测试 |
| E2E 测试环境依赖 | 测试环境可能不稳定 | 配置测试环境检查机制 |

### 9.2 依赖项追踪

| 依赖项 | 类型 | 状态 | 备注 |
|--------|------|------|------|
| `AssetStatus` 枚举 | 内部 | ✅ 已完成 | Phase 1 |
| `RetirementStatus` 枚举 | 内部 | ✅ 已完成 | Phase 1 |
| `RetirementRequest` 实体 | 内部 | ✅ 已完成 | Domain层 |
| `RetirementService` | 内部 | ✅ 已完成 | Service层 |
| `ApprovalService` | 内部 | ⏳ 待 Phase 3 | 预留接口 |
| 用户权限模块 | 外部 | ✅ 已完成 | 可复用 |

---

## 10. 验收检查清单

### 10.1 AC 验收对照表

| AC ID | 验收项 | 验证方式 | 通过标准 |
|-------|--------|----------|----------|
| AC-001 | 用户可以对资产发起报废申请 | unit_test | 所有申请场景测试通过 |
| AC-002 | 系统自动校验资产状态 | unit_test | 状态校验逻辑测试通过 |
| AC-003 | 代码无语法错误 | static_analysis | AST静态检查通过 |
| AC-004 | 函数包含docstring | static_analysis | 文档覆盖率达到100% |
| AC-005 | 模块可正常import | unit_test | 无ImportError |

### 10.2 文件变更检查

- [ ] `src/api/schemas/retirement_request.py` - Schema定义完成
- [ ] `src/api/schemas/retirement_response.py` - 响应结构定义完成
- [ ] `frontend/tests/e2e/dashboard.spec.ts` - 仪表盘测试补充
- [ ] `frontend/tests/e2e/retirement_flow.spec.ts` - 退役流程测试补充
- [ ] `frontend/src/app/pages/AuditDashboard/AuditDashboard.module.css` - 样式文件更新

### 10.3 测试覆盖率目标

| 类型 | 目标覆盖率 |
|------|------------|
| 单元测试 | ≥ 80% |
| 集成测试 | 核心路径100% |
| E2E测试 | ATB场景100%覆盖 |

---

## 11. 附录

### 11.1 参考文档

- [资产状态机设计](./state_machine/retirement_state_machine.md)
- [报废流程UML图](./uml/retirement_flow.md)
- [API接口文档](./api/retirement_api.md)

### 11.2 相关迭代

| 迭代 | 范围 | 状态 |
|------|------|------|
| Iteration 1 (本期) | Phase 2 - 报废申请与状态校验 | 进行中 |
| Iteration 2 | Phase 3 - 处置记录与审批集成 | 待开始 |
| Iteration 3 | Phase 4 - 状态变更与通知 | 待开始 |

### 11.3 变更日志

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2024-01-15 | v1.0 | 初始版本创建 | System |