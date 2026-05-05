# 工单审批流程技术规格文档

## 需求与背景

### 业务背景

本系统服务于固定资产退役审批流程，涵盖资产退役申请、审批链路流转、状态机驱动及多渠道通知触达等核心功能。当前系统基于 FastAPI 后端 + React 前端架构，需确保审批流程具备以下特性：

- **状态驱动**：基于状态机的审批流程控制，保证状态流转的原子性和一致性
- **审计追溯**：完整的操作审计日志，支持 Graphify 知识图谱可视化
- **通知触达**：多渠道通知（站内信、邮件）及时通知相关人员

### 本次迭代目标

**Iteration 1：Graphify 知识图谱 + 核心审批流程**

| 目标项 | 具体描述 |
|--------|----------|
| Graphify 知识图谱 | 审计日志节点可视化，修复"No matching nodes found"问题 |
| 状态机实现 | 定义工单状态枚举、状态流转规则、动作触发器 |
| 审批 API | 提供审批列表查询、审批操作、审批详情获取接口 |
| 前端审批页 | 审批工作台列表 + 审批详情/操作页面 |
| 通知服务 | 状态变更触发通知、基础通知渠道集成 |

---

## 当前 Phase 对应实施目标

**对应 Phase 1：核心流程骨架实现**

| 目标项 | 具体描述 | 交付文件 |
|--------|----------|----------|
| 状态机实现 | 定义工单状态枚举、状态流转规则、动作触发器 | `src/models/enums.py`, `src/state_machine/retirement_state_machine.py` |
| 审批服务 | 审批链路管理、审批操作、进度追踪 | `src/services/approval_chain_service.py` |
| 退役服务 | 工单创建、状态流转驱动 | `src/services/retirement_service.py` |
| 通知服务 | 状态变更触发通知 | `src/services/notification_service.py` |
| 前端审批页 | 审批工作台列表 + 审批详情/操作页面 | `frontend/src/pages/approval/*` |
| Graphify 可视化 | 审计日志知识图谱组件 | `frontend/src/components/audit/GraphifyKnowledgeGraph.tsx` |

---

## 边界约束

### 范围约束

| 约束类型 | 描述 |
|----------|------|
| 支持的审批模式 | 串行审批（单人逐级审批），暂不支持会签/或签 |
| 审批链路深度 | 最多支持 5 级审批节点 |
| 并发控制 | 同一工单同一时刻仅允许一个审批操作 |
| 通知延迟 | 状态变更后通知触达时间 ≤ 3 秒（同步模式） |

### 技术约束

| 约束项 | 约束内容 |
|--------|----------|
| 后端框架 | Python 3.10+ / FastAPI |
| 前端框架 | React 18 + TypeScript 4.9+ |
| 数据库 | SQLite（开发）/ PostgreSQL（生产） |
| 状态存储 | 持久化至 DB，内存缓存加速查询 |
| 通知渠道 | 仅实现站内信（WebSocket 推送）、邮件（可选） |
| API 风格 | RESTful + WebSocket，JSON 格式 |

### 数据约束

| 约束项 | 约束内容 |
|--------|----------|
| 工单 ID | UUID v4 |
| 审批记录 ID | UUID v4 |
| 状态机持久化 | 每次状态变更记录审计日志 |
| 软删除 | 工单及审批记录使用软删除 |

---

## 状态机设计

### 状态枚举 (RetirementStatus)

```python
# src/models/enums.py
from enum import Enum

class RetirementStatus(str, Enum):
    """资产退役工单状态枚举"""
    PENDING_SUBMIT = "PENDING_SUBMIT"      # 待提交
    PENDING_APPROVE = "PENDING_APPROVE"    # 待审批
    APPROVAL_IN_PROGRESS = "APPROVAL_IN_PROGRESS"  # 审批中
    APPROVED = "APPROVED"                  # 审批通过
    APPROVAL_REJECTED = "APPROVAL_REJECTED"  # 审批拒绝
    RETURNED = "RETURNED"                 # 已退回
    DISPOSED = "DISPOSED"                  # 已处置
    ARCHIVED = "ARCHIVED"                  # 已归档
```

### 动作枚举 (RetirementAction)

