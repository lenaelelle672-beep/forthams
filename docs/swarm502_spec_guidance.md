# SWARM-502 资产报废/退役流程规格指导文档

## 文档信息

| 属性 | 值 |
|------|-----|
| 功能模块 | 资产报废/退役管理 |
| 任务编号 | SWARM-502 |
| 所属迭代 | Iteration 1 |
| 文档版本 | v1.0 |
| 最后更新 | 2025-01-20 |

---

## 1. 需求与背景

### 1.1 业务背景

企业资产管理中，资产退役（报废）是重要的生命周期管理环节。当资产达到使用年限、性能下降或不再满足业务需求时，需要正式执行退役流程。当前系统缺少标准化的资产退役审批链路，导致退役操作不规范、状态管理混乱。

### 1.2 核心诉求

| 编号 | 诉求描述 |
|------|----------|
| RQ-001 | 构建标准化的资产退役状态机，规范资产退役生命周期 |
| RQ-002 | 实现资产退役审批链路，支持多级审批流程 |
| RQ-003 | 用户可提交资产退役申请，审批通过后自动更新资产状态 |
| RQ-004 | 完整的操作审计日志，支持追溯 |

### 1.3 功能范围

| 分类 | 功能点 |
|------|--------|
| 申请管理 | 资产退役申请创建、编辑、提交、撤销 |
| 审批链路 | 单级审批流程，支持审批/驳回操作 |
| 状态同步 | 审批通过后自动更新资产主数据状态 |
| 记录查询 | 退役记录查询与统计 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 映射

根据 plan.md 中的 Phase 拆解，本 spec 对准 **Phase 2: 核心流程构建**

### 2.2 Phase 2 实施目标

| 目标项 | 描述 | 优先级 |
|--------|------|--------|
| 状态机实现 | 构建 Asset Retirement State Machine，覆盖 5 种状态流转 | P0 |
| 审批链路 | 实现单级审批流程，支持审批/驳回操作 | P0 |
| 申请管理 | 支持创建、编辑、提交、撤销退役申请 | P0 |
| 状态同步 | 审批通过后自动更新资产主数据状态 | P0 |

### 2.3 非本 Phase 范围（后续迭代）

- [ ] 多级审批流程
- [ ] 退役资产处置跟踪
- [ ] 自动化审批规则引擎
- [ ] 财务系统集成

---

## 3. 边界约束

### 3.1 架构约束

```
┌─────────────────────────────────────────────────────────────┐
│                        API Gateway                            │
├─────────────────────────────────────────────────────────────┤
│   Asset Service      │  Workflow Service   │  Notification   │
│   (资产管理)          │  (工作流引擎)         │  Service        │
├─────────────────────────────────────────────────────────────┤
│                    PostgreSQL                                 │
│   (assets, retirement_applications, approval_records)        │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 技术栈定位

| 层级 | 技术选型 | 关键实现 |
|------|----------|----------|
| 数据层 | SQLAlchemy + PostgreSQL | ORM 模型、迁移脚本 |
| 服务层 | Python Domain Service | 业务逻辑、状态机 |
| 接口层 | FastAPI Routes | REST API、Schema 验证 |
| 测试层 | pytest + pytest-asyncio | ATB 覆盖、覆盖率 > 80% |

### 3.3 数据边界约束

| 约束项 | 具体限制 |
|--------|----------|
| 资产范围 | 仅支持 `status = 'ACTIVE'` 的资产发起退役申请 |
| 状态锁定 | `RETIRED` 状态资产不允许状态回退 |
| 审批唯一性 | 同一资产同一时间仅允许存在 1 个有效的退役申请 |
| 字段长度 | 退役原因描述 ≤ 500 字符，审批意见 ≤ 200 字符 |

### 3.4 业务规则约束

#### 3.4.1 前置条件检查

```python
# 退役申请前置条件
preconditions = {
    "asset_status": "ACTIVE",                    # 资产必须处于活跃状态
    "no_pending_retirement": True,              # 不存在待处理的退役申请
    "no_pending_assignment": True,              # 不存在待处理的借用/分配记录
}
```

#### 3.4.2 状态流转约束

```
┌─────────┐  提交  ┌──────────────────┐  批准  ┌──────────┐  执行退役  ┌─────────┐
│  DRAFT  │──────>│ PENDING_APPROVAL │──────>│ APPROVED │──────────>│ RETIRED │
└─────────┘       └──────────────────┘        └──────────┘           └─────────┘
     │                    │                       │
     │ 取消               │ 驳回                   │
     v                    v                       v
