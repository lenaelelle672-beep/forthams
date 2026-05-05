# SWARM-002 资产报废退役流程规格指导文档

**版本**: v1.0  
**迭代**: Iteration 1  
**状态**: 进行中  
**关联 Phase**: Phase 2（报废申请与状态校验）  
**最后更新**: 2025-01-15

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
| 生命周期状态更新 | 报废完成后更新资产状态为"已报废"，标记退役 | P1 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 参照 plan.md Phase 拆解

| Phase | 名称 | 实施范围 | 状态 |
|-------|------|----------|------|
| Phase 1 | 数据模型与状态定义 | 资产状态枚举、生命周期阶段模型 | ✅ 已完成 |
| **Phase 2** | **报废申请与状态校验** | **报废申请接口、状态前置校验逻辑** | **本期目标** |
| Phase 3 | 处置记录与审批集成 | 处置记录生成、审批链路触发 | 下期目标 |
| Phase 4 | 状态变更与通知 | 生命周期状态更新、通知机制 | 下期目标 |

### 2.2 本期具体目标（Phase 2）

1. **报废申请接口开发**
   - POST `/api/v1/assets/{asset_id}/retire` 接口实现
   - 请求体包含：`reason`（必填）、`description`（选填）、`attachments`（选填）

2. **资产状态校验逻辑**
   - 校验资产是否存在
   - 校验资产当前状态是否为可报废状态
   - 校验资产是否已存在进行中的报废流程

3. **报废申请单数据模型**
   - 记录申请人、申请时间、报废原因
   - 关联资产信息与处置意向

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

---

## 4. 验收测试基准 (ATB)

### ATB-1: 报废申请接口正常提交流程

**测试场景**: 资产状态为 `IN_USE`，用户为资产责任人，发起报废申请

```python
def test_retire_application_success():
    """
    ATB-1: 报废申请接口正常提交流程
    
    物理测试期待:
    1. POST /api/v1/assets/{asset_id}/retire 返回 201
    2. 响应体包含 retire_application_id
    3. 数据库 assets 表状态未变更（等待审批后变更）
    4. 数据库 retire_applications 表插入新记录
    """
    asset_id = create_test_asset(status="IN_USE")
    response = client.post(
        f"/api/v1/assets/{asset_id}/retire",
        json={"reason": "设备老旧无法修复，需报废处理"}
    )
    assert response.status_code == 201
    assert "retire_application_id" in response.json()
```

### ATB-2: 资产状态校验 - 不允许报废状态

**测试场景**: 资产状态为 `RETIRED`，尝试发起报废申请

```python
def test_retire_application_invalid_status():
    """
    ATB-2: 资产状态校验 - 不允许报废状态
    
    物理测试期待:
    1. POST /api/v1/assets/{asset_id}/retire 返回 400
    2. 错误码 RETIRE_STATUS_NOT_ALLOWED
    3. 数据库无新增记录
    """
    asset_id = create_test_asset(status="RETIRED")
    response = client.post(
        f"/api/v1/assets/{asset_id}/retire",
        json={"reason": "设备老旧无法修复，需报废处理"}
    )
    assert response.status_code == 400
    assert response.json()["code"] == "RETIRE_STATUS_NOT_ALLOWED"
```

### ATB-3: 重复报废申请校验

**测试场景**: 资产已存在 `PENDING_RETIRE` 状态的申请，再次发起申请

```python
def test_retire_application_duplicate_conflict():
    """
    ATB-3: 重复报废申请校验
    
    物理测试期待:
    1. POST /api/v1/assets/{asset_id}/retire 返回 409
    2. 错误码 RETIRE_APPLICATION_CONFLICT
    3. 提示"资产已存在进行中的报废流程"
    """
    asset_id = create_test_asset_with_pending_retire()
    response = client.post(
        f"/api/v1/assets/{asset_id}/retire",
        json={"reason": "设备老旧无法修复，需报废处理"}
    )
    assert response.status_code == 409
    assert response.json()["code"] == "RETIRE_APPLICATION_CONFLICT"
```

### ATB-4: 报废原因必填校验

**测试场景**: 提交报废申请时未填写原因或原因过短

```python
@pytest.mark.parametrize("reason,expected_code", [
    ("", "RETIRE_REASON_REQUIRED"),           # 空字符串
    ("太旧了", "RETIRE_REASON_TOO_SHORT"),    # 不足10字符
])
def test_retire_application_reason_validation(reason, expected_code):
    """
    ATB-4: 报废原因必填校验
    
    物理测试期待:
    1. POST /api/v1/assets/{asset_id}/retire 返回 400
    2. 对应错误码 RETIRE_REASON_REQUIRED 或 RETIRE_REASON_TOO_SHORT
    """
    asset_id = create_test_asset(status="IN_USE")
    response = client.post(
        f"/api/v1/assets/{asset_id}/retire",
        json={"reason": reason}
    )
    assert response.status_code == 400
    assert response.json()["code"] == expected_code
```

### ATB-5: 权限校验 - 非资产责任人

**测试场景**: 非资产责任人用户尝试发起报废申请

```python
def test_retire_application_unauthorized():
    """
    ATB-5: 权限校验 - 非资产责任人
    
    物理测试期待:
    1. POST /api/v1/assets/{asset_id}/retire 返回 403
    2. 错误码 PERMISSION_DENIED
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

### ATB-6: 资产不存在场景

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
        "/api/v1/assets/nonexistent-id/retire",
        json={"reason": "设备老旧无法修复，需报废处理"}
    )
    assert response.status_code == 404
    assert response.json()["code"] == "ASSET_NOT_FOUND"
```

### ATB-7: 申请单查询接口

