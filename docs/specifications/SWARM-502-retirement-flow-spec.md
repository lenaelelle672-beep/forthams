# SWARM-502 资产报废/退役流程 - 规格指导文档

## 1. 需求与背景

### 1.1 业务背景

企业资产管理中，资产退役（报废）是重要的生命周期管理环节。当资产达到使用年限、性能下降或不再满足业务需求时，需要正式执行退役流程。当前系统缺少标准化的资产退役审批链路，导致退役操作不规范、状态管理混乱。

**痛点分析**：
- 缺乏统一的资产退役申请入口
- 审批流程不规范，状态变更无记录
- 资产状态与实际使用情况不同步
- 退役操作无法追溯和审计

### 1.2 核心诉求

| 诉求 | 描述 |
|------|------|
| 状态机规范 | 构建标准化的资产退役状态机，覆盖完整的生命周期状态 |
| 审批链路 | 实现单级审批流程，支持审批通过/驳回操作 |
| 申请管理 | 支持创建、编辑、提交、撤销退役申请 |
| 状态同步 | 审批通过后自动更新资产主数据状态 |
| 审计追溯 | 完整的操作日志，支持追溯 |

### 1.3 功能范围

**本迭代范围（Phase 2）**：
- 资产退役申请创建与编辑
- 资产退役审批工作流
- 资产状态自动变更
- 退役记录查询

**非本迭代范围**：
- 多级审批流程
- 自动化审批规则引擎
- 财务系统集成
- 退役资产处置跟踪

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 映射

根据 `docs/plan.md` 中的 Phase 拆解，本 spec 对准 **Phase 2: 核心流程构建**。

### 2.2 Phase 2 实施目标

| 目标项 | 描述 | 完成标准 |
|--------|------|----------|
| 状态机实现 | 构建 Asset Retirement State Machine | 5 种状态流转正确 |
| 审批链路 | 实现单级审批流程 | 支持审批/驳回 |
| 申请管理 | 支持创建、编辑、提交、撤销 | 全流程可执行 |
| 状态同步 | 审批通过后更新资产状态 | 原子性保证 |

### 2.3 关键交付物

```
Phase 2 交付物清单
├── backend/models/asset_retirement.py     # 资产退役数据模型
├── backend/services/retirement_service.py # 退役业务服务
├── backend/services/approval_service.py   # 审批服务
├── src/state_machine/retirement_state_machine.py # 状态机实现
├── src/repositories/retirement_repository.py    # 仓储层
├── src/api/middleware/audit_logger.py     # 审计日志中间件
├── tests/e2e/retirement_user_journey.spec.ts    # 端到端测试
└── src/main.py                             # 路由注册
```

---

## 3. 边界约束

### 3.1 架构约束

```
┌─────────────────────────────────────────────────────────┐
│                      API Gateway                         │
├─────────────────────────────────────────────────────────┤
│  Asset Service  │  Retirement Service  │  Notification  │
│  (资产管理)     │  (退役服务)            │  Service       │
├─────────────────────────────────────────────────────────┤
│                  PostgreSQL                              │
│  ┌─────────────┐ ┌─────────────────┐ ┌────────────────┐  │
│  │  assets     │ │ retirement_apps│ │approval_records│  │
│  └─────────────┘ └─────────────────┘ └────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 3.2 技术栈约束

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 后端框架 | FastAPI | RESTful API |
| ORM | SQLAlchemy | 数据库操作 |
| 状态机 | 自定义状态机 | `src/state_machine/retirement_state_machine.py` |
| 权限控制 | JWT + RBAC | `src/api/deps/auth.py` |
| 测试 | pytest + Playwright | 单元测试 + E2E |

### 3.3 数据边界约束

| 约束项 | 具体限制 | 错误码 |
|--------|----------|--------|
| 资产范围 | 仅支持 `status = 'ACTIVE'` 的资产发起退役申请 | `RETIRED_ASSET_NOT_ALLOWED` |
| 状态锁定 | `RETIRED` 状态资产不允许状态回退 | `INVALID_STATE_TRANSITION` |
| 审批唯一性 | 同一资产同一时间仅允许存在 1 个有效退役申请 | `DUPLICATE_APPLICATION_EXISTS` |
| 字段长度 | 退役原因描述 ≤ 500 字符 | `FIELD_TOO_LONG` |
| 字段长度 | 审批意见 ≤ 200 字符 | `FIELD_TOO_LONG` |

### 3.4 业务规则约束

#### 3.4.1 前置条件检查

```python
# 退役申请创建前置条件
def validate_retirement_prerequisites(asset_id: str) -> bool:
    """
    1. 资产必须处于 ACTIVE 状态
    2. 资产不存在待处理的退役申请
    3. 资产不存在待处理的借用/分配记录
    """
