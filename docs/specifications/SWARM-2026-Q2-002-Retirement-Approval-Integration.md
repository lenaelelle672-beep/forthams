# SWARM-2026-Q2-002: 资产报废退役流程与审批链集成

## 需求与背景

### 业务背景

资产管理生命周期中，报废/退役环节是资产价值终结的关键节点。当前系统缺乏完整的报废申请与多级审批机制，导致以下问题：

| 问题 | 影响 |
|------|------|
| 资产报废决策缺乏规范化审批流程 | 决策随意，资产流失风险 |
| 历史状态变更无完整记录，追溯困难 | 审计合规风险 |
| 审批节点分散，信息不透明 | 流程效率低下，责任不清 |

### 功能范围

| 功能模块 | 描述 | 优先级 |
|---------|------|--------|
| 报废申请 | 用户发起资产报废/退役申请，填写报废原因、预估残值等信息 | P0 |
| 多级审批链 | 配置并执行报废申请的多级审批流程，支持会签/或签 | P0 |
| 生命周期历史 | 记录并展示资产从采购到报废的全生命周期状态流转 | P1 |
| 状态流转可视化 | 在资产详情页展示状态变更时间轴 | P1 |

---

## 当前 Phase 对应实施目标

> 参照 `plan.md` Phase 拆解

### Phase 4: 审批链执行与历史追溯 (本次 Iteration 核心目标)

```
Phase 1 (已完成): 资产状态模型与基础数据层
Phase 2 (已完成): 报废申请表单与提交接口
Phase 3 (已完成): 审批链配置引擎
Phase 4 ← 本次: 审批链执行与历史追溯 ←
Phase 5 (规划中): 通知与告警集成
```

### 实施里程碑

| 里程碑 | 验收条件 | 状态 | 负责人 |
|--------|----------|------|--------|
| M4.1 | 审批任务查询与拉取 | ✓ 已实现 | - |
| M4.2 | 审批操作（通过/驳回/转交） | ✓ 已实现 | - |
| M4.3 | 状态变更持久化与历史查询 | **本次重点** | TBD |
| M4.4 | 生命周期时间轴渲染 | **本次重点** | TBD |

---

## 边界约束

### 功能边界

```
✅ 允许: 报废申请提交 → 审批链流转 → 状态变更 → 历史记录
✅ 允许: 审批驳回后申请人修改重新提交
✅ 允许: 审批转交（本人 → 指定人）
✅ 允许: 历史记录只读查询
❌ 禁止: 越级审批（必须按配置链顺序执行）
❌ 禁止: 同一资产并发发起多个报废申请（状态锁定）
❌ 禁止: 历史记录修改/删除
❌ 禁止: 报废审批中强制终止流程（必须走完审批链）
```

### 数据边界

| 实体 | 约束 |
|------|------|
| 资产状态 | 仅限 `可用` / `维修中` / `已报废` / `已退役` |
| 审批链层级 | 最少 1 级，最多 5 级 |
| 历史记录保留 | 永久保留，不可删除 |
| 单次审批超时 | 72 小时，超时自动提醒 |

### 技术约束

| 约束项 | 说明 |
|--------|------|
| 后端框架 | FastAPI / Django |
| 前端框架 | Vue 3 + TypeScript |
| 数据库 | PostgreSQL / MySQL |
| 审批链存储 | `approval_chain_repository.py` |
| 生命周期记录 | `history_repository.py` |

---

## 验收测试基准 (ATB)

### ATB-1: 报废申请提交

**测试用例**: `test_submit_retirement_application`

```python
# pytest tests/integration/test_retirement_flow.py::test_submit_retirement_application
def test_submit_retirement_application():
    """
    验证报废申请提交的核心流程：
    1. 资产状态为"可用"
    2. 无进行中的报废申请
    3. 申请提交后状态变为"审批中"
    """
    # 前提条件
    asset_id = create_test_asset(status="可用")
    assert not has_pending_retirement(asset_id)
    
    # 操作: 提交报废申请
    response = api.post("/api/v1/retirement/apply", json={
        "asset_id": asset_id,
        "reason": "设备老化，无法继续使用",
        "estimated_residual_value": 500.00
    })
    
    # 期待结果
    assert response.status_code == 201
    assert response.json()["status"] == "审批中"
    assert response.json()["current_approver"] == "部门经理"
```

