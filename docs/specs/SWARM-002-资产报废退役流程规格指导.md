# SWARM-002 资产报废/退役流程 规格指导文档

```yaml
spec_id: SWARM-002
spec_title: 资产报废/退役流程 - 状态流转与审批链机制
spec_version: 1.0.0
iteration: 1
parent_context:
  - lifecycle_recorder: backend/src/main/java/com/ams/service/LifecycleRecorder.java
  - related_services:
      - backend/src/main/java/com/ams/service/RetirementService.java
      - backend/src/main/java/com/ams/service/ApprovalChainService.java
      - backend/src/main/java/com/ams/service/ApprovalService.java
  - related_models:
      - backend/src/main/java/com/ams/entity/RetirementApplication.java
      - backend/src/main/java/com/ams/entity/RetirementHistory.java
      - backend/src/main/java/com/ams/entity/ApprovalRecord.java
      - backend/src/main/java/com/ams/entity/Asset.java
  - related_tests:
      - tests/e2e/retirement_user_journey.spec.ts
      - tests/api/test_retirement_api.py
      - tests/state_machine/test_retirement_sm.py
```

---

## 需求与背景

### 业务场景

资产管理生命周期中，资产需经历「运行中」→「待报废」→「已报废」的状态流转。当前系统缺失标准化的资产退役流程，导致：

1. **状态管理混乱** - 闲置/损坏资产仍标记为「运行中」，造成资产台账失真
2. **审批流程缺失** - 报废操作无规范审批链路，存在合规风险
3. **历史追溯困难** - 报废记录未持久化，无法满足审计需求

### 核心诉求

- 为闲置或损坏资产提供标准化的退役申请入口
- 建立「申请人提交 → 审批链审核 → 状态变更」的闭环流程
- 持久化报废历史记录，支持状态追溯与审计

### 现有系统能力参考

| 组件 | 现有实现 | 本次改造点 |
|------|----------|------------|
| `RetirementService.submit_retirement_application()` | 仅创建申请记录 | 需联动 `LifecycleRecorder` 记录状态变更 |
| `ApprovalChainService` | 工作订单审批链 | 扩展支持报废审批链类型 |
| `LifecycleRecorder` | 通用生命周期记录 | 新增 `RETIREMENT` 事件类型处理 |
| `RetirementHistory` 实体 | 已存在 | 需完善字段填充逻辑 |

---

## 当前 Phase 对应实施目标

### Plan.md Phase 映射

| Plan Phase | 实施范围 | 本次 Spec 覆盖 |
|------------|----------|----------------|
| Phase 3: 核心状态机 | 资产状态定义与流转规则 | ✅ 全部 |
| Phase 4: 表单与审批 | 报废申请表单、审批链配置 | ✅ 全部 |
| Phase 5: 数据持久化 | 报废历史记录存储与查询 | ✅ 全部 |
| Phase 6: 前端交互 | 申请/审批 UI 与状态追踪 | ✅ 全部 |

### 本次迭代交付范围

```
backend/src/main/java/com/ams/
├── entity/
│   ├── RetirementApplication.java      # 报废申请实体扩展
│   ├── RetirementHistory.java           # 报废历史实体
│   └── ApprovalRecord.java              # 审批记录扩展
├── service/
│   ├── RetirementService.java           # 核心：submit_retirement_application()
│   ├── ApprovalChainService.java        # 扩展：审批链类型支持
│   └── LifecycleRecorder.java           # 核心：状态变更记录
├── controller/
│   └── RetirementController.java        # API 端点
├── dto/
│   ├── RetirementApplicationDTO.java    # 申请表单 DTO
│   ├── RetirementApproveDTO.java       # 审批操作 DTO
│   └── RetirementRejectDTO.java         # 驳回操作 DTO
└── state/
    └── RetirementState.java             # 状态枚举

frontend/src/
├── pages/Retirement/
│   ├── RetirementApplicationForm.tsx    # 申请表单页面
│   ├── RetirementApprovalPage.tsx       # 审批操作页面
│   └── RetirementHistoryPage.tsx        # 历史记录页面
└── services/
    └── retirementService.ts              # 前端 API 服务
```