```python
class RetirementAction(str, Enum):
    """资产退役动作枚举"""
    SUBMIT = "SUBMIT"          # 提交
    APPROVE = "APPROVE"        # 审批通过
    REJECT = "REJECT"          # 审批拒绝
    RETURN = "RETURN"          # 退回
    DISPOSE = "DISPOSE"        # 处置
    ARCHIVE = "ARCHIVE"        # 归档
```

### 状态流转矩阵

| 当前状态 | 允许动作 | 目标状态 | 触发条件 |
|----------|----------|----------|----------|
| PENDING_SUBMIT | SUBMIT | PENDING_APPROVE | 提交人点击提交 |
| PENDING_APPROVE | APPROVE | APPROVED | 审批人同意（单级审批） |
| PENDING_APPROVE | APPROVE | APPROVAL_IN_PROGRESS | 审批人同意（多级审批，第一级通过） |
| PENDING_APPROVE | REJECT | APPROVAL_REJECTED | 审批人拒绝 |
| PENDING_APPROVE | RETURN | RETURNED | 审批人退回修改 |
| APPROVAL_IN_PROGRESS | APPROVE | APPROVED | 最后一级审批通过 |
| APPROVAL_IN_PROGRESS | REJECT | APPROVAL_REJECTED | 审批人拒绝 |
| APPROVAL_IN_PROGRESS | RETURN | RETURNED | 审批人退回修改 |
| APPROVED | DISPOSE | DISPOSED | 处置人执行处置 |
| DISPOSED | ARCHIVE | ARCHIVED | 系统自动或手动归档 |

### 异常流转校验

```python
# src/state_machine/guards.py
"""
禁止动作（违反状态机规则的操作）：
- RETURNED 状态不可直接 APPROVE/REJECT/DISPOSE
- ARCHIVED 状态不可进行任何动作
- APPROVAL_REJECTED 状态不可 RETURN
- 同一工单并发 SUBMIT/APPROVE/REJECT/RETURN 操作，后者操作被拒绝
"""

# 流转守卫函数示例
def can_transition(current_status: RetirementStatus, action: RetirementAction) -> bool:
    valid_transitions = {
        RetirementStatus.PENDING_SUBMIT: [RetirementAction.SUBMIT],
        RetirementStatus.PENDING_APPROVE: [
            RetirementAction.APPROVE,
            RetirementAction.REJECT,
            RetirementAction.RETURN
        ],
        RetirementStatus.APPROVAL_IN_PROGRESS: [
            RetirementAction.APPROVE,
            RetirementAction.REJECT,
            RetirementAction.RETURN
        ],
        RetirementStatus.APPROVED: [RetirementAction.DISPOSE],
        RetirementStatus.DISPOSED: [RetirementAction.ARCHIVE],
        # 终止状态禁止任何动作
        RetirementStatus.ARCHIVED: [],
        RetirementStatus.APPROVAL_REJECTED: [],
    }
    return action in valid_transitions.get(current_status, [])
```

---

## 数据模型

### 工单模型 (AssetRetirementRequest)

```python
# src/models/asset_retirement.py
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID, uuid4

from .enums import RetirementStatus

@dataclass
class AssetRetirementRequest:
    """资产退役申请单"""
    id: UUID = field(default_factory=uuid4)
    asset_id: UUID
    asset_name: str
    asset_code: str
    
    # 申请人信息
    applicant_id: UUID
    applicant_name: str
    department_id: UUID
    department_name: str
    
    # 申请详情
    reason: str
    description: str
    estimated_value: float
    
    # 状态与审批
    status: RetirementStatus = RetirementStatus.PENDING_SUBMIT
    current_level: int = 0  # 当前审批层级
    current_approver_id: Optional[UUID] = None
    
    # 元数据
    version: int = 1  # 乐观锁版本号
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    
    # 业务数据扩展
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "asset_id": str(self.asset_id),
            "asset_name": self.asset_name,
            "asset_code": self.asset_code,
            "status": self.status.value,
            "version": self.version,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
```

### 审批链路模型 (ApprovalChain)

