# SWARM-2026-Q2-002: 资产报废退役流程与审批链集成

> **规格版本**: v4.0  
> **迭代周期**: Iteration 4  
> **编制日期**: 2026-04-20  
> **状态**: ✅ 已批准实施

---

## 1. 需求与背景

### 1.1 业务背景

资产管理系统中，资产报废/退役是资产全生命周期管理的关键终结环节。当前系统存在以下痛点：

| 问题 | 影响 |
|------|------|
| 报废决策缺乏规范化审批流程 | 资产处置随意性强，监管风险高 |
| 多级审批节点分散 | 信息不透明，审批效率低 |
| 历史状态变更无完整记录 | 资产追溯困难，审计合规性不足 |

### 1.2 功能范围

本次迭代聚焦**Phase 4: 审批链执行与历史追溯**的核心能力交付：

```
┌─────────────────────────────────────────────────────────────┐
│  资产生命周期全流程                                          │
├─────────────────────────────────────────────────────────────┤
│  采购入库 → 领用 → 维修 → 报废申请 → [多级审批] → 已报废     │
│                        ↑                                      │
│                   本次迭代重点:                               │
│                   1. 审批链执行引擎                          │
│                   2. 生命周期历史记录与可视化                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 里程碑对照表

| Phase | 描述 | 状态 | 对应 Milestone |
|-------|------|------|----------------|
| Phase 1 | 资产状态模型与基础数据层 | ✅ 已完成 | M1.1-M1.3 |
| Phase 2 | 报废申请表单与提交接口 | ✅ 已完成 | M2.1-M2.2 |
| Phase 3 | 审批链配置引擎 | ✅ 已完成 | M3.1-M3.3 |
| **Phase 4** | **审批链执行与历史追溯** | **🔄 本次迭代** | **M4.1-M4.4** |
| Phase 5 | 通知与告警集成 | 📋 规划中 | M5.1-M5.2 |

### 2.2 Phase 4 实施任务分解

#### M4.1: 审批任务查询与拉取 ✅ 已实现

```python
# 核心接口
GET /api/v1/approvals/pending
GET /api/v1/approvals/{task_id}

# 返回数据结构
{
    "task_id": "APT-20260420-001",
    "asset_id": "AST-2024-001",
    "asset_name": "Dell PowerEdge R740 服务器",
    "retirement_reason": "设备老化，无法正常运行",
    "current_level": 1,
    "total_levels": 3,
    "assigned_to": "dept_manager",
    "created_at": "2026-04-20T10:30:00Z"
}
```

#### M4.2: 审批操作（通过/驳回/转交） ✅ 已实现

| 操作 | API 端点 | 说明 |
|------|----------|------|
| 通过 | `POST /api/v1/approvals/{task_id}/approve` | 进入下一级或完成审批 |
| 驳回 | `POST /api/v1/approvals/{task_id}/reject` | 返回申请人修改 |
| 转交 | `POST /api/v1/approvals/{task_id}/delegate` | 指派他人代为审批 |

#### M4.3: 状态变更持久化与历史查询 🔄 本次重点

```python
# 变更持久化服务
class LifecycleRecorder:
    """
    记录资产生命周期状态变更
    
    职责:
    - 记录每次状态变更事件
    - 维护状态变更时间序列
    - 提供历史查询接口
    """
    
    def record_transition(self, asset_id: str, event: StateChangedEvent) -> LifecycleEvent:
        """
        记录状态转换事件
        
        Args:
            asset_id: 资产ID
            event: 状态变更事件
            
        Returns:
            生命周期事件记录
        """
        pass
```

#### M4.4: 生命周期时间轴渲染 🔄 本次重点

```typescript
// frontend/src/types/approval.ts
interface LifecycleTimeline {
  asset_id: string;
  events: TimelineEvent[];
}

