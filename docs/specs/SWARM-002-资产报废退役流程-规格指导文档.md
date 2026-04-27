# SWARM-002 资产报废退役流程 - 规格指导文档

**版本**: v1.0  
**Task ID**: SWARM-002  
**Iteration**: 1  
**状态**: 规格评审中  
**最后更新**: 2024年

---

## 1. 需求与背景

### 1.1 业务场景

资产管理生命周期中，资产从采购入库开始经历使用、维护、最终面临报废或退役处置。当前系统缺失资产报废退役的标准化流程，导致：

- 资产报废缺乏统一审批机制
- 报废状态不可追溯
- 历史资产数据无法闭环管理

### 1.2 核心需求

| 需求项 | 描述 | 优先级 |
|--------|------|--------|
| RQ-001 | 用户可提交资产报废申请，关联目标资产及报废原因 | P0 |
| RQ-002 | 报废申请按审批链自动路由至责任人 | P0 |
| RQ-003 | 审批人可批准或驳回报废申请 | P0 |
| RQ-004 | 用户可实时跟踪报废申请的审批进度 | P1 |
| RQ-005 | 审批完成后资产状态自动流转至"已报废" | P0 |

### 1.3 关键实体

```python
# src/models/asset_retirement.py
class AssetRetirement:
    id: str
    asset_id: str
    asset_code: str  # 资产唯一编码
    retirement_type: RetirementType  # SCRAPPED, RETIRED
    reason: str
    description: str
    applicant_id: str
    current_approver_id: str
    status: RetirementStatus  # DRAFT, PENDING, APPROVED, REJECTED
    created_at: datetime
    updated_at: datetime

class RetirementHistory:
    id: str
    retirement_id: str
    action: str  # SUBMIT, APPROVE, REJECT
    actor_id: str
    comment: str
    timestamp: datetime
```

### 1.4 状态机定义

```
Asset Status Transitions:
┌─────────┐     submit      ┌─────────────────────┐
│ IN_USE  │ ──────────────→│ PENDING_RETIREMENT  │
└─────────┘                └──────────┬──────────┘
      ↑                               │
      │         reject                │ approve
      └───────────────────────────────┘
      

RetirementRequest Status:
DRAFT → PENDING → APPROVED
                → REJECTED
```

---

## 2. 当前 Phase 对应实施目标

### Phase 2: 报废申请与审批基础流程（本次 Iteration）

参照整体计划，Phase 2 聚焦于**最小可行审批流程**的实现：

```
Phase 1 (已完成): 资产状态枚举扩展
     ↓
Phase 2 (本次): 报废申请提交 → 单级审批 → 状态更新 ← [当前]
     ↓
Phase 3: 审批链可视化 + 多级审批
     ↓
Phase 4: 批量报废 + 导出报表
```

### 本次 Iteration 交付范围

| 交付物 | 负责人 | 说明 |
|--------|--------|------|
| 后端 API | Backend Dev | 报废申请 CRUD、审批操作接口 |
| 数据模型 | Backend Dev | RetirementRequest, ApprovalChain 表结构 |
| 状态机 | Backend Dev | 资产状态流转逻辑 |
| 前端页面 | Frontend Dev | 报废申请表单 + 审批进度跟踪 |
| 测试用例 | QA | 单元测试 + E2E 测试 |

### 2.1 后端服务交付清单

| 服务文件 | 类/方法 | 职责 |
|----------|---------|------|
| `src/services/approval_service.py` | `ApprovalService` | 审批核心逻辑 |
| `src/services/approval_chain_service.py` | `ApprovalChainService` | 审批链管理 |
| `src/services/retirement_service.py` | `RetirementService` | 报废申请业务逻辑 |
| `src/services/scrap_service.py` | `ScrapService` | 报废处置逻辑 |
| `src/services/notification_service.py` | `NotificationService` | 通知分发 |
| `src/services/status_history_service.py` | `StatusHistoryService` | 状态变更记录 |
| `src/state_machine/retirement_state_machine.py` | `RetirementStateMachine` | 状态机定义 |

