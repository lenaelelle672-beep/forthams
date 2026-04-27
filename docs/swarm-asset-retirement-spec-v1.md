# SWARM-ASSET-RETIREMENT 规格指导文档

> **文档版本**: v1.0  
> **迭代编号**: Iteration 1  
> **创建日期**: 2024-XX-XX  
> **负责人**: SWARM Team  
> **状态**: Draft → Pending Review

---

## 1. 需求与背景

### 1.1 业务场景

资产管理生命周期中，资产需经历从采购入库、正常使用、到最终报废/退役的完整流程。当前系统已完成资产入库与正常使用阶段的实现，本迭代聚焦于**资产退役阶段**的端到端流程覆盖。

### 1.2 核心功能诉求

| 功能模块 | 描述 | 优先级 |
|---------|------|--------|
| 退役申请 | 资产管理员提交资产退役申请，包含原因说明与附件支持 | P0 |
| 状态流转 | 实现 `Active → Pending Retirement → Retired` 三态流转控制 | P0 |
| 记录持久化 | 退役申请、审批、变更历史写入持久化存储 | P0 |
| 历史查询 | 提供退役记录与状态变更历史的查询接口 | P1 |

### 1.3 技术栈约束

| 层级 | 技术选型 |
|-----|---------|
| 后端 API | RESTful 风格，JSON 格式，FastAPI |
| 前端 | Vue 3 + TypeScript + Vite |
| 数据库 | PostgreSQL 12+ |
| ORM | SQLAlchemy |
| 认证 | JWT Bearer Token |
| 测试 | pytest + Playwright |

### 1.4 相关文件清单

```
src/
├── models/
│   └── asset_retirement.py          # 核心数据模型
├── schemas/
│   └── retirement_request.py        # Pydantic 请求/响应模式
├── api/routers/
│   └── retirement_router.py         # API 路由定义
├── services/
│   └── retirement_service.py        # 业务逻辑服务
├── state_machine/
│   └── retirement_state_machine.py  # 状态机实现
├── repositories/
│   └── retirement_repository.py     # 数据访问层
└── main.py                          # 应用入口

frontend/
└── src/pages/retirement/
    └── [id].tsx                     # 退役申请页面

tests/
├── e2e/
│   ├── retirement_flow.spec.ts      # 退役流程 E2E 测试
│   └── retirement_user_journey.spec.ts # 用户旅程 E2E 测试
├── api/
│   └── test_retirement_api.py       # API 单元测试
└── services/
    └── test_retirement_service.py   # Service 层测试
```

---

## 2. 当前 Phase 对应实施目标

### Phase 1: 核心退役流程实现

| 序号 | 交付物 | 验收标准 | 状态 |
|-----|--------|---------|------|
| P1.1 | 资产退役申请表单页面 | 支持填写资产ID、退役原因、预估残值 | ⬜ |
| P1.2 | 退役申请提交 API | `POST /api/v1/assets/{assetId}/retirement` | ⬜ |
| P1.3 | 状态流转引擎 | Active→Pending Retirement 自动触发审批流 | ⬜ |
| P1.4 | 退役审批 API | `POST /api/v1/assets/{assetId}/retirement/approve` | ⬜ |
| P1.5 | 退役记录持久化 | 退役申请表、状态变更日志写入 DB | ⬜ |
| P1.6 | 退役历史查询 API | `GET /api/v1/assets/{assetId}/retirement/history` | ⬜ |

### 排除范围（后续迭代）

- 资产维修/保养流程
- 批量退役操作
- 退役资产处置跟踪（回收/销毁）
- 财务折旧联动
- 多级审批流程

---

## 3. 边界约束

### 3.1 状态机约束

```
┌─────────┐  submit   ┌────────────────────┐  approve   ┌─────────┐
│  Active │ ────────→ │ Pending Retirement │ ─────────→ │ Retired │
└─────────┘           └────────────────────┘            └─────────┘
                              │
                              │ reject
                              ↓
                       ┌──────────────┐
                       │ Return Active│
                       └──────────────┘
```

**状态转移规则：**

| 规则编号 | 规则描述 |
|---------|---------|
| SR-001 | 仅 `Active` 状态资产可发起退役申请 |
| SR-002 | `Pending Retirement` 状态仅允许审批或驳回操作 |
| SR-003 | `Retired` 状态为终态，不可逆 |
| SR-004 | 驳回操作将状态恢复至 `Active`，并记录驳回原因 |
| SR-005 | 同一资产同一时刻仅允许一个退役申请处理中（并发控制） |

