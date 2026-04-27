# SWARM-051 工单审批流程规格指导文档

**版本**: 1.0.0  
**迭代**: Iteration 1  
**状态**: 进行中  
**最后更新**: 2025-01-20

---

## 需求与背景

### 业务背景

工单审批流程是企业运维管理中的核心环节。当用户完成工单创建或工单状态变更时，需要经过指定审批人逐级审批通过后，方可执行后续操作（如工单关闭、资源释放、配置变更等）。当前系统缺少完整的审批流程支持，导致：

- 用户无法主动发起审批申请
- 审批进度对用户不可见
- 审批历史记录缺失，难以追溯

### 功能范围

本次 Iteration 1 聚焦于审批流程的基础能力建设：

| 功能点 | 描述 |
|--------|------|
| 审批申请发起 | 用户可在工单详情页发起审批请求 |
| 审批进度查看 | 用户可查看当前审批状态及历史审批节点 |
| 审批历史记录 | 系统记录完整审批轨迹，包含审批人、审批时间、审批意见 |

### 非本次范围

- 审批流程配置（审批节点、审批人规则）
- 审批驳回与修改
- 审批超时自动处理
- 移动端适配

---

## 当前 Phase 对应实施目标

### Phase 拆解（参照 plan.md）

根据 plan.md 的整体规划，审批流程分为以下 Phase：

| Phase | 内容 | 目标迭代 |
|-------|------|----------|
| Phase 1 | **审批基础能力**（发起、进度、记录） | Iteration 1 ← 本次 |
| Phase 2 | 审批驳回与驳回处理 | Iteration 2 |
| Phase 3 | 审批配置与规则引擎 | Iteration 3 |
| Phase 4 | 审批通知与超时处理 | Iteration 4 |

### 本次 Phase 1 实施目标

**目标**: 构建审批流程的最小可用闭环

```
┌─────────────────────────────────────────────────────────────┐
│                    Phase 1 目标范围                          │
├─────────────────────────────────────────────────────────────┤
│  发起审批 ──→ 审批处理 ──→ 审批完成 ──→ 历史记录查看          │
│     ↑              │              │              │           │
│     └──────────────┴──────────────┴──────────────┘           │
│                      完整闭环                                 │
└─────────────────────────────────────────────────────────────┘
```

**具体交付物**:

1. **前端组件**: 审批申请按钮 + 审批进度展示组件 + 审批历史记录面板
2. **后端接口**: 审批申请 API、审批进度查询 API、审批历史查询 API
3. **数据模型**: 审批记录表（含节点状态、时间戳、审批意见）
4. **单元测试**: 后端接口覆盖率 ≥ 80%
5. **E2E 测试**: Playwright 验收测试用例覆盖核心路径

---

## 边界约束

### 硬性约束

| 约束项 | 具体要求 |
|--------|----------|
| 审批状态枚举 | `PENDING`（待审批）、`APPROVED`（已通过）、`REJECTED`（已驳回）、`CANCELLED`（已取消） |
| 工单状态限制 | 仅 `OPEN` 和 `IN_PROGRESS` 状态的工单允许发起审批 |
| 幂等性 | 同一工单同一时间只允许存在一条 `PENDING` 状态的审批申请 |
| 权限要求 | 发起审批的用户必须是工单的创建者或负责人 |
| 历史不可篡改 | 审批记录创建后不允许修改，仅允许追加新节点 |

### 技术约束

| 约束项 | 具体要求 |
|--------|----------|
| API 版本控制 | 所有接口采用 `/api/v1/` 前缀 |
| 响应格式 | 统一 `{ code, message, data }` 结构 |
| 分页参数 | 列表接口统一支持 `page`、`page_size` 参数 |
| 时间格式 | ISO 8601 标准（`2025-01-20T10:30:00Z`） |

### 数据边界

| 边界 | 值 |
|------|-----|
| 审批历史单页最大条数 | 50 |
| 审批意见最大长度 | 500 字符 |
| 单次审批超时 | 72 小时（Phase 4 实现） |

---

## 验收测试基准 (ATB)