**测试场景**: 报废申请创建后，支持通过 ID 查询详情

```python
def test_retire_application_query():
    """
    ATB-7: 申请单查询接口
    
    物理测试期待:
    1. GET /api/v1/retire-applications/{id} 返回 200
    2. 响应包含申请单完整信息
    """
    app = create_retire_application()
    response = client.get(f"/api/v1/retire-applications/{app.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PENDING"
    assert data["asset_id"] == app.asset_id
```

---

## 5. 开发切入层级序列

### 层级一：数据层（优先）

```
src/
├── models/
│   └── retirement.py              # 报废申请单数据模型
├── schemas/
│   └── retirement_request.py       # Pydantic 请求/响应 schema
└── repositories/
    └── retirement_repository.py    # 报废申请单仓储层
```

**交付物**:
- `RetirementApplication` 模型类
- `CreateRetirementApplicationSchema` / `RetirementApplicationResponseSchema`
- `RetirementApplicationRepository` 基础 CRUD

### 层级二：服务层（核心）

```
src/
└── services/
    └── retirement_service.py      # 报废业务服务层
```

**交付物**:
- `RetirementService.create_retirement_application()` - 创建报废申请
- `RetirementService.validate_asset_retire_eligibility()` - 资产报废资格校验
- 状态校验规则实现
- 权限校验逻辑集成

### 层级三：接口层（API）

```
src/
└── api/
    └── v1/
        ├── assets.py              # 资产相关接口（含报废入口）
        └── retire_applications.py # 报废申请管理接口
```

**交付物**:
- `POST /api/v1/assets/{asset_id}/retire` - 发起报废申请
- `GET /api/v1/retire-applications/{id}` - 查询申请详情
- `GET /api/v1/assets/{asset_id}/retire-applications` - 查询资产报废历史

### 层级四：集成层（依赖接入）

```
src/
├── dependencies/
│   └── asset_service.py           # 资产服务依赖注入
└── middleware/
    └── auth.py                    # 认证鉴权中间件
```

**交付物**:
- 资产服务客户端封装
- 用户身份解析与权限校验
- 请求上下文注入

---

## 6. 数据模型定义

### RetirementApplication（报废申请单）

| 字段 | 类型 | 约束 | 描述 |
|------|------|------|------|
| id | UUID | PK | 主键 |
| application_no | VARCHAR(30) | UNIQUE, NOT NULL | 申请单编号 |
| asset_id | UUID | FK, NOT NULL | 关联资产ID |
| applicant_id | UUID | NOT NULL | 申请人ID |
| reason | VARCHAR(500) | NOT NULL | 报废原因 |
| description | TEXT | NULLABLE | 补充说明 |
| status | ENUM | NOT NULL | 申请状态 |
| created_at | TIMESTAMP | NOT NULL | 创建时间 |
| updated_at | TIMESTAMP | NOT NULL | 更新时间 |

### 状态枚举（RetirementApplicationStatus）

| 状态值 | 描述 |
|--------|------|
| `PENDING` | 待审批 |
| `APPROVED` | 已审批通过 |
| `REJECTED` | 已驳回 |
| `CANCELLED` | 已撤回 |

### 资产状态枚举（AssetRetirementStatus）

| 状态值 | 描述 |
|--------|------|
| `IN_USE` | 在用 |
| `IDLE` | 闲置 |
| `PENDING_RETIRE` | 待报废 |
| `RETIRED` | 已报废 |

---

## 7. API 规格

### POST /api/v1/assets/{asset_id}/retire

**请求**

```json
{
  "reason": "设备老旧无法修复，需报废处理",
  "description": "经维修评估，修复成本超过资产原值50%",
  "attachments": [
    "https://storage.example.com/attaches/xxx.pdf"
  ]
}
```

**成功响应 (201)**

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

**错误响应 (400/403/409/404)**

```json
{
  "code": 40000,
  "message": "资产当前状态不允许报废",
  "code": "RETIRE_STATUS_NOT_ALLOWED"
}
```

---

## 8. 风险项与依赖说明

| 风险项 | 影响 | 缓解措施 |
|--------|------|----------|
| Phase 1 状态枚举未完成 | 无法进行状态校验开发 | 先行定义枚举常量，待 Phase 1 完成后对齐 |
| 审批链路依赖 Phase 3 | 本期仅完成申请提交，审批功能后续迭代 | 接口设计预留审批字段 |
| 资产服务尚未封装 | 状态查询依赖不稳定 | 使用 Mock 进行单元测试 |

---

## 9. AC 验收追踪

| AC ID | 验证方式 | 状态 | 说明 |
|-------|----------|------|------|
| AC-001 | unit_test | pending | 资产报废申请功能测试 |
| AC-002 | unit_test | pending | 状态校验逻辑测试 |
| AC-003 | static_analysis | pending | AST 静态检查通过 |
| AC-004 | static_analysis | pending | 所有函数包含 docstring |
| AC-005 | unit_test | pending | 模块可正常 import |

---

## 10. 变更文件清单

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `src/api/schemas/retirement_request.py` | 修改 | 报废申请请求 schema |
| `src/api/schemas/retirement_response.py` | 修改 | 报废申请响应 schema |
| `frontend/tests/e2e/dashboard.spec.ts` | 修改 | 仪表盘 E2E 测试 |
| `frontend/tests/e2e/retirement_flow.spec.ts` | 修改 | 报废流程 E2E 测试 |
| `frontend/src/app/pages/AuditDashboard/AuditDashboard.module.css` | 修改 | 审核仪表盘样式 |

---

*文档版本: v1.0 | 维护者: SWARM-002 Team | 迭代周期: Iteration 1*