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

| Phase | 名称 | 范围 | 里程碑 |
|-------|------|------|--------|
| **Phase 1** | 状态机与数据模型 | 资产退役状态枚举定义、数据库模型变更 | M1: 状态枚举可导入、迁移可执行 |
| **Phase 2** | Service 层 | 退役申请业务逻辑、状态转换校验 | M2: 状态机单元测试通过率 100% |
| **Phase 3** | API 层 | 审批链 RESTful API、后端权限校验 | M3: Service 层 Mock 测试通过 |
| **Phase 4** | 前端交互 | 报废申请页面、审批流程 UI | M4: API 端点测试覆盖完整 |

### 2.2 本次 Iteration 目标
本次迭代覆盖 **Phase 1 ~ Phase 4 完整链路**，实现端到端的资产报废流程。

---

## 3. 边界约束

### 3.1 状态机约束

#### 3.1.1 资产退役状态枚举
```python
# src/state_machine/states.py
class RetirementState(str, Enum):
    """
    资产退役状态枚举
    
    状态转换规则:
    - NORMAL → PENDING_RETIREMENT: 用户提交退役申请
    - PENDING_RETIREMENT → RETIRED: 审批通过
    - PENDING_RETIREMENT → NORMAL: 审批拒绝
    - RETIRED: 终态，不可转换
    """
    NORMAL = "normal"                    # 正常状态
    PENDING_RETIREMENT = "pending"       # 退役审批中
    RETIRED = "retired"                  # 已退役（终态）
```

#### 3.1.2 状态转换图
```
┌─────────┐     提交申请      ┌─────────────────┐     审批通过      ┌──────────┐
│ NORMAL  │ ────────────────→ │ PENDING_RETIREMENT │ ───────────────→ │ RETIRED │
└─────────┘                   └─────────────────┘                   └──────────┘
                                   │
                                   │ 审批拒绝
                                   ↓
                               [回退至 NORMAL]

不允许的状态转换:
- RETIRED → 任何状态（终态）
- PENDING_RETIREMENT → RETIRED（跳过审批）
- 任何状态 → PENDING_RETIREMENT（跳过申请提交）
```

### 3.2 技术约束

| 层级 | 技术选型 | 约束 |
|------|----------|------|
| 后端 | FastAPI / Python 3.10+ | 需支持事务回滚 |
| 数据库 | PostgreSQL / SQLite | 需支持状态字段索引 |
| 前端 | React 18+ / TypeScript | 需状态管理方案 |
| 测试 | pytest + Playwright | 覆盖率 ≥ 80% |

### 3.3 业务约束

| 约束项 | 描述 |
|--------|------|
| 状态前置条件 | 资产状态为 `NORMAL` 时方可提交退役申请 |
| 防重复提交 | 同一资产不允许重复提交退役申请 |
| 审批权限 | 审批权限需校验操作用户角色 |
| 审计追溯 | 退役申请需记录操作人与时间戳 |

### 3.4 边界外事项

| 范围外事项 | 说明 |
|------------|------|
| 资产折旧计算 | 不在本次范围，参照 SWARM-003 |
| 资产实物处置跟踪 | 不在本次范围 |
| 跨系统资产同步 | 不在本次范围 |

---

## 4. 验收测试基准 (ATB)

### 4.1 后端单元测试（pytest）

```python
# tests/unit/test_retirement_state_machine.py
# 文件: src/state_machine/states.py 核心验证

def test_valid_state_transition_normal_to_pending():
    """
    物理期待：NORMAL 状态资产可成功转换到 PENDING_RETIREMENT
    
    测试步骤:
    1. 创建状态为 NORMAL 的资产
    2. 调用 submit_retirement_application()
    3. 验证状态变更为 PENDING_RETIREMENT
    """
    # Arrange
    asset = Asset(id=1, status=RetirementState.NORMAL)
    # Act
    result = asset.submit_retirement_application()
    # Assert
    assert result.status == RetirementState.PENDING_RETIREMENT


def test_invalid_transition_retired_to_any():
    """
    物理期待：RETIRED 终态不可转换到任何状态
    
    测试步骤:
    1. 创建状态为 RETIRED 的资产
    2. 尝试调用任何状态转换方法
    3. 验证抛出 InvalidStateTransitionError
    """
    asset = Asset(id=1, status=RetirementState.RETIRED)
    with pytest.raises(InvalidStateTransitionError):
        asset.submit_retirement_application()


def test_duplicate_application_rejected():
    """
    物理期待：PENDING_RETIREMENT 状态不可重复提交申请
    
    测试步骤:
    1. 创建状态为 PENDING_RETIREMENT 的资产
    2. 尝试再次提交申请
    3. 验证抛出 DuplicateApplicationError
    """
    asset = Asset(id=1, status=RetirementState.PENDING_RETIREMENT)
    with pytest.raises(DuplicateApplicationError):
        asset.submit_retirement_application()


def test_retirement_application_creates_audit_log():
    """
    物理期待：提交申请时创建审计日志记录
    
    测试步骤:
    1. 调用 service.submit_retirement(asset_id=1, operator_id=100)
    2. 验证 audit_log.operator_id == 100
    3. 验证 audit_log.action == "RETIREMENT_APPLIED"
    """
    # Act
    application = service.submit_retirement(asset_id=1, operator_id=100)
    # Assert
    assert application.audit_log.operator_id == 100
    assert application.audit_log.action == "RETIREMENT_APPLIED"
```

