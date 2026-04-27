# 工单审批流程规格指导文档

**规格编号**: SPEC-WO-001  
**版本**: 1.0  
**关联任务**: SWARM-001  
**Iteration**: 1

---

## 需求与背景

### 业务背景

当前工单系统缺少审批节点，用户提交工单后无法进行逐级审批确认，导致：

- 关键业务工单缺乏质量控制环节
- 审批过程无记录、可追溯性差
- 审批结果无法及时通知相关方

### 功能需求

用户在审批页面提交工单审批意见（**通过** 或 **驳回**），系统完成状态机流转并触发相应通知。

### 核心约束

- 状态机流转必须是原子操作，保证数据一致性
- 通知机制必须异步执行，不阻塞主流程
- 审批历史需持久化存档

---

## 当前 Phase 对应实施目标

> **Phase 1: 审批核心链路（当前 Iteration）**

| 子任务 | 目标 | 交付物 |
|--------|------|--------|
| 1.1 | 前端审批表单交互 | 审批意见提交组件 |
| 1.2 | 后端审批接口 | REST API 端点 |
| 1.3 | 状态机实现 | 状态流转逻辑 |
| 1.4 | 通知触发 | 通知事件发送 |

**后续 Phase（不包含于本次规格）**:

- Phase 2: 审批历史查询与导出
- Phase 3: 批量审批、委托审批

---

## 边界约束

### 功能边界

| 约束项 | 说明 |
|--------|------|
| 审批对象 | 仅限状态为 `PENDING_APPROVAL` 的工单 |
| 审批意见 | 仅支持 `APPROVED`（通过）或 `REJECTED`（驳回）两种枚举值 |
| 驳回原因 | 驳回操作**必须**填写驳回原因，通过操作可选填写备注 |
| 审批权限 | 仅工单绑定的审批人角色可执行审批操作 |
| 状态不可逆 | `APPROVED` / `REJECTED` 状态不可回退 |

### 状态机定义

```
                    ┌─────────────────────┐
                    │  PENDING_APPROVAL   │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │ 提交通过意见    │  提交驳回意见   │
              ▼                │                ▼
     ┌────────────────┐        │       ┌────────────────┐
     │    APPROVED    │        │       │   REJECTED     │
     └────────────────┘        │       └────────────────┘
                               │                │
                               │      （可重新提交）
                               └────────────────┘
```

### 技术约束

- API 响应时间 ≤ 500ms
- 通知发送失败不影响审批状态更新
- 幂等性：重复提交同一审批意见应返回成功而非报错

---

## 验收测试基准 (ATB)

### ATB-1: 正常审批通过流程

**前置条件**: 工单状态为 `PENDING_APPROVAL`，当前用户为审批人

**测试步骤**:
1. 调用 `GET /api/work-orders/{id}` 验证状态为 `PENDING_APPROVAL`
2. 调用 `POST /api/work-orders/{id}/approve` 提交审批意见
3. 调用 `GET /api/work-orders/{id}` 验证状态已变更为 `APPROVED`
4. 查询审批历史表验证记录已创建

**物理测试期待**:
```python
# pytest 测试用例
def test_approve_work_order_success():
    # 1. 创建待审批工单
    wo = WorkOrderFactory(status=WorkOrderStatus.PENDING_APPROVAL)
    
    # 2. 提交通过审批
    response = api_client.post(
        f"/api/work-orders/{wo.id}/approve",
        data={"result": "APPROVED", "comment": "同意处理"}
    )
    
    # 3. 断言 HTTP 200
    assert response.status_code == 200
    
    # 4. 断言状态机流转
    wo.refresh_from_db()
    assert wo.status == WorkOrderStatus.APPROVED
    
    # 5. 断言审批历史已记录
    history = ApprovalHistory.objects.filter(work_order=wo).first()
    assert history.action == "APPROVED"
```

---

### ATB-2: 正常驳回流程

**前置条件**: 工单状态为 `PENDING_APPROVAL`，当前用户为审批人