### 关键服务方法清单

| 方法 | 所属服务 | 职责 | 改造要点 |
|------|----------|------|----------|
| `submit_retirement_application()` | `RetirementService` | 创建报废申请 | 联动 `LifecycleRecorder` 记录状态 |
| `approve_retirement()` | `ApprovalService` | 审批通过 | 更新资产状态为 `RETIRED` |
| `reject_retirement()` | `ApprovalService` | 审批驳回 | 更新资产状态为 `RUNNING` |
| `recordTransition()` | `LifecycleRecorder` | 生命周期记录 | 新增 `RETIREMENT` 事件处理分支 |

---

## 边界约束

### 状态机约束

| 约束项 | 规则 |
|--------|------|
| 状态定义 | `RUNNING` / `PENDING_RETIREMENT` / `RETIRED` |
| 合法流转 | `RUNNING → PENDING_RETIREMENT` (需申请) |
|           | `PENDING_RETIREMENT → RUNNING` (审批驳回) |
|           | `PENDING_RETIREMENT → RETIRED` (审批通过) |
| 不可逆性 | `RETIRED` 状态不可回退 |
| 前置条件 | 仅 `RUNNING` 状态资产可发起报废申请 |

### 审批链约束

| 角色 | 权限 |
|------|------|
| 申请人 | 仅能提交本人关联资产的报废申请 |
| 一级审批 | 可执行「通过」或「驳回」操作 |
| 二级审批 | 一级通过后执行「最终通过」或「驳回」操作 |
| 驳回后状态 | 资产恢复 `RUNNING`，申请人可重新发起 |

### 表单约束

| 字段 | 类型 | 约束 |
|------|------|------|
| asset_id | UUID | 必填，引用有效资产 |
| retirement_reason | Text | 必填，≥10 字符，≤500 字符 |
| supporting_docs | File[] | 可选，最多 3 个附件，单个 ≤10MB |
| estimated_value | Decimal | 可选，报废资产估值 |

### 数据持久化约束

| 表名 | 用途 |
|------|------|
| `retirement_application` | 报废申请主记录 |
| `approval_record` | 审批链路记录 |
| `lifecycle_history` | 资产状态变更历史 |
| `retirement_history` | 报废历史快照 |

---

## 验收测试基准 (ATB)

### ATB-001: 状态机流转测试

```java
// RetirementStateMachineTest.java
@Test
void test_retirement_status_transitions() {
    /**
     * ATB-001 物理测试期待
     * 1. 新建资产默认状态为 RUNNING
     * 2. 提交报废申请后状态变为 PENDING_RETIREMENT
     * 3. 审批通过后状态变为 RETIRED
     * 4. 审批驳回后状态恢复 RUNNING
     */
    Asset asset = assetService.create("测试资产");
    assertEquals(AssetStatus.RUNNING, asset.getStatus());
    
    RetirementApplication request = retirementService.submit_retirement_application(
        asset.getId(), "设备损坏需报废");
    assertEquals(AssetStatus.PENDING_RETIREMENT, asset.getStatus());
    
    approvalService.approve(request.getId(), ApprovalLevel.LEVEL_1);
    approvalService.approve(request.getId(), ApprovalLevel.LEVEL_2);
    assertEquals(AssetStatus.RETIRED, asset.getStatus());
}

@Test
void test_retired_state_immutable() {
    /**
     * ATB-001.1 物理测试期待
     * - 已报废资产不可再次发起报废申请
     * - 已报废资产状态不可被强制修改
     */
    Asset retiredAsset = getRetiredAsset();
    
    assertThrows(InvalidStateTransitionException.class, () -> {
        retirementService.submit_retirement_application(
            retiredAsset.getId(), "再次申请");
    });
}
```

### ATB-002: 报废申请表单验证测试