### 3.2 数据约束

#### retirement_requests 表

| 字段 | 类型 | 约束 |
|-----|------|-----|
| id | UUID | PK |
| asset_id | VARCHAR(50) | FK → assets.id, NOT NULL |
| reason | VARCHAR(20) | NOT NULL, ENUM |
| reason_detail | TEXT | NULLABLE |
| estimated_residual_value | DECIMAL(15,2) | NULLABLE, CHECK >= 0 |
| status | VARCHAR(20) | NOT NULL, ENUM('PENDING', 'APPROVED', 'REJECTED') |
| requester_id | VARCHAR(50) | FK → users.id, NOT NULL |
| approver_id | VARCHAR(50) | FK → users.id, NULLABLE |
| approval_comment | TEXT | NULLABLE |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMP | NOT NULL |

#### retirement_history 表

| 字段 | 类型 | 约束 |
|-----|------|-----|
| id | UUID | PK |
| asset_id | VARCHAR(50) | FK → assets.id, NOT NULL |
| action | VARCHAR(20) | NOT NULL, ENUM('SUBMIT', 'APPROVE', 'REJECT') |
| from_status | VARCHAR(20) | NULLABLE |
| to_status | VARCHAR(20) | NOT NULL |
| operator_id | VARCHAR(50) | FK → users.id, NOT NULL |
| detail | JSONB | NULLABLE |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() |

### 3.3 业务约束

#### 退役原因枚举 (ReasonEnum)

```python
class ReasonEnum(str, Enum):
    DAMAGED = "DAMAGED"           # 损坏
    OBSOLETE = "OBSOLETE"         # 淘汰
    SOLD = "SOLD"                 # 出售
    DONATED = "DONATED"           # 捐赠
    OTHER = "OTHER"               # 其他
```

#### 字段必填规则

| 条件 | 字段 | 约束 |
|-----|------|-----|
| 通用 | asset_id | 必填，外键关联 `assets` 表 |
| 通用 | retirement_reason | 必填 |
| reason=OTHER | reason_detail | 必填；最大 500 字符 |
| 通用 | estimated_residual_value | 可选，DECIMAL(15,2)，≥ 0 |
| 审批时 | approver_id | 必填，关联 `users` 表 |
| 审批时 | approval_comment | 可选，最大 200 字符 |

### 3.4 权限约束

| 角色 | 发起申请 | 审批/驳回 | 查询所有 | 查询本人 |
|-----|---------|----------|---------|---------|
| asset_admin | ✅ | ✅ | ✅ | ✅ |
| asset_operator | ✅ (本人负责) | ❌ | ❌ | ✅ |
| asset_viewer | ❌ | ❌ | ✅ | ✅ |

### 3.5 并发约束

- 使用数据库行级锁（`SELECT ... FOR UPDATE`）防止竞态
- VersionConflictError 用于乐观锁检测

---

## 4. 验收测试基准 (ATB)

### 4.1 API 层测试

#### ATB-001: 提交退役申请

```python
# tests/api/test_retirement_api.py::test_submit_retirement_request
def test_submit_retirement_request(client, auth_headers, test_asset):
    """
    Given: 存在状态为 Active 的资产 asset-001
    When:  POST /api/v1/assets/asset-001/retirement
           body: {
               "reason": "OBSOLETE",
               "reason_detail": "使用超过10年",
               "estimated_residual_value": 500
           }
    Then:  HTTP 201 Created
           body: {
               "asset_id": "asset-001",
               "status": "PENDING_RETIREMENT",
               "request_id": "..."
           }
           DB: assets.status = 'PENDING_RETIREMENT'
           DB: retirement_requests 表新增 1 条记录
    """
```

#### ATB-002: 退役申请状态校验

```python
# tests/api/test_retirement_api.py::test_cannot_retire_non_active_asset
def test_cannot_retire_non_active_asset(client, auth_headers):
    """
    Given: 资产 asset-002 状态为 PENDING_RETIREMENT
    When:  POST /api/v1/assets/asset-002/retirement
    Then:  HTTP 409 Conflict
           body: {
               "error": "ASSET_NOT_IN_ACTIVE_STATE",
               "current_status": "PENDING_RETIREMENT"
           }
    """
```