```python
# src/models/approval_chain.py
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4

@dataclass
class ApprovalNode:
    """审批节点"""
    id: UUID = field(default_factory=uuid4)
    order_id: UUID
    level: int  # 审批层级 1-5
    approver_id: UUID
    approver_name: str
    role_id: Optional[UUID] = None
    role_name: Optional[str] = None
    
    status: str = "PENDING"  # PENDING/APPROVED/REJECTED/RETURNED
    comment: Optional[str] = None
    operated_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)

@dataclass
class ApprovalChain:
    """审批链路"""
    id: UUID = field(default_factory=uuid4)
    order_id: UUID
    nodes: List[ApprovalNode] = field(default_factory=list)
    current_level: int = 1
    is_final: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def get_current_node(self) -> Optional[ApprovalNode]:
        """获取当前待审批节点"""
        for node in self.nodes:
            if node.level == self.current_level and node.status == "PENDING":
                return node
        return None
    
    def get_completed_nodes(self) -> List[ApprovalNode]:
        """获取已完成审批的节点"""
        return [n for n in self.nodes if n.status != "PENDING"]
```

### 审批历史模型 (RetirementHistory)

```python
# src/models/retirement_history.py
from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4
from .enums import RetirementStatus, RetirementAction

@dataclass
class RetirementHistory:
    """退役操作历史"""
    id: UUID = field(default_factory=uuid4)
    order_id: UUID
    action: RetirementAction
    from_status: RetirementStatus
    to_status: RetirementStatus
    operator_id: UUID
    operator_name: str
    comment: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
```

### 通知记录模型

```python
# 通知类型枚举
class NotificationType(str, Enum):
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"  # 待审批通知
    APPROVED = "APPROVED"                      # 审批通过通知
    REJECTED = "REJECTED"                     # 审批拒绝通知
    RETURNED = "RETURNED"                     # 退回通知
    DISPOSED = "DISPOSED"                     # 已处置通知
    REMINDER = "REMINDER"                     # 审批超时提醒

@dataclass
class NotificationRecord:
    """通知记录"""
    id: UUID = field(default_factory=uuid4)
    user_id: UUID
    type: NotificationType
    title: str
    content: str
    related_order_id: Optional[UUID] = None
    is_read: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)
```

---

## API 规范

### 审批工作台接口

#### GET /api/retirement/todo-list

**描述**：获取当前用户的待审批工单列表

**Query Parameters**：
| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| page | int | 否 | 页码，默认 1 |
| page_size | int | 否 | 每页数量，默认 20 |
| status | string | 否 | 筛选状态 |

**Response**：
```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "资产退役申请 - 服务器设备",
        "asset_name": "Dell PowerEdge R740",
        "asset_code": "AST-2024-001",
        "status": "PENDING_APPROVE",
        "applicant_name": "张三",
        "department_name": "IT部",
        "created_at": "2024-01-15T10:30:00Z",
        "current_level": 1
      }
    ],
    "total": 15,
    "page": 1,
    "page_size": 20
  }
}
```

#### GET /api/retirement/{order_id}

**描述**：获取工单详情及审批链路

**Response**：
```json
{
  "code": 200,
  "data": {
    "order": {
      "id": "uuid",
      "asset_id": "uuid",
      "asset_name": "Dell PowerEdge R740",
      "asset_code": "AST-2024-001",
      "reason": "设备老旧需退役",
      "description": "该服务器已使用8年，性能下降严重",
      "estimated_value": 15000.00,
      "status": "PENDING_APPROVE",
      "applicant": {
        "id": "uuid",
        "name": "张三",
        "department": "IT部"
      },
      "created_at": "2024-01-15T10:30:00Z"
    },
    "approval_chain": {
      "current_level": 1,
      "is_final": false,
      "nodes": [
        {
          "level": 1,
          "approver": {
            "id": "uuid",
            "name": "李四",
            "role": "部门主管"
          },
          "status": "PENDING",
          "comment": null
        },
        {
          "level": 2,
          "approver": {
            "id": "uuid",
            "name": "王五",
            "role": "资产管理员"
          },
          "status": "PENDING",
          "comment": null
        }
      ]
    },
    "history": [
      {
        "action": "SUBMIT",
        "from_status": "PENDING_SUBMIT",
        "to_status": "PENDING_APPROVE",
        "operator": "张三",
        "comment": "申请设备退役",
        "created_at": "2024-01-15T10:35:00Z"
      }
    ]
  }
}
```

#### POST /api/retirement/{order_id}/action

**描述**：执行审批操作

**Request Body**：
```json
{
  "action": "APPROVE",
  "comment": "同意退役申请"
}
```

**Response**：
```json
{
  "code": 200,
  "data": {
    "order_id": "uuid",
    "new_status": "APPROVAL_IN_PROGRESS",
    "current_level": 2,
    "message": "审批成功"
  }
}
```

