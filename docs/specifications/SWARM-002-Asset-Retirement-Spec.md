# SWARM-002 资产报废退役流程 - 规格指导文档

**版本**: v1.0  
**Task ID**: SWARM-002  
**Iteration**: 1  
**状态**: 规格评审中  
**创建日期**: 2024年

---

## 1. 需求与背景

### 1.1 业务场景

资产管理生命周期中，资产从采购入库开始经历使用、维护、最终面临报废或退役处置。当前系统缺失资产报废退役的标准化流程，导致以下问题：

| 问题类型 | 具体描述 |
|---------|---------|
| 流程缺失 | 资产报废缺乏统一审批机制 |
| 追溯困难 | 报废状态不可追溯，审批历史难以查询 |
| 数据孤岛 | 历史资产数据无法闭环管理 |
| 权限混乱 | 报废申请人与审批人职责边界不清晰 |

### 1.2 核心需求

| 需求项 | 描述 | 优先级 |
|--------|------|--------|
| RQ-001 | 用户可提交资产报废申请，关联目标资产及报废原因 | P0 |
| RQ-002 | 报废申请按审批链自动路由至责任人 | P0 |
| RQ-003 | 审批人可批准或驳回报废申请 | P0 |
| RQ-004 | 用户可实时跟踪报废申请的审批进度 | P1 |
| RQ-005 | 审批完成后资产状态自动流转至"已报废" | P0 |

### 1.3 关键实体关系

```
┌─────────────────┐       ┌──────────────────────────┐
│      Asset      │       │  RetirementApplication   │
├─────────────────┤       ├──────────────────────────┤
│ id: UUID        │◄──────│ asset_id: FK             │
│ asset_code      │       │ applicant_id: FK         │
│ name            │       │ reason: String           │
│ status          │       │ status: Enum             │
└─────────────────┘       │ current_approver_id: FK  │
                           │ created_at               │
                           └──────────┬───────────────┘
                                      │
                           ┌──────────▼───────────────┐
                           │      ApprovalNode         │
                           ├───────────────────────────┤
                           │ request_id: FK           │
                           │ approver_id: FK           │
                           │ sequence: Integer         │
                           │ decision: Enum            │
                           │ comment: String           │
                           └───────────────────────────┘
```

### 1.4 资产状态机定义

```
                    ┌────────────────────────────────────────────────────────┐
                    │                                                        │
                    ▼                                                        │
┌─────────┐   submit    ┌─────────────────────┐   approve   ┌────────────────┴───┐
│ IN_USE  │ ───────────►│ PENDING_RETIREMENT │ ──────────►│      SCRAPPED      │
└─────────┘             └─────────┬───────────┘             └────────────────────┘
        ▲                         │
        │                         │ reject
        │                         ▼
        └─────────────────────────┘
        
状态说明:
- IN_USE: 资产正常使用中，可发起报废申请
- PENDING_RETIREMENT: 报废申请待审批，资产暂不可用
- SCRAPPED: 资产已报废完成
```

---

## 2. 当前 Phase 对应实施目标

### 2.1 整体迭代计划

| Phase | 名称 | 状态 | 描述 |
|-------|------|------|------|
| Phase 1 | 资产状态枚举扩展 | 已完成 | 新增 SCRAPPED 状态及相关枚举 |
| Phase 2 | 报废申请与审批基础流程 | 当前 | 单级审批 + 状态流转 |
| Phase 3 | 审批链可视化 + 多级审批 | 待开发 | 复杂审批链支持 |
| Phase 4 | 批量报废 + 导出报表 | 待开发 | 批量操作与数据导出 |

### 2.2 Iteration 1 交付范围

本次迭代聚焦于**最小可行审批流程 (MVP)**，具体交付物如下：

#### 后端交付物

| 交付物 | 文件路径 | 说明 |
|--------|----------|------|
| 报废申请实体 | `backend/src/main/java/com/ams/entity/RetirementApplication.java` | 报废申请数据模型 |
| 审批节点实体 | `backend/src/main/java/com/ams/entity/ApprovalNode.java` | 审批链节点定义 |
| 状态枚举 | `backend/src/main/java/com/ams/state/RetirementState.java` | 申请状态枚举 |
| 报废服务 | `backend/src/main/java/com/ams/service/RetirementService.java` | 业务逻辑层 |
| 报废控制器 | `backend/src/main/java/com/ams/controller/RetirementController.java` | REST API |
| 状态机 | `backend/src/main/java/com/ams/state/AssetStateMachine.java` | 状态流转控制 |