### 2.2 前端交付清单

| 文件路径 | 修改内容 |
|----------|----------|
| `frontend/src/composables/useApprovalPermission.ts` | 权限校验逻辑 |
| `frontend/src/stores/approvalStore.ts` | 审批状态管理 |
| `frontend/src/app/pages/OperationLogDashboard/components/TrendChart.tsx` | 操作日志趋势图 |
| `frontend/src/app/pages/AuditDashboard/AuditDashboard.module.css` | 审计仪表盘样式 |
| `frontend/src/app/pages/AuditDashboard/components/FilterBar/FilterBar.module.css` | 筛选栏样式 |

---

## 3. 边界约束

### 3.1 功能边界

| 约束项 | 描述 | 级别 |
|--------|------|------|
| BC-001 | **单级审批**: 本次 Iteration 仅支持单一审批人，不支持会签或多级审批链 | Must |
| BC-002 | **单资产申请**: 一次报废申请仅关联一个资产，不支持批量报废 | Must |
| BC-003 | **状态限制**: 仅 `IN_USE` 状态的资产可发起报废申请 | Must |
| BC-004 | **操作权限**: 申请人不可审批自己的申请 | Must |
| BC-005 | **草稿状态**: 申请提交前可保存草稿，提交后不可修改 | Should |

### 3.2 非功能边界

| 约束项 | 描述 | 级别 |
|--------|------|------|
| NB-001 | 暂不实现附件上传功能 | Won't |
| NB-002 | 暂不实现消息通知（邮件/站内信） | Won't |
| NB-003 | 暂不实现报废资产的后续处置跟踪 | Won't |
| NB-004 | 暂不实现报废资产残值计算 | Won't |

### 3.3 技术约束

| 约束项 | 描述 | 技术选型 |
|--------|------|----------|
| TC-001 | RESTful API 规范 | FastAPI / Django REST Framework |
| TC-002 | 数据库事务保证审批状态更新的原子性 | ACID 事务 |
| TC-003 | 前端状态管理 | Redux Toolkit / Zustand |
| TC-004 | E2E 测试框架 | Playwright |
| TC-005 | 单元测试框架 | pytest / Jest |

---

## 4. 验收测试基准 (ATB)

### 4.1 后端 API 测试

测试文件: `tests/api/test_retirement_api.py`

#### ATB-001: 报废申请创建

```python
# Test Case: ATB-001
def test_create_retirement_request_success(api_client, asset_in_use, user):
    """
    Given: 存在 IN_USE 状态的资产
    When:  用户提交有效的报废申请
    Then:  返回 201 Created
          RetirementRequest.status == 'PENDING'
          Asset.status 自动变更为 'PENDING_RETIREMENT'
          审批链自动创建单条记录
    """
    # Arrange
    asset = asset_in_use
    payload = {
        "asset_id": asset.id,
        "reason": "DAMAGED",
        "description": "设备老化严重，无法继续使用"
    }
    
    # Act
    response = api_client.post("/api/v1/retirements/", json=payload)
    
    # Assert
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "PENDING"
    assert data["asset_id"] == asset.id
```

**物理测试期待**:
- `POST /api/v1/retirements/` 返回 201
- 数据库 `retirement_requests` 表插入 1 条记录
- 数据库 `assets` 表对应记录 `status` 变更为 `PENDING_RETIREMENT`
- 数据库 `approval_chains` 表插入 1 条审批记录

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
    # Arrange
    asset = asset_not_in_use  # status = 'RETIRED'
    payload = {
        "asset_id": asset.id,
        "reason": "DAMAGED"
    }
    
    # Act
    response = api_client.post("/api/v1/retirements/", json=payload)
    
    # Assert
    assert response.status_code == 400
    assert "资产状态不允许报废申请" in response.json()["message"]
