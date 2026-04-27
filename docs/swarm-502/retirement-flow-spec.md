# SWARM-502 资产报废/退役流程 - 规格指导文档

## 1. 需求与背景

### 1.1 业务背景
企业资产管理中，资产退役（报废）是重要的生命周期管理环节。当资产达到使用年限、性能下降或不再满足业务需求时，需要正式执行退役流程。当前系统缺少标准化的资产退役审批链路，导致退役操作不规范、状态管理混乱。

### 1.2 核心诉求
1. **状态机规范化**：构建标准化的资产退役状态机，规范资产退役生命周期
2. **审批链路实现**：实现资产退役审批链路，支持多级审批流程
3. **用户操作**：用户可提交资产退役申请，审批通过后自动更新资产状态
4. **审计追溯**：完整的操作审计日志，支持追溯

### 1.3 功能范围
- ✅ 资产退役申请创建与编辑
- ✅ 资产退役审批工作流
- ✅ 资产状态自动变更
- ✅ 退役记录查询与统计
- ⬜ 多级审批流程（后续迭代）
- ⬜ 退役资产处置跟踪（后续迭代）

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 映射
| Phase | 描述 | 状态 |
|-------|------|------|
| Phase 1 | 基础架构搭建 | ✅ 完成 |
| **Phase 2** | **核心流程构建** | 🔄 **当前** |
| Phase 3 | 高级特性 | ⬜ 待开发 |

### 2.2 Phase 2 实施目标

#### 2.2.1 状态机实现
```python
class RetirementStatus(str, Enum):
    """资产退役状态枚举"""
    DRAFT = "DRAFT"                    # 草稿
    PENDING_APPROVAL = "PENDING_APPROVAL"  # 待审批
    APPROVED = "APPROVED"              # 已批准
    REJECTED = "REJECTED"              # 已驳回
    CANCELLED = "CANCELLED"            # 已撤回
    RETIRED = "RETIRED"                # 已退役
```

#### 2.2.2 审批链路
- 单级审批流程
- 支持审批/驳回操作
- 审批意见记录

#### 2.2.3 状态同步
审批通过后自动更新资产主数据状态

---

## 3. 边界约束

### 3.1 架构约束
```
┌─────────────────────────────────────────────────────────┐
│                     API Gateway                          │
├─────────────────────────────────────────────────────────┤
│   Asset Service  │  Workflow Service  │  Notification  │
│   (资产管理)      │  (工作流引擎)        │  Service       │
├─────────────────────────────────────────────────────────┤
│                     PostgreSQL                            │
│   (assets, retirement_applications, approval_records)   │
└─────────────────────────────────────────────────────────┘
```

### 3.2 数据边界约束

| 约束项 | 具体限制 |
|--------|----------|
| 资产范围 | 仅支持 `status = 'ACTIVE'` 的资产发起退役申请 |
| 状态锁定 | `RETIRED` 状态资产不允许状态回退 |
| 审批唯一性 | 同一资产同一时间仅允许存在 1 个有效的退役申请 |
| 字段长度 | 退役原因描述 ≤ 500 字符，审批意见 ≤ 200 字符 |

### 3.3 业务规则约束

#### 3.3.1 前置条件检查
```python
def validate_retirement_prerequisites(asset: Asset) -> ValidationResult:
    """验证资产退役前置条件"""
    errors = []
    
    if asset.status != AssetStatus.ACTIVE:
        errors.append("资产必须处于 ACTIVE 状态才能发起退役申请")
    
    if has_pending_retirement(asset.id):
        errors.append("该资产已存在待处理的退役申请")
    
    if has_pending_assignment(asset.id):
        errors.append("该资产存在待处理的借用/分配记录")
    
    return ValidationResult(valid=len(errors) == 0, errors=errors)
```

