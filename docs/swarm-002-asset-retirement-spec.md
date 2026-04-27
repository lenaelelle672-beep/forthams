# SWARM-002 资产报废流程 规格指导文档

## 1. 需求与背景

### 1.1 业务背景
企业资产管理中，资产到达生命周期终点或需提前退役时，需经过规范的审批流程后方可正式退役。现有系统缺乏标准化的资产退役状态管理与审批链机制。

### 1.2 功能范围
- 实现资产退役状态机，定义清晰的状态转换规则
- 提供退役申请 Service 层，处理业务逻辑
- 构建后端审批 API，支持状态流转
- 开发前端报废申请页面，实现用户交互

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解（参照 plan.md）

| Phase | 名称 | 范围 |
|-------|------|------|
| **Phase 1** | 状态机与数据模型 | 资产退役状态枚举定义、数据库模型变更 |
| **Phase 2** | Service 层 | 退役申请业务逻辑、状态转换校验 |
| **Phase 3** | API 层 | 审批链 RESTful API、后端权限校验 |
| **Phase 4** | 前端交互 | 报废申请页面、审批流程 UI |

### 2.2 本次 Iteration 目标
本次迭代覆盖 **Phase 1 ~ Phase 4 完整链路**，实现端到端的资产报废流程。

---

## 3. 边界约束

### 3.1 状态机约束

```
状态枚举定义：
┌─────────┐     提交申请      ┌─────────────────────┐     审批通过      ┌──────────┐
│ NORMAL  │ ────────────────→ │ PENDING_RETIREMENT  │ ────────────────→ │ RETIRED  │
└─────────┘                   └─────────────────────┘                   └──────────┘
                                   │
                                   │ 审批拒绝
                                   ↓
                               [回退至 NORMAL]

不允许的状态转换：
- RETIRED → 任何状态（终态）
- PENDING_RETIREMENT → RETIRED（跳过审批）
- 任何状态 → PENDING_RETIREMENT（跳过申请提交）
```

### 3.2 技术约束

| 层级 | 技术选型 | 约束 |
|------|----------|------|
| 后端 | FastAPI / Django | 需支持事务回滚 |
| 数据库 | PostgreSQL | 需支持状态字段索引 |
| 前端 | React 18+ | 需状态管理方案 |
| 测试 | pytest + Playwright | 覆盖率 ≥ 80% |

### 3.3 业务约束

- 资产状态为 `NORMAL` 时方可提交退役申请
- 同一资产不允许重复提交退役申请（状态为 `PENDING_RETIREMENT` 时）
- 审批权限需校验操作用户角色
- 退役申请需记录操作人与时间戳

### 3.4 边界外事项

- 资产折旧计算逻辑（不在本次范围）
- 资产实物处置跟踪（不在本次范围）
- 跨系统资产同步（不在本次范围）

---

## 4. 验收测试基准 (ATB)

### 4.1 后端单元测试（pytest）

```python
# tests/test_asset_retirement_state_machine.py

def test_valid_state_transition_normal_to_pending():
    """物理期待：NORMAL 状态资产可成功转换到 PENDING_RETIREMENT"""
    # Arrange
    asset = Asset(id=1, status=AssetStatus.NORMAL)
    # Act
    result = asset.submit_retirement_application()
    # Assert
    assert result.status == AssetStatus.PENDING_RETIREMENT

def test_invalid_transition_retired_to_any():
    """物理期待：RETIRED 终态不可转换到任何状态"""
    asset = Asset(id=1, status=AssetStatus.RETIRED)
    with pytest.raises(InvalidStateTransitionError):
        asset.submit_retirement_application()

def test_duplicate_application_rejected():
    """物理期待：PENDING_RETIREMENT 状态不可重复提交申请"""
    asset = Asset(id=1, status=AssetStatus.PENDING_RETIREMENT)
    with pytest.raises(DuplicateApplicationError):
        asset.submit_retirement_application()

def test_retirement_application_creates_audit_log():
    """物理期待：提交申请时创建审计日志记录"""
    # Act
    application = service.submit_retirement(asset_id=1, operator_id=100)
    # Assert
    assert application.audit_log.operator_id == 100
    assert application.audit_log.action == "RETIREMENT_APPLIED"
```

```python
# tests/test_approval_api.py

def test_approval_endpoint_requires_auth():
    """物理期待：未认证请求返回 401"""
    response = client.post("/api/v1/assets/1/approve")
    assert response.status_code == 401

def test_approval_endpoint_role_authorization():
    """物理期待：非审批角色返回 403"""
    response = client.post(
        "/api/v1/assets/1/approve",
        headers={"Authorization": "Bearer user_token"}
    )
    assert response.status_code == 403

def test_approval_success_transitions_to_retired():
    """物理期待：审批通过后状态变更为 RETIRED"""
    response = client.post(
        "/api/v1/assets/1/approve",
        headers={"Authorization": "Bearer approver_token"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "RETIRED"

def test_rejection_returns_to_normal():
    """物理期待：审批拒绝后状态回退至 NORMAL"""
    response = client.post(
        "/api/v1/assets/1/reject",
        json={"reason": "资产仍在使用中"},
        headers={"Authorization": "Bearer approver_token"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "NORMAL"
```

### 4.2 前端 E2E 测试（Playwright）