#### ATB-003: 审批通过

```python
# tests/api/test_retirement_api.py::test_approve_retirement
def test_approve_retirement(client, auth_headers, test_asset_pending):
    """
    Given: 资产 asset-003 状态为 PENDING_RETIREMENT，存在 request_id="req-001"
    When:  POST /api/v1/assets/asset-003/retirement/approve
           body: {
               "request_id": "req-001",
               "approver_id": "user-admin-01",
               "approval_comment": "同意退役"
           }
    Then:  HTTP 200 OK
           DB: assets.status = 'RETIRED'
           DB: retirement_requests.status = 'APPROVED'
           DB: retirement_history 新增状态变更记录
    """
```

#### ATB-004: 驳回申请

```python
# tests/api/test_retirement_api.py::test_reject_retirement
def test_reject_retirement(client, auth_headers, test_asset_pending):
    """
    Given: 资产 asset-004 状态为 PENDING_RETIREMENT
    When:  POST /api/v1/assets/asset-004/retirement/reject
           body: {
               "request_id": "req-002",
               "approver_id": "user-admin-01",
               "rejection_reason": "需补充维修记录"
           }
    Then:  HTTP 200 OK
           DB: assets.status 恢复为 'ACTIVE'
           DB: retirement_requests.status = 'REJECTED'
    """
```

#### ATB-005: 退役历史查询

```python
# tests/api/test_retirement_api.py::test_get_retirement_history
def test_get_retirement_history(client, auth_headers, test_asset_with_history):
    """
    Given: 资产 asset-005 存在 2 条退役相关记录
    When:  GET /api/v1/assets/asset-005/retirement/history
    Then:  HTTP 200 OK
           body: {
               "total": 2,
               "items": [
                   {"action": "SUBMIT", "timestamp": "...", ...},
                   {"action": "APPROVE", "timestamp": "...", ...}
               ]
           }
    """
```

### 4.2 前端页面测试

#### ATB-006: 退役申请表单渲染

```typescript
// tests/e2e/retirement_flow.spec.ts
test('retirement form renders correctly', async ({ page }) => {
  // Given: 用户登录为 asset_admin，进入资产详情页
  await page.goto('/assets/asset-001');
  
  // When: 点击"发起退役"按钮
  await page.click('[data-testid="initiate-retirement-btn"]');
  
  // Then: 退役申请表单正确渲染，包含：
  await expect(page.locator('[data-testid="retirement-form"]')).toBeVisible();
  await expect(page.locator('[data-testid="reason-select"]')).toBeVisible();
  await expect(page.locator('[data-testid="reason-detail-input"]')).toBeVisible();
  await expect(page.locator('[data-testid="residual-value-input"]')).toBeVisible();
  await expect(page.locator('[data-testid="submit-btn"]')).toBeVisible();
});
```

#### ATB-007: 表单验证

```typescript
// tests/e2e/retirement_flow.spec.ts
test('retirement form validates required fields', async ({ page }) => {
  // Given: 退役申请表单页面
  await page.goto('/assets/asset-001/retirement/new');
  
  // When: 不填写必填项直接点击提交
  await page.click('[data-testid="submit-btn"]');
  
  // Then: 前端显示验证错误
  await expect(page.locator('[data-testid="reason-error"]'))
    .toContainText('退役原因为必填项');
  // API 未被调用
  await expect(apiMock).not.toHaveBeenCalled();
});
```

#### ATB-008: 状态流转 UI 反馈

```typescript
// tests/e2e/retirement_user_journey.spec.ts
test('shows pending retirement status after submission', async ({ page }) => {
  // Given: 提交退役申请成功
  await page.goto('/assets/asset-001');
  await page.click('[data-testid="initiate-retirement-btn"]');
  await page.selectOption('[data-testid="reason-select"]', 'OBSOLETE');
  await page.fill('[data-testid="reason-detail-input"]', '设备老化');
  await page.click('[data-testid="submit-btn"]');
  
  // When: 页面刷新
  await page.reload();
  
  // Then: 资产状态标签显示 "Pending Retirement"
  await expect(page.locator('[data-testid="asset-status-badge"]'))
    .toContainText('Pending Retirement');
  // 状态变更历史区域新增记录
  await expect(page.locator('[data-testid="history-list"]'))
    .toContainText('提交退役申请');
});
```

