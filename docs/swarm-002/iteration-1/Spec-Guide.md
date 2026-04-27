# SWARM-002 资产报废退役流程规格指导文档

**版本**: v1.0  
**迭代**: Iteration 1  
**状态**: 进行中  
**关联 Phase**: Phase 2（报废申请与状态校验）  
**文档路径**: `src/api/routes/retirement_routes.py`

---

## 1. 需求与背景

### 1.1 业务场景

资产管理系统需支持资产的全生命周期管理。当资产到达生命周期末端或因损毁、闲置等原因需退出使用序列时，需通过规范的报废退役流程进行处置，确保资产账实相符、审批合规可追溯。

### 1.2 功能目标

| 功能点 | 描述 | 关联模块 |
|--------|------|----------|
| 报废申请发起 | 用户可对目标资产提交报废申请，填写报废原因及附件 | `retirement_routes.py` |
| 状态自动校验 | 系统在校验资产当前状态是否符合报废前置条件 | `src/services/retirement_service.py` |
| 处置记录生成 | 审批通过后自动生成资产处置流水记录 | 下期目标 |
| 审批链路触发 | 根据资产价值/类别匹配对应审批流程 | 下期目标 |
| 生命周期状态更新 | 报废完成后更新资产状态为"已报废"，标记退役 | 下期目标 |

### 1.3 核心实体（已完成）

| 实体 | 路径 | 职责 |
|------|------|------|
| `RetirementRequest` | `src/domain/entities/retirement_request.py` | 报废申请核心实体 |
| `ApprovalStep` | `src/domain/entities/approval_stage.py` | 审批步骤定义 |
| `RetirementStateMachine` | `src/domain/state_machine/retirement_state_machine.py` | 状态机流转控制 |
| `Asset` | `src/domain/entities/asset.py` | 资产实体 |

### 1.4 核心服务（已完成）

| 服务 | 路径 | 职责 |
|------|------|------|
| `RetirementService` | `src/services/retirement_service.py` | 报废业务逻辑编排 |
| `ApprovalService` | `src/services/approval_service.py` | 审批流程管理 |
| `ScrapService` | `src/services/scrap_service.py` | 报废处置服务 |
| `NotificationService` | `src/services/notification_service.py` | 通知服务 |
| `AssetValidator` | `src/services/validators/asset_validator.py` | 资产校验器 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解（参照 plan.md）

| Phase | 名称 | 实施范围 | 状态 |
|-------|------|----------|------|
| Phase 1 | 数据模型与状态定义 | 资产状态枚举、生命周期阶段模型 | ✅ 已完成 |
| **Phase 2** | **报废申请与状态校验** | **报废申请接口、状态前置校验逻辑** | **本期目标** |
| Phase 3 | 处置记录与审批集成 | 处置记录生成、审批链路触发 | 下期目标 |
| Phase 4 | 状态变更与通知 | 生命周期状态更新、通知机制 | 下期目标 |

### 2.2 本期具体目标（Phase 2）

#### 2.2.1 报废申请接口开发

- **接口路径**: `POST /api/v1/assets/{asset_id}/retire`
- **实现文件**: `src/api/routes/retirement_routes.py`
- **请求体 Schema**: `src/api/schemas/retirement_request.py`

```python
# src/api/routes/retirement_routes.py - 核心路由定义
from fastapi import APIRouter, Depends, Path
from src.api.schemas.retirement_request import CreateRetireApplicationRequest
from src.api.schemas.retirement_response import RetireApplicationResponse
from src.services.retirement_service import RetirementService
from src.api.deps.auth import get_current_user

router = APIRouter(prefix="/api/v1/assets", tags=["资产报废"])

@router.post("/{asset_id}/retire", response_model=RetireApplicationResponse, status_code=201)
async def create_retire_application(
    asset_id: str = Path(..., description="资产ID"),
    request: CreateRetireApplicationRequest = ...,
    current_user = Depends(get_current_user),
    service: RetirementService = Depends()
) -> RetireApplicationResponse:
    """
    发起资产报废申请
    
    - 校验资产状态是否允许报废
    - 校验用户权限
    - 创建报废申请单
    """
    return await service.create_retire_application(
        asset_id=asset_id,
        applicant_id=current_user.id,
        reason=request.reason,
        description=request.description,
        attachments=request.attachments
    )
```