#### 3.3.2 状态流转约束
```
DRAFT ──[提交]──> PENDING_APPROVAL ──[批准]──> APPROVED ──[执行退役]──> RETIRED
                      │                         │
                      └──[驳回]──> REJECTED ◄───┘
                      │
                      └──[撤回]──> CANCELLED
```

#### 3.3.3 权限约束
| 操作 | 允许角色 |
|------|----------|
| 退役申请创建 | 资产归属部门用户 |
| 审批操作 | APPROVER 角色 |
| 状态查询 | 所有认证用户 |

### 3.4 性能约束
- 单次 API 响应时间 < 200ms
- 状态机状态变更事务保证原子性
- 并发审批冲突检测：乐观锁机制

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 资产退役申请创建

#### ATB-1.1: 有效资产创建退役申请
```typescript
// frontend/tests/e2e/retirement_flow.spec.ts
test('should create retirement application for valid asset', async ({ page }) => {
  // 物理期待:
  // - POST /api/v1/assets/{asset_id}/retirement 成功返回 201
  // - 申请状态为 DRAFT
  // - 返回包含 application_id
  await page.goto(`/assets/${activeAssetId}`);
  await page.click('[data-testid="retire-button"]');
  await page.fill('[data-testid="retirement-reason"]', '设备老旧需报废');
  await page.click('[data-testid="submit-retirement"]');
  await expect(page.locator('.application-status')).toHaveText('DRAFT');
});
```

#### ATB-1.2: 非活跃资产创建退役申请失败
```typescript
test('should reject retirement for non-active asset', async ({ page }) => {
  // 物理期待:
  // - 返回 400 Bad Request
  // - 错误码 RETIRED_ASSET_NOT_ALLOWED
  await page.goto(`/assets/${retiredAssetId}`);
  await expect(page.locator('[data-testid="retire-button"]')).toBeDisabled();
});
```

#### ATB-1.3: 重复申请检测
```typescript
test('should prevent duplicate retirement applications', async ({ page }) => {
  // 物理期待:
  // - 返回 409 Conflict
  // - 错误码 DUPLICATE_APPLICATION_EXISTS
  await page.goto(`/assets/${activeAssetId}`);
  await page.click('[data-testid="retire-button"]');
  // 尝试重复提交
  await page.click('[data-testid="submit-retirement"]');
  await expect(page.locator('.error-message')).toContainText('已存在退役申请');
});
```

### 4.2 ATB-2: 资产退役状态机流转

#### ATB-2.1: 提交申请 DRAFT -> PENDING_APPROVAL
```typescript
test('should transition from DRAFT to PENDING_APPROVAL', async ({ page }) => {
  // 物理期待:
  // - 状态变更为 PENDING_APPROVAL
  // - submitted_at 时间戳更新
  await page.goto(`/retirement/${draftApplicationId}`);
  await page.click('[data-testid="submit-for-approval"]');
  await expect(page.locator('.status-badge')).toHaveText('待审批');
});
```

#### ATB-2.2: 非法状态转换检测
```typescript
test('should reject invalid state transitions', async ({ page }) => {
  // 物理期待:
  // - 返回 422 Unprocessable Entity
  // - 错误码 INVALID_STATE_TRANSITION
  await page.goto(`/retirement/${draftApplicationId}`);
  // 尝试直接从草稿执行退役
  await expect(page.locator('[data-testid="execute-retirement"]')).toBeDisabled();
});
```

### 4.3 ATB-3: 审批链路

#### ATB-3.1: 审批通过
```typescript
test('should approve retirement application', async ({ page }) => {
  // 物理期待:
  // - 申请状态变更为 APPROVED
  // - 创建审批记录
  await page.goto(`/approvals/${pendingApplicationId}`);
  await page.fill('[data-testid="approval-comment"]', '同意退役');
  await page.click('[data-testid="approve-button"]');
  await expect(page.locator('.status-badge')).toHaveText('已批准');
});
```

