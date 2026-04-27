# SWARM-002 资产报废退役流程 - 规格指导文档

## 版本信息

| 字段 | 内容 |
|------|------|
| Task ID | SWARM-002 |
| Iteration | 1 |
| 文档类型 | 规格指导规格 (Specifications) |
| 状态 | Draft |

---

## 1. 需求与背景

### 1.1 业务场景
资产全生命周期管理中，资产到达生命周期末期或因损坏/淘汰需退出运营时，需执行报废退役操作。该操作需严格遵循申请→审批→执行三阶段流程，确保资产退役的可追溯性与合规性。

### 1.2 核心诉求
- 实现资产状态从 `ACTIVE`/`IN_USE` 等状态流转至 `RETIRED` 状态
- 固化退役申请→审批→执行的端到端链路
- 自动持久化退役时间戳、退役原因、操作人等关键字段至生命周期历史表
- 支持后续审计与统计需求

### 1.3 业务规则

| 规则ID | 规则描述 |
|--------|----------|
| BR-001 | 仅状态为 `ACTIVE`、`IN_USE`、`IDLE` 的资产可发起退役申请 |
| BR-002 | 退役申请须包含退役原因（预设枚举 + 自由文本） |
| BR-003 | 退役审批须由指定角色（如 `ASSET_ADMIN`）执行 |
| BR-004 | 审批通过后自动执行退役状态变更并记录时间戳 |
| BR-005 | 退役后资产不可再被分配或借用 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 定位

| Phase | 阶段名称 | 实施范围 |
|-------|----------|----------|
| **Phase 1** | **核心退役链路实现** | 退役申请提交 → 审批通过 → 执行退役 → 生命周期记录持久化 |
| Phase 2 | 高级审批流扩展 | 多级审批、条件审批 |
| Phase 3 | 报表与统计增强 | 退役统计、趋势分析 |

> **本次 Iteration 1 对准 Phase 1**，聚焦核心流程打通，不含高级审批与统计功能。

### 2.2 Phase 1 交付目标

| 目标ID | 目标描述 | 完成标准 |
|--------|----------|----------|
| GO-001 | 资产退役申请接口 | POST `/api/v1/assets/{asset_id}/retirement` 可提交申请 |
| GO-002 | 退役审批接口 | POST `/api/v1/asset-retirements/{retirement_id}/approve` 可执行审批 |
| GO-003 | 退役状态自动流转 | 审批通过后资产状态自动变更为 `RETIRED` |
| GO-004 | 生命周期历史记录 | 退役操作记录写入 `asset_lifecycle_history` 表 |
| GO-005 | 退役信息持久化 | 退役时间戳、原因、操作人写入生命周期历史 |

---

## 3. 边界约束

### 3.1 范围边界 (In-Scope)

| 类别 | 约束项 |
|------|--------|
| 状态范围 | 退役仅涉及 `RETIRED` 单一终态 |
| 流程范围 | 仅支持申请→审批→执行单链，不含驳回重提 |
| 数据范围 | 生命周期历史表 `asset_lifecycle_history` 写入 |
| 角色范围 | 审批角色限定为 `ASSET_ADMIN` |

### 3.2 范围边界 (Out-of-Scope)

| 类别 | 约束项 | 移动至 |
|------|--------|--------|
| 多级审批 | 本次不支持多级审批链 | Phase 2 |
| 驳回重提 | 本次不支持申请驳回后重新提交 | Phase 2 |
| 批量退役 | 本次不支持批量资产退役 | Phase 2 |
| 退役恢复 | 本次不支持退役资产重新激活 | Phase 3 |
| 财务处置 | 本次不涉及折旧、报废残值计算 | 财务模块 |

### 3.3 技术约束

| 约束ID | 约束描述 |
|--------|----------|
| TC-001 | 状态变更须在事务内完成，确保原子性 |
| TC-002 | 生命周期历史记录须在状态变更后同步写入 |
| TC-003 | 退役申请须校验资产当前状态，不符合则返回 400 |
| TC-004 | 重复退役申请须幂等处理，返回已有申请信息 |

### 3.4 数据约束

| 约束ID | 约束描述 |
|--------|----------|
| DC-001 | 退役原因枚举值：`DAMAGED`、`OBSOLETE`、`UPGRADE`、`EXPIRED`、`OTHER` |
| DC-002 | 生命周期历史表字段：`asset_id`, `event_type=RETIREMENT`, `timestamp`, `operator_id`, `reason`, `metadata` |
| DC-003 | 资产表 `status` 字段须更新为 `RETIRED` |

---

## 4. 验收测试基准 (ATB)

### 4.1 测试环境要求