#### 前端交付物

| 交付物 | 文件路径 | 说明 |
|--------|----------|------|
| 权限钩子 | `frontend/src/composables/useApprovalPermission.ts` | 审批权限校验 |
| 趋势图表 | `frontend/src/app/pages/OperationLogDashboard/components/TrendChart.tsx` | 操作日志趋势展示 |
| 审计面板样式 | `frontend/src/app/pages/AuditDashboard/AuditDashboard.module.css` | 审计仪表板样式 |
| 筛选栏样式 | `frontend/src/app/pages/AuditDashboard/components/FilterBar/FilterBar.module.css` | 筛选栏组件样式 |
| 审批状态管理 | `frontend/src/stores/approvalStore.ts` | Redux 状态管理 |

---

## 3. 边界约束

### 3.1 功能边界

| 约束项 | 约束编号 | 描述 |
|--------|----------|------|
| 单级审批 | BC-001 | 本次 Iteration 仅支持单一审批人，不支持会签或多级审批链 |
| 单资产申请 | BC-002 | 一次报废申请仅关联一个资产，不支持批量报废 |
| 状态限制 | BC-003 | 仅 `IN_USE` 状态的资产可发起报废申请 |
| 权限隔离 | BC-004 | 申请人不可审批自己的申请 |
| 草稿机制 | BC-005 | 申请提交前可保存草稿，提交后不可修改 |
| 不可逆审批 | BC-006 | 审批通过后不可撤回，仅可驳回后重新申请 |

### 3.2 非功能边界

| 约束项 | 约束编号 | 描述 |
|--------|----------|------|
| 暂不实现 | NB-001 | 暂不实现附件上传功能 |
| 暂不实现 | NB-002 | 暂不实现消息通知（邮件/站内信） |
| 暂不实现 | NB-003 | 暂不实现报废资产的后续处置跟踪 |
| 暂不实现 | NB-004 | 暂不实现报废资产的价值评估 |

### 3.3 技术约束

| 约束项 | 约束编号 | 描述 |
|--------|----------|------|
| 后端框架 | TC-001 | 使用 Django REST Framework / Spring Boot |
| 前端框架 | TC-002 | 使用 React + TypeScript |
| 数据库事务 | TC-003 | 审批状态更新必须保证原子性 |
| API 版本 | TC-004 | RESTful API 统一使用 `/api/v1/` 前缀 |
| 认证方式 | TC-005 | 使用 JWT Token 进行身份认证 |

---

## 4. 验收测试基准 (ATB)

### 4.1 后端 API 测试

测试框架: `pytest` + `pytest-django`  
测试文件: `tests/api/test_retirement_api.py`

#### ATB-001: 报废申请创建

```python
# Test Case: ATB-001
def test_create_retirement_request_success(api_client, asset_in_use, user):
    """
    Given: 存在 IN_USE 状态的资产
    When:  用户提交有效的报废申请
    Then:  返回 201 Created
          RetirementApplication.status == 'PENDING'
          Asset.status 自动变更为 'PENDING_RETIREMENT'
          审批链自动创建单条 ApprovalNode 记录
    """
```

**物理测试期待**:
- HTTP 响应: `POST /api/v1/retirements/` → 201 Created
- 数据库 `retirement_applications` 表插入 1 条记录
- 数据库 `assets` 表对应记录 `status` 变更为 `PENDING_RETIREMENT`
- 数据库 `approval_nodes` 表插入 1 条审批记录

#### ATB-002: 申请状态校验

```python
# Test Case: ATB-002
def test_create_retirement_invalid_asset_status(api_client, asset_not_in_use):
    """
    Given: 资产状态不为 IN_USE
    When:  提交报废申请
    Then:  返回 400 Bad Request
          错误信息包含 "资产状态不允许报废申请"
    """
```

**物理测试期待**:
- HTTP 响应: `POST /api/v1/retirements/` → 400 Bad Request
- 错误响应体: `{"code": "INVALID_ASSET_STATUS", "message": "资产状态不允许报废申请"}`
- 数据库无新记录插入

#### ATB-003: 审批通过

```python
# Test Case: ATB-003
def test_approve_retirement_request(api_client, retirement_request, approver_user):
    """
    Given: 存在 PENDING 状态的报废申请
    When:  审批人批准申请
    Then:  返回 200 OK
          RetirementApplication.status == 'APPROVED'
          Asset.status 变更为 'SCRAPPED'
          ApprovalNode.decision == 'APPROVED'
    """
```