### 4.3 边界条件测试

#### ATB-009: 并发申请防护

```python
# tests/api/test_retirement_concurrency.py::test_concurrent_retirement_request
def test_concurrent_retirement_request(db_session, test_asset):
    """
    Given: 资产 asset-concurrent 状态为 Active
    When:  并发发起 2 个退役申请
    Then:  1 个请求返回 201 Created
           另 1 个请求返回 409 Conflict
           最终仅存在 1 条 pending 状态的申请记录
    """
```

#### ATB-010: 权限校验

```python
# tests/api/test_retirement_auth.py::test_unauthorized_approval
def test_unauthorized_approval(viewer_client, test_asset_pending):
    """
    Given: 用户 role=asset_viewer
    When:  POST /api/v1/assets/asset-001/retirement/approve
    Then:  HTTP 403 Forbidden
           body: {"error": "INSUFFICIENT_PERMISSION"}
    """
```

#### ATB-011: VersionConflictError 处理

```python
# tests/api/test_retirement_api.py::test_version_conflict_handling
def test_version_conflict_handling(client, auth_headers, test_asset_pending):
    """
    Given: 存在版本号为 1 的退役申请
    When:  同时发起 approve 请求（版本 1）和 reject 请求（版本 1）
    Then:  第一个成功，第二个返回 409 Conflict
           body: {"error": "VERSION_CONFLICT", "current_version": 2}
    """
```

#### ATB-012: 终态不可逆

```python
# tests/api/test_retirement_api.py::test_retired_asset_immutable
def test_retired_asset_immutable(client, auth_headers, test_asset_retired):
    """
    Given: 资产 asset-final 状态为 RETIRED
    When:  尝试任何状态变更操作
    Then:  HTTP 400 Bad Request
           body: {"error": "FINAL_STATE_UNMODIFIABLE"}
    """
```

---

## 5. 开发切入层级序列

### Phase 1 实施顺序

```
Week 1 Day 1-2: 数据库层
├── [ ] 创建 retirement_requests 表
├── [ ] 创建 retirement_history 表
├── [ ] 编写 Alembic/SQLAlchemy 迁移脚本
└── [ ] 验证表结构与约束

Week 1 Day 3-4: 领域模型层
├── [ ] 定义 RetirementRequest, RetirementHistory 实体
├── [ ] 实现 AssetRetirementStateMachine 状态机
├── [ ] 编写单元测试 (状态机逻辑)
└── [ ] 验证状态转移规则 SR-001 ~ SR-005

Week 2 Day 1-2: Repository 层
├── [ ] 实现 RetirementRepository
├── [ ] 实现 IAssetRepository.update_status()
├── [ ] 实现并发控制 (行级锁)
└── [ ] 编写集成测试 (DB 操作)

Week 2 Day 3-4: Service 层
├── [ ] 实现 RetirementService.submit_request()
├── [ ] 实现 RetirementService.approve()
├── [ ] 实现 RetirementService.reject()
├── [ ] 实现 RetirementService.get_history()
├── [ ] 集成 VersionConflictError 检测
└── [ ] 编写 Service 层单元测试

Week 3 Day 1-2: API 层
├── [ ] 实现 POST /retirement (提交申请)
├── [ ] 实现 POST /retirement/approve
├── [ ] 实现 POST /retirement/reject
├── [ ] 实现 GET /retirement/history
├── [ ] 集成 API 路由与 Service
├── [ ] 添加权限校验中间件
└── [ ] 编写 API 层测试

Week 3 Day 3-5: 前端层
├── [ ] 实现 RetirementApplicationForm.vue
├── [ ] 实现 RetirementHistoryTable.vue
├── [ ] 集成状态显示组件
├── [ ] 实现表单验证逻辑
├── [ ] 编写 E2E 测试
└── [ ] 手动验收

Week 4 Day 1-2: 联调与修复
├── [ ] API + 前端联调
├── [ ] 修复 ATB 失败项
├── [ ] 补充边界条件测试
└── [ ] 性能测试 (并发场景)

Week 4 Day 3-5: 文档与发布
├── [ ] 更新 API 文档 (OpenAPI/Swagger)
├── [ ] 更新数据库 ER 图
├── [ ] 编写部署说明
└── [ ] 提交 PR / Code Review
```