```

#### 3.4.2 状态流转约束

```
┌─────────┐
│  DRAFT  │ ←─ 草稿/编辑状态
└────┬────┘
     │ submit (提交)
     ▼
┌───────────────────┐
│ PENDING_APPROVAL  │ ←─ 待审批状态
└─────┬─────────┬───┘
      │         │
  approve    reject
      │         │
      ▼         ▼
┌─────────┐ ┌──────────┐
│ APPROVED│ │ REJECTED │ ←─ 需修订后可重新提交
└────┬────┘ └──────────┘
     │ execute (执行退役)
     ▼
┌─────────┐
│ RETIRED │ ←─ 已退役（终态）
└─────────┘

PENDING_APPROVAL ──withdraw──→ CANCELLED (撤回)
```

### 3.5 权限约束

| 操作 | 权限角色 | 说明 |
|------|----------|------|
| 创建退役申请 | `REQUESTER` | 资产归属部门用户 |
| 提交申请 | `REQUESTER` | 申请创建者 |
| 审批/驳回 | `ASSET_MANAGER`, `ADMIN` | 审批角色 |
| 执行退役 | `ASSET_MANAGER`, `ADMIN` | 审批通过后执行 |
| 查询 | 所有认证用户 | - |

### 3.6 性能约束

| 指标 | 目标值 | 说明 |
|------|--------|------|
| API 响应时间 | < 200ms | P95 |
| 状态变更事务 | 原子性保证 | 失败完整回滚 |
| 并发审批 | 乐观锁机制 | 冲突检测 |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 资产退役申请创建

**测试场景**: 用户成功创建资产退役申请

```typescript
// tests/e2e/retirement_user_journey.spec.ts

describe('ATB-1: 资产退役申请创建', () => {
  
  it('ATB-1.1: 有效资产创建退役申请', async ({ page }) => {
    /**
     * 物理期待:
     * - POST /api/v1/assets/{asset_id}/retirement 成功返回 201
     * - 申请状态为 DRAFT
     * - 返回包含 application_id
     */
    await page.goto(`/assets/${activeAssetId}`);
    await page.click('[data-testid="retire-btn"]');
    await page.fill('[data-testid="retirement-reason"]', '设备老旧需报废');
    await page.fill('[data-testid="planned-date"]', '2025-03-01');
    await page.click('[data-testid="submit-btn"]');
    
    await expect(page.locator('.toast-success')).toBeVisible();
    const response = await api.createRetirementApplication({
      asset_id: activeAssetId,
      reason: '设备老旧需报废'
    });
    expect(response.status).toBe(201);
    expect(response.data.status).toBe('DRAFT');
  });

  it('ATB-1.2: 非活跃资产创建退役申请失败', async ({ page }) => {
    /**
     * 物理期待:
     * - 返回 400 Bad Request
     * - 错误码 RETIRED_ASSET_NOT_ALLOWED
     */
    const response = await api.createRetirementApplication({
      asset_id: retiredAssetId,
      reason: '测试'
    });
    expect(response.status).toBe(400);
    expect(response.data.error_code).toBe('RETIRED_ASSET_NOT_ALLOWED');
  });

  it('ATB-1.3: 重复申请检测', async ({ page }) => {
    /**
     * 物理期待:
     * - 返回 409 Conflict
     * - 错误码 DUPLICATE_APPLICATION_EXISTS
     */
    const response = await api.createRetirementApplication({
      asset_id: assetWithExistingApplication,
      reason: '测试'
    });
    expect(response.status).toBe(409);
    expect(response.data.error_code).toBe('DUPLICATE_APPLICATION_EXISTS');
  });
});
```

### 4.2 ATB-2: 资产退役状态机流转

**测试场景**: 验证状态机各状态转换合法性

```typescript
// tests/e2e/retirement_user_journey.spec.ts