#### 2.2.2 资产状态校验逻辑

| 校验项 | 校验规则 | 错误码 | 错误信息 |
|--------|----------|--------|----------|
| 资产存在性 | 资产ID在系统中存在 | `ASSET_NOT_FOUND` | 资产不存在 |
| 资产状态 | 状态必须为 `IN_USE` 或 `IDLE` | `RETIRE_STATUS_NOT_ALLOWED` | 资产当前状态不允许报废 |
| 流程冲突 | 不存在 `PENDING_RETIRE` 状态的进行中流程 | `RETIRE_APPLICATION_CONFLICT` | 资产已存在进行中的报废流程 |
| 报废原因 | 必填，最小长度 10 字符 | `RETIRE_REASON_TOO_SHORT` | 报废原因不少于10字符 |
| 用户权限 | 仅责任人或管理员可发起 | `PERMISSION_DENIED` | 无操作权限 |

#### 2.2.3 报废申请单数据模型

```python
# src/domain/entities/retirement_request.py
@dataclass
class RetirementRequest:
    id: str                              # UUID 主键
    application_no: str                  # 申请单编号 RET-{YYYYMMDD}-{6位随机数}
    asset_id: str                        # 关联资产ID
    applicant_id: str                    # 申请人ID
    reason: str                          # 报废原因（必填，≥10字符）
    description: Optional[str]           # 补充说明
    attachments: List[str]               # 附件URL列表
    status: RetirementStatus             # 申请状态
    created_at: datetime                 # 创建时间
    updated_at: datetime                 # 更新时间
```

---

## 3. 边界约束

### 3.1 业务规则约束

| 约束编号 | 约束内容 | 违规响应 | 关联验证器 |
|----------|----------|----------|------------|
| C-001 | 资产状态必须为 `IN_USE` 或 `IDLE` 才能发起报废申请 | 400: `RETIRE_STATUS_NOT_ALLOWED` | `AssetValidator.validate_retire_eligibility()` |
| C-002 | 资产不可存在 `PENDING_RETIRE` 或 `RETIRED` 状态的进行中流程 | 409: `RETIRE_APPLICATION_CONFLICT` | `RetirementService._check_pending_application()` |
| C-003 | 报废原因 `reason` 字段必填，最小长度 10 字符 | 400: `RETIRE_REASON_TOO_SHORT` | `CreateRetireApplicationRequest` |
| C-004 | 仅资产责任人或管理员可发起报废申请 | 403: `PERMISSION_DENIED` | `get_current_user()` + 权限校验 |
| C-005 | 单次报废申请仅针对单一资产，不支持批量 | 业务约束 | 前端表单限制 |

### 3.2 数据约束

| 约束编号 | 约束内容 |
|----------|----------|
| D-001 | 报废申请单编号格式：`RET-{YYYYMMDD}-{6位随机数}` |
| D-002 | 申请时间以服务器时间戳为准，格式 ISO 8601 |
| D-003 | 附件支持 PDF/图片格式，单文件最大 10MB |
| D-004 | 报废原因最大长度 500 字符 |

### 3.3 外部依赖约束

| 约束编号 | 约束内容 | 影响说明 |
|----------|----------|----------|
| E-001 | 依赖 Phase 1 的资产状态枚举定义 | 状态值需保持一致 |
| E-002 | 依赖用户权限模块的用户身份校验 | 权限校验结果决定接口放行 |
| E-003 | 依赖 `AssetService.get_asset_by_id()` | 资产查询服务 |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 报废申请接口正常提交流程

**测试场景**: 资产状态为 `IN_USE`，用户为资产责任人，发起报废申请

