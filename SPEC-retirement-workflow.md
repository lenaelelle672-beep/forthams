# SWARM-S5-002 资产报废/退役流程 - 规格指导文档

## 1. 需求与背景

### 1.1 业务背景

企业资产管理中，资产报废/退役是资产全生命周期管理的最终环节。现有系统缺少标准化的报废流程支持，导致：
- 资产状态变更缺乏统一管理
- 报废审批链路不透明
- 历史记录不完整，无法追溯

### 1.2 核心需求

实现端到端的资产报废/退役流程管理，覆盖申请提交、状态流转、审批链执行、历史记录归档全链路。

### 1.3 关联文件清单

| 文件路径 | 相关度 | 说明 |
|----------|--------|------|
| `backend/models/asset_retirement.py` | 高 | 资产退役领域模型定义 |
| `src/main.py` | 高 | 应用入口与依赖注入配置 |
| `src/api/middleware/audit_logger.py` | 高 | 审计日志中间件 |
| `src/api/deps/auth.py` | 高 | 认证与授权依赖（包含 UserRole、AssetStatus 枚举） |
| `tests/e2e/retirement_user_journey.spec.ts` | 高 | E2E 测试规范 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 迭代定位

**Iteration: 1** - 基础流程实现阶段

### 2.2 Phase 拆解对齐

| Phase | 目标 | 交付物 |
|-------|------|--------|
| Phase 1 | 资产报废申请提交与基础校验 | 申请表单、数据校验逻辑 |
| Phase 2 | 审批链路配置与执行 | 审批流程引擎、节点路由 |
| Phase 3 | 状态流转与通知 | 状态机引擎、消息通知 |
| Phase 4 | 历史记录与审计追踪 | 操作日志表、查询接口 |

### 2.3 本次 Specification 覆盖范围

本次输出对齐 **Phase 1 + Phase 2 + Phase 3 核心路径**，Phase 4 历史记录部分作为独立模块预留接口。

---

## 3. 边界约束

### 3.1 范围界定

#### ✅ 范围内

1. 资产报废申请单创建、编辑、撤回
2. 资产状态枚举定义与状态机转换
3. 多级审批链路配置（线性审批链）
4. 审批节点执行（通过/驳回/转签）
5. 状态变更触发与持久化
6. 操作历史记录写入

#### ❌ 范围外

1. 财务模块对接（折旧计算接口预留）
2. 资产入库/领用等正向流程
3. 批量报废审批（单次仅支持单条资产）
4. 移动端 UI
5. 跨组织审批路由

### 3.2 数据约束

| 约束项 | 规则 |
|--------|------|
| 资产状态前置校验 | 仅 `ACTIVE`、`IDLE` 状态允许发起报废 |
| 审批链最大层级 | 不超过 5 级 |
| 申请单编号格式 | `SC-YYYYMMDD-XXXX`（XXXX 为 4 位序号） |
| 附件上传限制 | 支持 .pdf/.jpg/.png，单文件 ≤ 10MB |

### 3.3 状态机定义

```
┌─────────────────────────────────────────────────────────────────┐
│                      资产报废状态机                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐    submit     ┌──────────────────┐                │
│  │  ACTIVE │──────────────▶│ PENDING_APPROVAL │                │
│  └─────────┘               └────────┬─────────┘                │
│       ▲                            │                           │
│       │                            │ approve                   │
│       │ rollback                   ▼                           │
│       │                      ┌──────────┐                      │
│  ┌────┴────┐                │ APPROVED │                      │
│  │  IDLE   │◀───────────────└────┬─────┘                      │
│  └─────────┘    reject           │                             │
│                                 │ finalize                    │
│                                 ▼                             │
│                          ┌─────────────┐                      │
│                          │   CLOSED    │                      │
│                          └─────────────┘                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 验收测试基准 (ATB)

### 4.1 测试层级划分

```
ATB-1: 单元测试层 (pytest)
ATB-2: 集成测试层 (pytest + fixtures)
ATB-3: 端到端测试层 (Playwright)
```

---

### ATB-1: 单元测试（pytest）

#### T1.1 资产状态枚举校验

```python
def test_asset_status_enum_values():
    """
    验证资产状态枚举包含预期值
    关联: src/api/deps/auth.py -> AssetStatus 枚举 (L33)
    """
    from src.api.deps.auth import AssetStatus
    
    expected_statuses = {"ACTIVE", "IDLE", "PENDING_APPROVAL", "APPROVED", "CLOSED"}
    actual_statuses = {s.value for s in AssetStatus}
    assert expected_statuses.issubset(actual_statuses)