**错误响应**：
```json
{
  "code": 400,
  "error": {
    "code": "APPROVAL_002",
    "message": "当前状态不允许此操作"
  }
}
```

### 通知接口

#### GET /api/notifications

**描述**：获取当前用户通知列表

**Query Parameters**：
| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| is_read | boolean | 否 | 筛选已读/未读 |
| page | int | 否 | 页码 |
| page_size | int | 否 | 每页数量 |

#### PUT /api/notifications/{notification_id}/read

**描述**：标记通知已读

---

## 前端页面规格

### 审批工作台页面 (/approval)

**功能要求**：
- Tab 切换：全部 / 待审批 / 已审批 / 我发起的
- 列表展示：资产名称、工单状态标签、申请人、部门、提交时间、操作按钮
- 状态标签颜色：
  - 待审批：橙色 `#FF9800`
  - 审批中：蓝色 `#2196F3`
  - 已通过：绿色 `#4CAF50`
  - 已拒绝：红色 `#F44336`
  - 已退回：灰色 `#9E9E9E`
  - 已处置：紫色 `#9C27B0`
- 支持分页加载
- 支持关键词搜索
- 点击列表项跳转详情页

### 审批详情页面 (/approval/:orderId)

**功能要求**：
- 工单基本信息展示区（资产信息、申请人、申请原因、预估价值）
- 审批链路可视化（横向步骤条，显示各节点状态）
- 审计日志 Graphify 知识图谱组件
- 当前审批人操作区（仅当 status=PENDING_APPROVE 且当前用户为审批人时显示）
  - 审批意见输入框
  - 通过 / 拒绝 / 退回 三个操作按钮
- 审批历史记录时间线

### 通知中心组件

**功能要求**：
- 顶部导航栏显示未读通知数量徽标
- 点击展开通知列表
- 每条通知显示：类型图标、标题、摘要、时间
- 支持一键全部已读
- 支持 WebSocket 实时推送

---

## 通知触发规则

| 触发事件 | 通知类型 | 接收人 | 通知渠道 |
|----------|----------|--------|----------|
| 工单提交 | APPROVAL_REQUIRED | 当前层级审批人 | 站内信 + 邮件 |
| 审批通过（最终级） | APPROVED | 工单创建人 | 站内信 + 邮件 |
| 审批拒绝 | REJECTED | 工单创建人 | 站内信 + 邮件 |
| 工单退回 | RETURNED | 工单创建人 | 站内信 + 邮件 |
| 审批超时提醒 | REMINDER | 当前审批人 | 站内信（仅站内信） |

---

## 验收测试基准 (ATB)

### 后端单元测试 (pytest)

#### TC-01：状态机流转测试

```python
# tests/state_machine/test_retirement_sm.py
import pytest
from src.models.enums import RetirementStatus, RetirementAction
from src.state_machine.retirement_state_machine import RetirementStateMachine

class TestRetirementStateMachine:
    """工单状态机测试套件"""
    
    def test_pending_submit_can_submit(self):
        """PENDING_SUBMIT 状态提交后应转为 PENDING_APPROVE"""
        sm = RetirementStateMachine()
        new_status = sm.transition(
            RetirementStatus.PENDING_SUBMIT,
            RetirementAction.SUBMIT
        )
        assert new_status == RetirementStatus.PENDING_APPROVE
    
    def test_pending_approve_can_approve(self):
        """PENDING_APPROVE 状态审批通过后应转为 APPROVED（单级审批）"""
        sm = RetirementStateMachine()
        sm.context.approval_chain.is_final = True  # 单级审批
        new_status = sm.transition(
            RetirementStatus.PENDING_APPROVE,
            RetirementAction.APPROVE
        )
        assert new_status == RetirementStatus.APPROVED
    
    def test_pending_approve_to_approval_in_progress(self):
        """PENDING_APPROVE 状态审批通过后应转为 APPROVAL_IN_PROGRESS（多级审批）"""
        sm = RetirementStateMachine()
        sm.context.approval_chain.is_final = False  # 多级审批
        new_status = sm.transition(
            RetirementStatus.PENDING_APPROVE,
            RetirementAction.APPROVE
        )
        assert new_status == RetirementStatus.APPROVAL_IN_PROGRESS
    
    def test_pending_approve_can_reject(self):
        """PENDING_APPROVE 状态审批拒绝后应转为 APPROVAL_REJECTED"""
        sm = RetirementStateMachine()
        new_status = sm.transition(
            RetirementStatus.PENDING_APPROVE,
            RetirementAction.REJECT
        )
        assert new_status == RetirementStatus.APPROVAL_REJECTED
    
    def test_pending_approve_can_return(self):
        """PENDING_APPROVE 状态退回后应转为 RETURNED"""
        sm = RetirementStateMachine()
        new_status = sm.transition(
            RetirementStatus.PENDING_APPROVE,
            RetirementAction.RETURN
        )
        assert new_status == RetirementStatus.RETURNED
    
    def test_rejected_cannot_approve(self):
        """REJECTED 状态不允许 APPROVE 操作，应抛出异常"""
        sm = RetirementStateMachine()
        with pytest.raises(InvalidTransitionError):
            sm.transition(
                RetirementStatus.APPROVAL_REJECTED,
                RetirementAction.APPROVE
            )
    
    def test_archived_no_actions(self):
        """ARCHIVED 状态不允许任何操作"""
        sm = RetirementStateMachine()
        for action in RetirementAction:
            with pytest.raises(InvalidTransitionError):
                sm.transition(RetirementStatus.ARCHIVED, action)
```