```

**物理测试期待**:
- `POST /api/v1/retirements/` 返回 400
- 数据库无新记录插入

#### ATB-003: 审批通过

```python
# Test Case: ATB-003
def test_approve_retirement_request(api_client, retirement_request, approver_user):
    """
    Given: 存在 PENDING 状态的报废申请
    When:  审批人批准申请
    Then:  返回 200 OK
          RetirementRequest.status == 'APPROVED'
          Asset.status 变更为 'SCRAPPED'
          ApprovalChain.decision == 'APPROVED'
    """
    # Arrange
    request_id = retirement_request.id
    
    # Act
    response = api_client.post(
        f"/api/v1/retirements/{request_id}/approve/",
        json={"comment": "同意报废"}
    )
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "APPROVED"
    
    # Verify asset status changed
    asset = Asset.objects.get(id=retirement_request.asset_id)
    assert asset.status == "SCRAPPED"
```

**物理测试期待**:
- `POST /api/v1/retirements/{id}/approve/` 返回 200
- 资产状态最终为 `SCRAPPED`

#### ATB-004: 审批驳回

```python
# Test Case: ATB-004
def test_reject_retirement_request(api_client, retirement_request, approver_user):
    """
    Given: 存在 PENDING 状态的报废申请
    When:  审批人驳回申请
    Then:  返回 200 OK
          RetirementRequest.status == 'REJECTED'
          Asset.status 回退为 'IN_USE'
    """
    # Arrange
    request_id = retirement_request.id
    
    # Act
    response = api_client.post(
        f"/api/v1/retirements/{request_id}/reject/",
        json={"comment": "资产仍在使用中，不同意报废"}
    )
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "REJECTED"
    
    # Verify asset status reverted
    asset = Asset.objects.get(id=retirement_request.asset_id)
    assert asset.status == "IN_USE"
```

**物理测试期待**:
- `POST /api/v1/retirements/{id}/reject/` 返回 200
- 资产状态恢复为 `IN_USE`

#### ATB-005: 进度查询

```python
# Test Case: ATB-005
def test_get_retirement_progress(api_client, user, retirement_request):
    """
    Given: 存在报废申请
    When:  申请人查询进度
    Then:  返回包含当前审批状态和审批历史的完整对象
    """
    # Act
    response = api_client.get(
        f"/api/v1/retirements/{retirement_request.id}/progress/"
    )
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "current_approver" in data
    assert "approval_history" in data
    assert len(data["approval_history"]) >= 1