```

#### T1.2 报废申请前置条件校验

```python
def test_retirement_precondition_valid_status(setup_asset_active):
    """
    在用状态资产允许发起报废
    关联: backend/models/asset_retirement.py -> validate_eligibility
    """
    result = validate_retirement_eligibility(setup_asset_active.id)
    assert result.is_eligible is True

def test_retirement_precondition_invalid_status(setup_asset_maintenance):
    """
    维护中状态资产不允许发起报废
    关联: backend/models/asset_retirement.py -> RetirementApplication
    """
    result = validate_retirement_eligibility(setup_asset_maintenance.id)
    assert result.is_eligible is False
    assert "非有效前置状态" in result.error_message
```

#### T1.3 申请单编号生成规则

```python
def test_retirement_application_number_format():
    """
    验证申请单编号符合 SC-YYYYMMDD-XXXX 格式
    关联: src/models/asset_retirement.py -> generate_application_number
    """
    import re
    from src.models.asset_retirement import generate_retirement_application_number
    
    number = generate_retirement_application_number()
    pattern = r"^SC-\d{8}-\d{4}$"
    assert re.match(pattern, number) is not None
```

#### T1.4 状态机转换合法性校验

```python
@pytest.mark.parametrize("from_status,to_status,expected_valid", [
    ("ACTIVE", "PENDING_APPROVAL", True),
    ("IDLE", "PENDING_APPROVAL", True),
    ("PENDING_APPROVAL", "APPROVED", True),
    ("APPROVED", "CLOSED", True),
    ("CLOSED", "ACTIVE", False),  # 已关闭不可逆
    ("ACTIVE", "CLOSED", False),  # 必须经过审批流程
])
def test_status_transition_validity(from_status, to_status, expected_valid):
    """
    参数化测试状态转换合法性
    关联: src/state_machine/retirement_state_machine.py
    """
    from src.state_machine.retirement_state_machine import RetirementStateMachine
    
    validator = RetirementStateMachine()
    result = validator.can_transition(from_status, to_status)
    assert result == expected_valid
```

#### T1.5 审批链配置验证

```python
def test_approval_chain_max_level_constraint():
    """
    验证审批链层级不超过 5 级
    关联: src/models/approval_chain.py -> ApprovalChain.validate
    """
    from src.models.approval_chain import ApprovalChain, ValidationError
    
    chain = ApprovalChain(name="测试链", levels=6)
    with pytest.raises(ValidationError) as exc_info:
        chain.validate()
    assert "超过最大审批层级" in str(exc_info.value)
```

---

### ATB-2: 集成测试（pytest + fixtures）

#### T2.1 完整报废流程状态流转

```python
def test_complete_retirement_workflow(test_client, setup_asset, setup_approval_chain):
    """
    测试场景: 资产从 ACTIVE -> PENDING_APPROVAL -> APPROVED -> CLOSED 全链路
    验证: 状态变更持久化、申请单状态同步
    
    关联:
    - src/services/retirement_service.py -> submit_retirement_application
    - src/services/approval_chain_service.py -> execute_approval
    """
    # Step 1: 创建报废申请
    response = test_client.post("/api/v1/assets/retirement", json={
        "asset_id": setup_asset.id,
        "reason": "设备老旧需淘汰",
        "expected_date": "2025-12-31"
    })
    assert response.status_code == 201
    application_id = response.json()["application_id"]
    
    # Step 2: 验证资产状态变为 "PENDING_APPROVAL"
    asset_response = test_client.get(f"/api/v1/assets/{setup_asset.id}")
    assert asset_response.json()["status"] == "PENDING_APPROVAL"
    
    # Step 3: 审批通过
    approve_response = test_client.post(
        f"/api/v1/retirement/{application_id}/approve",
        json={"approver_id": "user_001", "comment": "同意报废"}
    )
    assert approve_response.status_code == 200
    
    # Step 4: 最终审批完成 -> CLOSED
    finalize_response = test_client.post(
        f"/api/v1/retirement/{application_id}/finalize"
    )
    assert finalize_response.status_code == 200
    
    # Step 5: 验证最终状态为 "CLOSED"
    final_asset_response = test_client.get(f"/api/v1/assets/{setup_asset.id}")
    assert final_asset_response.json()["status"] == "CLOSED"