```python
# tests/api/test_retirement_api.py
def test_retire_application_success():
    """
    ATB-1: 报废申请接口正常提交流程
    
    物理测试期待:
    1. POST /api/v1/assets/{asset_id}/retire 返回 201
    2. 响应体包含 retire_application_id
    3. 响应体包含 application_no (格式 RET-YYYYMMDD-XXXXXX)
    4. 响应体 status 为 PENDING
    5. 数据库 retire_applications 表插入新记录
    6. 数据库 assets 表状态未变更（等待审批后变更）
    """
    asset_id = create_test_asset(status="IN_USE", owner_id="user_001")
    
    response = client.post(
        f"/api/v1/assets/{asset_id}/retire",
        json={
            "reason": "设备老旧无法修复，需报废处理",
            "description": "经维修评估，修复成本超过资产原值50%",
            "attachments": []
        }
    )
    
    # 断言
    assert response.status_code == 201
    data = response.json()
    assert "retire_application_id" in data["data"]
    assert data["data"]["application_no"].startswith("RET-")
    assert data["data"]["status"] == "PENDING"
    
    # 数据库验证
    db_record = db.query(RetirementApplication).filter_by(asset_id=asset_id).first()
    assert db_record is not None
    assert db_record.reason == "设备老旧无法修复，需报废处理"
```

### 4.2 ATB-2: 资产状态校验 - 不允许报废状态

**测试场景**: 资产状态为 `RETIRED`，尝试发起报废申请

```python
def test_retire_application_invalid_status():
    """
    ATB-2: 资产状态校验 - 不允许报废状态
    
    物理测试期待:
    1. POST /api/v1/assets/{asset_id}/retire 返回 400
    2. 错误码 RETIRE_STATUS_NOT_ALLOWED
    3. 错误信息包含"资产当前状态不允许报废"
    4. 数据库无新增记录
    """
    asset_id = create_test_asset(status="RETIRED")
    
    response = client.post(
        f"/api/v1/assets/{asset_id}/retire",
        json={"reason": "设备老旧无法修复，需报废处理"}
    )
    
    assert response.status_code == 400
    assert response.json()["code"] == "RETIRE_STATUS_NOT_ALLOWED"
    
    # 数据库验证
    db_count = db.query(RetirementApplication).filter_by(asset_id=asset_id).count()
    assert db_count == 0
```

### 4.3 ATB-3: 重复报废申请校验

**测试场景**: 资产已存在 `PENDING_RETIRE` 状态的申请，再次发起申请

```python
def test_retire_application_duplicate_conflict():
    """
    ATB-3: 重复报废申请校验
    
    物理测试期待:
    1. POST /api/v1/assets/{asset_id}/retire 返回 409
    2. 错误码 RETIRE_APPLICATION_CONFLICT
    3. 提示"资产已存在进行中的报废流程"
    4. 数据库记录数不增加
    """
    asset_id = create_test_asset_with_pending_retire()
    
    response = client.post(
        f"/api/v1/assets/{asset_id}/retire",
        json={"reason": "设备老旧无法修复，需报废处理"}
    )
    
    assert response.status_code == 409
    assert response.json()["code"] == "RETIRE_APPLICATION_CONFLICT"
    assert "进行中的报废流程" in response.json()["message"]
```

### 4.4 ATB-4: 报废原因必填校验

**测试场景**: 提交报废申请时未填写原因或原因过短

```python
@pytest.mark.parametrize("reason,expected_code,expected_msg", [
    ("", "RETIRE_REASON_REQUIRED", "报废原因必填"),
    ("太旧了", "RETIRE_REASON_TOO_SHORT", "报废原因不少于10字符"),
    ("设备故障", "RETIRE_REASON_TOO_SHORT", "报废原因不少于10字符"),
])
def test_retire_application_reason_validation(reason, expected_code, expected_msg):
    """
    ATB-4: 报废原因必填校验
    
    物理测试期待:
    1. POST /api/v1/assets/{asset_id}/retire 返回 400
    2. 对应错误码 RETIRE_REASON_REQUIRED 或 RETIRE_REASON_TOO_SHORT
    3. 错误信息包含预期提示
    """
    asset_id = create_test_asset(status="IN_USE")
    
    response = client.post(
        f"/api/v1/assets/{asset_id}/retire",
        json={"reason": reason}
    )
    
    assert response.status_code == 400
    assert response.json()["code"] == expected_code
    assert expected_msg in response.json()["message"]
```