**物理测试点**: 
- [ ] 资产状态锁定检查（`asset.status == '审批中'`）
- [ ] 申请记录持久化（DB Insert 到 `retirement_application` 表）
- [ ] 首个审批任务生成（`approval_task.created_at`）
- [ ] 生命周期事件记录（`lifecycle_event.event_type == '报废申请提交'`）

---

### ATB-2: 审批链层级验证

**测试用例**: `test_sequential_approval`

```python
# pytest tests/integration/test_approval_chain.py::test_sequential_approval
def test_sequential_approval():
    """
    验证多级审批链的顺序执行：
    配置: 部门经理 → 资产管理员 → 财务
    """
    # 准备: 配置3级审批链
    config_approval_chain(levels=["dept_manager", "asset_admin", "finance"])
    asset_id = create_test_asset()
    submit_retirement(asset_id)
    
    # 第一级审批
    task = get_pending_approval(user="dept_manager")
    approve(task_id=task.id, decision="approve")
    assert task.status == "approved"
    
    # 验证: 第二级审批任务生成
    next_task = get_pending_approval(user="asset_admin")
    assert next_task.asset_id == task.asset_id
    assert next_task.level == 2
```

**物理测试点**:
- [ ] 层级顺序校验（禁止跳级审批）
- [ ] 每级审批后正确生成下一级任务
- [ ] 最后一审批完成后触发状态变更
- [ ] 驳回时状态回滚

---

### ATB-3: 驳回与修改重提

**测试用例**: `test_reject_and_resubmit`

```python
# pytest tests/integration/test_retirement_request.py::test_reject_and_resubmit
def test_reject_and_resubmit():
    """
    验证驳回后申请人修改重提流程：
    1. 第一级审批驳回
    2. 资产状态解锁
    3. 申请人修改后重新提交
    4. 新审批链启动
    """
    # 第一级驳回
    task = get_pending_approval(user="dept_manager")
    reject(task_id=task.id, reason="报废理由不充分，请补充")
    
    assert task.status == "rejected"
    assert asset.status == "可用"  # 状态解锁
    
    # 申请人修改重提
    response = api.put(f"/api/v1/retirement/{asset_id}", json={
        "reason": "设备已无法修复，需报废处理",
        "estimated_residual_value": 200.00,
        "attachments": ["repair_report.pdf"]
    })
    
    assert response.status_code == 200
    assert response.json()["status"] == "审批中"
    assert response.json()["current_approver"] == "部门经理"  # 新审批链启动
```

**物理测试点**:
- [ ] 驳回后资产状态恢复
- [ ] 驳回原因记录（`approval_history.rejection_reason`）
- [ ] 修改后新审批链正确启动
- [ ] 历史记录保留驳回痕迹

---

### ATB-4: 生命周期历史查询

**测试用例**: `test_query_lifecycle_history`

```python
# pytest tests/integration/test_asset_history.py::test_query_lifecycle_history
def test_query_lifecycle_history():
    """
    验证资产生命周期历史查询：
    - 按时间倒序/正序
    - 历史记录不可修改
    - 状态变更节点完整
    """
    asset_id = "AST-2024-001"
    
    # 查询生命周期历史
    response = api.get(f"/api/v1/assets/{asset_id}/lifecycle")
    
    assert response.status_code == 200
    history = response.json()["timeline"]
    
    # 期待时间轴顺序
    expected_events = [
        {"event": "采购入库", "timestamp": "2024-01-15T10:00:00Z"},
        {"event": "领用", "timestamp": "2024-02-01T14:30:00Z"},
        {"event": "维修", "timestamp": "2024-06-10T09:15:00Z"},
        {"event": "报废申请", "timestamp": "2026-04-20T11:00:00Z"},
        {"event": "审批完成", "timestamp": "2026-04-22T16:45:00Z"}
    ]
    
    assert history == expected_events
```