```

#### T2.2 审批驳回状态回滚

```python
def test_retirement_rejection_rollback(test_client, setup_asset, setup_approval_chain):
    """
    测试场景: 审批驳回后资产状态回滚至原状态
    关联: src/services/retirement_service.py -> reject_retirement
    """
    # 前置: 资产当前状态为 "ACTIVE"
    original_status = setup_asset.status
    
    # 创建申请 -> 审批中状态
    response = test_client.post("/api/v1/assets/retirement", json={
        "asset_id": setup_asset.id,
        "reason": "测试驳回"
    })
    assert response.status_code == 201
    
    # 审批驳回
    reject_response = test_client.post(
        f"/api/v1/retirement/{response.json()['application_id']}/reject",
        json={"approver_id": "user_001", "comment": "信息不全"}
    )
    assert reject_response.status_code == 200
    
    # 验证状态回滚
    asset_response = test_client.get(f"/api/v1/assets/{setup_asset.id}")
    assert asset_response.json()["status"] == original_status
```

#### T2.3 申请撤回功能

```python
def test_retirement_application_withdraw(test_client, setup_asset):
    """
    测试场景: 申请人撤回未审批的报废申请
    验证: 申请单状态变为 "WITHDRAWN"，资产状态恢复原值
    
    关联: src/services/retirement_service.py -> withdraw_application
    """
    # 创建申请
    create_resp = test_client.post("/api/v1/assets/retirement", json={
        "asset_id": setup_asset.id,
        "reason": "误操作"
    })
    app_id = create_resp.json()["application_id"]
    
    # 撤回申请
    withdraw_resp = test_client.post(f"/api/v1/retirement/{app_id}/withdraw")
    assert withdraw_resp.status_code == 200
    
    # 验证申请单状态
    app_detail = test_client.get(f"/api/v1/retirement/{app_id}")
    assert app_detail.json()["status"] == "WITHDRAWN"
    
    # 验证资产状态恢复
    asset = test_client.get(f"/api/v1/assets/{setup_asset.id}")
    assert asset.json()["status"] == "ACTIVE"  # 恢复原状态
```

#### T2.4 多级审批链路执行

```python
def test_multi_level_approval_chain(test_client, setup_asset, setup_3level_chain):
    """
    测试场景: 3 级审批链路顺序执行
    验证: 每级审批完成后进入下一级，最终审批完成后状态流转
    
    关联:
    - src/services/approval_chain_service.py -> ApprovalChainService
    - src/api/middleware/audit_logger.py -> 审批操作审计
    """
    create_resp = test_client.post("/api/v1/assets/retirement", json={
        "asset_id": setup_asset.id,
        "reason": "多级审批测试"
    })
    app_id = create_resp.json()["application_id"]
    
    # Level 1 审批
    resp1 = test_client.post(f"/api/v1/retirement/{app_id}/approve", json={
        "approver_id": "level1_user", "comment": "L1通过"
    })
    assert resp1.json()["current_level"] == 1
    assert resp1.json()["next_approver"] is not None
    
    # Level 2 审批
    resp2 = test_client.post(f"/api/v1/retirement/{app_id}/approve", json={
        "approver_id": "level2_user", "comment": "L2通过"
    })
    assert resp2.json()["current_level"] == 2
    
    # Level 3 最终审批 -> 状态变为 APPROVED
    resp3 = test_client.post(f"/api/v1/retirement/{app_id}/approve", json={
        "approver_id": "level3_user", "comment": "最终批准"
    })
    assert resp3.json()["status"] == "APPROVED"
    
    # 最终结案
    finalize_resp = test_client.post(f"/api/v1/retirement/{app_id}/finalize")
    assert finalize_resp.json()["status"] == "CLOSED"
    
    # 验证资产最终状态
    asset = test_client.get(f"/api/v1/assets/{setup_asset.id}")
    assert asset.json()["status"] == "CLOSED"