### 4.5 ATB-5: 权限校验 - 非资产责任人

**测试场景**: 非资产责任人用户尝试发起报废申请

```python
def test_retire_application_unauthorized():
    """
    ATB-5: 权限校验 - 非资产责任人
    
    物理测试期待:
    1. POST /api/v1/assets/{asset_id}/retire 返回 403
    2. 错误码 PERMISSION_DENIED
    3. 数据库无新增记录
    """
    asset_id = create_test_asset(status="IN_USE", owner_id="user_A")
    auth_header = get_auth_header(user_id="user_B")
    
    response = client.post(
        f"/api/v1/assets/{asset_id}/retire",
        json={"reason": "设备老旧无法修复，需报废处理"},
        headers=auth_header
    )
    
    assert response.status_code == 403
    assert response.json()["code"] == "PERMISSION_DENIED"
```

### 4.6 ATB-6: 资产不存在场景

**测试场景**: 针对不存在的资产 ID 发起报废申请

```python
def test_retire_application_asset_not_found():
    """
    ATB-6: 资产不存在场景
    
    物理测试期待:
    1. POST /api/v1/assets/{nonexistent_id}/retire 返回 404
    2. 错误码 ASSET_NOT_FOUND
    """
    response = client.post(
        "/api/v1/assets/nonexistent-asset-id/retire",
        json={"reason": "设备老旧无法修复，需报废处理"}
    )
    
    assert response.status_code == 404
    assert response.json()["code"] == "ASSET_NOT_FOUND"
```

### 4.7 ATB-7: 申请单查询接口

**测试场景**: 报废申请创建后，支持通过 ID 查询详情

```python
def test_retire_application_query():
    """
    ATB-7: 申请单查询接口
    
    物理测试期待:
    1. GET /api/v1/retire-applications/{id} 返回 200
    2. 响应包含申请单完整信息 (application_no, asset_id, status, reason, created_at)
    """
    app = create_retire_application()
    
    response = client.get(f"/api/v1/retire-applications/{app.id}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PENDING"
    assert data["asset_id"] == app.asset_id
    assert data["reason"] == app.reason
    assert "application_no" in data
```

---

## 5. 开发切入层级序列

### 5.1 层级一：Schema 层（优先实现）

```
src/
└── api/
    ├── schemas/
    │   ├── retirement_request.py    # 报废申请请求 Schema
    │   └── retirement_response.py   # 报废申请响应 Schema
```

**交付物**:
- `CreateRetireApplicationRequest`: 请求体验证模型
- `RetireApplicationResponse`: 响应数据模型

### 5.2 层级二：路由层（核心）

```
src/
└── api/
    └── routes/
        └── retirement_routes.py      # 报废相关 API 路由
```

**交付物**:
- `POST /api/v1/assets/{asset_id}/retire` - 发起报废申请
- `GET /api/v1/retire-applications/{id}` - 查询申请详情
- `GET /api/v1/assets/{asset_id}/retire-applications` - 查询资产报废历史

### 5.3 层级三：服务层（业务编排）

```
src/
└── services/
    ├── retirement_service.py         # 报废业务服务层
    └── validators/
        └── asset_validator.py        # 资产校验器
```

**交付物**:
- `RetirementService.create_retire_application()` - 创建报废申请
- `RetirementService.validate_asset_retire_eligibility()` - 资产报废资格校验
- `RetirementService._check_pending_application()` - 进行中流程校验

### 5.4 层级四：领域层（核心实体）

```
src/
├── domain/
│   ├── entities/
│   │   └── retirement_request.py     # 报废申请单实体
│   └── state_machine/
│       └── retirement_state_machine.py # 状态机
```