```java
// RetirementServiceTest.java
@Test
void test_retirement_request_form_validation() {
    /**
     * ATB-002 物理测试期待
     * 1. asset_id 为空 → 返回 400 错误
     * 2. retirement_reason 长度 < 10 → 返回 400 错误
     * 3. retirement_reason 长度 > 500 → 返回 400 错误
     * 4. 附件数量 > 3 → 返回 400 错误
     * 5. 单个附件 > 10MB → 返回 400 错误
     * 6. 引用不存在的 asset_id → 返回 404 错误
     */
    
    // invalid: missing asset_id
    ValidationResult result = validator.validate(
        RetirementApplicationDTO.builder()
            .reason("设备损坏")
            .build());
    assertFalse(result.isValid());
    assertEquals("asset_id.required", result.getErrorCode());
    
    // invalid: reason too short
    result = validator.validate(
        RetirementApplicationDTO.builder()
            .assetId("valid-uuid")
            .reason("损坏")
            .build());
    assertFalse(result.isValid());
    assertEquals("reason.length.invalid", result.getErrorCode());
}
```

### ATB-003: 审批链机制测试

```java
// ApprovalChainServiceTest.java
@Test
void test_approval_chain_flow() {
    /**
     * ATB-003 物理测试期待
     * 1. 一级审批未通过时，二级审批入口不可用
     * 2. 驳回操作需记录驳回原因
     * 3. 驳回后资产状态恢复 RUNNING
     * 4. 驳回后申请人可重新发起申请
     */
    RetirementApplication request = createPendingRequest();
    
    // Level 1 reject
    ApprovalResult result = approvalChainService.reject(
        request.getId(), 
        ApprovalLevel.LEVEL_1, 
        "需要补充资料");
    assertTrue(result.isSuccess());
    assertEquals(AssetStatus.RUNNING, request.getAsset().getStatus());
    
    // Re-submit allowed
    RetirementApplication newRequest = retirementService.submit_retirement_application(
        request.getAsset().getId(), "补充资料后重新申请");
    assertNotEquals(request.getId(), newRequest.getId());
}

@Test
void test_approval_sequence_enforcement() {
    /**
     * ATB-003.1 物理测试期待
     * - 跳过一级直接二级审批 → 返回 403 错误
     * - 已通过的审批级别不可重复操作 → 返回 409 错误
     */
    RetirementApplication request = createPendingRequest();
    
    // Try level 2 first
    assertThrows(ForbiddenException.class, () -> {
        approvalChainService.approve(request.getId(), ApprovalLevel.LEVEL_2);
    });
    
    // After level 1 approved, try approving again
    approvalChainService.approve(request.getId(), ApprovalLevel.LEVEL_1);
    assertThrows(ConflictException.class, () -> {
        approvalChainService.approve(request.getId(), ApprovalLevel.LEVEL_1);
    });
}
```

### ATB-004: 历史记录持久化测试

```java
// LifecycleRecorderTest.java
@Test
void test_retirement_history_persistence() {
    /**
     * ATB-004 物理测试期待
     * 1. 报废完成后，retirement_history 表存在对应记录
     * 2. lifecycle_history 表记录完整的状态变更时间戳
     * 3. approval_record 表记录每个审批节点的操详情
     */
    Asset asset = createAndRetireAsset();
    
    // Verify retirement history
    RetirementHistory history = retirementHistoryRepository
        .findByAssetId(asset.getId())
        .orElseThrow();
    assertNotNull(history.getRetiredAt());
    assertEquals("设备老化无法修复", history.getRetirementReason());
    
    // Verify lifecycle history
    List<LifecycleHistory> statuses = lifecycleHistoryRepository
        .findByAssetIdOrderByCreatedAt(asset.getId());
    assertEquals(3, statuses.size());
    assertEquals(List.of("RUNNING", "PENDING_RETIREMENT", "RETIRED"), 
        statuses.stream().map(LifecycleHistory::getToStatus).toList());
    
    // Verify approval chain
    List<ApprovalRecord> approvals = approvalRecordRepository
        .findByRequestId(history.getRequestId());
    assertEquals(2, approvals.size()); // Level 1 + Level 2
}
```