interface TimelineEvent {
  id: string;
  event_type: '采购入库' | '领用' | '维修' | '报废申请' | '审批通过' | '已报废';
  timestamp: string;
  operator: string;
  details?: Record<string, any>;
}
```

---

## 3. 边界约束

### 3.1 功能边界

```
✅ 允许的操作:
   - 报废申请提交 → 触发审批链流转
   - 审批驳回 → 申请人修改 → 重新提交
   - 审批转交 → 指定人员代为审批
   - 历史记录只读查询
   - 审批通过 → 状态变更 → 历史记录

❌ 禁止的操作:
   - 越级审批（必须按配置链顺序执行）
   - 并发发起多个报废申请（资产状态锁定）
   - 历史记录修改/删除
   - 报废审批中强制终止流程
```

### 3.2 数据约束

| 约束项 | 限制值 | 说明 |
|--------|--------|------|
| 资产状态枚举 | `可用` / `维修中` / `审批中` / `已报废` / `已退役` | 退役与报废为终态 |
| 审批链层级 | 1-5 级 | 最少1级，最多5级 |
| 历史记录保留 | 永久保留 | 不可删除 |
| 单次审批超时 | 72 小时 | 超时自动发送提醒 |
| 驳回重提次数 | 不限 | 每次重提生成新审批链 |

### 3.3 状态机定义

```yaml
AssetStatus:
  可用:
    → 审批中: submit_retirement_application()
    → 维修中: submit_repair_request()
  
  审批中:
    → 已报废: approval_chain_complete(success=true)
    → 可用: approval_chain_complete(rejected=true)
  
  已报废:
    (终态 - 不可流转)
  
  已退役:
    (终态 - 不可流转)
```

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-001: 报废申请提交

**测试文件**: `tests/unit/test_retirement_state_machine.py`

```python
def test_retirement_application_submit():
    """
    ATB-001: 验证报废申请提交功能
    
    测试步骤:
    1. 创建测试资产（状态: 可用）
    2. 调用 POST /api/v1/retirement/apply
    3. 验证响应状态码 201
    4. 验证资产状态变更为 审批中
    5. 验证生成首级审批任务
    """
    
    # Arrange
    asset = create_test_asset(status=AssetStatus.可用)
    
    # Act
    response = retirement_api.submit_application(
        asset_id=asset.id,
        reason="设备老化，无法修复",
        estimated_value=500.00
    )
    
    # Assert
    assert response.status_code == 201
    assert response.json()["status"] == "审批中"
    assert response.json()["current_level"] == 1
    
    # 验证资产状态锁定
    updated_asset = asset_repository.get(asset.id)
    assert updated_asset.status == AssetStatus.审批中
    assert updated_asset.status_locked == True
```

**物理测试点**:
- [ ] 资产状态从 `可用` → `审批中` 转换正确
- [ ] 申请记录正确持久化至数据库
- [ ] 首个审批任务正确生成
- [ ] 并发申请被正确拒绝（状态锁定检查）

---

### 4.2 ATB-002: 多级审批链顺序执行

**测试文件**: `tests/unit/test_retirement_state_machine.py`

```python
def test_approval_chain_sequential_execution():
    """
    ATB-002: 验证多级审批链按顺序执行
    
    测试场景: 配置 3 级审批链 (部门经理 → 资产管理员 → 财务)
    
    测试步骤:
    1. 提交报废申请
    2. 第一级审批人通过
    3. 验证第二级任务生成
    4. 第二级审批人通过
    5. 验证第三级任务生成
    6. 第三级审批人通过
    7. 验证资产状态变更为已报废
    """
    
    # Arrange - 配置3级审批链
    approval_chain = ApprovalChainConfig(
        levels=[
            Approver(role="dept_manager", level=1),
            Approver(role="asset_admin", level=2),
            Approver(role="finance", level=3)
        ]
    )
    
    application = submit_retirement_application()
    
    # Act & Assert - 第一级
    task_level_1 = get_pending_task(approver="dept_manager")
    assert task_level_1.level == 1
    assert task_level_1.status == "pending"
    
    approve(task_id=task_level_1.id)
    assert task_level_1.status == "approved"
    
    # Act & Assert - 第二级
    task_level_2 = get_pending_task(approver="asset_admin")
    assert task_level_2.level == 2
    assert task_level_2.asset_id == application.asset_id
    
    approve(task_id=task_level_2.id)
    
    # Act & Assert - 第三级（末级）
    task_level_3 = get_pending_task(approver="finance")
    assert task_level_3.level == 3
    
    approve(task_id=task_level_3.id)
    
    # Assert - 终态验证
    final_asset = asset_repository.get(application.asset_id)
    assert final_asset.status == AssetStatus.已报废
    assert final_asset.status_locked == False