**物理测试期待**：7 个测试用例全部通过，验证状态机流转规则符合设计。

#### TC-02：并发审批控制测试

```python
# tests/services/test_retirement_service.py
import pytest
from unittest.mock import AsyncMock, patch
from src.services.retirement_service import RetirementService

class TestConcurrencyControl:
    """并发审批控制测试"""
    
    @pytest.mark.asyncio
    async def test_concurrent_approval_rejected(self):
        """同一工单并发两次 APPROVE 操作，第二次应失败"""
        service = RetirementService()
        order_id = "test-order-id"
        
        # 第一次审批成功
        result1 = await service.approve(order_id, "user1", "comment1")
        assert result1.success is True
        
        # 第二次审批应因乐观锁失败
        with pytest.raises(VersionConflictError):
            await service.approve(order_id, "user2", "comment2")
```

**物理测试期待**：第二次并发操作返回版本冲突异常，数据库仅记录第一次审批结果。

#### TC-03：API 接口测试

```python
# tests/api/test_retirement_api.py
import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

class TestApprovalAPI:
    """审批 API 测试套件"""
    
    def test_get_todo_list_returns_pending_approvals(self):
        """GET /api/retirement/todo-list 应返回当前用户待审批列表"""
        response = client.get(
            "/api/retirement/todo-list",
            headers={"Authorization": f"Bearer {test_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data["data"]
        assert isinstance(data["data"]["items"], list)
    
    def test_execute_approval_updates_status(self):
        """POST /api/retirement/{order_id}/action 执行审批应更新状态"""
        response = client.post(
            f"/api/retirement/{test_order_id}/action",
            headers={"Authorization": f"Bearer {test_token}"},
            json={"action": "APPROVE", "comment": "同意"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["new_status"] in [
            "APPROVED", "APPROVAL_IN_PROGRESS"
        ]
    
    def test_invalid_action_returns_400(self):
        """无效动作应返回 400 错误"""
        response = client.post(
            f"/api/retirement/{test_order_id}/action",
            headers={"Authorization": f"Bearer {test_token}"},
            json={"action": "INVALID_ACTION"}
        )
        
        assert response.status_code == 400
```

**物理测试期待**：API 响应符合 HTTP 状态码及响应格式规范。

#### TC-04：通知生成测试

```python
# tests/services/test_retirement_service.py
class TestNotificationGeneration:
    """通知生成逻辑测试"""
    
    @pytest.mark.asyncio
    async def test_approval_creates_notification_for_applicant(self):
        """审批通过时应为申请人生成 APPROVED 通知"""
        service = RetirementService()
        await service.approve(order_id, approver_id, "同意")
        
        notification = await service.notification_repo.find_one(
            user_id=creator_id,
            type=NotificationType.APPROVED
        )
        
        assert notification is not None
        assert "审批通过" in notification.title
    
    @pytest.mark.asyncio
    async def test_rejection_creates_notification_for_applicant(self):
        """审批拒绝时应为申请人生成 REJECTED 通知"""
        service = RetirementService()
        await service.reject(order_id, approver_id, "材料不全")
        
        notification = await service.notification_repo.find_one(
            user_id=creator_id,
            type=NotificationType.REJECTED
        )
        
        assert notification is not None
        assert "材料不全" in notification.content
```