**物理测试期待**:
- HTTP 响应: `POST /api/v1/retirements/{id}/approve/` → 200 OK
- 资产状态最终为 `SCRAPPED`
- 审批节点 decision 字段更新为 `APPROVED`

#### ATB-004: 审批驳回

```python
# Test Case: ATB-004
def test_reject_retirement_request(api_client, retirement_request, approver_user):
    """
    Given: 存在 PENDING 状态的报废申请
    When:  审批人驳回申请
    Then:  返回 200 OK
          RetirementApplication.status == 'REJECTED'
          Asset.status 回退为 'IN_USE'
    """
```

**物理测试期待**:
- HTTP 响应: `POST /api/v1/retirements/{id}/reject/` → 200 OK
- 资产状态恢复为 `IN_USE`
- 审批节点 decision 字段更新为 `REJECTED`

#### ATB-005: 进度查询

```python
# Test Case: ATB-005
def test_get_retirement_progress(api_client, user, retirement_request):
    """
    Given: 存在报废申请
    When:  申请人查询进度
    Then:  返回包含当前审批状态和审批历史的完整对象
    """
```

**物理测试期待**:
- HTTP 响应: `GET /api/v1/retirements/{id}/progress/` → 200 OK
- 响应包含字段: `status`, `current_approver`, `approval_history`, `asset_info`

### 4.2 前端功能测试

测试框架: Playwright  
测试文件: `tests/e2e/retirement_flow.spec.ts`

#### ATB-006: 报废申请页面渲染

```typescript
// Test Case: ATB-006
test('retirement application page loads correctly', async ({ page }) => {
  await page.goto('/assets/retirement/new');
  
  // 验证页面关键元素
  await expect(page.locator('form')).toBeVisible();
  await expect(page.locator('#asset-selector')).toBeVisible();
  await expect(page.locator('#reason-select')).toBeVisible();
  await expect(page.locator('#description-input')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});
```

**物理测试期待**: 页面加载成功，所有关键表单元素可见

#### ATB-007: 提交申请流程

```typescript
// Test Case: ATB-007
test('submit retirement application', async ({ page }) => {
  await page.goto('/assets/retirement/new');
  
  // 选择资产
  await page.selectOption('#asset-selector', 'AST-001');
  
  // 选择报废原因
  await page.selectOption('#reason-select', 'DAMAGED');
  
  // 填写描述
  await page.fill('#description-input', '设备老化严重，无法继续使用');
  
  // 提交申请
  await page.click('button[type="submit"]');
  
  // 验证成功提示
  await expect(page.locator('.toast-success')).toBeVisible();
  
  // 验证跳转至进度页面
  await expect(page).toHaveURL(/\/retirement\/\w+\/progress/);
});
```

**物理测试期待**: 
- 表单提交成功
- 显示成功提示 toast
- 页面跳转至进度跟踪页面

#### ATB-008: 审批进度可视化

```typescript
// Test Case: ATB-008
test('view approval progress', async ({ page }) => {
  await page.goto('/retirement/RET-001/progress');
  
  // 验证状态展示
  await expect(page.locator('.status-badge')).toContainText('审批中');
  
  // 验证审批人信息
  await expect(page.locator('.approver-name')).toContainText('张经理');
  
  // 验证时间线组件
  await expect(page.locator('.timeline')).toBeVisible();
  await expect(page.locator('.timeline-item')).toHaveCount(1);
});
```

**物理测试期待**: 进度页面展示当前状态、审批人、时间线组件

### 4.3 单元测试

测试框架: Jest  
测试文件: `frontend/src/stores/approvalStore.test.ts`

#### ATB-009: 状态管理初始化

```typescript
// Test Case: ATB-009
test('approvalStore initializes with correct default state', () => {
  const state = approvalStore.getState();
  
  expect(state.retirements).toEqual([]);
  expect(state.currentRetirement).toBeNull();
  expect(state.loading).toBe(false);
  expect(state.error).toBeNull();
});
```

**物理测试期待**: Redux store 初始化状态符合预期

#### ATB-010: 权限校验