### 测试策略

| 测试层级 | 工具 | 覆盖率目标 |
|----------|------|-------------|
| 单元测试 | pytest | 后端逻辑 ≥ 80% |
| API 测试 | pytest + requests | 接口覆盖率 100% |
| E2E 测试 | Playwright | 核心用户路径 100% |

---

### ATB-001: 审批申请接口

**测试文件**: `tests/api/test_approval.py::test_create_approval_request`

```python
# pytest 测试用例伪代码
class TestApprovalRequest:
    def test_create_approval_request_success(self):
        """
        验收点: 有效工单可成功发起审批申请
        预期: 返回 201, data.id 为新审批记录 ID, status=PENDING
        """
        response = api_client.post("/api/v1/work-orders/{wo_id}/approvals", json={...})
        assert response.status_code == 201
        assert response.json()["data"]["status"] == "PENDING"

    def test_create_approval_duplicate_rejected(self):
        """
        验收点: 存在待审批时不可重复发起
        预期: 返回 409 Conflict
        """
        # 已存在 PENDING 审批
        response = api_client.post("/api/v1/work-orders/{wo_id}/approvals", json={...})
        assert response.status_code == 409

    def test_create_approval_invalid_status(self):
        """
        验收点: 非开放状态工单不可发起审批
        预期: 返回 400 Bad Request
        """
        # 工单状态为 CLOSED
        response = api_client.post("/api/v1/work-orders/{wo_id}/approvals", json={...})
        assert response.status_code == 400
```

---

### ATB-002: 审批进度查询接口

**测试文件**: `tests/api/test_approval.py::test_get_approval_progress`

```python
# pytest 测试用例伪代码
class TestApprovalProgress:
    def test_get_progress_with_nodes(self):
        """
        验收点: 返回完整审批节点链
        预期: data.nodes 包含所有审批节点，含 status/time/approver
        """
        response = api_client.get("/api/v1/approvals/{approval_id}/progress")
        assert response.status_code == 200
        nodes = response.json()["data"]["nodes"]
        assert len(nodes) >= 1
        assert all(k in nodes[0] for k in ["status", "created_at", "approver_id"])

    def test_get_progress_not_found(self):
        """
        验收点: 审批 ID 不存在时返回 404
        预期: 返回 404
        """
        response = api_client.get("/api/v1/approvals/{invalid_id}/progress")
        assert response.status_code == 404
```

---

### ATB-003: 审批历史记录查询接口

**测试文件**: `tests/api/test_approval.py::test_get_approval_history`

```python
class TestApprovalHistory:
    def test_get_history_paginated(self):
        """
        验收点: 历史记录支持分页
        预期: 返回 total/page/page_size, data 为记录数组
        """
        response = api_client.get("/api/v1/work-orders/{wo_id}/approvals/history?page=1&page_size=10")
        assert response.status_code == 200
        data = response.json()["data"]
        assert "total" in data
        assert "page" in data
        assert isinstance(data["items"], list)

    def test_history_ordered_by_time_desc(self):
        """
        验收点: 历史记录按时间倒序
        预期: items[0].created_at >= items[1].created_at
        """
        response = api_client.get("/api/v1/work-orders/{wo_id}/approvals/history")
        items = response.json()["data"]["items"]
        timestamps = [item["created_at"] for item in items]
        assert timestamps == sorted(timestamps, reverse=True)
```

---

### ATB-004: 前端 E2E 验收测试

**测试文件**: `e2e/tests/approval_flow.spec.ts`