describe('ATB-2: 资产退役状态机流转', () => {
  
  it('ATB-2.1: 提交申请 DRAFT → PENDING_APPROVAL', async ({ page }) => {
    /**
     * 物理期待:
     * - PUT /api/v1/retirement/{id}/submit 返回 200
     * - 状态变更为 PENDING_APPROVAL
     * - submitted_at 时间戳更新
     */
    const response = await api.submitRetirement(draftApplicationId);
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('PENDING_APPROVAL');
    expect(response.data.submitted_at).toBeDefined();
  });

  it('ATB-2.2: 非法状态转换 DRAFT → RETIRED', async ({ page }) => {
    /**
     * 物理期待:
     * - 返回 422 Unprocessable Entity
     * - 错误码 INVALID_STATE_TRANSITION
     */
    const response = await api.executeRetirement(draftApplicationId);
    expect(response.status).toBe(422);
    expect(response.data.error_code).toContain('INVALID_STATE_TRANSITION');
  });

  it('ATB-2.3: 撤回待审批申请 PENDING → CANCELLED', async ({ page }) => {
    /**
     * 物理期待:
     * - 返回 200
     * - 状态变更为 CANCELLED
     */
    const response = await api.withdrawRetirement(pendingApplicationId);
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('CANCELLED');
  });
});
```

### 4.3 ATB-3: 审批链路

**测试场景**: 审批人执行审批操作

```typescript
// tests/e2e/retirement_user_journey.spec.ts

describe('ATB-3: 审批链路', () => {
  
  it('ATB-3.1: 审批通过', async ({ page }) => {
    /**
     * 物理期待:
     * - POST /api/v1/retirement/{id}/approve 返回 200
     * - 申请状态变更为 APPROVED
     * - 创建审批记录 approval_record
     */
    const response = await api.approveRetirement(pendingApplicationId, {
      comment: '同意退役申请',
      effective_date: '2025-02-28'
    });
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('APPROVED');
    expect(response.data.approval_record.approver_id).toBeDefined();
  });

  it('ATB-3.2: 审批驳回', async ({ page }) => {
    /**
     * 物理期待:
     * - 返回 200
     * - 申请状态变更为 REJECTED
     * - 需要填写驳回原因
     */
    const response = await api.rejectRetirement(pendingApplicationId, {
      reason: '资产仍在使用中'
    });
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('REJECTED');
  });

  it('ATB-3.3: 执行退役后资产状态同步', async ({ page }) => {
    /**
     * 物理期待:
     * - PUT /api/v1/retirement/{id}/execute 返回 200
     * - 申请状态变更为 RETIRED
     * - 关联资产 status 更新为 RETIRED
     */
    const response = await api.executeRetirement(approvedApplicationId);
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('RETIRED');
    
    // 验证资产状态同步
    const assetResponse = await api.getAsset(approvedApplicationId);
    expect(assetResponse.data.status).toBe('RETIRED');
  });

  it('ATB-3.4: 非审批人权限校验', async ({ page }) => {
    /**
     * 物理期待:
     * - 返回 403 Forbidden
     * - 错误码 INSUFFICIENT_PERMISSION
     */
    const response = await api.approveRetirement(pendingApplicationId, {
      comment: '测试'
    }, { role: 'REQUESTER' });
    expect(response.status).toBe(403);
    expect(response.data.error_code).toBe('INSUFFICIENT_PERMISSION');
  });
});
```

### 4.4 ATB-4: 数据一致性

**测试场景**: 事务与并发控制

```python
# tests/backend/test_retirement_transaction.py