### 4.2 后端 API 测试

```python
# tests/api/test_retirement_api.py

def test_approval_endpoint_requires_auth():
    """
    物理期待：未认证请求返回 401
    """
    response = client.post("/api/v1/assets/1/approve")
    assert response.status_code == 401


def test_approval_endpoint_role_authorization():
    """
    物理期待：非审批角色返回 403
    """
    response = client.post(
        "/api/v1/assets/1/approve",
        headers={"Authorization": "Bearer user_token"}
    )
    assert response.status_code == 403


def test_approval_success_transitions_to_retired():
    """
    物理期待：审批通过后状态变更为 RETIRED
    """
    response = client.post(
        "/api/v1/assets/1/approve",
        headers={"Authorization": "Bearer approver_token"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "retired"


def test_rejection_returns_to_normal():
    """
    物理期待：审批拒绝后状态回退至 NORMAL
    """
    response = client.post(
        "/api/v1/assets/1/reject",
        json={"reason": "资产仍在使用中"},
        headers={"Authorization": "Bearer approver_token"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "normal"
```

### 4.3 前端 E2E 测试（Playwright）

```typescript
// tests/e2e/retirement_flow.spec.ts

test('用户提交报废申请成功', async ({ page }) => {
  /**
   * 物理期待：用户进入资产详情页 → 点击"提交报废" → 填写原因 → 确认提交 → 状态变更为"审批中"
   */
  await page.goto('/assets/1');
  await page.click('[data-testid="btn-submit-retirement"]');
  await page.fill('[data-testid="retirement-reason"]', '设备老化需报废');
  await page.click('[data-testid="btn-confirm"]');
  
  await expect(page.locator('[data-testid="asset-status"]')).toHaveText('审批中');
  await expect(page.locator('.toast-message')).toContainText('提交成功');
});


test('重复提交按钮应禁用', async ({ page }) => {
  /**
   * 物理期待：已提交申请时，"提交报废"按钮应禁用
   */
  await page.goto('/assets/1');
  
  await expect(page.locator('[data-testid="btn-submit-retirement"]')).toBeDisabled();
});
```

### 4.4 集成测试

```python
# tests/integration/test_retirement_flow.py

def test_complete_retirement_flow():
    """
    物理期待：完整流程 NORMAL → PENDING → RETIRED
    
    测试步骤:
    1. 提交申请 → 验证返回 201，状态为 PENDING_RETIREMENT
    2. 查询状态 → 验证 GET /api/v1/assets/1 返回 pending 状态
    3. 审批通过 → 验证返回 200
    4. 验证终态 → 状态为 RETIRED
    5. 验证不可操作 → 拒绝请求返回 400
    """
    # 1. 提交申请
    app_response = client.post("/api/v1/assets/1/retirement")
    assert app_response.status_code == 201
    
    # 2. 查询状态
    get_response = client.get("/api/v1/assets/1")
    assert get_response.json()["status"] == "pending"
    
    # 3. 审批通过
    approve_response = client.post("/api/v1/assets/1/approve")
    assert approve_response.status_code == 200
    
    # 4. 验证终态
    final_response = client.get("/api/v1/assets/1")
    assert final_response.json()["status"] == "retired"
    
    # 5. 验证无法再次操作
    reject_response = client.post("/api/v1/assets/1/reject")
    assert reject_response.status_code == 400
```

---

## 5. 开发切入层级序列

### 5.1 依赖关系图

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
- **核心文件**: `src/state_machine/states.py`
- **产出**: 状态枚举 `RetirementState` 定义
- **职责**:
  - 定义 `NORMAL`, `PENDING_RETIREMENT`, `RETIRED` 三种状态
  - 提供状态转换规则常量
