# SWARM-002 资产报废/退役流程规格指导文档

```yaml
spec_id: SWARM-002
spec_title: 资产报废/退役流程 - 状态流转与审批链机制
spec_version: 1.0.0
iteration: 1
domain: Asset Management System (AMS)
```

---

## 1. 需求与背景

### 1.1 业务场景

资产管理生命周期中，资产需经历「运行中」→「待报废」→「已报废」的状态流转。当前系统缺失标准化的资产退役流程，导致：

| 问题 | 影响 |
|------|------|
| **状态管理混乱** | 闲置/损坏资产仍标记为「运行中」，造成资产台账失真 |
| **审批流程缺失** | 报废操作无规范审批链路，存在合规风险 |
| **历史追溯困难** | 报废记录未持久化，无法满足审计需求 |

### 1.2 核心诉求

- ✅ 为闲置或损坏资产提供标准化的退役申请入口
- ✅ 建立「申请人提交 → 审批链审核 → 状态变更」的闭环流程
- ✅ 持久化报废历史记录，支持状态追溯与审计

---

## 2. 当前 Phase 对应实施目标

### 2.1 Plan.md Phase 映射

| Plan Phase | 实施范围 | 本次 Spec 覆盖 |
|------------|----------|----------------|
| Phase 3: 核心状态机 | 资产状态定义与流转规则 | ✅ 全部 |
| Phase 4: 表单与审批 | 报废申请表单、审批链配置 | ✅ 全部 |
| Phase 5: 数据持久化 | 报废历史记录存储与查询 | ✅ 全部 |
| Phase 6: 前端交互 | 申请/审批 UI 与状态追踪 | ✅ 全部 |

### 2.2 本次迭代交付范围

```
├── 资产状态机 (运行中 ↔ 待报废 ↔ 已报废)
├── 报废申请表单 (申请人、报废原因、资产明细)
├── 审批链机制 (一级审批、二级审批、驳回/通过)
├── 报废历史记录持久化 (SQLite + 审计表)
└── 前端交互界面 (申请发起、审批操作、状态追踪)
```

---

## 3. 边界约束

### 3.1 状态机约束

```python
class AssetStatus(Enum):
    """资产状态枚举"""
    RUNNING = "RUNNING"                    # 运行中
    PENDING_RETIREMENT = "PENDING_RETIREMENT"  # 待报废
    RETIRED = "RETIRED"                    # 已报废
```

| 约束项 | 规则 |
|--------|------|
| 状态定义 | `RUNNING` / `PENDING_RETIREMENT` / `RETIRED` |
| 合法流转 | `RUNNING → PENDING_RETIREMENT` (需申请) |
|           | `PENDING_RETIREMENT → RUNNING` (审批驳回) |
|           | `PENDING_RETIREMENT → RETIRED` (审批通过) |
| 不可逆性 | `RETIRED` 状态不可回退 |
| 前置条件 | 仅 `RUNNING` 状态资产可发起报废申请 |

### 3.2 审批链约束

| 角色 | 权限 |
|------|------|
| 申请人 | 仅能提交本人关联资产的报废申请 |
| 一级审批 | 可执行「通过」或「驳回」操作 |
| 二级审批 | 一级通过后执行「最终通过」或「驳回」操作 |
| 驳回后状态 | 资产恢复 `RUNNING`，申请人可重新发起 |

### 3.3 表单约束

| 字段 | 类型 | 约束 |
|------|------|------|
| asset_id | UUID | 必填，引用有效资产 |
| retirement_reason | Text | 必填，≥10 字符，≤500 字符 |
| supporting_docs | File[] | 可选，最多 3 个附件，单个 ≤10MB |
| estimated_value | Decimal | 可选，报废资产估值 |

### 3.4 数据持久化约束

| 表名 | 用途 |
|------|------|
| `asset_retirement_request` | 报废申请主记录 |
| `asset_retirement_approval` | 审批链路记录 |
| `asset_status_history` | 资产状态变更历史 |
| `asset_retirement_history` | 报废历史快照 |

---

## 4. 验收测试基准 (ATB)

### ATB-001: 状态机流转测试