```typescript
// Playwright 测试用例伪代码
import { test, expect } from '@playwright/test';

test.describe('工单审批流程 E2E', () => {
  test('用户可成功发起审批并查看进度', async ({ page }) => {
    // 步骤 1: 进入工单详情页
    await page.goto(`/work-orders/${woId}`);
    
    // 验收点: 审批按钮可见
    const approvalBtn = page.locator('[data-testid="btn-create-approval"]');
    await expect(approvalBtn).toBeVisible();
    
    // 步骤 2: 点击发起审批
    await approvalBtn.click();
    
    // 验收点: 弹窗确认
    const confirmDialog = page.locator('[data-testid="dialog-approval-confirm"]');
    await expect(confirmDialog).toBeVisible();
    await page.locator('[data-testid="btn-confirm"]').click();
    
    // 验收点: Toast 提示成功
    await expect(page.locator('.toast-success')).toContainText('审批申请已提交');
    
    // 步骤 3: 查看审批进度
    const progressPanel = page.locator('[data-testid="approval-progress-panel"]');
    await expect(progressPanel).toBeVisible();
    
    // 验收点: 显示待审批状态
    await expect(progressPanel.locator('.status-badge')).toContainText('待审批');
    
    // 步骤 4: 查看历史记录
    await page.click('[data-testid="tab-history"]');
    const historyList = page.locator('[data-testid="approval-history-list"]');
    
    // 验收点: 历史记录非空
    await expect(historyList.locator('.history-item')).toHaveCount({ min: 1 });
  });

  test('重复发起审批时显示错误', async ({ page }) => {
    await page.goto(`/work-orders/${woId}`);
    await page.click('[data-testid="btn-create-approval"]');
    await page.click('[data-testid="btn-confirm"]');
    
    // 验收点: 再次发起时按钮禁用
    await expect(page.locator('[data-testid="btn-create-approval"]')).toBeDisabled();
  });
});
```

---

### ATB-005: 数据完整性测试

**测试文件**: `tests/unit/test_approval_model.py`

```python
class TestApprovalModel:
    def test_approval_status_transitions(self):
        """
        验收点: 审批状态流转正确
        初始 PENDING -> 终态 APPROVED/REJECTED/CANCELLED
        """
        approval = Approval.create(work_order_id=wo_id, status=ApprovalStatus.PENDING)
        
        # 有效转换
        approval.status = ApprovalStatus.APPROVED
        assert approval.status == ApprovalStatus.APPROVED
        
        # 无效转换应抛异常
        with pytest.raises(InvalidStatusTransitionError):
            approval.status = ApprovalStatus.PENDING  # 不能从 APPROVED 回退

    def test_history_record_immutable(self):
        """
        验收点: 历史记录创建后不可修改
        """
        node = ApprovalNode.objects.create(approval_id=aid, status=ApprovalStatus.PENDING)
        node.status = ApprovalStatus.APPROVED  # 修改
        node.save()
        
        # 验证数据库中的值未改变（需在模型层拦截）
        refreshed = ApprovalNode.objects.get(id=node.id)
        assert refreshed.status == ApprovalStatus.PENDING
```

---

## 开发切入层级序列

### 层级依赖图

```
┌─────────────────────────────────────────────────────────┐
│                    层级 4: E2E 测试验证                   │
│                   (验收基准 / 用户视角)                    │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────┐
│                    层级 3: 前端实现                       │
│         (审批申请表单 + 进度组件 + 历史记录面板)             │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────┐
│                    层级 2: 后端 API                      │
│         (审批申请 / 进度查询 / 历史查询接口)               │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────┐
│                    层级 1: 数据模型                       │
│            (Approval / ApprovalNode 模型)                │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────┐
│                    层级 0: 数据库迁移                     │
│                  (审批相关表结构创建)                      │
└─────────────────────────────────────────────────────────┘
```

### 开发实施顺序

| 序号 | 层级 | 任务项 | 产出物 | 预估工时 |
|------|------|--------|--------|----------|
| 0 | 数据库迁移 | 设计并执行 Approval/ApprovalNode 表 DDL | 迁移文件 + 回滚脚本 | 0.5d |
| 1 | 数据模型 | 定义 Django Model / SQLAlchemy Model | `models.py` | 0.5d |
| 1 | 业务逻辑 | 实现审批状态机、幂等校验逻辑 | `services.py` | 1d |
| 2 | 后端 API | 实现 CRUD 接口 + 参数校验 | `views.py` / `serializers.py` | 1.5d |
| 2 | 单元测试 | pytest 接口测试（覆盖率 ≥ 80%） | `tests/api/` | 1d |
| 3 | 前端实现 | 审批申请按钮 + 进度组件 + 历史面板 | React/Vue 组件 | 2d |
| 3 | 前端集成 | 接入后端 API，错误处理 | 集成代码 | 0.5d |
| 4 | E2E 测试 | Playwright 验收测试 | `e2e/tests/` | 1d |
| 5 | 文档更新 | API 文档 + 使用文档 | OpenAPI / Swagger | 0.5d |