**物理测试期待**：通知记录正确写入数据库。

### 前端集成测试 (Playwright)

#### TC-05：审批工作台页面测试

```typescript
// frontend/tests/e2e/approval.spec.ts
import { test, expect } from '@playwright/test';

test.describe('审批工作台页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/approval');
    await page.waitForLoadState('networkidle');
  });

  test('应显示待审批工单列表', async ({ page }) => {
    // 验证页面标题
    await expect(page.locator('h1')).toContainText('审批工作台');
    
    // 验证列表加载
    await expect(page.locator('.approval-list')).toBeVisible();
    
    // 验证 Tab 切换
    await page.click('button:has-text("待审批")');
    await expect(page.locator('.approval-list .item')).toHaveCount(3);
  });

  test('点击工单应跳转详情页', async ({ page }) => {
    await page.click('.approval-list .item:first-child');
    await expect(page).toHaveURL(/\/approval\/[\w-]+$/);
  });

  test('Graphify 知识图谱应正常渲染', async ({ page }) => {
    await page.goto('/approval/test-order-id');
    
    // 验证知识图谱容器可见
    await expect(page.locator('.graphify-container')).toBeVisible();
    
    // 等待节点渲染
    await page.waitForSelector('.graphify-node', { timeout: 5000 });
    
    // 验证有节点渲染（修复 No matching nodes 问题）
    const nodes = await page.locator('.graphify-node').count();
    expect(nodes).toBeGreaterThan(0);
  });
});
```

**物理测试期待**：Playwright 测试通过，页面渲染正确、交互响应符合预期、Graphify 节点正常显示。

#### TC-06：Graphify 知识图谱节点匹配测试

```typescript
// frontend/tests/unit/audit/convertAuditLogsToGraphifyNodes.test.ts
import { describe, it, expect } from 'vitest';
import { convertAuditLogsToGraphifyNodes } from '@/app/hooks/useAuditableFields';

describe('Graphify 节点转换', () => {
  it('应将审计日志转换为 Graphify 节点', () => {
    const auditLogs = [
      {
        id: 'log-1',
        action: 'asset_value_changed',
        field: 'estimated_value',
        oldValue: '10000',
        newValue: '8000',
        timestamp: Date.now(),
        operator: 'admin'
      }
    ];
    
    const nodes = convertAuditLogsToGraphifyNodes(auditLogs, 'AST-001');
    
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('log-1');
    expect(nodes[0].label).toContain('资产价值变更');
    expect(nodes[0].assetId).toBe('AST-001');
  });

  it('空日志应返回空数组', () => {
    const nodes = convertAuditLogsToGraphifyNodes([], 'AST-001');
    expect(nodes).toHaveLength(0);
  });
});
```

**物理测试期待**：修复 "No matching nodes found" 问题，节点 ID 匹配正确。

---

## 开发切入层级序列

### Phase 1 实施顺序