| 环境 | 要求 |
|------|------|
| 数据库 | PostgreSQL 14+ with migrations applied |
| 测试框架 | pytest 7.x + pytest-asyncio |
| API 测试 | pytest + httpx (async) 或 Playwright (E2E) |
| 清理策略 | Each test uses fixture teardown to reset DB state |

### 4.2 单元测试 (pytest)

#### ATB-001: 资产退役申请提交

```python
# tests/unit/test_retirement_service.py

class TestRetirementApplication:
    """ATB-001: 退役申请提交"""
    
    async def test_submit_retirement_success(self, db_session, sample_asset_active):
        """
        物理测试期待:
        - Given: 存在状态为 ACTIVE 的资产 asset_id=sample_asset_active.id
        - When: 调用 retirement_service.submit_application(asset_id, reason, operator_id)
        - Then: 返回 RetirementApplication 对象，状态为 PENDING_APPROVAL
              - assert result.status == RetirementStatus.PENDING_APPROVAL
              - assert result.asset_id == sample_asset_active.id
        """
        pass
    
    async def test_submit_retirement_invalid_status(self, db_session, sample_asset_retired):
        """
        物理测试期待:
        - Given: 存在状态为 RETIRED 的资产
        - When: 调用 submit_application
        - Then: 抛出 InvalidAssetStatusError，状态码 400
              - assert raises InvalidAssetStatusError
        """
        pass
    
    async def test_submit_retirement_duplicate(self, db_session, existing_retirement):
        """
        物理测试期待:
        - Given: 已存在 PENDING_APPROVAL 的退役申请
        - When: 再次提交同一资产的退役申请
        - Then: 返回已有申请，不创建新记录
              - assert result.id == existing_retirement.id
        """
        pass
```

#### ATB-002: 退役审批执行

```python
# tests/unit/test_retirement_service.py

class TestRetirementApproval:
    """ATB-002: 退役审批执行"""
    
    async def test_approve_retirement_success(self, db_session, pending_retirement):
        """
        物理测试期待:
        - Given: 存在 PENDING_APPROVAL 的退役申请
        - When: 调用 retirement_service.approve(retirement_id, approver_id)
        - Then: 
              - assert result.status == RetirementStatus.APPROVED
              - 资产表中 asset.status == RETIRED
              - 生命周期历史表写入新记录
        """
        pass
    
    async def test_approve_retirement_not_found(self, db_session):
        """
        物理测试期待:
        - Given: 不存在的 retirement_id
        - When: 调用 approve
        - Then: 抛出 RetirementNotFoundError，状态码 404
        """
        pass
```

#### ATB-003: 生命周期历史记录写入

```python
# tests/unit/test_lifecycle_history.py

class TestLifecycleHistoryOnRetirement:
    """ATB-003: 生命周期历史记录写入"""
    
    async def test_history_record_created_on_retirement(self, db_session, pending_retirement):
        """
        物理测试期待:
        - Given: 待审批的退役申请
        - When: 审批通过
        - Then: 查询 asset_lifecycle_history 表
              - assert 记录存在
              - assert event_type == 'RETIREMENT'
              - assert reason == pending_retirement.reason
              - assert timestamp 已设置
        """
        pass
    
    async def test_history_metadata_persisted(self, db_session, pending_retirement):
        """
        物理测试期待:
        - Given: 退役申请含 metadata
        - When: 审批通过
        - Then: 历史记录 metadata 字段包含 operator_id, approver_id
        """
        pass
```

### 4.3 集成测试 (pytest + httpx)

#### ATB-004: API 端到端测试

```python
# tests/integration/test_retirement_api.py

class TestRetirementAPI:
    """ATB-004: API 端到端退役流程"""
    
    async def test_full_retirement_workflow(self, async_client: httpx.AsyncClient, db_session):
        """
        物理测试期待 (Playwright/E2E 风格断言):
        Step 1: POST /api/v1/assets/{asset_id}/retirement
                - assert response.status == 201
                - assert response.json()['status'] == 'PENDING_APPROVAL'
                - extraction: retirement_id = response.json()['id']
        
        Step 2: GET /api/v1/asset-retirements/{retirement_id}
                - assert response.status == 200
                - assert response.json()['status'] == 'PENDING_APPROVAL'
        
        Step 3: POST /api/v1/asset-retirements/{retirement_id}/approve
                - assert response.status == 200
                - assert response.json()['status'] == 'APPROVED'
        
        Step 4: GET /api/v1/assets/{asset_id}
                - assert response.json()['status'] == 'RETIRED'
        
        Step 5: GET /api/v1/assets/{asset_id}/lifecycle-history
                - assert len(response.json()) > 0
                - assert any(h['event_type'] == 'RETIREMENT' for h in response.json())
        """
        pass
    
    async def test_retirement_api_validation(self, async_client: httpx.AsyncClient):
        """
        物理测试期待:
        - Given: 无效请求体（缺少 reason 字段）
        - When: POST /api/v1/assets/{asset_id}/retirement
        - Then: assert response.status == 422 (Validation Error)
        """
        pass
```