```

**物理测试期待**:
- `GET /api/v1/retirements/{id}/progress/` 返回 200
- 响应包含 `status`, `current_approver`, `approval_history` 字段

---

### 4.2 前端功能测试

测试文件: `tests/e2e/retirement_flow.spec.ts`

#### ATB-006: 报废申请页面渲染

```typescript
// Test Case: ATB-006
test('retirement application page loads correctly', async ({ page }) => {
  await page.goto('/assets/retirement/new');
  
  // Verify page title
  await expect(page).toHaveTitle(/报废申请/);
  
  // Verify form elements exist
  await expect(page.locator('form')).toBeVisible();
  await expect(page.locator('#asset-selector')).toBeVisible();
  await expect(page.locator('#reason-select')).toBeVisible();
  await expect(page.locator('#description-input')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
  
  // Verify asset selector shows available assets
  const assetOptions = page.locator('#asset-selector option');
  await expect(assetOptions).toHaveCount({ greaterThan: 1 });
});
```

**物理测试期待**: 页面加载成功，关键表单元素可见，资产下拉框非空

#### ATB-007: 提交申请流程

```typescript
// Test Case: ATB-007
test('submit retirement application', async ({ page }) => {
  // Login first
  await page.goto('/login');
  await page.fill('[data-testid="username-input"]', 'asset_manager');
  await page.fill('[data-testid="password-input"]', 'password');
  await page.click('[data-testid="login-button"]');
  
  // Navigate to retirement application
  await page.goto('/assets/retirement/new');
  
  // Fill form
  await page.selectOption('#asset-selector', { index: 1 });
  await page.selectOption('#reason-select', 'DAMAGED');
  await page.fill('#description-input', '设备老化严重');
  
  // Submit
  await page.click('button[type="submit"]');
  
  // Verify success
  await expect(page.locator('.toast-success')).toBeVisible();
  await expect(page.locator('.toast-success')).toContainText('提交成功');
  
  // Verify redirect to progress page
  await expect(page).toHaveURL(/\/retirement\/\w+\/progress/);
});
```

**物理测试期待**: 
- 表单提交成功
- 显示成功提示 "提交成功"
- 跳转至进度跟踪页面

#### ATB-008: 审批进度可视化

```typescript
// Test Case: ATB-008
test('view approval progress', async ({ page }) => {
  // Login and navigate
  await loginUser(page, { username: 'asset_manager', password: 'password' });
  await page.goto('/retirement/RET-001/progress');
  
  // Verify status badge
  await expect(page.locator('.status-badge')).toBeVisible();
  await expect(page.locator('.status-badge')).toContainText('审批中');
  
  // Verify current approver info
  await expect(page.locator('.approver-name')).toContainText('张经理');
  await expect(page.locator('.approver-avatar')).toBeVisible();
  
  // Verify timeline
  await expect(page.locator('.timeline')).toBeVisible();
  const timelineItems = page.locator('.timeline-item');
  await expect(timelineItems).toHaveCount(2); // Submitted + Pending approval
  
  // Verify asset info section
  await expect(page.locator('.asset-code')).toContainText('AST-001');
  await expect(page.locator('.asset-name')).toContainText('笔记本电脑');
});
```

**物理测试期待**: 进度页面展示当前状态、审批人、时间线、资产信息

#### ATB-009: 审批人批准操作

```typescript
// Test Case: ATB-009
test('approver can approve retirement request', async ({ page }) => {
  // Login as approver
  await loginUser(page, { username: 'approver_manager', password: 'password' });
  
  // Navigate to pending approval
  await page.goto('/approvals/pending');
  await page.click('[data-testid="retirement-request-1"]');
  
  // View request details
  await expect(page.locator('.request-detail')).toBeVisible();
  await expect(page.locator('.asset-info')).toContainText('AST-001');
  
  // Approve
  await page.fill('#approval-comment', '同意报废处理');
  await page.click('button[data-testid="approve-btn"]');
  
  // Verify success
  await expect(page.locator('.toast-success')).toContainText('审批已完成');
  
  // Verify status changed
  await expect(page.locator('.status-badge')).toContainText('已批准');
});
```

**物理测试期待**: 审批人可批准请求，状态更新成功

#### ATB-010: 审批人驳回操作

```typescript
// Test Case: ATB-010
test('approver can reject retirement request', async ({ page }) => {
  // Login as approver
  await loginUser(page, { username: 'approver_manager', password: 'password' });
  
  // Navigate to pending approval
  await page.goto('/approvals/pending');
  await page.click('[data-testid="retirement-request-2"]');
  
  // Reject
  await page.fill('#approval-comment', '资产仍在使用中，不满足报废条件');
  await page.click('button[data-testid="reject-btn"]');
  
  // Verify success
  await expect(page.locator('.toast-success')).toContainText('已驳回');
  
  // Verify status changed
  await expect(page.locator('.status-badge')).toContainText('已驳回');
  
  // Verify applicant can see rejection reason
  await page.goto('/retirement/RET-002/progress');
  await expect(page.locator('.rejection-reason')).toContainText('资产仍在使用中');
});
```

**物理测试期待**: 审批人可驳回请求，申请人可查看驳回原因

---

## 5. 开发切入层级序列

### 层级 1: 数据模型层 (Day 1)

```
1.1 数据库迁移
    - 创建 retirement_requests 表
    - 创建 approval_chains 表
    - 添加索引 (asset_id, status, created_at)
    
1.2 定义数据模型
    - src/models/asset_retirement.py
    - src/models/approval_chain.py
    - src/models/approval_node.py
    
1.3 编写 Model 层单元测试
    - tests/unit/test_retirement_model.py
```

**关键代码片段**:

```python
# src/models/asset_retirement.py
from .enums import RetirementStatus, RetirementType

class AssetRetirement:
    """资产报废申请模型"""
    
    def __init__(
        self,
        asset_id: str,
        retirement_type: RetirementType,
        reason: str,
        applicant_id: str,
        **kwargs
    ):
        self.id = kwargs.get('id', generate_uuid())
        self.asset_id = asset_id
        self.asset_code = kwargs.get('asset_code')
        self.retirement_type = retirement_type
        self.reason = reason
        self.description = kwargs.get('description', '')
        self.applicant_id = applicant_id
        self.current_approver_id = kwargs.get('current_approver_id')
        self.status = RetirementStatus.DRAFT
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
```

### 层级 2: 状态机层 (Day 1)

```
2.1 状态机定义
    - src/state_machine/retirement_state_machine.py
    - 定义状态转换规则
    - 定义转换前置条件
    
2.2 状态转换守卫
    - src/state_machine/guards.py
    - validate_asset_status()
    - validate_approver_permission()
    
2.3 状态转换动作
    - src/state_machine/transitions.py
    - on_submit()
    - on_approve()
    - on_reject()
```

**关键代码片段**:

```python
# src/state_machine/retirement_state_machine.py
from .states import RetirementState, AssetState
from .guards import (
    can_submit_retirement,
    can_approve_retirement,
    can_reject_retirement
)

class RetirementStateMachine:
    """报废申请状态机"""
    
    TRANSITIONS = {
        RetirementState.DRAFT: {
            'submit': (RetirementState.PENDING, can_submit_retirement)
        },
        RetirementState.PENDING: {
            'approve': (RetirementState.APPROVED, can_approve_retirement),
            'reject': (RetirementState.REJECTED, can_reject_retirement)
        }
    }
    
    def __init__(self, retirement: AssetRetirement):
        self.retirement = retirement
    
    def transition(self, action: str, context: dict) -> bool:
        """执行状态转换"""
        current_state = self.retirement.status
        if action not in self.TRANSITIONS.get(current_state, {}):
            raise StateTransitionException(
                f"Invalid transition: {action} from {current_state}"
            )
        
        next_state, guard_fn = self.TRANSITIONS[current_state][action]
        
        if not guard_fn(self.retirement, context):
            raise StateTransitionException(
                f"Guard failed for transition: {action}"
            )
        
        self.retirement.status = next_state
        return True
```

### 层级 3: 服务层 (Day 1-2)

```
3.1 RetirementService
    - create_retirement_request()
    - submit_retirement_request()
    - get_retirement_details()
    - list_retirements()
    
3.2 ApprovalChainService
    - create_approval_chain()
    - get_current_approver()
    - advance_approval()
    
3.3 NotificationService
    - notify_approver()
    - notify_applicant()
    
3.4 业务规则校验
    - 资产状态校验
    - 权限校验
    - 重复申请校验
```

**关键代码片段**:

```python
# src/services/retirement_service.py
class RetirementService:
    """报废申请服务"""
    
    def __init__(self, repository: RetirementRepository):
        self.repository = repository
    
    def create_retirement_request(
        self,
        asset_id: str,
        reason: str,
        applicant_id: str,
        description: str = ''
    ) -> RetirementRequest:
        """创建报废申请（草稿状态）"""
        # 校验资产状态
        asset = self.asset_service.get_asset(asset_id)
        if asset.status != AssetStatus.IN_USE:
            raise BusinessException(
                "E_RETIREMENT_INVALID_ASSET_STATUS",
                "只有使用中的资产才能发起报废申请"
            )
        
        # 创建申请
        retirement = RetirementRequest(
            asset_id=asset_id,
            reason=reason,
            description=description,
            applicant_id=applicant_id,
            status=RetirementStatus.DRAFT
        )
        
        return self.repository.save(retirement)
    
    def submit_retirement_request(
        self,
        retirement_id: str,
        approver_id: str
    ) -> RetirementRequest:
        """提交报废申请"""
        retirement = self.repository.find_by_id(retirement_id)
        
        # 状态机转换
        self.state_machine.transition(
            'submit',
            {'approver_id': approver_id}
        )
        
        # 设置审批人
        retirement.current_approver_id = approver_id
        
        # 锁定资产状态
        self.asset_service.update_status(
            retirement.asset_id,
            AssetStatus.PENDING_RETIREMENT
        )
        
        # 发送通知
        self.notification_service.notify_approver(
            retirement,
            approver_id
        )
        
        return self.repository.save(retirement)
```

### 层级 4: API 层 (Day 2)

```
4.1 API 路由
    - src/api/routers/retirement_router.py
    - src/api/routes/retirement_routes.py
    
4.2 请求/响应 Schema
    - src/schemas/retirement_request.py
    - src/api/schemas/responses.py
    
4.3 ViewSet / APIView
    - RetirementViewSet
    - ApprovalViewSet
    
4.4 URL 路由配置
```

**API 规范摘要**:

| 方法 | 端点 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/v1/retirements/` | 创建报废申请 | `{asset_id, reason, description}` | 201 |
| GET | `/api/v1/retirements/` | 列表查询 | Query: `?status=&page=` | 200 |
| GET | `/api/v1/retirements/{id}/` | 详情 | - | 200 |
| POST | `/api/v1/retirements/{id}/submit/` | 提交申请 | `{approver_id}` | 200 |
| GET | `/api/v1/retirements/{id}/progress/` | 审批进度 | - | 200 |
| POST | `/api/v1/retirements/{id}/approve/` | 批准 | `{comment}` | 200 |
| POST | `/api/v1/retirements/{id}/reject/` | 驳回 | `{comment}` | 200 |

### 层级 5: 前端组件层 (Day 3)

```
5.1 页面组件
    - RetirementApplicationPage (申请表单)
    - RetirementProgressPage (进度跟踪)
    - RetirementListPage (申请列表)
    
5.2 共享组件
    - AssetSelector
    - StatusBadge
    - ApprovalTimeline
    - ReasonSelect
    
5.3 状态管理
    - stores/approvalStore.ts (Redux Toolkit)
    - stores/retirementStore.ts
    
5.4 权限钩子
    - composables/useApprovalPermission.ts
```

**关键代码片段**:

```typescript
// frontend/src/composables/useApprovalPermission.ts
/**
 * 报废审批权限校验 Hook
 * @description 校验用户对报废申请的审批权限
 */
export function useApprovalPermission() {
  const { user } = useAuth();
  
  /**
   * 校验是否可以审批指定申请
   * @param retirement - 报废申请对象
   * @returns 是否有审批权限
   */
  const canApprove = (retirement: RetirementRequest): boolean => {
    if (!user.value) return false;
    
    // 申请人不能审批自己的申请
    if (retirement.applicant_id === user.value.id) {
      return false;
    }
    
    // 必须是当前审批人
    if (retirement.current_approver_id !== user.value.id) {
      return false;
    }
    
    // 必须是待审批状态
    if (retirement.status !== RetirementStatus.PENDING) {
      return false;
    }
    
    return true;
  };
  
  /**
   * 校验是否可以查看申请详情
   * @param retirement - 报废申请对象
   * @returns 是否有查看权限
   */
  const canView = (retirement: RetirementRequest): boolean => {
    if (!user.value) return false;
    
    // 申请人可以查看
    if (retirement.applicant_id === user.value.id) {
      return true;
    }
    
    // 审批人可以查看
    if (retirement.current_approver_id === user.value.id) {
      return true;
    }
    
    // 管理员可以查看
    if (user.value.role === UserRole.ADMIN) {
      return true;
    }
    
    return false;
  };
  
  return {
    canApprove,
    canView
  };
}
```

```typescript
// frontend/src/stores/approvalStore.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

/**
 * 审批状态管理 Store
 * @description 管理报废审批相关的状态和操作
 */
interface ApprovalState {
  pendingApprovals: RetirementRequest[];
  currentRequest: RetirementRequest | null;
  progress: ApprovalProgress | null;
  loading: boolean;
  error: string | null;
}

const initialState: ApprovalState = {
  pendingApprovals: [],
  currentRequest: null,
  progress: null,
  loading: false,
  error: null,
};

/**
 * 获取待审批列表
 */
export const fetchPendingApprovals = createAsyncThunk(
  'approval/fetchPending',
  async () => {
    const response = await retirementApi.listPending();
    return response.data;
  }
);

/**
 * 批准报废申请
 */
export const approveRetirement = createAsyncThunk(
  'approval/approve',
  async ({ id, comment }: { id: string; comment: string }) => {
    const response = await retirementApi.approve(id, { comment });
    return response.data;
  }
);

/**
 * 驳回报废申请
 */
export const rejectRetirement = createAsyncThunk(
  'approval/reject',
  async ({ id, comment }: { id: string; comment: string }) => {
    const response = await retirementApi.reject(id, { comment });
    return response.data;
  }
);

const approvalSlice = createSlice({
  name: 'approval',
  initialState,
  reducers: {
    setCurrentRequest: (state, action: PayloadAction<RetirementRequest>) => {
      state.currentRequest = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPendingApprovals.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPendingApprovals.fulfilled, (state, action) => {
        state.loading = false;
        state.pendingApprovals = action.payload;
      })
      .addCase(fetchPendingApprovals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '获取待审批列表失败';
      });
  },
});

export const { setCurrentRequest, clearError } = approvalSlice.actions;
export default approvalSlice.reducer;
```

### 层级 6: 集成与验收 (Day 3-4)

```
6.1 端到端测试
    - Playwright E2E 测试
    - 用户操作流程覆盖
    
6.2 API 集成测试
    - pytest 完整覆盖
    
6.3 手动验收检查
    - 实际资产状态流转验证
```

---

## 6. 测试覆盖率目标

| 测试类型 | 覆盖率目标 | 测试文件 |
|----------|------------|----------|
| 单元测试 | 80%+ | `tests/unit/test_retirement_*.py` |
| 集成测试 | 70%+ | `tests/integration/test_retirement_*.py` |
| API 测试 | 90%+ | `tests/api/test_retirement_api.py` |
| E2E 测试 | 关键路径覆盖 | `tests/e2e/retirement_*.spec.ts` |

---

## 附录

### A. 相关文档

| 文档 | 路径 |
|------|------|
| API 规范 | `docs/api/retirement-api-spec.md` |
| 数据库 ER 图 | `docs/database/asset-retirement-er.png` |
| 状态机图 | `docs/diagrams/retirement-state-machine.png` |
| 测试模板 | `docs/testing/templates/` |

### B. 环境配置

```yaml
# .env.example
RETIREMENT_API_BASE_URL=http://localhost:8000/api/v1
RETIREMENT_APPROVAL_TIMEOUT=86400
RETIREMENT_AUTO_ESCALATION=false
```

### C. 错误码定义

| 错误码 | 描述 | HTTP 状态码 |
|--------|------|-------------|
| E_RETIREMENT_001 | 资产状态不允许报废 | 400 |
| E_RETIREMENT_002 | 报废申请不存在 | 404 |
| E_RETIREMENT_003 | 无权审批该申请 | 403 |
| E_RETIREMENT_004 | 申请状态不允许该操作 | 400 |
| E_RETIREMENT_005 | 重复提交 | 409 |

---

**文档结束**