### ATB-005: 前端交互集成测试

```typescript
// retirement_user_journey.spec.ts
test('ATB-005: 用户完成完整的报废申请与审批流程', async ({ page }) => {
  /**
   * ATB-005 物理测试期待
   * 场景: 用户完成完整的报废申请与审批流程
   * 1. 登录系统，进入资产列表页
   * 2. 选择目标资产，点击「申请报废」按钮
   * 3. 填写报废原因，提交申请
   * 4. 页面显示申请已提交，状态为「待审批」
   * 5. 审批人登录，进入审批页面
   * 6. 审批人通过一级、二级审批
   * 7. 申请人查看资产状态已变更为「已报废」
   */
  
  // 申请人操作
  await page.goto('/assets');
  await page.click('[data-testid="asset-row"] [data-testid="btn-retire"]');
  await page.fill(
    '[data-testid="retirement-reason"]', 
    '设备老化，无法修复，需报废处理'
  );
  await page.click('[data-testid="btn-submit-retirement"]');
  
  // Assert pending status
  await expect(page.locator('[data-testid="asset-status"]'))
    .toHaveText('待报废');
  
  // 审批人操作
  await page.goto('/approvals');
  await page.click('[data-testid="approval-item"]:first-child');
  await page.click('[data-testid="btn-approve-level1"]');
  await page.click('[data-testid="btn-approve-level2"]');
  
  // Verify final status
  await page.goto('/assets');
  await expect(page.locator('[data-testid="asset-status"]'))
    .toHaveText('已报废');
});
```

---

## 开发切入层级序列

### Phase 1: 数据模型层 (Day 1)

```
backend/src/main/java/com/ams/entity/
├── RetirementApplication.java      # 扩展申请实体
├── RetirementHistory.java          # 完善历史实体
├── ApprovalRecord.java             # 扩展审批记录
└── Asset.java                      # 添加 status 字段映射
```

**关键实现点**:

1. `RetirementApplication` 新增字段:
   - `asset_id` (FK)
   - `retirement_reason`
   - `estimated_value`
   - `supporting_doc_urls`

2. `RetirementHistory` 新增字段:
   - `retired_by`
   - `retired_at`
   - `retirement_reason`

### Phase 2: 服务层核心逻辑 (Day 2-3)

```
backend/src/main/java/com/ams/service/
├── RetirementService.java          # 核心业务逻辑
├── ApprovalChainService.java       # 审批链扩展
└── LifecycleRecorder.java          # 生命周期记录
```

**关键实现点**:

1. `RetirementService.submit_retirement_application()`:
   ```java
   public RetirementApplication submit_retirement_application(
       String assetId, 
       String reason
   ) {
       // 1. 验证资产状态为 RUNNING
       // 2. 创建 RetirementApplication 记录
       // 3. 调用 LifecycleRecorder 记录状态变更
       // 4. 触发审批链初始化
       // 5. 返回申请记录
   }
   ```

2. `LifecycleRecorder` 扩展:
   ```java
   public void recordTransition(
       Asset asset,
       String fromStatus,
       String toStatus,
       RetirementEvent event  // 新增事件类型
   ) {
       // 处理 RETIREMENT 类型事件
   }
   ```

### Phase 3: API 路由层 (Day 3-4)

```
backend/src/main/java/com/ams/controller/
└── RetirementController.java       # REST API 端点

backend/src/main/java/com/ams/dto/
├── RetirementApplicationDTO.java
├── RetirementApproveDTO.java
└── RetirementRejectDTO.java
```

**API 端点清单**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/retirement/apply` | 提交报废申请 |
| GET | `/api/v1/retirement/{id}` | 查询申请详情 |
| POST | `/api/v1/retirement/{id}/approve` | 审批通过 |
| POST | `/api/v1/retirement/{id}/reject` | 审批驳回 |
| GET | `/api/v1/retirement/history/{assetId}` | 查询报废历史 |

### Phase 4: 前端界面层 (Day 4-6)

```
frontend/src/
├── pages/Retirement/
│   ├── RetirementApplicationForm.tsx
│   ├── RetirementApprovalPage.tsx
│   └── RetirementHistoryPage.tsx
└── services/
    └── retirementService.ts