class TestRetirementDataConsistency:
    
    def test_concurrent_approval_conflict(self, pending_application):
        """
        ATB-4.1: 并发审批冲突检测
        
        物理期待:
        - 第二个审批请求返回 409 Conflict
        - 使用乐观锁 version 字段检测
        """
        # 模拟两个审批请求同时到达
        response1 = approval_service.approve(pending_application.id, approver1)
        response2 = approval_service.approve(pending_application.id, approver2)
        
        # 只有一个成功
        success_count = sum(1 for r in [response1, response2] if r.status == 200)
        conflict_count = sum(1 for r in [response1, response2] if r.status == 409)
        
        assert success_count == 1
        assert conflict_count == 1
    
    def test_retirement_atomic_transaction(self, approved_application):
        """
        ATB-4.2: 退役执行事务原子性
        
        物理期待:
        - 状态变更与资产更新在同一个事务中
        - 失败时完整回滚
        """
        # 验证事务边界
        with pytest.raises(IntegrityError):
            # 模拟部分失败场景
            retirement_service.execute_retirement(
                approved_application.id,
                simulate_failure=True
            )
```

---

## 5. 开发切入层级序列

### 5.1 开发阶段划分

```
Phase 2 开发时间线
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Day 1-2    Day 3-4    Day 5-6    Day 7       Day 8
  ▼          ▼          ▼         ▼           ▼
┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐
│数据层│ → │服务层│ → │接口层│ → │集成测试│ → │交付│
│ 8h  │   │ 12h │   │ 10h │   │ 8h  │   │ 4h  │
└─────┘   └─────┘   └─────┘   └─────┘   └─────┘
```

### 5.2 详细任务分解

#### Phase 2 开发任务分解

| 阶段 | 任务项 | 预计工时 | 依赖关系 | 交付文件 |
|------|--------|----------|----------|----------|
| **Day 1-2** | 数据库模型设计与迁移 | 8h | 无 | - |
| | - 资产退役申请表 `retirement_applications` | | | `backend/models/asset_retirement.py` |
| | - 审批记录表 `approval_records` | | | |
| | - 状态机枚举定义 | | | `src/models/enums.py` |
| **Day 3-4** | 核心服务层实现 | 12h | Day 1-2 | - |
| | - 退役服务 `RetirementService` | | | `src/services/retirement_service.py` |
| | - 状态机状态转换逻辑 | | | `src/state_machine/retirement_state_machine.py` |
| | - 审批链路服务 | | | `src/services/approval_chain_service.py` |
| **Day 5-6** | API 路由层实现 | 10h | Day 3-4 | - |
| | - RESTful 接口定义 | | | `src/api/routers/retirement_router.py` |
| | - 请求验证与错误处理 | | | |
| | - 审计日志中间件 | | | `src/api/middleware/audit_logger.py` |
| | - 路由注册 | | | `src/main.py` |
| **Day 7** | 集成测试与修复 | 8h | Day 5-6 | - |
| | - ATB 测试用例执行 | | | `tests/e2e/retirement_user_journey.spec.ts` |
| | - 缺陷修复 | | | |
| **Day 8** | 文档与交付 | 4h | Day 7 | - |
| | - API 文档更新 | | | |
| | - 操作手册 | | | |

### 5.3 技术栈定位

| 层级 | 技术选型 | 关键实现 | 核心文件 |
|------|----------|----------|----------|
| 数据层 | SQLAlchemy + PostgreSQL | ORM 模型、迁移脚本 | `backend/models/asset_retirement.py` |
| 服务层 | Python Domain Service | 业务逻辑、状态机 | `src/services/retirement_service.py` |
| 接口层 | FastAPI Routes | REST API、Schema 验证 | `src/api/routers/retirement_router.py` |
| 测试层 | pytest + Playwright | ATB 覆盖、覆盖率 > 80% | `tests/e2e/retirement_user_journey.spec.ts` |

### 5.4 代码目录结构建议

```
src/
├── domain/
│   └── retirement/
│       ├── entities.py              # 退役申请实体
│       ├── state_machine.py         # 状态机定义
│       └── events.py                # 领域事件
├── application/
│   └── services/
│       ├── retirement_service.py    # 退役业务服务
│       └── approval_service.py      # 审批服务
├── infrastructure/
│   ├── repositories/
│   │   └── retirement_repository.py # 仓储层
│   └── database/
│       └── migrations/
├── api/
│   ├── routers/
│   │   └── retirement_router.py     # 退役路由
│   └── middleware/
│       └── audit_logger.py          # 审计中间件
├── state_machine/
│   └── retirement_state_machine.py  # 状态机实现
├── models/
│   ├── enums.py                     # 枚举定义
│   └── asset_retirement.py          # 数据模型
└── main.py                          # 应用入口