#### ATB-3.2: 审批驳回
```typescript
test('should reject retirement application', async ({ page }) => {
  // 物理期待:
  // - 申请状态变更为 REJECTED
  // - 需要填写驳回原因
  await page.goto(`/approvals/${pendingApplicationId}`);
  await page.fill('[data-testid="rejection-reason"]', '资产仍在使用');
  await page.click('[data-testid="reject-button"]');
  await expect(page.locator('.status-badge')).toHaveText('已驳回');
});
```

#### ATB-3.3: 执行退役后资产状态同步
```typescript
test('should update asset status after retirement execution', async ({ page }) => {
  // 物理期待:
  // - 申请状态变更为 RETIRED
  // - 关联资产 status 更新为 RETIRED
  await page.goto(`/retirement/${approvedApplicationId}`);
  await page.click('[data-testid="execute-retirement"]');
  await expect(page.locator('.status-badge')).toHaveText('已退役');
  
  // 验证资产状态
  const assetStatus = await page.locator('.asset-status').textContent();
  expect(assetStatus).toBe('RETIRED');
});
```

### 4.4 ATB-4: 数据一致性

#### ATB-4.1: 并发审批冲突检测
```typescript
test('should detect concurrent approval conflicts', async ({ browser }) => {
  // 物理期待:
  // - 第二个审批请求返回 409 Conflict
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();
  
  await Promise.all([
    page1.goto(`/approvals/${pendingApplicationId}`),
    page2.goto(`/approvals/${pendingApplicationId}`)
  ]);
  
  await page1.click('[data-testid="approve-button"]');
  await page2.click('[data-testid="approve-button"]');
  
  // 只有一个成功
  const successCount = await Promise.all([
    page1.locator('.success-message').count(),
    page2.locator('.success-message').count()
  ]);
  expect(successCount.filter(Boolean)).toHaveLength(1);
});
```

---

## 5. 开发切入层级序列

### 5.1 Phase 2 开发任务分解

```
开发阶段    │ 任务项                    │ 预计工时  │ 依赖关系
────────────┼───────────────────────────┼───────────┼────────────
Day 1-2     │ 数据库模型设计与迁移       │ 8h        │ 无
            │ - retirement_applications │
            │ - approval_records        │
            │ - 状态机枚举定义           │
────────────┼───────────────────────────┼───────────┼────────────
Day 3-4     │ 核心服务层实现            │ 12h       │ Day 1-2
            │ - RetirementService        │
            │ - 状态机状态转换逻辑       │
            │ - 审批链路服务             │
────────────┼───────────────────────────┼───────────┼────────────
Day 5-6     │ API 路由层实现            │ 10h       │ Day 3-4
            │ - RESTful 接口定义         │
            │ - 请求验证与错误处理       │
            │ - 权限中间件集成           │
────────────┼───────────────────────────┼───────────┼────────────
Day 7       │ 集成测试与修复            │ 8h        │ Day 5-6
            │ - ATB 测试用例执行         │
            │ - 缺陷修复                 │
────────────┼───────────────────────────┼───────────┼────────────
Day 8       │ 文档与交付                │ 4h        │ Day 7
            │ - API 文档更新            │
            │ - 操作手册                 │
```

### 5.2 技术栈定位

| 层级 | 技术选型 | 关键实现 |
|------|----------|----------|
| 数据层 | SQLAlchemy + PostgreSQL | ORM 模型、迁移脚本 |
| 服务层 | Python Domain Service | 业务逻辑、状态机 |
| 接口层 | FastAPI Routes | REST API、Schema 验证 |
| 前端层 | React + Playwright | E2E 测试、用户交互 |
| 测试层 | pytest + pytest-asyncio | ATB 覆盖、覆盖率 > 80% |

### 5.3 代码目录结构