┌───────────┐      ┌───────────┐           ┌───────────┐
│ CANCELLED │      │ REJECTED  │           │ REJECTED  │
└───────────┘      └───────────┘           └───────────┘
```

#### 3.4.3 权限约束

| 操作 | 允许角色 | 说明 |
|------|----------|------|
| 退役申请创建 | REQUESTER, ASSET_MANAGER, ADMIN | 资产归属部门用户 |
| 审批操作 | ASSET_MANAGER, ADMIN | 审批角色（可配置） |
| 状态查询 | 所有认证用户 | - |

### 3.5 性能约束

| 指标 | 目标值 |
|------|--------|
| 单次 API 响应时间 | < 200ms |
| 状态机状态变更事务 | 保证原子性 |
| 并发审批冲突检测 | 乐观锁机制 |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 资产退役申请创建

**测试场景**: 用户成功创建资产退役申请

```python
# pytest 测试用例
class TestRetirementApplicationCreation:
    
    def test_create_retirement_application_success(self, client, auth_headers, sample_asset):
        """
        ATB-1.1: 有效资产创建退役申请
        
        物理期待:
        - POST /api/v1/assets/{asset_id}/retirement 成功返回 201
        - 申请状态为 DRAFT
        - 返回包含 application_id
        """
        response = client.post(
            f"/api/v1/assets/{sample_asset['id']}/retirement",
            json={
                "reason": "设备老旧需报废",
                "planned_retirement_date": "2025-03-01",
                "description": "使用年限超过10年"
            },
            headers=auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "DRAFT"
        assert data["asset_id"] == sample_asset["id"]
        assert "application_id" in data
    
    def test_create_retirement_invalid_asset_status(self, client, auth_headers, retired_asset):
        """
        ATB-1.2: 非活跃资产创建退役申请失败
        
        物理期待:
        - 返回 400 Bad Request
        - 错误码 RETIRED_ASSET_NOT_ALLOWED
        """
        response = client.post(
            f"/api/v1/assets/{retired_asset['id']}/retirement",
            json={"reason": "测试"},
            headers=auth_headers
        )
        assert response.status_code == 400
        assert response.json()["error_code"] == "RETIRED_ASSET_NOT_ALLOWED"
    
    def test_create_retirement_duplicate_application(self, client, auth_headers, sample_asset, existing_application):
        """
        ATB-1.3: 重复申请检测
        
        物理期待:
        - 返回 409 Conflict
        - 错误码 DUPLICATE_APPLICATION_EXISTS
        """
        response = client.post(
            f"/api/v1/assets/{sample_asset['id']}/retirement",
            json={"reason": "测试"},
            headers=auth_headers
        )
        assert response.status_code == 409
        assert response.json()["error_code"] == "DUPLICATE_APPLICATION_EXISTS"
```

### 4.2 ATB-2: 资产退役状态机流转

**测试场景**: 验证状态机各状态转换合法性

```python
class TestRetirementStateMachine:
    
    def test_submit_application_draft_to_pending(self, client, auth_headers, draft_application):
        """
        ATB-2.1: 提交申请 DRAFT -> PENDING_APPROVAL
        
        物理期待:
        - PUT /api/v1/retirement/{id}/submit 返回 200
        - 状态变更为 PENDING_APPROVAL
        - submitted_at 时间戳更新
        """
        response = client.put(
            f"/api/v1/retirement/{draft_application['id']}/submit",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "PENDING_APPROVAL"
        assert response.json()["submitted_at"] is not None
    
    def test_invalid_transition_draft_to_retired(self, client, auth_headers, draft_application):
        """
        ATB-2.2: 非法状态转换 DRAFT -> RETIRED
        
        物理期待:
        - 返回 422 Unprocessable Entity
        - 错误码 INVALID_STATE_TRANSITION
        """
        response = client.put(
            f"/api/v1/retirement/{draft_application['id']}/retire",
            headers=auth_headers
        )
        assert response.status_code == 422
        assert "INVALID_STATE_TRANSITION" in response.json()["error_code"]
    
    def test_withdraw_pending_application(self, client, auth_headers, pending_application):
        """
        ATB-2.3: 撤回待审批申请 PENDING_APPROVAL -> CANCELLED
        
        物理期待:
        - 返回 200
        - 状态变更为 CANCELLED
        """
        response = client.put(
            f"/api/v1/retirement/{pending_application['id']}/withdraw",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "CANCELLED"
```

### 4.3 ATB-3: 审批链路

**测试场景**: 审批人执行审批操作

```python
class TestRetirementApproval:
    
    def test_approve_retirement_application(self, client, approver_headers, pending_application):
        """
        ATB-3.1: 审批通过
        
        物理期待:
        - POST /api/v1/retirement/{id}/approve 返回 200
        - 申请状态变更为 APPROVED
        - 创建审批记录 approval_record
        """
        response = client.post(
            f"/api/v1/retirement/{pending_application['id']}/approve",
            json={"comment": "同意退役申请", "effective_date": "2025-02-28"},
            headers=approver_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "APPROVED"
        assert data["approval_record"]["approver_id"] == approver_headers["user_id"]
    
    def test_reject_retirement_application(self, client, approver_headers, pending_application):
        """
        ATB-3.2: 审批驳回
        
        物理期待:
        - 返回 200
        - 申请状态变更为 REJECTED
        - 需要填写驳回原因
        """
        response = client.post(
            f"/api/v1/retirement/{pending_application['id']}/reject",
            json={"reason": "资产仍在使用中"},
            headers=approver_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "REJECTED"
    
    def test_execute_retirement_updates_asset_status(self, client, auth_headers, approved_application):
        """
        ATB-3.3: 执行退役后资产状态同步
        
        物理期待:
        - PUT /api/v1/retirement/{id}/execute 返回 200
        - 申请状态变更为 RETIRED
        - 关联资产 status 更新为 RETIRED
        """
        response = client.put(
            f"/api/v1/retirement/{approved_application['id']}/execute",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "RETIRED"
        
        # 验证资产状态同步
        asset_response = client.get(f"/api/v1/assets/{approved_application['asset_id']}")
        assert asset_response.json()["status"] == "RETIRED"
    
    def test_non_approver_cannot_approve(self, client, regular_user_headers, pending_application):
        """
        ATB-3.4: 非审批人权限校验
        
        物理期待:
        - 返回 403 Forbidden
        - 错误码 INSUFFICIENT_PERMISSION
        """
        response = client.post(
            f"/api/v1/retirement/{pending_application['id']}/approve",
            json={"comment": "测试"},
            headers=regular_user_headers
        )
        assert response.status_code == 403
        assert response.json()["error_code"] == "INSUFFICIENT_PERMISSION"
```

### 4.4 ATB-4: 数据一致性

**测试场景**: 事务与并发控制

```python
class TestDataConsistency:
    
    def test_concurrent_approval_conflict(self, client, pending_application):
        """
        ATB-4.1: 并发审批冲突检测
        
        物理期待:
        - 第二个审批请求返回 409 Conflict
        - 使用乐观锁 version 字段检测
        """
        # 模拟两个审批请求同时到达
        response1 = client.post(
            f"/api/v1/retirement/{pending_application['id']}/approve",
            json={"comment": "审批1"}
        )
        response2 = client.post(
            f"/api/v1/retirement/{pending_application['id']}/approve",
            json={"comment": "审批2"}
        )
        
        # 只有一个成功
        assert [response1.status_code, response2.status_code].count(200) == 1
        assert 409 in [response1.status_code, response2.status_code]
    
    def test_retirement_atomic_transaction(self, client, auth_headers, db_session, approved_application):
        """
        ATB-4.2: 退役执行事务原子性
        
        物理期待:
        - 状态变更与资产更新在同一个事务中
        - 失败时完整回滚
        """
        # 模拟事务边界验证
        with pytest.raises(IntegrityError):
            # 手动破坏事务以验证回滚机制
            pass
```

---

## 5. 开发切入层级序列

### 5.1 Phase 2 开发任务分解

| 开发阶段 | 任务项 | 预计工时 | 依赖关系 |
|----------|--------|----------|----------|
| Day 1-2 | 数据库模型设计与迁移 | 8h | 无 |
| | - retirement_applications | | |
| | - approval_records | | |
| | - 状态机枚举定义 | | |
| Day 3-4 | 核心服务层实现 | 12h | Day 1-2 |
| | - RetirementService | | |
| | - 状态机状态转换逻辑 | | |
| | - 审批链路服务 | | |
| Day 5-6 | API 路由层实现 | 10h | Day 3-4 |
| | - RESTful 接口定义 | | |
| | - 请求验证与错误处理 | | |
| | - 权限中间件集成 | | |
| Day 7 | 集成测试与修复 | 8h | Day 5-6 |
| | - ATB 测试用例执行 | | |
| | - 缺陷修复 | | |
| Day 8 | 文档与交付 | 4h | Day 7 |
| | - API 文档更新 | | |
| | - 操作手册 | | |

### 5.2 代码目录结构建议

```
src/
├── domain/
│   └── retirement/
│       ├── entities.py          # 退役申请实体
│       ├── state_machine.py     # 状态机定义
│       └── events.py            # 领域事件
├── application/
│   └── services/
│       ├── retirement_service.py
│       └── approval_service.py
├── infrastructure/
│   ├── repositories/
│   │   └── retirement_repository.py
│   └── database/
│       └── migrations/
├── api/
│   └── v1/
│       ├── retirement_router.py
│       └── schemas.py
└── tests/
    ├── unit/
    │   └── test_state_machine.py
    └── integration/
        └── test_retirement_api.py
```

---

## 6. 附录：状态机完整定义

### 6.1 状态枚举

```python
class RetirementStatus(str, Enum):
    """资产退役申请状态枚举"""
    DRAFT = "DRAFT"                    # 草稿
    PENDING_APPROVAL = "PENDING_APPROVAL"  # 待审批
    APPROVED = "APPROVED"              # 已批准
    REJECTED = "REJECTED"              # 已驳回
    CANCELLED = "CANCELLED"            # 已撤回
    RETIRED = "RETIRED"                # 已退役
```

### 6.2 状态转换规则

| 当前状态 | 允许转换 | 触发事件 | 目标状态 |
|----------|----------|----------|----------|
| DRAFT | PENDING_APPROVAL | submit | 提交 |
| DRAFT | CANCELLED | cancel | 取消 |
| PENDING_APPROVAL | APPROVED | approve | 批准 |
| PENDING_APPROVAL | REJECTED | reject | 驳回 |
| PENDING_APPROVAL | CANCELLED | withdraw | 撤回 |
| APPROVED | RETIRED | execute | 执行退役 |
| REJECTED | DRAFT | revise | 修订重提 |

### 6.3 用户角色定义

```python
class UserRole(str, Enum):
    """用户角色枚举"""
    ADMIN = "ADMIN"                          # 管理员 - 可执行最终审批
    ASSET_MANAGER = "ASSET_MANAGER"          # 资产管理员 - 可执行各级审批
    REQUESTER = "REQUESTER"                  # 普通请求者 - 可发起报废请求
```

### 6.4 资产状态定义

```python
class AssetStatus(str, Enum):
    """资产状态枚举"""
    ACTIVE = "ACTIVE"                        # 使用中
    MAINTENANCE = "MAINTENANCE"              # 维护中
    RETIRED = "RETIRED"                     # 已退役 - 不可逆向操作
```

---

## 7. AC 验证状态跟踪

| AC 编号 | 验证方法 | 状态 | 备注 |
|---------|----------|------|------|
| AC-001 | unit_test | pending | 核心功能单元测试 |
| AC-002 | unit_test | pending | 状态机流转测试 |
| AC-003 | static_analysis | pending | AST 静态检查 |
| AC-004 | static_analysis | pending | docstring 覆盖检查 |
| AC-005 | unit_test | pending | 模块 import 检查 |

---

*文档版本: v1.0 | 对应迭代: Iteration 1 | 最后更新: 2025-01-20*