- **接口**:
  ```python
  class RetirementState(str, Enum):
      NORMAL = "normal"
      PENDING_RETIREMENT = "pending"
      RETIRED = "retired"
  ```

#### 层级 2：状态转换校验逻辑
- **核心文件**: `src/domain/services/retirement_service.py`
- **产出**: `RetirementService` 业务逻辑封装
- **职责**:
  - 校验状态转换合法性
  - 执行状态变更操作
  - 记录状态转换历史
- **关键方法**:
  ```python
  def can_transition(from_state: RetirementState, to_state: RetirementState) -> bool
  def transition(asset_id: int, target_state: RetirementState, operator_id: int)
  ```

#### 层级 3：退役申请 Service
- **核心文件**: `src/domain/services/retirement_service.py`
- **产出**: 退役申请业务逻辑
- **职责**:
  - 创建退役申请记录
  - 触发审批链
  - 写入审计日志
- **关键方法**:
  ```python
  def submit_retirement(asset_id: int, reason: str, operator_id: int) -> RetirementApplication
  def approve_retirement(application_id: int, approver_id: int, comment: str)
  def reject_retirement(application_id: int, approver_id: int, reason: str)
  ```

#### 层级 4：审批 API 端点
- **核心文件**: `src/api/routes/retirement_routes.py`
- **产出**: RESTful API 端点
- **职责**:
  - 暴露退役申请接口
  - 权限校验
  - 请求参数校验
- **端点清单**:
  | 方法 | 路径 | 描述 |
  |------|------|------|
  | POST | `/api/v1/assets/{id}/retirement` | 提交退役申请 |
  | POST | `/api/v1/assets/{id}/approve` | 审批通过 |
  | POST | `/api/v1/assets/{id}/reject` | 审批拒绝 |
  | GET | `/api/v1/assets/{id}/retirement` | 查询退役状态 |

#### 层级 5：前端状态管理与 API 集成
- **核心文件**: `frontend/src/app/services/retirementService.ts`
- **产出**: API Client、状态管理
- **职责**:
  - 调用后端 API
  - 状态同步
- **接口**:
  ```typescript
  interface RetirementService {
    submitRetirement(assetId: string, reason: string): Promise<RetirementResponse>
    approveRetirement(assetId: string, comment?: string): Promise<void>
    rejectRetirement(assetId: string, reason: string): Promise<void>
  }
  ```

#### 层级 6：前端报废申请页面
- **核心文件**: `frontend/src/app/pages/AuditDashboard/AuditDashboard.module.css`
- **产出**: 用户交互 UI
- **职责**:
  - 展示资产状态
  - 提供申请入口
  - 展示审批进度

### 5.3 里程碑检查点

| 里程碑 | 验收条件 | 阻塞下一层 |
|--------|----------|------------|
| **M1** | 状态枚举可导入、迁移可执行 | 是 |
| **M2** | 状态机单元测试通过率 100% | 是 |
| **M3** | Service 层 Mock 测试通过 | 是 |
| **M4** | API 端点测试覆盖完整 | 是 |
| **M5** | 前端 E2E 测试全绿 | 否（可并行） |

---

## 附录

### A. 关键字段定义

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | ENUM | NORMAL / PENDING_RETIREMENT / RETIRED |
| `retirement_reason` | TEXT | 申请原因 |
| `applied_at` | DATETIME | 申请时间 |
| `applied_by` | FK(User) | 申请人 |
| `approved_at` | DATETIME | 审批时间 |
| `approved_by` | FK(User) | 审批人 |
| `approval_comment` | TEXT | 审批意见 |

### B. 错误码定义

| 错误码 | 错误类型 | 说明 |
|--------|----------|------|
| `RET_001` | INVALID_STATE_TRANSITION | 无效的状态转换 |
| `RET_002` | DUPLICATE_APPLICATION | 重复提交申请 |
| `RET_003` | ASSET_NOT_FOUND | 资产不存在 |
| `RET_004` | UNAUTHORIZED_APPROVAL | 无审批权限 |
| `RET_005` | ALREADY_RETIRED | 资产已退役 |

### C. 参考文件

| 文件路径 | 说明 |
|----------|------|
| `src/state_machine/states.py` | 状态枚举定义 |
| `src/domain/services/retirement_service.py` | 退役服务 |
| `src/api/routes/retirement_routes.py` | API 路由 |
| `src/models/retirement.py` | 数据模型 |
| `tests/unit/test_retirement_state_machine.py` | 单元测试 |
| `tests/integration/test_retirement_flow.py` | 集成测试 |