**交付物**:
- `RetirementRequest` 实体类
- `RetirementStateMachine` 状态转换逻辑

### 5.5 层级五：仓储层（数据持久化）

```
src/
└── repositories/
    └── retirement_repository.py      # 报废申请仓储
```

**交付物**:
- `RetirementRepository.create()` - 创建报废申请
- `RetirementRepository.find_by_asset_id()` - 按资产查询
- `RetirementRepository.find_pending()` - 查询进行中的申请

---

## 6. API 规格

### 6.1 POST /api/v1/assets/{asset_id}/retire

**功能**: 发起资产报废申请

**路径参数**:
| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| asset_id | string | 是 | 资产ID |

**请求体**:
```json
{
  "reason": "string (必填, ≥10字符, ≤500字符)",
  "description": "string (选填)",
  "attachments": ["string"] (选填, URL数组)
}
```

**成功响应 (201)**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "retire_application_id": "550e8400-e29b-41d4-a716-446655440000",
    "application_no": "RET-20240115-A3B7C9",
    "asset_id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "PENDING",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**错误响应**:

| 状态码 | 错误码 | 错误信息 |
|--------|--------|----------|
| 400 | `RETIRE_REASON_REQUIRED` | 报废原因必填 |
| 400 | `RETIRE_REASON_TOO_SHORT` | 报废原因不少于10字符 |
| 400 | `RETIRE_STATUS_NOT_ALLOWED` | 资产当前状态不允许报废 |
| 403 | `PERMISSION_DENIED` | 无操作权限 |
| 404 | `ASSET_NOT_FOUND` | 资产不存在 |
| 409 | `RETIRE_APPLICATION_CONFLICT` | 资产已存在进行中的报废流程 |

### 6.2 GET /api/v1/retire-applications/{id}

**功能**: 查询报废申请详情

**路径参数**:
| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| id | string | 是 | 报废申请ID |

**成功响应 (200)**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "application_no": "RET-20240115-A3B7C9",
    "asset_id": "123e4567-e89b-12d3-a456-426614174000",
    "applicant_id": "user-001",
    "reason": "设备老旧无法修复，需报废处理",
    "description": "经维修评估",
    "attachments": [],
    "status": "PENDING",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

---

## 7. 数据模型定义

### 7.1 RetirementRequest（报废申请单）

| 字段 | 类型 | 约束 | 描述 |
|------|------|------|------|
| id | UUID | PK, NOT NULL | 主键 |
| application_no | VARCHAR(30) | UNIQUE, NOT NULL | 申请单编号 |
| asset_id | UUID | FK, NOT NULL, INDEX | 关联资产ID |
| applicant_id | UUID | NOT NULL | 申请人ID |
| reason | VARCHAR(500) | NOT NULL | 报废原因 |
| description | TEXT | NULLABLE | 补充说明 |
| attachments | JSON | DEFAULT '[]' | 附件URL列表 |
| status | ENUM | NOT NULL, DEFAULT 'PENDING' | 申请状态 |
| created_at | TIMESTAMP | NOT NULL | 创建时间 |
| updated_at | TIMESTAMP | NOT NULL | 更新时间 |

### 7.2 状态枚举（RetirementStatus）

| 状态值 | 描述 | 可转换到 |
|--------|------|----------|
| `PENDING` | 待审批 | `APPROVED`, `REJECTED`, `CANCELLED` |
| `APPROVED` | 已审批通过 | - |
| `REJECTED` | 已驳回 | - |
| `CANCELLED` | 已撤回 | - |

### 7.3 资产状态（AssetStatus）

| 状态值 | 描述 | 可发起报废 |
|--------|------|-------------|
| `IN_USE` | 在用 | ✅ |
| `IDLE` | 闲置 | ✅ |
| `RETIRED` | 已报废 | ❌ |
| `DISPOSED` | 已处置 | ❌ |

---

## 8. 异常定义

### 8.1 业务异常