```
┌─────────────────────────────────────────────────────────────────────┐
│  Level 1: 数据模型层                                                 │
│  ├─ 定义枚举（RetirementStatus, RetirementAction, NotificationType）│
│  ├─ 数据类（AssetRetirementRequest, ApprovalChain, RetirementHistory）│
│  └─ 数据访问层（Repository 接口定义）                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Level 2: 状态机层                                                   │
│  ├─ 流转规则定义（transitions.py）                                    │
│  ├─ 流转守卫（guards.py）                                             │
│  ├─ 状态机引擎（retirement_state_machine.py）                         │
│  └─ 单元测试覆盖 100%                                                │
├─────────────────────────────────────────────────────────────────────┤
│  Level 3: 服务层                                                     │
│  ├─ RetirementService                                                │
│  │   ├─ create_retirement_request()                                  │
│  │   ├─ submit(order_id)                                             │
│  │   ├─ approve(order_id, user_id, comment)                         │
│  │   ├─ reject(order_id, user_id, comment)                          │
│  │   ├─ return(order_id, user_id, comment)                           │
│  │   └─ dispose(order_id, user_id)                                   │
│  ├─ ApprovalChainService                                             │
│  │   ├─ create_chain(order_id, approval_chain)                       │
│  │   ├─ get_current_approver(order_id)                               │
│  │   └─ advance_level(order_id)                                      │
│  ├─ NotificationService                                              │
│  │   ├─ send_notification(user_id, type, title, content)            │
│  │   ├─ get_notifications(user_id)                                   │
│  │   └─ mark_as_read(notification_id)                               │
│  └─ 单元测试覆盖 80%+                                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Level 4: API 层                                                     │
│  ├─ RESTful 接口实现（FastAPI Router）                               │
│  ├─ 参数校验（Pydantic Schema）                                        │
│  ├─ 鉴权中间件                                                       │
│  ├─ 审计日志中间件                                                   │
│  └─ API 集成测试                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Level 5: 前端层                                                     │
│  ├─ 审批工作台页面                                                   │
│  ├─ 审批详情页                                                       │
│  ├─ Graphify 知识图谱组件                                            │
│  ├─ 通知中心组件                                                     │
│  └─ E2E 测试                                                         │
├─────────────────────────────────────────────────────────────────────┤
│  Level 6: 通知渠道集成                                               │
│  ├─ 站内信（WebSocket 推送）                                          │
│  ├─ 邮件通知（可选）                                                  │
│  └─ 通知模板配置                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 关键依赖关系

```
枚举定义 ──→ 数据模型 ──→ 状态机 ──→ 服务层 ──→ API层
                │                       │
                └──── 通知服务 ◄─────────┘
                        │
                        ▼
                   前端层 + E2E
                        │
                        ▼
               Graphify 知识图谱
```

### AC 验收对照

| AC ID | 验收标准 | 验证方法 | 测试文件 |
|-------|----------|----------|----------|
| AC-001 | Graphify 知识图谱节点正常显示 | integration | `convertAuditLogsToGraphifyNodes.test.ts` |
| AC-002 | 代码无语法错误 | static_analysis | AST 检查通过 |
| AC-003 | 函数包含 docstring | static_analysis | `verify_docstring.test.ts` |
| AC-004 | 模块可正常 import | unit_test | 各模块单元测试 |

---

## 附录：错误码规范

| 错误码 | HTTP 状态码 | 描述 |
|--------|-------------|------|
| APPROVAL_001 | 400 | 无效的审批动作 |
| APPROVAL_002 | 400 | 当前状态不允许此操作 |
| APPROVAL_003 | 409 | 乐观锁冲突（并发操作） |
| APPROVAL_004 | 404 | 工单不存在 |
| APPROVAL_005 | 403 | 无审批权限 |
| NOTIFICATION_001 | 404 | 通知不存在 |

---

## 文件清单

### 后端文件

| 文件路径 | 描述 |
|----------|------|
| `src/models/enums.py` | 状态枚举、动作枚举 |
| `src/models/asset_retirement.py` | 资产退役工单模型 |
| `src/models/approval_chain.py` | 审批链路模型 |
| `src/models/retirement_history.py` | 退役操作历史模型 |
| `src/state_machine/retirement_state_machine.py` | 状态机引擎 |
| `src/state_machine/transitions.py` | 流转规则定义 |
| `src/state_machine/guards.py` | 流转守卫 |
| `src/services/retirement_service.py` | 退役服务 |
| `src/services/approval_chain_service.py` | 审批链路服务 |
| `src/services/notification_service.py` | 通知服务 |
| `src/api/routers/retirement_router.py` | 退役 API 路由 |

### 前端文件

| 文件路径 | 描述 |
|----------|------|
| `frontend/src/pages/approval/index.tsx` | 审批工作台页面 |
| `frontend/src/pages/approval/[orderId].tsx` | 审批详情页面 |
| `frontend/src/components/audit/GraphifyKnowledgeGraph.tsx` | Graphify 知识图谱组件 |
| `frontend/src/pages/AssetDetailPage/config/auditableFieldMap.ts` | 可审计字段映射配置 |
| `frontend/src/components/notification/NotificationCenter.tsx` | 通知中心组件 |

### 测试文件

| 文件路径 | 描述 |
|----------|------|
| `tests/state_machine/test_retirement_sm.py` | 状态机单元测试 |
| `tests/services/test_retirement_service.py` | 服务层单元测试 |
| `tests/api/test_retirement_api.py` | API 集成测试 |
| `frontend/tests/unit/audit/convertAuditLogsToGraphifyNodes.test.ts` | Graphify 节点转换测试 |
| `frontend/tests/e2e/approval.spec.ts` | 审批流程 E2E 测试 |