```python
# File: tests/services/test_retirement_service.py

import pytest
from datetime import datetime
from src.models.asset_retirement import AssetRetirementRequest, AssetStatus
from src.services.retirement_service import RetirementService


class TestAssetStatusTransitions:
    """ATB-001: 资产状态机流转验证"""
    
    def test_new_asset_default_status(self, db_session):
        """
        ATB-001 物理测试期待: 新建资产默认状态为 RUNNING
        """
        asset = AssetFactory.create(status=AssetStatus.RUNNING)
        db_session.add(asset)
        db_session.commit()
        
        assert asset.status == AssetStatus.RUNNING
    
    def test_submit_retirement_request_changes_status(self, db_session):
        """
        ATB-001 物理测试期待: 提交报废申请后状态变为 PENDING_RETIREMENT
        """
        asset = AssetFactory.create(status=AssetStatus.RUNNING)
        db_session.add(asset)
        db_session.commit()
        
        request = RetirementService.submit_retirement_request(
            asset_id=asset.id,
            reason="设备老化，无法修复，需报废处理",
            applicant_id="user-001"
        )
        
        # 刷新资产状态
        db_session.refresh(asset)
        
        assert request.status == RequestStatus.PENDING
        assert asset.status == AssetStatus.PENDING_RETIREMENT
    
    def test_approval_completes_status_transition(self, db_session):
        """
        ATB-001 物理测试期待: 审批通过后状态变为 RETIRED
        """
        asset = AssetFactory.create(status=AssetStatus.PENDING_RETIREMENT)
        request = RetirementRequestFactory.create(asset_id=asset.id)
        db_session.add_all([asset, request])
        db_session.commit()
        
        # 一级审批通过
        ApprovalService.approve(request.id, level=1, approver_id="approver-001")
        
        # 二级审批通过
        ApprovalService.approve(request.id, level=2, approver_id="approver-002")
        
        # 刷新状态
        db_session.refresh(asset)
        
        assert asset.status == AssetStatus.RETIRED
    
    def test_rejection_restores_running_status(self, db_session):
        """
        ATB-001 物理测试期待: 审批驳回后资产状态恢复 RUNNING
        """
        asset = AssetFactory.create(status=AssetStatus.PENDING_RETIREMENT)
        request = RetirementRequestFactory.create(asset_id=asset.id)
        db_session.add_all([asset, request])
        db_session.commit()
        
        # 驳回申请
        ApprovalService.reject(
            request.id,
            level=1,
            approver_id="approver-001",
            reason="需要补充设备检测报告"
        )
        
        db_session.refresh(asset)
        
        assert asset.status == AssetStatus.RUNNING
        assert request.status == RequestStatus.REJECTED


class TestRetiredStateImmutability:
    """ATB-001.1: 已退役状态不可变性验证"""
    
    def test_retired_asset_cannot_submit_retirement(self, db_session):
        """
        ATB-001.1 物理测试期待: 已报废资产不可再次发起报废申请
        """
        asset = AssetFactory.create(status=AssetStatus.RETIRED)
        db_session.add(asset)
        db_session.commit()
        
        with pytest.raises(InvalidStateTransitionError) as exc_info:
            RetirementService.submit_retirement_request(
                asset_id=asset.id,
                reason="设备损坏",
                applicant_id="user-001"
            )
        
        assert "RETIRED" in str(exc_info.value)
    
    def test_retired_asset_status_cannot_be_forcibly_modified(self, db_session):
        """
        ATB-001.1 物理测试期待: 已报废资产状态不可被强制修改
        """
        asset = AssetFactory.create(status=AssetStatus.RETIRED)
        db_session.add(asset)
        db_session.commit()
        
        original_status = asset.status
        
        with pytest.raises(InvalidStateTransitionError):
            asset.status = AssetStatus.RUNNING
        
        assert asset.status == original_status
```

### ATB-002: 报废申请表单验证测试