```typescript
// Test Case: ATB-010
test('canApprove returns true for authorized user', () => {
  const permission = useApprovalPermission({
    userId: 'user-002',
    retirement: mockRetirement,
    approvers: ['user-002', 'user-003'],
  });
  
  expect(permission.canApprove).toBe(true);
  expect(permission.canReject).toBe(true);
});
```

**物理测试期待**: 授权用户可执行审批操作

---

## 5. 开发切入层级序列

### 5.1 层级 1: 数据模型层 (Day 1)

**目标**: 完成数据库表结构设计和 ORM 映射

```
1.1 数据库迁移
    ├── retirement_applications 表
    │   ├── id (PK, UUID)
    │   ├── asset_id (FK)
    │   ├── applicant_id (FK)
    │   ├── reason (VARCHAR)
    │   ├── description (TEXT)
    │   ├── status (ENUM)
    │   ├── current_approver_id (FK)
    │   ├── created_at (TIMESTAMP)
    │   └── updated_at (TIMESTAMP)
    │
    └── approval_nodes 表
        ├── id (PK, UUID)
        ├── request_id (FK)
        ├── approver_id (FK)
        ├── sequence (INT)
        ├── decision (ENUM)
        ├── comment (TEXT)
        └── decided_at (TIMESTAMP)

1.2 Django Models / JPA Entities
    ├── RetirementApplication.java
    └── ApprovalNode.java

1.3 单元测试
    └── tests/unit/test_retirement_model.py
```

### 5.2 层级 2: 服务层 (Day 1-2)

**目标**: 实现业务逻辑和状态机

```
2.1 RetirementService
    ├── create_retirement_request(asset_id, applicant_id, reason)
    ├── approve_request(request_id, approver_id, comment)
    ├── reject_request(request_id, approver_id, comment)
    └── get_progress(request_id)

2.2 AssetStateMachine
    ├── validate_transition(current_state, target_state, operation)
    ├── execute_transition(asset_id, operation)
    └── get_allowed_operations(asset_id)

2.3 业务规则校验
    ├── 资产状态校验 (BC-003)
    ├── 权限校验 (BC-004)
    └── 申请人 ≠ 审批人
```

### 5.3 层级 3: API 层 (Day 2)

**目标**: 提供 RESTful API 接口

```
3.1 Serializers
    ├── RetirementApplicationSerializer
    │   ├── id (read_only)
    │   ├── asset_id (write_only)
    │   ├── reason (required)
    │   ├── description (optional)
    │   ├── status (read_only)
    │   └── current_approver (nested)
    │
    ├── ApprovalNodeSerializer
    │   ├── approver (nested)
    │   ├── decision
    │   └── comment
    │
    └── RetirementProgressSerializer
        ├── status
        ├── current_approver
        ├── approval_history (list)
        └── asset_info (nested)

3.2 ViewSets
    └── RetirementRequestViewSet
        ├── POST   /retirements/                    # 创建申请
        ├── GET    /retirements/                     # 列表查询
        ├── GET    /retirements/{id}/                # 详情
        ├── GET    /retirements/{id}/progress/       # 审批进度
        ├── POST   /retirements/{id}/approve/        # 批准
        └── POST   /retirements/{id}/reject/          # 驳回

3.3 URL 路由配置
    └── api/v1/retirements/
```

### 5.4 层级 4: 前端组件层 (Day 3)

**目标**: 实现用户交互界面

```
4.1 页面组件
    ├── RetirementApplicationPage
    │   ├── AssetSelector
    │   ├── ReasonSelect
    │   ├── DescriptionInput
    │   └── SubmitButton
    │
    └── RetirementProgressPage
        ├── StatusBadge
        ├── ApproverInfo
        ├── ApprovalTimeline
        └── ActionButtons

4.2 共享组件
    ├── AssetSelector
    │   └── 从资产列表选择
    ├── StatusBadge
    │   └── 状态展示徽章
    └── ApprovalTimeline
        └── 审批历史时间线

4.3 状态管理 (Redux Toolkit)
    └── approvalStore.ts
        ├── retirements: RetirementRequest[]
        ├── currentRetirement: RetirementRequest | null
        ├── loading: boolean
        ├── error: string | null
        └── actions: submit, approve, reject, fetchProgress
```

### 5.5 层级 5: 集成与验收 (Day 3-4)

**目标**: 端到端测试和验收