### 4.4 E2E 测试 (Playwright)

#### ATB-005: UI 交互流程测试

```python
# tests/e2e/test_retirement_workflow.py

async def test_retirement_workflow_ui(page: Page):
    """
    物理测试期待:
    1. 导航至资产管理页面
    2. 选择目标资产，点击「申请退役」按钮
    3. 填写退役原因，选择 DAMAGED
    4. 点击「提交申请」
    5. 断言: 页面显示「退役申请已提交」
    
    6. 以 ASSET_ADMIN 角色登录
    7. 导航至退役审批列表
    8. 找到对应申请，点击「审批通过」
    9. 断言: 资产状态变更为「已退役」
    10. 断言: 生命周期历史可见退役记录
    """
```

---

## 5. 开发切入层级序列

### 5.1 分层架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  (API Routes / Handlers - retirement endpoints)              │
├─────────────────────────────────────────────────────────────┤
│                    Application Layer                         │
│  (Use Cases / Services - RetirementService)                  │
├─────────────────────────────────────────────────────────────┤
│                      Domain Layer                            │
│  (Entities: Asset, RetirementApplication, LifecycleHistory) │
│  (Domain Services / Business Rules)                          │
├─────────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                       │
│  (Repositories, Database Migrations, External Services)      │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 开发顺序与依赖

| 序号 | 开发层级 | 具体任务 | 依赖前置 |
|------|----------|----------|----------|
| **1** | **Infrastructure** | 创建数据库迁移: `asset_lifecycle_history` 表 | 无 |
| **2** | **Infrastructure** | 实现 `AssetRepository`, `RetirementRepository`, `LifecycleHistoryRepository` | 迁移完成 |
| **3** | **Domain** | 定义 `Asset`, `RetirementApplication`, `LifecycleHistory` 实体 | 无 |
| **4** | **Domain** | 实现领域规则校验 (`AssetStatusValidator`, `RetirementEligibilityChecker`) | 实体定义 |
| **5** | **Application** | 实现 `RetirementService.submit_application()` | Repositories + 实体 |
| **6** | **Application** | 实现 `RetirementService.approve()` + 状态流转逻辑 | submit_application |
| **7** | **Application** | 实现 `RetirementService._record_lifecycle_history()` | approve 流程 |
| **8** | **Presentation** | 实现 API Routes: POST `/retirement`, POST `/{id}/approve` | Service 层 |
| **9** | **Presentation** | 实现 API Route: GET `/assets/{id}/lifecycle-history` | History Repository |
| **10** | **Testing** | 编写 ATB-001 ~ ATB-003 单元测试 | 代码完成 |
| **11** | **Testing** | 编写 ATB-004 ~ ATB-005 集成/E2E 测试 | API Routes |

### 5.3 关键接口签名

#### 5.3.1 RetirementService

```python
class RetirementService:
    async def submit_application(
        self,
        asset_id: UUID,
        reason: RetirementReason,
        reason_detail: Optional[str],
        operator_id: UUID
    ) -> RetirementApplication:
        """提交退役申请"""
        pass
    
    async def approve(
        self,
        retirement_id: UUID,
        approver_id: UUID
    ) -> RetirementApplication:
        """审批退役申请"""
        pass
```

#### 5.3.2 API Endpoints

| Method | Path | Request Body | Response |
|--------|------|--------------|----------|
| POST | `/api/v1/assets/{asset_id}/retirement` | `{reason, reason_detail, operator_id}` | `201: RetirementApplication` |
| POST | `/api/v1/asset-retirements/{retirement_id}/approve` | `{approver_id}` | `200: RetirementApplication` |
| GET | `/api/v1/assets/{asset_id}/lifecycle-history` | - | `200: List[LifecycleHistory]` |

---

## 6. 附录

### 6.1 枚举定义

```python
class AssetStatus(str, Enum):
    ACTIVE = "ACTIVE"
    IN_USE = "IN_USE"
    IDLE = "IDLE"
    RETIRED = "RETIRED"
    MAINTENANCE = "MAINTENANCE"

class RetirementStatus(str, Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class RetirementReason(str, Enum):
    DAMAGED = "DAMAGED"
    OBSOLETE = "OBSOLETE"
    UPGRADE = "UPGRADE"
    EXPIRED = "EXPIRED"
    OTHER = "OTHER"
```

### 6.2 数据模型

```sql
-- asset_lifecycle_history 表结构
CREATE TABLE asset_lifecycle_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id),
    event_type VARCHAR(50) NOT NULL,
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    operator_id UUID NOT NULL,
    reason VARCHAR(100),
    reason_detail TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

**文档结束**