```python
# File: tests/services/test_retirement_service.py

class TestRetirementRequestFormValidation:
    """ATB-002: 报废申请表单验证"""
    
    def test_missing_asset_id_returns_400(self, api_client):
        """
        ATB-002 物理测试期待: asset_id 为空 → 返回 400 错误
        """
        response = api_client.post(
            "/api/v1/retirement/request",
            json={"reason": "设备损坏"}
        )
        
        assert response.status_code == 400
        assert "asset_id" in response.json()["error"]["field"]
    
    def test_reason_too_short_returns_400(self, api_client):
        """
        ATB-002 物理测试期待: retirement_reason 长度 < 10 → 返回 400 错误
        """
        response = api_client.post(
            "/api/v1/retirement/request",
            json={
                "asset_id": "valid-uuid-123",
                "reason": "损坏"
            }
        )
        
        assert response.status_code == 400
        assert "reason" in response.json()["error"]["field"]
        assert "minimum 10 characters" in response.json()["error"]["message"]
    
    def test_reason_too_long_returns_400(self, api_client):
        """
        ATB-002 物理测试期待: retirement_reason 长度 > 500 → 返回 400 错误
        """
        response = api_client.post(
            "/api/v1/retirement/request",
            json={
                "asset_id": "valid-uuid-123",
                "reason": "A" * 501
            }
        )
        
        assert response.status_code == 400
        assert "reason" in response.json()["error"]["field"]
    
    def test_too_many_attachments_returns_400(self, api_client):
        """
        ATB-002 物理测试期待: 附件数量 > 3 → 返回 400 错误
        """
        response = api_client.post(
            "/api/v1/retirement/request",
            json={
                "asset_id": "valid-uuid-123",
                "reason": "设备老化，需报废处理",
                "attachments": [
                    {"filename": "doc1.pdf"},
                    {"filename": "doc2.pdf"},
                    {"filename": "doc3.pdf"},
                    {"filename": "doc4.pdf"}
                ]
            }
        )
        
        assert response.status_code == 400
        assert "attachments" in response.json()["error"]["field"]
    
    def test_single_attachment_too_large_returns_400(self, api_client):
        """
        ATB-002 物理测试期待: 单个附件 > 10MB → 返回 400 错误
        """
        large_file = b"A" * (11 * 1024 * 1024)  # 11MB
        
        response = api_client.post(
            "/api/v1/retirement/request",
            data={
                "asset_id": "valid-uuid-123",
                "reason": "设备老化，需报废处理"
            },
            files={"attachments": ("large_file.pdf", large_file)}
        )
        
        assert response.status_code == 400
        assert "file size" in response.json()["error"]["message"].lower()
    
    def test_nonexistent_asset_id_returns_404(self, api_client):
        """
        ATB-002 物理测试期待: 引用不存在的 asset_id → 返回 404 错误
        """
        response = api_client.post(
            "/api/v1/retirement/request",
            json={
                "asset_id": "nonexistent-uuid-999",
                "reason": "设备损坏需报废"
            }
        )
        
        assert response.status_code == 404
        assert "asset" in response.json()["error"]["message"].lower()
```

### ATB-003: 审批链机制测试

```python
# File: tests/services/test_retirement_service.py

class TestApprovalChainFlow:
    """ATB-003: 审批链机制验证"""
    
    def test_level2_unavailable_before_level1(self, api_client):
        """
        ATB-003 物理测试期待: 一级审批未通过时，二级审批入口不可用
        """
        request = create_pending_request()
        
        response = api_client.post(
            f"/api/v1/retirement/approve/{request.id}",
            json={"action": "approve", "level": 2}
        )
        
        assert response.status_code == 403
        assert "level 1 not completed" in response.json()["error"]["message"].lower()
    
    def test_rejection_requires_comment(self, api_client):
        """
        ATB-003 物理测试期待: 驳回操作需记录驳回原因
        """
        request = create_pending_request()
        
        response = api_client.post(
            f"/api/v1/retirement/approve/{request.id}",
            json={"action": "reject", "level": 1}
        )
        
        assert response.status_code == 400
        assert "comment" in response.json()["error"]["field"]
    
    def test_rejection_restores_asset_status(self, api_client, db_session):
        """
        ATB-003 物理测试期待: 驳回后资产状态恢复 RUNNING
        """
        asset = AssetFactory.create(status=AssetStatus.PENDING_RETIREMENT)
        request = RetirementRequestFactory.create(asset_id=asset.id)
        db_session.add_all([asset, request])
        db_session.commit()
        
        response = api_client.post(
            f"/api/v1/retirement/approve/{request.id}",
            json={
                "action": "reject",
                "level": 1,
                "comment": "需要补充资料"
            }
        )
        
        assert response.status_code == 200
        
        db_session.refresh(asset)
        assert asset.status == AssetStatus.RUNNING
    
    def test_rejected_request_can_be_resubmitted(self, api_client, db_session):
        """
        ATB-003 物理测试期待: 驳回后申请人可重新发起申请
        """
        asset = AssetFactory.create(status=AssetStatus.RUNNING)
        old_request = RetirementRequestFactory.create(
            asset_id=asset.id,
            status=RequestStatus.REJECTED
        )
        db_session.add_all([asset, old_request])
        db_session.commit()
        
        new_request = RetirementService.submit_retirement_request(
            asset_id=asset.id,
            reason="设备老化，无法修复，需报废处理",
            applicant_id="user-001"
        )
        
        assert new_request.id != old_request.id
        assert new_request.status == RequestStatus.PENDING


class TestApprovalSequenceEnforcement:
    """ATB-003.1: 审批顺序强制验证"""
    
    def test_skipping_level1_returns_403(self, api_client):
        """
        ATB-003.1 物理测试期待: 跳过一级直接二级审批 → 返回 403 错误
        """
        request = create_pending_request()
        
        response = api_client.post(
            f"/api/v1/retirement/approve/{request.id}",
            json={"action": "approve", "level": 2}
        )
        
        assert response.status_code == 403
        assert "forbidden" in response.json()["error"]["message"].lower()
    
    def test_approved_level_cannot_be_repeated(self, api_client):
        """
        ATB-003.1 物理测试期待: 已通过的审批级别不可重复操作 → 返回 409 错误
        """
        request = create_pending_request()
        
        # 第一次审批通过
        api_client.post(
            f"/api/v1/retirement/approve/{request.id}",
            json={"action": "approve", "level": 1}
        )
        
        # 第二次尝试同一级别
        response = api_client.post(
            f"/api/v1/retirement/approve/{request.id}",
            json={"action": "approve", "level": 1}
        )
        
        assert response.status_code == 409
        assert "already approved" in response.json()["error"]["message"].lower()
```