```
5.1 端到端测试
    ├── Playwright E2E 测试
    │   ├── retirement_flow.spec.ts
    │   └── approval.spec.ts
    │
    └── 用户操作流程覆盖
        ├── 登录 → 选择资产 → 提交申请
        ├── 审批人登录 → 查看待审批 → 批准/驳回
        └── 申请人登录 → 查看进度

5.2 API 集成测试
    ├── pytest 完整覆盖 ATB-001 ~ ATB-005
    └── 边界条件测试

5.3 手动验收检查
    └── 实际资产状态流转验证
```

---

## 6. API 规范摘要

### 6.1 API 端点列表

| 方法 | 端点 | 描述 | 请求体 | 响应码 |
|------|------|------|--------|--------|
| POST | `/api/v1/retirements/` | 创建报废申请 | RetirementApplicationDTO | 201 |
| GET | `/api/v1/retirements/` | 列表查询 | - | 200 |
| GET | `/api/v1/retirements/{id}/` | 详情 | - | 200 |
| GET | `/api/v1/retirements/{id}/progress/` | 审批进度 | - | 200 |
| POST | `/api/v1/retirements/{id}/approve/` | 批准 | ApprovalActionDTO | 200 |
| POST | `/api/v1/retirements/{id}/reject/` | 驳回 | ApprovalActionDTO | 200 |

### 6.2 请求/响应示例

#### 创建报废申请

**Request:**
```json
POST /api/v1/retirements/
{
  "asset_id": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "DAMAGED",
  "description": "设备老化严重，无法继续使用"
}
```

**Response:**
```json
{
  "code": 201,
  "message": "success",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "asset_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "PENDING",
    "current_approver": {
      "id": "user-002",
      "name": "张经理"
    },
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

#### 查询审批进度

**Request:**
```json
GET /api/v1/retirements/660e8400-e29b-41d4-a716-446655440001/progress/
```

**Response:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "status": "PENDING",
    "asset": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Dell 服务器 R740",
      "code": "AST-2023-001"
    },
    "current_approver": {
      "id": "user-002",
      "name": "张经理"
    },
    "approval_history": [
      {
        "approver": "张经理",
        "decision": "PENDING",
        "decided_at": null,
        "comment": null
      }
    ],
    "timeline": [
      {
        "step": 1,
        "status": "pending",
        "title": "审批中"
      }
    ]
  }
}
```

---

## 7. 错误码定义

| 错误码 | 错误类型 | 描述 | HTTP 状态码 |
|--------|----------|------|-------------|
| INVALID_ASSET_STATUS | 参数错误 | 资产状态不允许报废申请 | 400 |
| ASSET_NOT_FOUND | 资源不存在 | 指定的资产不存在 | 404 |
| REQUEST_NOT_FOUND | 资源不存在 | 报废申请不存在 | 404 |
| PERMISSION_DENIED | 权限错误 | 无权执行此操作 | 403 |
| SELF_APPROVAL_NOT_ALLOWED | 业务规则 | 申请人不能审批自己的申请 | 400 |
| INVALID_TRANSITION | 状态错误 | 不允许的状态转换 | 400 |
| ALREADY_PROCESSED | 业务规则 | 申请已被处理 | 400 |

---

## 8. 附录

### 8.1 枚举定义

```java
// 资产状态
public enum AssetStatus {
    IN_USE,           // 正常使用
    PENDING_RETIREMENT,  // 待报废
    SCRAPPED          // 已报废
}

// 报废申请状态
public enum RetirementStatus {
    DRAFT,      // 草稿
    PENDING,    // 待审批
    APPROVED,   // 已批准
    REJECTED    // 已驳回
}

// 报废原因
public enum RetirementReason {
    DAMAGED,       // 损坏
    OBSOLETE,      // 淘汰
    EXPIRED,       // 过期
    LOST,          // 丢失
    OTHER          // 其他
}

// 审批决策
public enum ApprovalDecision {
    PENDING,    // 待决策
    APPROVED,   // 批准
    REJECTED    // 驳回
}
```

### 8.2 相关文档链接

| 文档 | 路径 |
|------|------|
| API 测试用例 | `tests/api/test_retirement_api.py` |
| E2E 测试用例 | `tests/e2e/retirement_flow.spec.ts` |
| 状态机测试 | `tests/state_machine/test_retirement_sm.py` |
| 后端服务实现 | `backend/src/main/java/com/ams/service/RetirementService.java` |
| 前端状态管理 | `frontend/src/stores/approvalStore.ts` |

---

**文档版本历史**

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2024-01-15 | 系统 | 初始版本创建 |