```

### Phase 5: 集成测试与修复 (Day 7)

```
tests/
├── unit/
│   ├── RetirementServiceTest.java
│   ├── ApprovalChainServiceTest.java
│   └── LifecycleRecorderTest.java
├── integration/
│   └── RetirementIntegrationTest.java
└── e2e/
    └── retirement_user_journey.spec.ts
```

---

## 附录

### A. 状态机状态图

```
                    ┌─────────────────┐
                    │     RUNNING     │
                    │    (运行中)      │
                    └────────┬────────┘
                             │
              submit_retirement_application()
                             │
                             ▼
                    ┌─────────────────────┐
                    │ PENDING_RETIREMENT  │
                    │     (待报废)         │
                    └──────────┬──────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │                                     │
    reject(level=1 or 2)                  approve(level=1 & 2)
            │                                     │
            ▼                                     ▼
    ┌───────────────┐                   ┌─────────────────┐
    │    RUNNING    │                   │     RETIRED     │
    │   (恢复运行)   │                   │    (已报废)      │
    └───────────────┘                   └─────────────────┘
                                                │
                                                │
                                         [不可逆状态]
```

### B. 审批链流程图

```
申请人提交
    │
    ▼
┌────────────────────────────────────────┐
│           审批链初始化                   │
│  pending_approvals = [LEVEL_1, LEVEL_2] │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│           一级审批 (LEVEL_1)             │
│  - APPROVE: 继续到 LEVEL_2             │
│  - REJECT: 审批结束，资产恢复 RUNNING    │
└────────────────┬───────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
    APPROVE            REJECT
        │                 │
        ▼                 ▼
┌───────────────┐  ┌──────────────────┐
│二级审批(LEVEL_2)│  │ 资产恢复 RUNNING │
│- APPROVE: 完成 │  │ 申请人可重新发起  │
│- REJECT: 恢复  │  └──────────────────┘
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ 资产状态变更为 │
│ RETIRED       │
│ 记录历史      │
└───────────────┘
```

### C. 生命周期事件类型扩展

```java
// LifecycleEvent.java 扩展
public enum LifecycleEvent {
    // 现有事件...
    ASSET_CREATED,
    ASSET_TRANSFERRED,
    ASSET_MAINTENANCE,
    
    // 新增报废相关事件
    RETIREMENT_APPLICATION_SUBMITTED,
    RETIREMENT_LEVEL_1_APPROVED,
    RETIREMENT_LEVEL_1_REJECTED,
    RETIREMENT_LEVEL_2_APPROVED,
    RETIREMENT_LEVEL_2_REJECTED,
    RETIREMENT_COMPLETED
}
```

### D. 关键文件修改清单

| 文件路径 | 修改类型 | 修改说明 |
|----------|----------|----------|
| `backend/src/main/java/com/ams/service/LifecycleRecorder.java` | 扩展 | 新增 `RETIREMENT` 事件处理 |
| `backend/src/main/java/com/ams/service/RetirementService.java` | 扩展 | 完善 `submit_retirement_application()` |
| `backend/src/main/java/com/ams/service/ApprovalChainService.java` | 扩展 | 支持报废审批链类型 |
| `backend/src/main/java/com/ams/entity/RetirementApplication.java` | 扩展 | 添加关联关系和字段 |
| `backend/src/main/java/com/ams/entity/RetirementHistory.java` | 完善 | 字段填充逻辑 |
| `tests/e2e/retirement_user_journey.spec.ts` | 新增 | E2E 测试覆盖 |
| `tests/api/test_retirement_api.py` | 扩展 | API 集成测试 |
| `tests/state_machine/test_retirement_sm.py` | 新增 | 状态机专项测试 |

---

*文档版本: 1.0.0 | 创建日期: 2024 | 状态: 审核通过*