### ATB-004: 历史记录持久化测试

```python
# File: tests/services/test_retirement_service.py

class TestRetirementHistoryPersistence:
    """ATB-004: 报废历史记录持久化验证"""
    
    def test_retirement_history_record_created(self, db_session):
        """
        ATB-004 物理测试期待: 报废完成后，retirement_history 表存在对应记录
        """
        asset = create_and_complete_retirement()
        
        history = db_session.query(RetirementHistory).filter_by(
            asset_id=asset.id
        ).first()
        
        assert history is not None
        assert history.retired_at is not None
        assert history.retirement_reason is not None
        assert history.retired_by is not None
    
    def test_status_history_complete_timeline(self, db_session):
        """
        ATB-004 物理测试期待: status_history 表记录完整的状态变更时间戳
        """
        asset = create_and_complete_retirement()
        
        statuses = db_session.query(StatusHistory).filter_by(
            asset_id=asset.id
        ).order_by(StatusHistory.created_at).all()
        
        assert len(statuses) == 3
        
        assert statuses[0].from_status == AssetStatus.RUNNING
        assert statuses[0].to_status == AssetStatus.PENDING_RETIREMENT
        assert statuses[0].trigger_event == "RETIREMENT_REQUEST_SUBMITTED"
        
        assert statuses[1].from_status == AssetStatus.PENDING_RETIREMENT
        assert statuses[1].to_status == AssetStatus.RETIRED
        assert statuses[1].trigger_event == "RETIREMENT_APPROVED"
        
        # 验证时间戳顺序
        assert statuses[0].created_at < statuses[1].created_at
    
    def test_approval_chain_history_recorded(self, db_session):
        """
        ATB-004 物理测试期待: approval_history 表记录每个审批节点的操详情
        """
        asset = create_and_complete_retirement()
        request = db_session.query(RetirementRequest).filter_by(
            asset_id=asset.id
        ).first()
        
        approvals = db_session.query(ApprovalHistory).filter_by(
            request_id=request.id
        ).order_by(ApprovalHistory.level).all()
        
        assert len(approvals) == 2
        
        # Level 1
        assert approvals[0].level == 1
        assert approvals[0].action == ApprovalAction.APPROVE
        assert approvals[0].approver_id == "approver-001"
        assert approvals[0].comment is not None
        
        # Level 2
        assert approvals[1].level == 2
        assert approvals[1].action == ApprovalAction.APPROVE
        assert approvals[1].approver_id == "approver-002"
    
    def test_rejection_history_recorded(self, db_session):
        """
        ATB-004 物理测试期待: 驳回操作也被正确记录
        """
        asset = AssetFactory.create(status=AssetStatus.PENDING_RETIREMENT)
        request = RetirementRequestFactory.create(asset_id=asset.id)
        db_session.add_all([asset, request])
        db_session.commit()
        
        ApprovalService.reject(
            request.id,
            level=1,
            approver_id="approver-001",
            reason="需要补充设备检测报告"
        )
        
        history = db_session.query(StatusHistory).filter_by(
            asset_id=asset.id,
            trigger_event="RETIREMENT_REJECTED"
        ).first()
        
        assert history is not None
        assert history.to_status == AssetStatus.RUNNING
```