```

**物理测试点**:
- [ ] 层级顺序校验（禁止跳级审批）
- [ ] 每级审批后正确生成下一级任务
- [ ] 末级审批完成后触发状态变更
- [ ] 资产状态正确更新为 `已报废`

---

### 4.3 ATB-003: 驳回与修改重提

**测试文件**: `tests/integration/test_retirement_flow.py`

```python
def test_rejection_and_resubmission():
    """
    ATB-003: 验证审批驳回后申请人修改重提
    
    测试步骤:
    1. 提交报废申请
    2. 第一级审批人驳回
    3. 验证资产状态恢复为可用
    4. 申请人修改理由重新提交
    5. 验证新审批链正确启动
    """
    
    # Arrange
    application = submit_retirement_application(
        reason="设备故障",
        estimated_value=1000.00
    )
    
    # Act - 第一级驳回
    task = get_pending_task(approver="dept_manager")
    reject(task_id=task.id, reason="报废理由不充分，需补充维修记录")
    
    # Assert - 状态恢复
    asset = asset_repository.get(application.asset_id)
    assert asset.status == AssetStatus.可用
    assert asset.status_locked == False
    
    # Act - 修改重提
    updated_application = update_retirement_application(
        application_id=application.id,
        reason="经专业维修评估，设备已无修复价值",
        estimated_value=200.00
    )
    
    # Assert - 新审批链
    assert updated_application.status == "审批中"
    assert updated_application.current_level == 1
    assert updated_application.version > application.version
```

**物理测试点**:
- [ ] 驳回后资产状态恢复 `可用`
- [ ] 驳回记录正确持久化
- [ ] 修改后新审批链从第一级重新开始
- [ ] 审批版本号递增

---

### 4.4 ATB-004: 生命周期历史查询

**测试文件**: `tests/unit/test_retirement_state_machine.py`

```python
def test_lifecycle_history_query():
    """
    ATB-004: 验证资产生命周期历史记录查询
    
    验证时间轴完整性、事件顺序、数据不可变性
    """
    
    # Arrange - 模拟完整资产生命周期
    asset_id = "AST-2024-001"
    lifecycle_events = [
        create_event(asset_id, "采购入库", "admin", "2024-01-15"),
        create_event(asset_id, "领用", "user001", "2024-02-01"),
        create_event(asset_id, "维修", "tech001", "2024-06-10"),
        create_event(asset_id, "报废申请", "user001", "2026-04-20"),
        create_event(asset_id, "审批通过", "finance", "2026-04-22"),
    ]
    
    # Act
    response = api.get(f"/api/v1/assets/{asset_id}/lifecycle")
    
    # Assert
    assert response.status_code == 200
    timeline = response.json()["timeline"]
    
    # 验证时间顺序
    timestamps = [event["timestamp"] for event in timeline]
    assert timestamps == sorted(timestamps)
    
    # 验证事件完整性
    expected_events = {
        "采购入库", "领用", "维修", 
        "报废申请", "审批通过", "已报废"
    }
    actual_events = {event["event_type"] for event in timeline}
    assert expected_events.issubset(actual_events)