**物理测试点**:
- [ ] 按时间倒序/正序查询
- [ ] 历史记录不可修改验证
- [ ] 状态变更节点完整性（无遗漏）
- [ ] 关联用户信息展示

---

### ATB-5: E2E 审批流程

**测试用例**: `test_full_approval_flow` (Playwright)

```typescript
// playwright tests/e2e/retirement_flow.spec.ts
async function test_full_approval_flow(page: Page) {
  // 1. 申请人提交报废申请
  await page.goto("/assets/AST-001/retire");
  await page.fill("#reason", "设备老化无法使用");
  await page.fill("#estimated_residual_value", "500");
  await page.click("button[type=submit]");
  await page.waitForSelector(".toast-success");
  
  // 2. 第一级审批人审批
  await page.goto("/approvals/pending");
  await page.click("button[data-action=approve]");
  await page.waitForSelector(".status-approved");
  
  // 3. 验证状态变更
  await page.goto("/assets/AST-001");
  await page.waitForSelector(".lifecycle-timeline");
  
  const timelineItems = await page.locator(".timeline-item").all();
  assert(timelineItems.length >= 5);
  
  // 4. 验证时间轴包含审批节点
  const approvalNode = await page.locator(".timeline-item.approval").first();
  await expect(approvalNode).toContainText("报废申请已通过");
}
```

---

## 开发切入层级序列

### 第一层: 数据层 (Backend - Model)

```
src/
├── models/
│   ├── retirement.py              # 报废申请实体
│   ├── retirement_request.py       # 退役请求实体
│   ├── approval_chain.py          # 审批链配置实体
│   ├── approval_record.py          # 审批记录实体
│   └── asset_lifecycle_event.py    # 生命周期事件实体
```

**切入任务**:
1. 扩展 `Asset` 模型添加 `status_locked` 字段
2. 新建 `RetirementApplication` 模型（关联资产、申请人、审批链）
3. 新建 `ApprovalTask` 模型（层级、状态、审批人）
4. 新建 `LifecycleEvent` 模型（事件类型、时间戳、操作人）

**参考文件**:
- `src/models/retirement.py` (相关度: 3, 553 行)
- `src/repositories/history_repository.py` (相关度: 3, 788 行)

---

### 第二层: 服务层 (Backend - Service)

```
src/
├── services/
│   ├── retirement_service.py      # 报废申请服务
│   ├── approval_service.py         # 审批链服务
│   └── lifecycle_service.py        # 生命周期记录服务
```

**切入任务**:
1. `submit_retirement_application(asset_id, reason, user_id)` → 创建申请，生成首级审批任务
2. `process_approval(task_id, decision, user_id)` → 执行审批，更新状态，触发下一级或完成
3. `record_lifecycle_event(asset_id, event_type, metadata)` → 记录状态变更历史
4. `get_lifecycle_timeline(asset_id)` → 聚合查询历史事件

**参考文件**:
- `backend/services/approval_service.py`
- `backend/services/retirement_service.py`

---

### 第三层: API层 (Backend - Router)

```
src/
├── api/v1/
│   ├── retirement.py               # 报废相关接口
│   ├── approval.py                 # 审批相关接口
│   └── schemas/
│       ├── retirement.py           # 报废请求/响应Schema
│       └── approval.py             # 审批请求/响应Schema
```

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/v1/retirement/apply` | POST | 提交报废申请 |
| `/api/v1/retirement/{id}` | PUT | 修改报废申请（驳回后） |
| `/api/v1/retirement/{id}` | GET | 查询申请详情 |
| `/api/v1/retirement/{id}/history` | GET | 查询申请审批历史 |
| `/api/v1/approvals/pending` | GET | 查询待我审批任务 |
| `/api/v1/approvals/{task_id}` | POST | 执行审批操作 |
| `/api/v1/approvals/{task_id}/transfer` | POST | 转交审批任务 |
| `/api/v1/assets/{id}/lifecycle` | GET | 查询资产生命周期 |

**参考文件**:
- `src/api/v1/schemas/retirement.py` (相关度: 4, 322 行)
- `backend/api/v1/approval.py` (相关度: 3, 521 行)

---

### 第四层: 前端层 (Frontend)

```
frontend/src/
├── pages/retirement/
│   └── RetirementApplication.vue   # ⭐ 核心修改文件
├── types/
│   └── approval.ts                 # 审批类型定义
├── services/
│   ├── retirementService.ts
│   └── approvalService.ts
└── stores/
    └── approvalStore.ts