```typescript
// tests/e2e/asset-retirement.spec.ts

test('用户提交报废申请成功', async ({ page }) => {
  // 物理期待：用户进入资产详情页 → 点击"提交报废" → 填写原因 → 确认提交 → 状态变更为"审批中"
  await page.goto('/assets/1');
  await page.click('[data-testid="btn-submit-retirement"]');
  await page.fill('[data-testid="retirement-reason"]', '设备老化需报废');
  await page.click('[data-testid="btn-confirm"]');
  
  await expect(page.locator('[data-testid="asset-status"]')).toHaveText('审批中');
  await expect(page.locator('.toast-message')).toContainText('提交成功');
});

test('重复提交按钮应禁用', async ({ page }) => {
  // 物理期待：已提交申请时，"提交报废"按钮应禁用
  await page.goto('/assets/1');
  
  await expect(page.locator('[data-testid="btn-submit-retirement"]')).toBeDisabled();
});
```

### 4.3 集成测试

```python
# tests/integration/test_retirement_flow.py

def test_complete_retirement_flow():
    """物理期待：完整流程 NORMAL → PENDING → RETIRED"""
    # 1. 提交申请
    app_response = client.post("/api/v1/assets/1/retirement")
    assert app_response.status_code == 201
    
    # 2. 查询状态
    get_response = client.get("/api/v1/assets/1")
    assert get_response.json()["status"] == "PENDING_RETIREMENT"
    
    # 3. 审批通过
    approve_response = client.post("/api/v1/assets/1/approve")
    assert approve_response.status_code == 200
    
    # 4. 验证终态
    final_response = client.get("/api/v1/assets/1")
    assert final_response.json()["status"] == "RETIRED"
    
    # 5. 验证无法再次操作
    reject_response = client.post("/api/v1/assets/1/reject")
    assert reject_response.status_code == 400
```

---

## 5. 开发切入层级序列

### 5.1 开发顺序

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              依赖关系图                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [1] 状态枚举与数据模型                                                      │
│          │                                                                   │
│          ▼                                                                   │
│   [2] 状态转换校验逻辑                                                        │
│          │                                                                   │
│          ▼                                                                   │
│   [3] 退役申请 Service                                                       │
│          │                                                                   │
│          ▼                                                                   │
│   [4] 审批 API 端点                                                          │
│          │                                                                   │
│          ▼                                                                   │
│   [5] 前端状态管理 + API 集成                                                 │
│          │                                                                   │
│          ▼                                                                   │
│   [6] 前端报废申请页面                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 详细层级说明

#### 层级 1：状态枚举与数据模型
- **产出**：`asset_status` 枚举定义、数据库 migration
- **文件**：`models/asset.py`、`migrations/xxx_add_retirement_status.py`

#### 层级 2：状态转换校验逻辑
- **产出**：状态机核心类、转换规则引擎
- **文件**：`services/state_machine.py`

#### 层级 3：退役申请 Service
- **产出**：业务逻辑封装、审计日志写入
- **文件**：`services/retirement_service.py`

#### 层级 4：审批 API 端点
- **产出**：RESTful API、权限校验中间件
- **文件**：`api/v1/retirement.py`、`middleware/auth.py`

#### 层级 5：前端状态管理与 API 集成
- **产出**：API Client、状态管理模块
- **文件**：`frontend/src/api/asset.ts`、`frontend/src/store/assetStore.ts`

#### 层级 6：前端报废申请页面
- **产出**：用户交互 UI、状态展示组件
- **文件**：`frontend/src/pages/AssetDetail/components/RetirementPanel.tsx`

### 5.3 里程碑检查点

| 里程碑 | 验收条件 | 阻塞下一层 |
|--------|----------|------------|
| M1 | 状态枚举可导入、迁移可执行 | 是 |
| M2 | 状态机单元测试通过率 100% | 是 |
| M3 | Service 层 Mock 测试通过 | 是 |
| M4 | API 端点测试覆盖完整 | 是 |
| M5 | 前端 E2E 测试全绿 | 否（可并行） |

---

## 附录：关键字段定义

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | ENUM | NORMAL / PENDING_RETIREMENT / RETIRED |
| `retirement_reason` | TEXT | 申请原因 |
| `applied_at` | DATETIME | 申请时间 |
| `applied_by` | FK(User) | 申请人 |
| `approved_at` | DATETIME | 审批时间 |
| `approved_by` | FK(User) | 审批人 |
| `approval_comment` | TEXT | 审批意见 |

---

## 附录 B：待修改文件清单

基于 SWARM-002 任务，本次迭代需修改以下 5 个文件：

| 序号 | 文件路径 | 修改说明 |
|------|----------|----------|
| 1 | `src/api/routes/retirement_routes.py` | 新增退役申请 API 端点 |
| 2 | `src/domain/services/retirement_service.py` | 实现退役申请业务逻辑 |
| 3 | `frontend/src/app/pages/AuditDashboard/AuditDashboard.module.css` | 适配退役流程 UI 样式 |
| 4 | `frontend/src/app/services/userService.ts` | 集成用户权限校验接口 |
| 5 | `frontend/src/app/services/inventoryService.ts` | 集成资产库存查询接口 |

---

## 附录 C：AC 验收追踪

| AC ID | 验收条件 | 验证方法 | 状态 |
|-------|----------|----------|------|
| AC-001 | 实现 SWARM-002 资产退役状态机与审批链 | integration | pending |
| AC-002 | 代码变更不引入新的语法错误 | static_analysis | pending |
| AC-003 | 所有修改的函数包含 docstring 文档注释 | static_analysis | pending |
| AC-004 | 变更后的模块可被正常 import | unit_test | pending |