| 异常类 | 错误码 | HTTP状态码 |
|--------|--------|------------|
| `AssetNotFoundException` | `ASSET_NOT_FOUND` | 404 |
| `RetireStatusNotAllowedException` | `RETIRE_STATUS_NOT_ALLOWED` | 400 |
| `RetireApplicationConflictException` | `RETIRE_APPLICATION_CONFLICT` | 409 |
| `RetireReasonTooShortException` | `RETIRE_REASON_TOO_SHORT` | 400 |
| `PermissionDeniedException` | `PERMISSION_DENIED` | 403 |

### 8.2 状态机异常

| 异常类 | 错误码 | 描述 |
|--------|--------|------|
| `StateTransitionException` | `INVALID_STATE_TRANSITION` | 非法的状态转换 |
| `ApprovalStepNotReachableException` | `APPROVAL_STEP_NOT_REACHABLE` | 审批步骤不可达 |

---

## 9. 风险项与依赖说明

### 9.1 风险项

| 风险项 | 影响 | 缓解措施 | 责任人 |
|--------|------|----------|--------|
| Phase 1 状态枚举未完成 | 无法进行状态校验开发 | 先行定义枚举常量，待 Phase 1 完成后对齐 | Backend Lead |
| 审批链路依赖 Phase 3 | 本期仅完成申请提交，审批功能后续迭代 | 接口设计预留审批字段 | Backend Lead |
| 资产服务尚未封装 | 状态查询依赖不稳定 | 使用 Mock 进行单元测试 | Backend Dev |

### 9.2 外部依赖

| 依赖模块 | 路径 | 用途 |
|----------|------|------|
| `AssetValidator` | `src/services/validators/asset_validator.py` | 资产状态校验 |
| `RetirementRepository` | `src/repositories/retirement_repository.py` | 数据持久化 |
| `AssetService` | `src/services/asset_service.py` | 资产查询服务 |
| `AuthService` | `src/services/auth_service.py` | 用户认证服务 |

### 9.3 待集成项（下期目标）

| 模块 | 描述 | 优先级 |
|------|------|--------|
| `ApprovalService` | 审批流程触发 | P0 |
| `NotificationService` | 报废申请通知 | P1 |
| `LifecycleRecorder` | 生命周期状态更新 | P0 |

---

## 10. AC 验收清单

| AC ID | 验收标准 | 验证方法 | 状态 |
|-------|----------|----------|------|
| AC-001 | 资产报废申请功能完整实现 | `unit_test` | 待验证 |
| AC-002 | 状态校验逻辑正确执行 | `unit_test` | 待验证 |
| AC-003 | 代码无语法错误 | `static_analysis` (AST) | 待验证 |
| AC-004 | 函数包含 docstring | `static_analysis` | 待验证 |
| AC-005 | 模块可正常 import | `unit_test` | 待验证 |

---

## 附录

### A. 文件变更清单

| 文件路径 | 变更类型 | 描述 |
|----------|----------|------|
| `src/api/routes/retirement_routes.py` | 修改 | 核心路由实现 |
| `src/api/schemas/retirement_request.py` | 修改 | 请求 Schema |
| `src/api/schemas/retirement_response.py` | 修改 | 响应 Schema |
| `tests/api/test_retirement_api.py` | 新增 | API 单元测试 |
| `tests/e2e/retirement_flow.spec.ts` | 修改 | E2E 测试 |
| `frontend/tests/e2e/dashboard.spec.ts` | 修改 | 前端测试 |
| `frontend/src/app/pages/AuditDashboard/AuditDashboard.module.css` | 修改 | CSS 样式 |

### B. 相关文档

| 文档 | 路径 |
|------|------|
| 状态机规格 | `src/domain/state_machine/retirement_state_machine.py` |
| 服务层规格 | `src/services/retirement_service.py` |
| 测试模板 | `docs/testing/templates/E2ETestTemplate.spec.ts` |

---

**文档版本历史**

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2024-01-15 | 初始版本 | System |