**总预估工时**: 8.5 人/天

### 关键技术点

1. **幂等性保证**: 使用数据库唯一约束 `(work_order_id, status=PENDING)` 防止重复申请
2. **审批链展示**: 递归查询 `ApprovalNode.parent_id` 构建树形结构
3. **历史不可变**: 模型层重写 `save()` 方法，对已确认节点拦截写操作
4. **前端状态同步**: WebSocket 推送或前端轮询更新审批进度（本期采用轮询，Phase 4 升级为 WS）

---

## 附录

### 数据模型 ER 图

```
┌──────────────────┐       ┌──────────────────────┐
│    WorkOrder     │       │      Approval        │
├──────────────────┤       ├──────────────────────┤
│ id (PK)          │──┐    │ id (PK)              │
│ status           │  │    │ work_order_id (FK)   │←─┐
│ creator_id       │  │    │ status               │  │
│ created_at       │  │    │ current_node_id (FK) │  │
└──────────────────┘  │    │ created_at           │  │
                      │    │ updated_at           │  │
                      │    └──────────────────────┘  │
                      │             │                │
                      │             │ 1:N           │
                      │             ▼                │
                      │    ┌──────────────────────┐  │
                      │    │   ApprovalNode       │  │
                      │    ├──────────────────────┤  │
                      │    │ id (PK)              │  │
                      └────│ approval_id (FK)     │──┘
                           │ parent_node_id (FK)  │
                           │ status               │
                           │ approver_id (FK)     │
                           │ comment              │
                           │ created_at           │
                           └──────────────────────┘
```

### API 端点清单

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/v1/work-orders/{id}/approvals` | 发起审批申请 |
| GET | `/api/v1/approvals/{id}/progress` | 获取审批进度 |
| GET | `/api/v1/work-orders/{id}/approvals/history` | 获取审批历史记录 |
| POST | `/api/v1/approvals/{id}/approve` | 审批通过 (Phase 2) |
| POST | `/api/v1/approvals/{id}/reject` | 审批驳回 (Phase 2) |

### 审批状态流转图

```
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                                     │
              ┌──────────┐                                 │
              │ PENDING  │ ← 工单创建后/状态变更后发起      │
              └────┬─────┘                                 │
                   │                                       │
         ┌─────────┼─────────┐                             │
         │         │         │                             │
         ▼         ▼         ▼                             │
   ┌──────────┐ ┌────────┐ ┌───────────┐                   │
   │APPROVED  │ │REJECTED│ │CANCELLED  │                   │
   └──────────┘ └────────┘ └───────────┘                   │
         │         │         │                             │
         │         │         └─────────────────────────────┘
         │         │                 (用户主动取消)
         │         │
         │         └───────────────────────────────────────┐
         │                                                 │
         ▼                                                 │
   (可执行后续操作)                                         │
   例: 工单关闭、资源释放、配置变更                          │
                                                          
```

### 修改文件清单

| 文件路径 | 修改类型 | 说明 |
|----------|----------|------|
| `frontend/src/types/depreciation.types.ts` | 修改 | 添加审批相关类型导出 |
| `frontend/src/app/pages/OperationLogDashboard/components/TrendChart.tsx` | 修改 | 集成审批进度数据展示 |
| `frontend/src/app/pages/AuditDashboard/components/FilterBar/FilterBar.module.css` | 修改 | 审批状态筛选样式 |
| `frontend/src/app/pages/asset/AssetDetailPage.tsx` | 修改 | 添加审批申请入口 |
| `frontend/src/components/approval/ApprovalHistory.tsx` | 修改 | 审批历史记录组件 |