```

**切入任务**:
1. **RetirementApplication.vue** - 报废申请表单
   - 报废原因输入（必填校验）
   - 预估残值计算
   - 附件上传
   - 提交/重提逻辑

2. **ApprovalPending.vue** - 审批任务列表
   - 待审批任务卡片
   - 通过/驳回按钮
   - 转交入口

3. **AssetLifecycle.vue** - 生命周期时间轴
   - 时间轴组件
   - 状态变更节点
   - 操作人信息展示

**参考文件**:
- `frontend/src/types/approval.ts` (相关度: 3, 186 行)

---

## 依赖关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端层 (Vue 3)                           │
│  ┌─────────────────────┐    ┌────────────────────────────────┐ │
│  │ RetirementApplication│    │      ApprovalPending.vue       │ │
│  │       .vue           │    │                                │ │
│  └──────────┬───────────┘    └───────────────┬────────────────┘ │
└─────────────┼──────────────────────────────────┼────────────────┘
              │                                  │
              ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API 层 (FastAPI)                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    /api/v1/retirement/*                    ││
│  │                    /api/v1/approvals/*                     ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      服务层 (Services)                           │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │retirement_     │  │  approval_      │  │  lifecycle_      │ │
│  │service.py      │  │  service.py     │  │  service.py     │ │
│  └───────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
└──────────┼────────────────────┼────────────────────┼───────────┘
           │                    │                    │
           ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      数据层 (Models)                            │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ RetirementApp  │  │ ApprovalTask    │  │ LifecycleEvent  │ │
│  │ (retirement.py)│  │ (approval.py)   │  │ (history_*.py)  │ │
│  └────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 附录: 状态机定义

```yaml
AssetStatus:
  可用:
    → 审批中 (提交报废申请)
    → 维修中 (发起维修)
  审批中:
    → 已报废 (审批链全部通过)
    → 可用 (审批驳回)
  已报废:
    (终态，不可再流转)
  已退役:
    (终态，不可再流转)
```

---

## 附录: 数据模型

### RetirementApplication

| 字段 | 类型 | 描述 |
|------|------|------|
| id | UUID | 主键 |
| asset_id | UUID | 关联资产ID |
| applicant_id | UUID | 申请人ID |
| reason | Text | 报废原因 |
| estimated_residual_value | Decimal | 预估残值 |
| status | Enum | 申请状态 |
| current_level | Int | 当前审批层级 |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |

### ApprovalTask

| 字段 | 类型 | 描述 |
|------|------|------|
| id | UUID | 主键 |
| application_id | UUID | 关联申请ID |
| level | Int | 审批层级 |
| approver_id | UUID | 审批人ID |
| status | Enum | 任务状态 |
| decision | Enum | 审批决定 |
| comment | Text | 审批意见 |
| decided_at | DateTime | 审批时间 |

### LifecycleEvent

| 字段 | 类型 | 描述 |
|------|------|------|
| id | UUID | 主键 |
| asset_id | UUID | 关联资产ID |
| event_type | Enum | 事件类型 |
| from_status | Enum | 原状态 |
| to_status | Enum | 新状态 |
| operator_id | UUID | 操作人ID |
| metadata | JSON | 扩展数据 |
| timestamp | DateTime | 事件时间 |

---

*文档版本: SWARM-2026-Q2-002-iter4*
*编制日期: 2026-04-20*
*迭代周期: Q2 2026*