```

---

### ATB-3: 端到端测试（Playwright）

#### T3.1 报废申请页面加载与表单提交

```typescript
// tests/e2e/retirement_user_journey.spec.ts

import { test, expect, Page } from '@playwright/test';

test.describe('资产报废申请 E2E 测试', () => {
  
  test('T3.1: 用户提交报废申请完整流程', async ({ page }) => {
    /**
     * E2E 测试: 用户进入资产详情页 -> 点击报废 -> 填写表单 -> 提交
     * 验证: 页面元素渲染、表单提交成功提示、状态更新
     * 
     * 关联:
     * - frontend/src/api/retirementApi.ts -> submitRetirementApplication
     * - frontend/src/app/services/retirementService.ts
     */
    
    const TEST_ASSET_ID = 'AT-001';
    
    // 导航至资产详情页
    await page.goto(`/assets/${TEST_ASSET_ID}`);
    
    // 验证资产状态显示
    const statusLabel = page.locator('[data-testid="asset-status"]');
    await expect(statusLabel).toHaveText('使用中');
    
    // 点击报废按钮
    await page.click('[data-testid="btn-retirement"]');
    
    // 填写报废表单
    await page.fill('[data-testid="retirement-reason"]', '设备老旧需淘汰');
    await page.fill('[data-testid="expected-date"]', '2025-12-31');
    
    // 提交
    await page.click('[data-testid="btn-submit-retirement"]');
    
    // 验证成功提示
    const toast = page.locator('[data-testid="toast-success"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText('报废申请已提交');
    
    // 验证状态变更
    await page.waitForSelector('[data-testid="asset-status"]');
    await expect(statusLabel).toHaveText('审批中');
  });
  
});
```

#### T3.2 审批流程页面操作

```typescript
test('T3.2: 审批人执行审批操作', async ({ page }) => {
  /**
   * E2E 测试: 审批人进入审批列表 -> 查看详情 -> 执行审批操作
   * 验证: 审批操作成功、状态流转正确
   * 
   * 关联:
   * - frontend/src/api/approval.ts -> approveRetirement
   * - frontend/src/app/services/approvalService.ts
   */
  
  // 登录审批人账号
  await page.goto('/login');
  await page.fill('[name="username"]', 'approver_level1');
  await page.fill('[name="password"]', 'password');
  await page.click('[data-testid="btn-login"]');
  
  // 进入待审批列表
  await page.goto('/approvals/pending');
  
  // 验证待审批项显示
  const pendingItem = page.locator('[data-testid="pending-item"]').first();
  await expect(pendingItem).toBeVisible();
  
  // 点击查看详情
  await pendingItem.click();
  
  // 执行审批通过
  await page.fill('[data-testid="approval-comment"]', '同意报废处理');
  await page.click('[data-testid="btn-approve"]');
  
  // 验证成功提示
  await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  
  // 验证列表刷新，该申请不再显示
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-testid="pending-item"]')).toHaveCount(0);
});
```

#### T3.3 历史记录查询

```typescript
test('T3.3: 用户查询报废历史记录', async ({ page }) => {
  /**
   * E2E 测试: 用户进入历史记录页面 -> 查询报废历史 -> 验证记录详情
   * 验证: 历史记录列表加载、详情展开、时间线显示
   * 
   * 关联:
   * - frontend/src/app/hooks/useAuditLogs.ts
   * - src/api/middleware/audit_logger.py -> AuditLogger
   */
  
  const TEST_ASSET_ID = 'AT-001';
  
  await page.goto(`/assets/${TEST_ASSET_ID}/history`);
  
  // 验证历史记录列表加载
  const historyItems = page.locator('[data-testid="history-item"]');
  await expect(historyItems.first()).toBeVisible();
  
  // 筛选报废相关记录
  await page.click('[data-testid="filter-retirement"]');
  
  // 验证记录数量
  const retirementRecords = page.locator(
    '[data-testid="history-item"][data-type="retirement"]'
  );
  expect(await retirementRecords.count()).toBeGreaterThanOrEqual(1);
  
  // 点击展开详情
  await retirementRecords.first().click();
  
  // 验证时间线显示
  const timeline = page.locator('[data-testid="timeline"]');
  await expect(timeline).toBeVisible();
  expect(await timeline.locator('[data-testid="timeline-item"]').count()).toBeGreaterThanOrEqual(2);
});
```

---

## 5. 开发切入层级序列

### 5.1 开发序列总览

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 0: 数据模型层                                         │
│  ├── src/api/deps/auth.py                                    │
│  │   ├── AssetStatus 枚举定义 (L33)                          │
│  │   ├── UserRole 枚举定义 (L23)                             │
│  │   └── ApprovalContext 模型 (L84)                          │
│  ├── backend/models/asset_retirement.py                      │
│  │   └── RetirementApplication 模型                          │
│  └── src/models/approval_chain.py                            │
│      └── ApprovalChain / ApprovalNode 模型                   │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: 基础服务层                                          │
│  ├── 状态校验服务 (validate_retirement_eligibility)           │
│  ├── 编号生成服务 (generate_retirement_application_number)    │
│  └── 状态机服务 (RetirementStateMachine)                      │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: 业务逻辑层                                          │
│  ├── src/services/retirement_service.py                      │
│  │   ├── submit_retirement_application()                     │
│  │   ├── withdraw_application()                               │
│  │   └── get_application_detail()                            │
│  ├── src/services/approval_chain_service.py                  │
│  │   ├── get_next_approver()                                 │
│  │   └── execute_approval()                                  │
│  └── src/services/retirement_service.py                      │
│      └── reject_retirement()                                │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: 接口层 (API)                                        │
│  ├── src/api/routers/retirement_router.py                   │
│  ├── POST /api/v1/assets/retirement (创建报废申请)           │
│  ├── POST /api/v1/retirement/{id}/approve (审批通过)         │
│  ├── POST /api/v1/retirement/{id}/reject (审批驳回)          │
│  └── POST /api/v1/retirement/{id}/withdraw (撤回申请)        │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: 事件层 (Domain Events)                              │
│  ├── src/notifications/events.py                             │
│  └── src/application/services/notification_service.py        │
├─────────────────────────────────────────────────────────────┤
│  Layer 5: 前端层 (UI)                                         │
│  ├── frontend/src/api/retirementApi.ts                      │
│  ├── frontend/src/app/services/retirementService.ts          │
│  └── frontend/src/app/pages/Retirement/*.tsx                │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 依赖优先级矩阵

| 开发顺序 | 层级 | 模块 | 依赖方 | 说明 |
|----------|------|------|--------|------|
| 1 | Layer 0 | 数据模型层 | L1-L5 全部 | 优先定义数据结构和枚举 |
| 2 | Layer 1 | 状态校验服务 | L2 业务逻辑 | 为业务逻辑提供基础校验 |
| 3 | Layer 1 | 状态机服务 | L2 业务逻辑 | 核心状态转换引擎 |
| 4 | Layer 2 | 报废申请服务 | L3 API 层 | 申请单生命周期管理 |
| 5 | Layer 2 | 审批链路服务 | L3 API 层 | 审批流程执行 |
| 6 | Layer 3 | API 接口 | L4 事件层 | REST 接口暴露 |
| 7 | Layer 4 | 领域事件 | L5 前端 | 解耦通知机制 |
| 8 | Layer 5 | 前端 API 层 | 无 | 可独立开发 |

### 5.3 关键路径（Critical Path）

```
资产报废申请提交 → 前置状态校验 → 申请单创建 → 状态变更为 PENDING_APPROVAL
                                                        ↓
                                                审批链路执行
                                                        ↓
                                           ┌──────────┴──────────┐
                                           ↓                     ↓
                                      审批通过              审批驳回
                                           ↓                     ↓
                                     APPROVED              rollback
                                           ↓                (IDLE)
                                      FINALIZE
                                           ↓
                                       CLOSED
                                           ↓
                                     历史记录写入