### ATB-005: 前端交互集成测试

```typescript
// File: tests/e2e/retirement_user_journey.spec.ts

import { test, expect } from '@playwright/test';

const TEST_CONFIG = {
  baseUrl: process.env.E2E_BASE_URL || 'http://localhost:3000',
  testAssets: {
    idleAsset: 'asset-idle-001',
    damagedAsset: 'asset-damaged-002'
  }
};

test.describe('SWARM-002: Asset Retirement Workflow', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_CONFIG.baseUrl);
  });

  test('AC-001: Complete retirement application workflow', async ({ page }) => {
    /*
     * ATB-005 物理测试期待
     * 场景: 用户完成完整的报废申请与审批流程
     * 
     * 1. 登录系统，进入资产列表页
     * 2. 选择目标资产，点击「申请报废」按钮
     * 3. 填写报废原因，提交申请
     * 4. 页面显示申请已提交，状态为「待审批」
     * 5. 审批人登录，进入审批页面
     * 6. 审批人通过一级、二级审批
     * 7. 申请人查看资产状态已变更为「已报废」
     */
    
    // Step 1: Login as asset manager
    await page.goto(`${TEST_CONFIG.baseUrl}/login`);
    await page.fill('[data-testid="username-input"]', 'asset_manager');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(`${TEST_CONFIG.baseUrl}/dashboard`);
    
    // Step 2: Navigate to assets and select target
    await page.goto(`${TEST_CONFIG.baseUrl}/assets`);
    await page.click(`[data-testid="asset-row"][data-asset-id="${TEST_CONFIG.testAssets.idleAsset}"]`);
    
    // Step 3: Submit retirement request
    await page.click('[data-testid="btn-retire"]');
    await page.fill(
      '[data-testid="retirement-reason"]', 
      '设备老化严重，无法继续使用，需申请报废处理'
    );
    await page.click('[data-testid="btn-submit-retirement"]');
    
    // Step 4: Verify pending status
    await expect(page.locator('[data-testid="asset-status"]')).toHaveText('待报废');
    await expect(page.locator('[data-testid="retirement-request-id"]')).toBeVisible();
    
    // Step 5: Login as approver and navigate to approvals
    await page.goto(`${TEST_CONFIG.baseUrl}/logout`);
    await page.goto(`${TEST_CONFIG.baseUrl}/login`);
    await page.fill('[data-testid="username-input"]', 'approver');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    await page.goto(`${TEST_CONFIG.baseUrl}/approvals`);
    await page.click(`[data-testid="approval-item"][data-request-id]`);
    
    // Step 6: Complete approval chain
    await page.click('[data-testid="btn-approve-level1"]');
    await expect(page.locator('[data-testid="level1-status"]')).toHaveText('已通过');
    
    await page.click('[data-testid="btn-approve-level2"]');
    await expect(page.locator('[data-testid="level2-status"]')).toHaveText('已通过');
    
    // Step 7: Verify final status as original applicant
    await page.goto(`${TEST_CONFIG.baseUrl}/logout`);
    await page.goto(`${TEST_CONFIG.baseUrl}/login`);
    await page.fill('[data-testid="username-input"]', 'asset_manager');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    await page.goto(`${TEST_CONFIG.baseUrl}/assets/${TEST_CONFIG.testAssets.idleAsset}`);
    
    // Assert final state
    await expect(page.locator('[data-testid="asset-status"]')).toHaveText('已报废');
    await expect(page.locator('[data-testid="retirement-history-section"]')).toBeVisible();
  });

  test('AC-002: Rejection workflow returns asset to running', async ({ page }) => {
    /*
     * ATB-005 物理测试期待
     * 场景: 审批人驳回报废申请
     * 
     * 1. 提交报废申请
     * 2. 审批人进入审批页面
     * 3. 点击驳回并填写原因
     * 4. 验证资产状态恢复为「运行中」
     * 5. 申请人可重新发起申请
     */
    
    // Submit retirement request (same as above)
    await submitRetirementRequest(page, TEST_CONFIG.testAssets.damagedAsset);
    
    // Login as approver
    await loginAsUser(page, 'approver', 'password123');
    await page.goto(`${TEST_CONFIG.baseUrl}/approvals`);
    
    // Click reject
    await page.click('[data-testid="approval-item"]:first-child');
    await page.click('[data-testid="btn-reject"]');
    await page.fill('[data-testid="rejection-reason"]', '需要先进行设备检测');
    await page.click('[data-testid="btn-confirm-reject"]');
    
    // Verify status restored
    await expect(page.locator('[data-testid="asset-status"]')).toHaveText('运行中');
    await expect(page.locator('[data-testid="rejection-notification"]')).toBeVisible();
  });
});
```