### 关键依赖关系

```
数据库迁移 ──────────→ 领域模型 ──────────→ Repository ──────────→ Service ──────────→ API
     │                      │                     │                     │              │
     └──────────────────────┴─────────────────────┴─────────────────────┴──────────────┘
                                       ↓
                              前端集成测试 ←───── API 层完成
```

---

## 6. API 接口规范

### 6.1 提交退役申请

```
POST /api/v1/assets/{asset_id}/retirement
```

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "OBSOLETE",
  "reason_detail": "使用超过10年，性能下降严重",
  "estimated_residual_value": 500.00
}
```

**Response (201 Created):**
```json
{
  "request_id": "uuid-xxx-xxx",
  "asset_id": "asset-001",
  "status": "PENDING_RETIREMENT",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- 400 Bad Request: 必填字段缺失
- 401 Unauthorized: 未认证
- 403 Forbidden: 无权限
- 404 Not Found: 资产不存在
- 409 Conflict: 资产状态不允许退役

### 6.2 审批通过

```
POST /api/v1/assets/{asset_id}/retirement/approve
```

**Request Body:**
```json
{
  "request_id": "uuid-xxx-xxx",
  "approver_id": "user-admin-01",
  "approval_comment": "同意退役处理"
}
```

**Response (200 OK):**
```json
{
  "request_id": "uuid-xxx-xxx",
  "asset_id": "asset-001",
  "status": "RETIRED",
  "approved_at": "2024-01-15T14:00:00Z"
}
```

### 6.3 驳回申请

```
POST /api/v1/assets/{asset_id}/retirement/reject
```

**Request Body:**
```json
{
  "request_id": "uuid-xxx-xxx",
  "approver_id": "user-admin-01",
  "rejection_reason": "需补充维修记录后再评估"
}
```

**Response (200 OK):**
```json
{
  "request_id": "uuid-xxx-xxx",
  "asset_id": "asset-001",
  "status": "ACTIVE",
  "rejected_at": "2024-01-15T14:00:00Z"
}
```

### 6.4 查询退役历史

```
GET /api/v1/assets/{asset_id}/retirement/history
```

**Query Parameters:**
- `page` (optional, default: 1)
- `page_size` (optional, default: 20, max: 100)

**Response (200 OK):**
```json
{
  "total": 5,
  "page": 1,
  "page_size": 20,
  "items": [
    {
      "id": "history-001",
      "action": "SUBMIT",
      "from_status": "ACTIVE",
      "to_status": "PENDING_RETIREMENT",
      "operator_id": "user-op-01",
      "detail": {
        "reason": "OBSOLETE",
        "reason_detail": "使用超过10年"
      },
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## 7. 错误码规范

| 错误码 | 错误信息 | HTTP Status |
|-------|---------|-------------|
| ASSET_NOT_FOUND | 资产不存在 | 404 |
| ASSET_NOT_IN_ACTIVE_STATE | 资产状态不允许退役操作 | 409 |
| REQUEST_NOT_FOUND | 退役申请不存在 | 404 |
| VERSION_CONFLICT | 版本冲突，请刷新后重试 | 409 |
| FINAL_STATE_UNMODIFIABLE | 终态不可修改 | 400 |
| INSUFFICIENT_PERMISSION | 权限不足 | 403 |
| INVALID_REASON_REQUIRED | 退役原因为必填项 | 400 |
| REASON_DETAIL_REQUIRED | 其他原因需填写详细说明 | 400 |
| CONCURRENT_REQUEST_EXISTS | 存在进行中的退役申请 | 409 |

---

## 8. 监控与日志

### 8.1 关键日志事件

| 事件 | Level | 包含字段 |
|-----|-------|---------|
| 退役申请提交 | INFO | asset_id, requester_id, reason |
| 退役申请审批 | INFO | asset_id, requester_id, approver_id |
| 退役申请驳回 | WARN | asset_id, requester_id, approver_id, rejection_reason |
| 状态转换失败 | ERROR | asset_id, from_status, to_status, error_code |
| 并发冲突检测 | WARN | asset_id, conflicting_request_id |

### 8.2 监控指标

- `retirement_requests_total`: 退役申请总数 (counter)
- `retirement_request_duration_seconds`: 退役流程耗时 (histogram)
- `retirement_requests_pending`: 待处理退役申请数 (gauge)
- `retirement_conflicts_total`: 并发冲突次数 (counter)

---

## 附录 A: 数据模型完整定义

### A.1 retirement_requests 表 DDL

```sql
CREATE TABLE retirement_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id VARCHAR(50) NOT NULL REFERENCES assets(id),
    reason VARCHAR(20) NOT NULL CHECK (reason IN ('DAMAGED', 'OBSOLETE', 'SOLD', 'DONATED', 'OTHER')),
    reason_detail TEXT,
    estimated_residual_value DECIMAL(15, 2) CHECK (estimated_residual_value >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    requester_id VARCHAR(50) NOT NULL REFERENCES users(id),
    approver_id VARCHAR(50) REFERENCES users(id),
    approval_comment TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_pending_request UNIQUE (asset_id) 
        WHERE status = 'PENDING'
);

CREATE INDEX idx_retirement_requests_asset_id ON retirement_requests(asset_id);
CREATE INDEX idx_retirement_requests_status ON retirement_requests(status);
CREATE INDEX idx_retirement_requests_requester ON retirement_requests(requester_id);
```

### A.2 retirement_history 表 DDL

```sql
CREATE TABLE retirement_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id VARCHAR(50) NOT NULL REFERENCES assets(id),
    action VARCHAR(20) NOT NULL CHECK (action IN ('SUBMIT', 'APPROVE', 'REJECT')),
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    operator_id VARCHAR(50) NOT NULL REFERENCES users(id),
    detail JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_retirement_history_asset_id ON retirement_history(asset_id);
CREATE INDEX idx_retirement_history_created_at ON retirement_history(created_at DESC);
```

---

## 附录 B: 状态机状态定义

```python
# src/models/enums.py
class AssetStatus(str, Enum):
    """资产状态枚举"""
    ACTIVE = "ACTIVE"
    PENDING_RETIREMENT = "PENDING_RETIREMENT"
    RETIRED = "RETIRED"
    UNDER_MAINTENANCE = "UNDER_MAINTENANCE"
    DISPOSED = "DISPOSED"

class RetirementStatus(str, Enum):
    """退役申请状态"""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class RetirementAction(str, Enum):
    """退役历史动作"""
    SUBMIT = "SUBMIT"
    APPROVE = "APPROVE"
    REJECT = "REJECT"
```

---

## 附录 C: 异常类定义

```python
# src/models/asset_retirement.py

class RetirementErrorCode(str, Enum):
    """退役相关错误码"""
    ASSET_NOT_FOUND = "ASSET_NOT_FOUND"
    ASSET_NOT_IN_ACTIVE_STATE = "ASSET_NOT_IN_ACTIVE_STATE"
    REQUEST_NOT_FOUND = "REQUEST_NOT_FOUND"
    VERSION_CONFLICT = "VERSION_CONFLICT"
    FINAL_STATE_UNMODIFIABLE = "FINAL_STATE_UNMODIFIABLE"
    INSUFFICIENT_PERMISSION = "INSUFFICIENT_PERMISSION"
    INVALID_REASON_REQUIRED = "INVALID_REASON_REQUIRED"
    REASON_DETAIL_REQUIRED = "REASON_DETAIL_REQUIRED"
    CONCURRENT_REQUEST_EXISTS = "CONCURRENT_REQUEST_EXISTS"

class VersionConflictError(BusinessException):
    """版本冲突异常"""
    def __init__(self, expected_version: int, actual_version: int):
        super().__init__(
            code=RetirementErrorCode.VERSION_CONFLICT,
            message="版本冲突，请刷新后重试",
            details={"expected_version": expected_version, "actual_version": actual_version}
        )

class InvalidTransitionError(BusinessException):
    """无效状态转换异常"""
    pass

class FinalStateError(BusinessException):
    """终态不可修改异常"""
    def __init__(self, current_status: str):
        super().__init__(
            code=RetirementErrorCode.FINAL_STATE_UNMODIFIABLE,
            message=f"资产已处于终态 {current_status}，不可修改",
            details={"current_status": current_status}
        )
```

---

**文档结束**

---

## 变更记录

| 版本 | 日期 | 作者 | 变更描述 |
|-----|------|-----|---------|
| v1.0 | 2024-XX-XX | SWARM Team | 初始版本 |