```

### 5.4 里程碑定义

| Milestone | 交付内容 | 完成标准 |
|-----------|----------|----------|
| M1 | Layer 0 + Layer 1 | 单元测试覆盖率 ≥ 90% |
| M2 | Layer 2 核心逻辑 | 单元测试覆盖率 ≥ 90%，ATB-2 集成测试通过 |
| M3 | Layer 3 API 接口 | OpenAPI 文档生成，ATB-2 集成测试通过 |
| M4 | Layer 5 前端 API | ATB-3 E2E 测试全部通过 |

---

## 6. 附录：测试数据 Fixture 清单

| Fixture 名称 | 用途 | 预设数据 |
|--------------|------|----------|
| `setup_asset_active` | 使用中状态资产 | id=AT-001, status="ACTIVE" |
| `setup_asset_idle` | 闲置状态资产 | id=AT-002, status="IDLE" |
| `setup_asset_maintenance` | 维护中状态资产 | id=AT-003, status="MAINTENANCE" |
| `setup_retirement_application` | 已创建的报废申请单 | id=RA-001, status="PENDING_APPROVAL" |
| `setup_approval_chain` | 单级审批链 | levels=1 |
| `setup_3level_chain` | 3级审批链 | levels=3 |
| `test_client` | API 测试客户端 | pytest-asyncio fixture |

---

## 7. API 契约定义

### 7.1 创建报废申请

```
POST /api/v1/assets/retirement
```

**Request Body:**
```json
{
  "asset_id": "string (required)",
  "reason": "string (required, max 500 chars)",
  "expected_date": "date (optional, format: YYYY-MM-DD)",
  "attachments": ["string (optional, file URLs)"]
}
```

**Response (201 Created):**
```json
{
  "application_id": "SC-20250101-0001",
  "asset_id": "AT-001",
  "status": "PENDING_APPROVAL",
  "created_at": "2025-01-01T10:00:00Z",
  "current_approver": "user_001"
}
```

### 7.2 执行审批

```
POST /api/v1/retirement/{application_id}/approve
```

**Request Body:**
```json
{
  "approver_id": "string (required)",
  "comment": "string (optional, max 200 chars)"
}
```

**Response (200 OK):**
```json
{
  "application_id": "SC-20250101-0001",
  "current_level": 1,
  "total_levels": 3,
  "next_approver": "user_002",
  "status": "PENDING_APPROVAL"
}
```

### 7.3 驳回审批

```
POST /api/v1/retirement/{application_id}/reject
```

**Request Body:**
```json
{
  "approver_id": "string (required)",
  "comment": "string (required, max 200 chars)",
  "rejection_reason": "string (optional)"
}
```

**Response (200 OK):**
```json
{
  "application_id": "SC-20250101-0001",
  "status": "REJECTED",
  "asset_status": "ACTIVE",
  "message": "报废申请已被驳回，资产状态已回滚"
}
```

### 7.4 撤回申请

```
POST /api/v1/retirement/{application_id}/withdraw
```

**Request Body:**
```json
{
  "requester_id": "string (required)"
}
```

**Response (200 OK):**
```json
{
  "application_id": "SC-20250101-0001",
  "status": "WITHDRAWN",
  "asset_status": "ACTIVE",
  "message": "报废申请已撤回"
}
```

---

*Document Version: 1.0*
*Specification ID: SWARM-S5-002-SPEC-001*
*Author: Specification Engineer*
*Status: Ready for Development*
*Generated: 2025-01-01*