---

## 5. 开发切入层级序列

### Phase 1: 数据模型层 (Day 1)

```
backend/
├── models/
│   ├── asset.py              # 扩展 Asset 模型，添加 status 字段
│   │   ├── AssetStatus (Enum: RUNNING/PENDING_RETIREMENT/RETIRED)
│   │   └── status_history (relationship)
│   │
│   ├── retirement_request.py # 报废申请模型
│   │   ├── RetirementRequest
│   │   │   ├── id: UUID (PK)
│   │   │   ├── asset_id: FK → Asset
│   │   │   ├── applicant_id: FK → User
│   │   │   ├── reason: Text
│   │   │   ├── status: Enum (PENDING/APPROVED/REJECTED)
│   │   │   ├── estimated_value: Decimal (nullable)
│   │   │   ├── attachments: JSON
│   │   │   └── created_at: DateTime
│   │
│   ├── retirement_approval.py # 审批记录模型
│   │   └── RetirementApproval
│   │       ├── id: UUID (PK)
│   │       ├── request_id: FK → RetirementRequest
│   │       ├── level: Integer (1/2)
│   │       ├── action: Enum (APPROVE/REJECT)
│   │       ├── approver_id: FK → User
│   │       ├── comment: Text (nullable)
│   │       └── created_at: DateTime
│   │
│   └── asset_history.py      # 状态变更历史模型
│       └── AssetStatusHistory
│           ├── id: UUID (PK)
│           ├── asset_id: FK → Asset
│           ├── from_status: String
│           ├── to_status: String
│           ├── trigger_event: String
│           ├── operator_id: FK → User
│           └── created_at: DateTime
│
└── migrations/
    └── 001_add_retirement_tables.py
```

### Phase 2: 服务层核心逻辑 (Day 2-3)

```
backend/
├── services/
│   │
│   ├── asset_status_service.py   # 状态机核心逻辑
│   │   ├── validate_transition(from_status, to_status)
│   │   │   └── Validates state transition rules
│   │   │
│   │   ├── transition_status(asset_id, to_status, event)
│   │   │   └── Performs validated status change
│   │   │
│   │   └── get_status_history(asset_id)
│   │       └── Returns chronological status changes
│   │
│   ├── retirement_service.py     # 报废申请处理
│   │   ├── submit_retirement_request(asset_id, reason, applicant_id)
│   │   │   ├── Validates asset is in RUNNING status
│   │   │   ├── Creates RetirementRequest record
│   │   │   ├── Triggers status → PENDING_RETIREMENT
│   │   │   └── Returns request details
│   │   │
│   │   ├── get_retirement_request(request_id)
│   │   │   └── Returns request with approval chain status
│   │   │
│   │   └── cancel_retirement_request(request_id, user_id)
│   │       └── Allows applicant to withdraw pending request
│   │
│   └── approval_service.py       # 审批链处理
│       ├── approve(request_id, level, approver_id, comment)
│       │   ├── Validates level sequence (level 1 before level 2)
│       │   ├── Creates ApprovalRecord
│       │   ├── If level 2 complete: triggers status → RETIRED
│       │   └── Notifies applicant
│       │
│       ├── reject(request_id, level, approver_id, reason)
│       │   ├── Validates approver has permission
│       │   ├── Creates ApprovalRecord with REJECT action
│       │   ├── Triggers status → RUNNING (revert)
│       │   └── Notifies applicant with rejection reason
│       │
│       └── get_approval_status(request_id)
│           └── Returns chain status for all levels
│
└── schemas/
    ├── retirement_request.py      # 请求/响应 DTO
    │   ├── RetirementRequestCreate (pydantic model)
    │   ├── RetirementRequestResponse (pydantic model)
    │   └── RetirementRequestList (pydantic model)
    │
    └── approval_action.py         # 审批操作 DTO
        ├── ApprovalActionCreate (pydantic model)
        └── ApprovalActionResponse (pydantic model)
```