**测试步骤**:
1. 调用 `POST /api/work-orders/{id}/reject` 提交驳回意见（含驳回原因）
2. 验证返回码 200
3. 验证状态变更为 `REJECTED`
4. 验证驳回原因已记录

**物理测试期待**:
```python
# pytest 测试用例
def test_reject_work_order_success():
    response = api_client.post(
        f"/api/work-orders/{wo.id}/reject",
        data={"result": "REJECTED", "reason": "材料不符合要求"}
    )
    
    assert response.status_code == 200
    wo.refresh_from_db()
    assert wo.status == WorkOrderStatus.REJECTED
    
    # 验证驳回原因已持久化
    history = ApprovalHistory.objects.filter(work_order=wo).first()
    assert history.rejection_reason == "材料不符合要求"
```

---

### ATB-3: 驳回时缺少原因（边界校验）

**前置条件**: 工单状态为 `PENDING_APPROVAL`

**测试步骤**:
1. 调用 `POST /api/work-orders/{id}/reject` 不带 reason 字段
2. 验证返回码 422（Unprocessable Entity）
3. 验证错误信息包含 reason 字段校验失败提示

**物理测试期待**:
```python
# pytest 测试用例
def test_reject_without_reason_fails():
    response = api_client.post(
        f"/api/work-orders/{wo.id}/reject",
        data={"result": "REJECTED"}
    )
    
    assert response.status_code == 422
    assert "reason" in response.json()["errors"]
```

---

### ATB-4: 非审批人权限校验

**前置条件**: 工单状态为 `PENDING_APPROVAL`，当前用户非审批人

**测试步骤**:
1. 以非审批人身份调用审批接口
2. 验证返回码 403 Forbidden

**物理测试期待**:
```python
# pytest 测试用例
def test_non_approver_cannot_approve():
    # 以普通用户身份调用
    response = regular_user_client.post(
        f"/api/work-orders/{wo.id}/approve",
        data={"result": "APPROVED"}
    )
    
    assert response.status_code == 403
```

---

### ATB-5: 状态非法流转校验

**前置条件**: 工单状态为 `APPROVED`（已通过）

**测试步骤**:
1. 调用审批接口尝试修改已通过工单
2. 验证返回码 409 Conflict
3. 验证错误信息提示状态不可逆

**物理测试期待**:
```python
# pytest 测试用例
def test_cannot_approve_already_approved():
    wo = WorkOrderFactory(status=WorkOrderStatus.APPROVED)
    
    response = api_client.post(
        f"/api/work-orders/{wo.id}/approve",
        data={"result": "APPROVED"}
    )
    
    assert response.status_code == 409
    assert "不可逆" in response.json()["error"]
```

---

### ATB-6: 通知触发验证

**前置条件**: 工单审批完成

**测试步骤**:
1. 执行审批操作
2. 验证通知消息已发送至消息队列

**物理测试期待**:
```python
# pytest 测试用例
def test_notification_sent_after_approval():
    with assert_event_published("workorder.approval.completed"):
        api_client.post(
            f"/api/work-orders/{wo.id}/approve",
            data={"result": "APPROVED"}
        )
    
    # 验证消息内容包含工单ID和审批结果
    published = get_published_message("workorder.approval.completed")
    assert published["work_order_id"] == wo.id
    assert published["result"] == "APPROVED"
```

---

### ATB-7: 幂等性验证

**前置条件**: 工单已审批通过

**测试步骤**:
1. 再次提交相同的审批意见
2. 验证返回码 200（而非报错）

**物理测试期待**:
```python
# pytest 测试用例
def test_duplicate_approval_idempotent():
    # 第一次审批
    response1 = api_client.post(
        f"/api/work-orders/{wo.id}/approve",
        data={"result": "APPROVED", "comment": "同意"}
    )
    assert response1.status_code == 200
    
    # 重复提交同一意见（幂等）
    response2 = api_client.post(
        f"/api/work-orders/{wo.id}/approve",
        data={"result": "APPROVED", "comment": "同意"}
    )
    assert response2.status_code == 200
    assert response2.json()["idempotent"] is True
```

---

### ATB-8: 前端 E2E 验收