```

**物理测试点**:
- [ ] 按时间倒序/正序查询正确
- [ ] 历史记录不可修改验证（Read-only）
- [ ] 状态变更节点完整性校验
- [ ] 事件详情包含操作人、时间戳

---

### 4.5 ATB-005: E2E 审批流程

**测试文件**: `tests/e2e/retirement_flow.spec.ts`

```typescript
// Playwright E2E 测试
test('full retirement approval flow', async ({ page }) => {
  // Step 1: 申请人提交报废申请
  await page.goto(`/assets/${assetId}/retire`);
  await page.fill('#retirement-reason', '服务器老化，无法稳定运行');
  await page.fill('#estimated-residual-value', '500');
  await page.click('button[type=submit]');
  
  // 验证提交成功
  await expect(page.locator('.toast-success')).toBeVisible();
  await expect(page.locator('.status-badge')).toHaveText('审批中');
  
  // Step 2: 第一级审批人审批
  await page.goto('/approvals/pending');
  await page.click(`[data-asset-id="${assetId}"] button[data-action=approve]`);
  await expect(page.locator('.status-approved')).toBeVisible();
  
  // Step 3: 第二级审批人审批
  await page.goto('/approvals/pending');
  await page.click(`[data-asset-id="${assetId}"] button[data-action=approve]`);
  
  // Step 4: 第三级审批人审批
  await page.goto('/approvals/pending');
  await page.click(`[data-asset-id="${assetId}"] button[data-action=approve]`);
  
  // Step 5: 验证资产状态变更
  await page.goto(`/assets/${assetId}`);
  await expect(page.locator('.asset-status')).toHaveText('已报废');
  
  // Step 6: 验证生命周期时间轴
  await expect(page.locator('.lifecycle-timeline')).toBeVisible();
  const timelineItems = await page.locator('.timeline-event').all();
  expect(timelineItems.length).toBeGreaterThanOrEqual(5);
});
```

---

## 5. 开发切入层级序列

### 5.1 第一层: 数据层 (Backend - Model)

**目标文件**: `src/models/retirement.py`

```python
# src/models/retirement.py
class RetirementApplication:
    """
    报废申请实体模型
    
    属性:
        id: 申请唯一标识
        asset_id: 关联资产ID
        applicant_id: 申请人ID
        reason: 报废原因
        estimated_residual_value: 预估残值
        status: 申请状态
        current_approval_level: 当前审批层级
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    class Status(str, Enum):
        """申请状态枚举"""
        PENDING = "pending"           # 待审批
        IN_APPROVAL = "in_approval"    # 审批中
        APPROVED = "approved"          # 已通过
        REJECTED = "rejected"          # 已驳回
        
    class StateTransitionError(Exception):
        """状态转换异常"""
        pass
```

**关键约束**:
- 同一资产同时只能有一个进行中的报废申请
- 状态变更需记录至 `status_history` 表

---

### 5.2 第二层: 服务层 (Backend - Service)

**目标文件**: 
- `src/services/retirement/retirement_service.py`
- `src/services/approval_chain_service.py`
- `src/repositories/history_repository.py`

```python
# src/services/retirement/retirement_service.py
class RetirementService:
    """
    报废申请服务
    
    核心职责:
    - 报废申请提交与撤回
    - 审批流程触发
    - 状态变更管理
    """
    
    def submit_application(
        self, 
        asset_id: str, 
        reason: str, 
        estimated_value: float,
        applicant_id: str
    ) -> RetirementApplication:
        """
        提交报废申请
        
        Args:
            asset_id: 资产ID
            reason: 报废原因
            estimated_value: 预估残值
            applicant_id: 申请人ID
            
        Returns:
            报废申请记录
            
        Raises:
            AssetNotFoundError: 资产不存在
            InvalidStateError: 资产状态不允许报废
            DuplicateApplicationError: 存在进行中的申请
        """
        # 验证资产状态
        asset = self.asset_repo.get(asset_id)
        if asset.status not in [AssetStatus.可用]:
            raise InvalidStateError(f"资产状态 {asset.status} 不允许发起报废申请")
        
        # 检查并发申请
        existing = self.retirement_repo.find_pending(asset_id)
        if existing:
            raise DuplicateApplicationError("该资产存在进行中的报废申请")
        
        # 创建申请
        application = RetirementApplication(
            asset_id=asset_id,
            reason=reason,
            estimated_residual_value=estimated_value,
            applicant_id=applicant_id,
            status=RetirementApplication.Status.IN_APPROVAL
        )
        
        # 锁定资产状态
        self.asset_repo.update_status(asset_id, AssetStatus.审批中, locked=True)
        
        # 触发审批链
        self.approval_service.trigger_chain(application.id)
        
        return application
```

```python
# src/repositories/history_repository.py
class HistoryRepository:
    """
    生命周期历史记录仓库
    
    职责:
    - 记录资产全生命周期事件
    - 提供历史查询接口
    """
    
    def record_lifecycle_event(
        self,
        asset_id: str,
        event_type: str,
        operator: str,
        metadata: dict = None
    ) -> LifecycleEvent:
        """
        记录生命周期事件
        
        Args:
            asset_id: 资产ID
            event_type: 事件类型
            operator: 操作人
            metadata: 附加数据
            
        Returns:
            生命周期事件记录
        """
        event = LifecycleEvent(
            asset_id=asset_id,
            event_type=event_type,
            operator=operator,
            metadata=metadata or {},
            timestamp=datetime.utcnow()
        )
        
        self.session.add(event)
        self.session.commit()
        
        return event
    
    def query_timeline(
        self, 
        asset_id: str, 
        order: str = "asc"
    ) -> List[LifecycleEvent]:
        """
        查询资产生命周期时间轴
        
        Args:
            asset_id: 资产ID
            order: 排序方向 (asc/desc)
            
        Returns:
            按时间排序的事件列表
        """
        query = self.session.query(LifecycleEvent).filter(
            LifecycleEvent.asset_id == asset_id
        )
        
        if order == "asc":
            query = query.order_by(LifecycleEvent.timestamp.asc())
        else:
            query = query.order_by(LifecycleEvent.timestamp.desc())
            
        return query.all()
```

---

### 5.3 第三层: API层 (Backend - Router)

**目标文件**:
- `src/api/v1/approval.py`
- `src/api/v1/schemas/retirement.py`

```python
# src/api/v1/approval.py
@router.post(
    "/approvals/{task_id}/approve",
    response_model=ApprovalResponse,
    summary="审批通过"
)
async def approve_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    approval_service: ApprovalService = Depends(get_approval_service)
) -> ApprovalResponse:
    """
    审批通过操作
    
    流程:
    1. 验证审批人权限
    2. 记录审批历史
    3. 判断是否为末级
       - 是: 完成审批，更新资产状态
       - 否: 触发下一级审批任务
    4. 记录生命周期事件
    """
    task = approval_service.get_task(task_id)
    
    if not task:
        raise NotFoundError("审批任务不存在")
    
    if task.assigned_to != current_user.id:
        raise ForbiddenError("无权限审批此任务")
    
    # 执行审批
    result = approval_service.approve(
        task_id=task_id,
        approver_id=current_user.id,
        comment=None
    )
    
    # 记录生命周期事件
    lifecycle_service.record_event(
        asset_id=task.asset_id,
        event_type="审批通过",
        operator=current_user.id,
        metadata={
            "level": task.level,
            "task_id": task_id
        }
    )
    
    return ApprovalResponse(
        success=True,
        message="审批通过",
        data=result
    )
```

---

### 5.4 第四层: 前端层 (Frontend)

**目标文件**: `frontend/src/types/approval.ts`

```typescript
// frontend/src/types/approval.ts

/**
 * 报废申请类型定义
 */
export interface RetirementApplication {
  id: string;
  assetId: string;
  assetName: string;
  reason: string;
  estimatedResidualValue: number;
  status: RetirementStatus;
  currentLevel: number;
  totalLevels: number;
  applicant: UserInfo;
  createdAt: string;
  updatedAt: string;
}

export enum RetirementStatus {
  PENDING = 'pending',
  IN_APPROVAL = 'in_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed'
}

/**
 * 审批任务类型定义
 */
export interface ApprovalTask {
  id: string;
  applicationId: string;
  assetId: string;
  assetName: string;
  level: number;
  totalLevels: number;
  status: TaskStatus;
  assignedTo: UserInfo;
  createdAt: string;
  deadline: string;
  reason?: string;
  estimatedValue?: number;
}

export enum TaskStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DELEGATED = 'delegated'
}

/**
 * 生命周期时间轴类型定义
 */
export interface LifecycleTimeline {
  assetId: string;
  assetName: string;
  events: TimelineEvent[];
}

export interface TimelineEvent {
  id: string;
  eventType: LifecycleEventType;
  timestamp: string;
  operator: string;
  details?: Record<string, unknown>;
  metadata?: {
    level?: number;
    taskId?: string;
    reason?: string;
  };
}

export enum LifecycleEventType {
  PURCHASE = '采购入库',
  ASSIGNMENT = '领用',
  MAINTENANCE = '维修',
  RETIREMENT_APPLICATION = '报废申请',
  APPROVAL = '审批通过',
  APPROVAL_REJECTED = '审批驳回',
  RETIRED = '已报废',
  DECOMMISSIONED = '已退役'
}
```

---

## 6. 变更文件清单

| 文件路径 | 变更类型 | 变更说明 |
|----------|----------|----------|
| `src/api/v1/schemas/retirement.py` | 修改 | 扩展报废申请 Schema，添加生命周期相关字段 |
| `frontend/src/types/approval.ts` | 修改 | 新增 `LifecycleTimeline`、`TimelineEvent` 类型定义 |
| `backend/api/v1/approval.py` | 修改 | 实现审批操作 API（通过/驳回/转交） |
| `src/repositories/history_repository.py` | 修改 | 新增 `record_lifecycle_event`、`query_timeline` 方法 |
| `src/models/retirement.py` | 修改 | 扩展 `RetirementApplication` 状态枚举 |

---

## 7. 附录

### 7.1 API 端点汇总

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/retirement/apply` | POST | 提交报废申请 |
| `/api/v1/retirement/{id}` | GET | 查询申请详情 |
| `/api/v1/retirement/{id}` | PUT | 修改申请（驳回后） |
| `/api/v1/approvals/pending` | GET | 查询待我审批任务 |
| `/api/v1/approvals/{task_id}` | GET | 查询审批任务详情 |
| `/api/v1/approvals/{task_id}/approve` | POST | 审批通过 |
| `/api/v1/approvals/{task_id}/reject` | POST | 审批驳回 |
| `/api/v1/approvals/{task_id}/delegate` | POST | 审批转交 |
| `/api/v1/assets/{id}/lifecycle` | GET | 查询资产生命周期 |

### 7.2 异常处理矩阵

| 异常类型 | HTTP 状态码 | 处理策略 |
|----------|-------------|----------|
| `AssetNotFoundError` | 404 | 资产不存在 |
| `InvalidStateError` | 400 | 状态不允许操作 |
| `DuplicateApplicationError` | 409 | 存在重复申请 |
| `UnauthorizedError` | 401 | 未认证 |
| `ForbiddenError` | 403 | 无权限 |
| `StateTransitionError` | 422 | 状态转换失败 |

---

*文档版本: SWARM-2026-Q2-002-iter4 | 编制日期: 2026-04-20*