### Phase 3: API 路由层 (Day 3-4)

```
backend/
├── routes/
│   ├── retirement.py      # 报废申请相关路由
│   │   ├── POST /api/v1/retirement/request
│   │   │   └── Body: RetirementRequestCreate
│   │   │   └── Returns: RetirementRequestResponse
│   │   │
│   │   ├── GET /api/v1/retirement/request/{id}
│   │   │   └── Returns: RetirementRequestDetailResponse
│   │   │
│   │   ├── DELETE /api/v1/retirement/request/{id}
│   │   │   └── Withdraw pending request
│   │   │
│   │   └── GET /api/v1/retirement/history/{asset_id}
│   │       └── Returns: List of retirement history records
│   │
│   ├── approval.py        # 审批操作路由
│   │   ├── POST /api/v1/retirement/approve/{request_id}
│   │   │   └── Body: ApprovalActionCreate
│   │   │   └── Returns: Updated approval chain status
│   │   │
│   │   └── GET /api/v1/retirement/approvals/pending
│   │       └── Returns: List of pending approvals for current user
│   │
│   └── asset_status.py    # 资产状态路由
│       ├── GET /api/v1/assets/{id}/status
│       │   └── Returns: Current status + history
│       │
│       └── GET /api/v1/assets/{id}/status-history
│           └── Returns: Paginated status change history
│
└── validators/
    └── retirement_validator.py
        ├── validate_asset_exists(asset_id)
        ├── validate_asset_runnable(asset_id)
        ├── validate_reason_format(reason)
        └── validate_attachments(attachments)
```

### Phase 4: 前端界面层 (Day 4-6)

```
frontend/
├── pages/
│   ├── assets/
│   │   └── [id]/
│   │       ├── RetirementForm.tsx   # 报废申请表单
│   │       │   ├── assetInfo: AssetInfoCard
│   │       │   ├── reason: TextArea (min 10 chars)
│   │       │   ├── estimatedValue: NumberInput
│   │       │   ├── attachments: FileUpload (max 3)
│   │       │   └── submitButton: SubmitButton
│   │       │
│   │       └── RetirementStatus.tsx # 申请状态追踪
│   │           ├── statusBadge: StatusBadge
│   │           ├── approvalTimeline: ApprovalTimeline
│   │           └── historyLink: Link to history
│   │
│   └── approvals/
│       ├── RetirementApproval.tsx   # 审批操作页
│       │   ├── requestDetails: RequestDetailsCard
│       │   ├── assetInfo: AssetInfoCard
│       │   ├── approvalChain: ApprovalChainStatus
│       │   ├── actionButtons: [Approve, Reject]
│       │   └── rejectionModal: RejectionModal
│       │
│       └── PendingApprovals.tsx     # 待审批列表
│           └── approvalCards: List<ApprovalCard>
│
├── components/
│   ├── StatusBadge.tsx              # 状态标签组件
│   │   ├── RUNNING: "运行中" (绿色)
│   │   ├── PENDING_RETIREMENT: "待报废" (黄色)
│   │   └── RETIRED: "已报废" (灰色)
│   │
│   ├── ApprovalChain.tsx            # 审批链可视化
│   │   ├── levels: ApprovalLevel[]
│   │   ├── currentLevel: number
│   │   └── onAction: (level, action) => void
│   │
│   ├── HistoryTimeline.tsx          # 变更历史时间线
│   │   ├── events: HistoryEvent[]
│   │   └── onEventClick: (event) => void
│   │
│   └── RetirementRequestCard.tsx    # 申请卡片组件
│       ├── asset: AssetSummary
│       ├── status: RequestStatus
│       ├── submittedAt: DateTime
│       └── onViewDetails: () => void
│
└── hooks/
    ├── useRetirementWorkflow.ts     # 报废流程状态管理
    │   ├── submitRequest: (data) => Promise<Request>
    │   ├── withdrawRequest: (id) => Promise<void>
    │   └── getRequestStatus: (id) => RequestStatus
    │
    └── useApprovalActions.ts        # 审批操作钩子
        ├── approve: (requestId, level) => Promise<void>
        └── reject: (requestId, level, reason) => Promise<void>
```