```
src/
├── domain/
│   └── retirement/
│       ├── entities.py          # 退役申请实体
│       ├── state_machine.py    # 状态机定义
│       └── events.py           # 领域事件
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
│   ├── routers/
│   │   └── retirement_router.py
│   ├── middleware/
│   │   └── audit_logger.py
│   └── schemas.py
└── main.py                      # 应用入口

frontend/
├── tests/
│   └── e2e/
│       └── retirement_flow.spec.ts  # E2E 测试
└── src/
    └── services/
        └── retirementService.ts
```

---

## 6. 状态机完整定义

### 6.1 状态转换规则表

| 当前状态 | 允许转换 | 触发事件 | 目标状态 | 权限要求 |
|----------|----------|----------|----------|----------|
| DRAFT | PENDING_APPROVAL | submit | 提交 | OWNER |
| DRAFT | CANCELLED | cancel | 取消 | OWNER |
| PENDING_APPROVAL | APPROVED | approve | 批准 | APPROVER |
| PENDING_APPROVAL | REJECTED | reject | 驳回 | APPROVER |
| PENDING_APPROVAL | CANCELLED | withdraw | 撤回 | OWNER |
| APPROVED | RETIRED | execute | 执行退役 | SYSTEM |
| REJECTED | DRAFT | revise | 修订重提 | OWNER |

### 6.2 领域事件

```python
class RetirementDomainEvent(str, Enum):
    """资产退役领域事件"""
    APPLICATION_CREATED = "retirement.application.created"
    APPLICATION_SUBMITTED = "retirement.application.submitted"
    APPLICATION_APPROVED = "retirement.application.approved"
    APPLICATION_REJECTED = "retirement.application.rejected"
    APPLICATION_WITHDRAWN = "retirement.application.withdrawn"
    ASSET_RETIRED = "asset.retired"
    ASSET_STATUS_CHANGED = "asset.status.changed"
```

---

## 7. API 接口规范

### 7.1 退役申请接口

#### 创建退役申请
```
POST /api/v1/assets/{asset_id}/retirement
Request:
{
  "reason": "设备老旧需报废",
  "planned_retirement_date": "2025-03-01",
  "description": "使用年限超过10年"
}
Response: 201 Created
{
  "application_id": "ret-xxx",
  "status": "DRAFT",
  "asset_id": "asset-xxx",
  "created_at": "2025-01-20T10:00:00Z"
}
```

#### 提交退役申请
```
PUT /api/v1/retirement/{id}/submit
Response: 200 OK
{
  "status": "PENDING_APPROVAL",
  "submitted_at": "2025-01-20T10:30:00Z"
}
```

#### 审批退役申请
```
POST /api/v1/retirement/{id}/approve
Request:
{
  "comment": "同意退役",
  "effective_date": "2025-02-28"
}
Response: 200 OK
{
  "status": "APPROVED"
}
```

#### 执行退役
```
PUT /api/v1/retirement/{id}/execute
Response: 200 OK
{
  "status": "RETIRED",
  "asset_status": "RETIRED"
}
```

---

## 8. 错误码定义

| 错误码 | 描述 | HTTP 状态 |
|--------|------|-----------|
| RETIRED_ASSET_NOT_ALLOWED | 非活跃资产不允许发起退役 | 400 |
| DUPLICATE_APPLICATION_EXISTS | 重复退役申请 | 409 |
| INVALID_STATE_TRANSITION | 非法状态转换 | 422 |
| INSUFFICIENT_PERMISSION | 权限不足 | 403 |
| APPLICATION_NOT_FOUND | 申请不存在 | 404 |
| ASSET_NOT_FOUND | 资产不存在 | 404 |

---

## 9. 附录

### 9.1 参考文档
- [状态机设计模式](../architecture/state-machine-pattern.md)
- [审批链路设计](../architecture/approval-chain-design.md)
- [审计日志规范](../security/audit-logging.md)

### 9.2 修改历史
| 版本 | 日期 | 作者 | 描述 |
|------|------|------|------|
| v1.0 | 2025-01-20 | - | 初始版本 |

---

*文档版本: v1.0 | 对应迭代: Iteration 1 | 最后更新: 2025-01-20*