tests/
├── e2e/
│   └── retirement_user_journey.spec.ts  # E2E 测试
├── unit/
│   └── test_state_machine.py
└── integration/
    └── test_retirement_api.py
```

### 5.5 关键文件修改清单

| 文件路径 | 修改类型 | 修改说明 |
|----------|----------|----------|
| `backend/models/asset_retirement.py` | 修改 | 补充资产退役模型字段 |
| `src/repositories/retirement_repository.py` | 修改 | 实现退役仓储层 CRUD |
| `src/api/middleware/audit_logger.py` | 修改 | 添加审计日志中间件 |
| `src/main.py` | 修改 | 注册路由/依赖注入 |
| `tests/e2e/retirement_user_journey.spec.ts` | 修改 | 编写端到端测试用例 |

---

## 6. 附录

### 6.1 状态机完整定义

```python
# src/models/enums.py

class RetirementStatus(str, Enum):
    """资产退役申请状态枚举"""
    DRAFT = "DRAFT"                        # 草稿
    PENDING_APPROVAL = "PENDING_APPROVAL"  # 待审批
    APPROVED = "APPROVED"                  # 已批准
    REJECTED = "REJECTED"                  # 已驳回
    CANCELLED = "CANCELLED"                # 已撤回
    RETIRED = "RETIRED"                    # 已退役（终态）


class AssetStatus(str, Enum):
    """资产状态枚举"""
    ACTIVE = "ACTIVE"                      # 使用中
    MAINTENANCE = "MAINTENANCE"            # 维护中
    RETIRED = "RETIRED"                    # 已退役
```

### 6.2 状态转换规则表

| 当前状态 | 允许转换 | 触发事件 | 目标状态 | 触发角色 |
|----------|----------|----------|----------|----------|
| DRAFT | → PENDING_APPROVAL | submit | 提交 | REQUESTER |
| DRAFT | → CANCELLED | cancel | 取消 | REQUESTER |
| PENDING_APPROVAL | → APPROVED | approve | 批准 | ASSET_MANAGER, ADMIN |
| PENDING_APPROVAL | → REJECTED | reject | 驳回 | ASSET_MANAGER, ADMIN |
| PENDING_APPROVAL | → CANCELLED | withdraw | 撤回 | REQUESTER |
| APPROVED | → RETIRED | execute | 执行退役 | ASSET_MANAGER, ADMIN |
| REJECTED | → DRAFT | revise | 修订重提 | REQUESTER |

### 6.3 API 接口清单

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | `/api/v1/retirement` | 创建退役申请 | REQUESTER |
| GET | `/api/v1/retirement/{id}` | 获取申请详情 | 认证用户 |
| PUT | `/api/v1/retirement/{id}` | 更新申请 | REQUESTER |
| POST | `/api/v1/retirement/{id}/submit` | 提交申请 | REQUESTER |
| POST | `/api/v1/retirement/{id}/withdraw` | 撤回申请 | REQUESTER |
| POST | `/api/v1/retirement/{id}/approve` | 审批通过 | ASSET_MANAGER, ADMIN |
| POST | `/api/v1/retirement/{id}/reject` | 审批驳回 | ASSET_MANAGER, ADMIN |
| POST | `/api/v1/retirement/{id}/execute` | 执行退役 | ASSET_MANAGER, ADMIN |
| GET | `/api/v1/assets/{id}/retirement` | 获取资产退役记录 | 认证用户 |

---

*文档版本: v1.0*  
*对应迭代: Iteration 1*  
*最后更新: 2025-01-20*  
*审核状态: 已批准*