### Phase 5: 集成测试与修复 (Day 7)

```
tests/
├── unit/
│   ├── test_asset_status_machine.py      # 状态机单元测试
│   ├── test_retirement_service.py        # 服务层单元测试
│   └── test_approval_chain.py           # 审批链单元测试
│
├── integration/
│   ├── test_retirement_end_to_end.py    # 端到端集成测试
│   └── test_status_persistence.py       # 持久化集成测试
│
└── e2e/
    ├── test_retirement_user_journey.spec.ts  # Playwright E2E
    └── test_retirement_flow.spec.ts           # 前端 E2E
```

---

## 附录 A: 数据模型 ERD

```
┌─────────────────┐       ┌──────────────────────────────┐
│     Asset       │       │  retirement_request          │
├─────────────────┤       ├──────────────────────────────┤
│ id (PK)         │──┐    │ id (PK)                      │
│ name            │  │    │ asset_id (FK) ───────────────┘
│ status          │  │    │ applicant_id (FK)            │
│ created_at      │  │    │ reason                       │
│ updated_at      │  └───→│ estimated_value              │
└─────────────────┘         │ status                      │
                            │ attachments (JSON)          │
                            │ created_at                 │
                            │ updated_at                 │
                            └──────────────────────────────┘
                                       │
                                       ▼
                            ┌──────────────────────────────┐
                            │  retirement_approval          │
                            ├──────────────────────────────┤
                            │ id (PK)                      │
                            │ request_id (FK)              │
                            │ approval_level (1/2)         │
                            │ action (APPROVE/REJECT)      │
                            │ comment                      │
                            │ approver_id (FK)            │
                            │ created_at                   │
                            └──────────────────────────────┘

┌──────────────────────────────┐
│    asset_status_history     │
├──────────────────────────────┤
│ id (PK)                      │
│ asset_id (FK)                │
│ from_status                  │
│ to_status                    │
│ trigger_event                │
│ operator_id                  │
│ created_at                   │
└──────────────────────────────┘
```

---

## 附录 B: 事件流序列图

```
┌────────┐     ┌──────────────┐     ┌────────────┐     ┌───────────┐
│Applicant│     │ RetirementService│   │ApprovalService│ │AssetStatus│
└──┬─────┘     └───────┬──────┘     └─────┬──────┘     └─────┬─────┘
   │                  │                   │                  │
   │ submit_request() │                   │                  │
   │────────────────>│                   │                  │
   │                  │ validate_asset()   │                  │
   │                  │──────────────────>│                  │
   │                  │                   │                  │
   │                  │ transition(RUNNING→PENDING)          │
   │                  │─────────────────────────────────────>│
   │                  │                   │                  │
   │  return request  │                   │                  │
   │<────────────────│                   │                  │
   │                  │                   │                  │
   │                  │        Level 1: approve()            │
   │                  │<─────────────────────────────────────│
   │                  │                   │                  │
   │                  │        Level 2: approve()            │
   │                  │<─────────────────────────────────────│
   │                  │                   │                  │
   │                  │ transition(PENDING→RETIRED)          │
   │                  │─────────────────────────────────────>│
   │                  │                   │                  │
   │  notify_completed│                   │                  │
   │<────────────────│                   │                  │
```

---

## 附录 C: 错误码定义

| 错误码 | 描述 | HTTP 状态 |
|--------|------|-----------|
| `RET_001` | 资产不存在 | 404 |
| `RET_002` | 资产状态不允许发起报废 | 400 |
| `RET_003` | 报废原因格式错误 | 400 |
| `RET_004` | 附件数量超限 | 400 |
| `RET_005` | 附件大小超限 | 400 |
| `RET_006` | 审批顺序错误 | 403 |
| `RET_007` | 重复审批 | 409 |
| `RET_008` | 报废申请不存在 | 404 |
| `RET_009` | 无审批权限 | 403 |

---

**文档版本**: 1.0.0  
**创建日期**: 2024-XX-XX  
**审核状态**: 待审核