**物理测试期待**:
```python
# playwright 测试用例
def test_approval_page_e2e():
    page.goto(f"/work-orders/{wo.id}/approve")
    
    # 验证页面加载待审批状态
    assert page.locator(".status-badge").text_content() == "待审批"
    
    # 点击通过按钮
    page.click("button[action='approve']")
    
    # 填写审批意见
    page.fill("textarea[name='comment']", "审核通过")
    page.click("button[type='submit']")
    
    # 验证页面提示成功
    assert page.locator(".toast").text_content() == "审批已提交"
    
    # 验证状态已更新
    page.reload()
    assert page.locator(".status-badge").text_content() == "已通过"
```

---

## 开发切入层级序列

### L1: 数据模型层

**文件位置**: `src/domain/entities/work_order.py`

**实现任务**:
1. 定义 `WorkOrderStatus` 枚举值（`PENDING_APPROVAL`, `APPROVED`, `REJECTED`）
2. 扩展 `WorkOrder` 实体添加审批相关字段
3. 添加审批人关联字段

**依赖**: 无

---

### L2: 状态机层

**文件位置**: `backend/state_machine/ticket_state_machine.py`

**实现任务**:
1. 扩展 `TicketStateMachine` 类
2. 定义工单审批相关的状态流转规则
3. 实现原子化状态更新方法（加锁保护）

**依赖**: L1

---

### L3: 业务服务层

**文件位置**: `src/services/approval_service.py`

**实现任务**:
1. 实现 `ApprovalService.submit_approval()` 方法
2. 集成状态机调用
3. 创建审批历史记录
4. 触发通知事件

**依赖**: L1, L2

---

### L4: API 接口层

**文件位置**: `src/api/routes/work_orders.py`

**实现任务**:
1. 实现 `POST /api/work-orders/{id}/approve` 端点
2. 实现 `POST /api/work-orders/{id}/reject` 端点
3. 实现参数校验（reason 必填校验）
4. 实现权限校验中间件

**依赖**: L3

---

### L5: 前端交互层

**文件位置**: `frontend/src/stores/approvalStore.ts`

**实现任务**:
1. 审批表单状态管理
2. 提交审批意见的 action
3. 错误处理和状态刷新

**依赖**: L4 API 完成

### L5-1: 前端路由层

**文件位置**: `frontend/src/router/approval.ts`

**实现任务**:
1. 审批页面路由配置
2. 路由守卫（权限校验）

**依赖**: L4 API 完成

---

### L6: 前端类型定义层

**文件位置**: `frontend/src/pages/WorkOrder/types/workOrder.ts`

**实现任务**:
1. 扩展 `WorkOrderStatus` 类型定义
2. 添加审批相关的类型（`ApprovalResult`, `ApprovalRequest`）

**依赖**: 无

---

### L7: 通知集成层

**文件位置**: `src/services/notification_service.py`

**实现任务**:
1. 监听审批完成事件
2. 发送消息至消息队列
3. 实现重试机制

**依赖**: L3

---

## 附录

### 审批结果枚举

```python
class ApprovalResult(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
```

### API 请求/响应示例

**请求**:
```json
POST /api/work-orders/123/approve
{
    "result": "APPROVED",
    "comment": "同意处理该工单"
}
```

**响应**:
```json
{
    "code": 200,
    "message": "审批成功",
    "data": {
        "work_order_id": 123,
        "status": "APPROVED",
        "approval_time": "2025-01-15T10:30:00Z"
    }
}
```

---

## 文件修改清单

| 层级 | 文件路径 | 修改类型 |
|------|----------|----------|
| L1 | `src/domain/entities/work_order.py` | 修改 |
| L2 | `backend/state_machine/ticket_state_machine.py` | 修改 |
| L3 | `src/services/approval_service.py` | 修改 |
| L4 | `src/api/routes/work_orders.py` | 修改 |
| L5 | `frontend/src/stores/approvalStore.ts` | 修改 |
| L5-1 | `frontend/src/router/approval.ts` | 修改 |
| L6 | `frontend/src/pages/WorkOrder/types/workOrder.ts` | 修改 |