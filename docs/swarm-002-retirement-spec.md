# SWARM-002 资产报废退役流程规格指导文档

**Iteration: 7**  
**Last Updated: 2024**  
**Status: APPROVED**

---

## 1. 需求与背景

### 1.1 业务需求

资产报废退役流程是固定资产全生命周期管理的终点环节。当前系统缺少标准化的资产退役机制，导致以下业务痛点：

| 痛点编号 | 痛点描述 | 业务影响 |
|----------|----------|----------|
| P-001 | 资产物理已报废但系统仍显示"在用"状态 | 资产账实不符，管理层决策依据失真 |
| P-002 | 资产处置缺乏合规审批链路 | 合规风险，无法追溯处置授权 |
| P-003 | 无法追踪资产从采购到报废的完整历史 | 审计追溯困难，历史状态不可查 |
| P-004 | 闲置/报废资产占用库位和账面价值 | 资源浪费，财务报表失准 |

### 1.2 技术目标

构建一个可配置的状态流转引擎，支持多级审批链路的资产报废申请流程，并将所有状态变更操作持久化为可审计的历史记录。

**核心能力矩阵**：

| 能力域 | 能力项 | 优先级 |
|--------|--------|--------|
| 状态管理 | 资产状态流转引擎 | P0 |
| 审批流程 | 报废申请多级审批链 | P0 |
| 审计追溯 | 历史记录持久化 | P0 |
| 并发控制 | 防重复申请机制 | P1 |
| 权限控制 | 角色基访问控制 | P1 |

### 1.3 假设条件

- 数据库采用 PostgreSQL 12+
- 后端框架采用 Spring Boot 3.x + MyBatis-Plus
- 前端采用 React 18 + TypeScript
- 认证机制采用 JWT Token

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 映射

根据系统架构规划，本任务对应 **Phase 3: 核心业务逻辑实现**。

```
Phase 1: 数据模型设计 ✓
Phase 2: 持久化层实现 ✓
Phase 3: 核心业务逻辑 ← 当前
Phase 4: API 层暴露
Phase 5: 前端集成
```

### 2.2 本次交付物清单

| 交付物 | 类/模块路径 | 职责描述 | 验收条件 |
|--------|-------------|----------|----------|
| D-001 | `AssetStateEngine` | 资产状态流转引擎类 | 支持预定义状态转换规则校验 |
| D-002 | `RetirementRequestService` | 报废申请服务 | 支撑创建、审批、驳回、撤销完整链路 |
| D-003 | `AssetHistoryRepository` | 历史记录仓储 | 实现 CRUD + 状态变更快照 |
| D-004 | `RetirementApprovalWorkflow` | 审批工作流组件 | 支持多级串行审批配置 |
| D-005 | `ApprovalChainResolver` | 审批链解析器 | 动态解析角色层级审批链 |

### 2.3 不在本次范围内

- **API 层暴露**：Phase 4 任务，本次不暴露 REST API
- **前端页面**：Phase 5 任务，本次不涉及 UI 组件
- **异步消息通知**：可预留接口但暂不实现
- **定时任务**：报废超期提醒等不在本次范围

---

## 3. 边界约束

### 3.1 业务约束

| 约束编号 | 约束类型 | 约束内容 | 违反后果 |
|----------|----------|----------|----------|
| C-001 | 状态机约束 | 资产状态仅允许按预定义规则流转，禁止跨状态跳跃 | 抛出 `StateTransitionException` |
| C-002 | 审批约束 | 报废申请必须通过完整审批链后才能变更资产状态 | 状态变更事务回滚 |
| C-003 | 权限约束 | 仅 `MANAGER` 及以上角色可发起报废申请 | 抛出 `PermissionDeniedException` |
| C-004 | 不可逆约束 | 已进入"审批中"的申请不允许删除，只允许撤销或完成 | 抛出 `ImmutableRequestException` |
| C-005 | 数据完整性 | 每次状态变更必须同时写入历史记录，不允许孤立状态 | 事务回滚 + 告警 |
| C-006 | 并发约束 | 同一资产同时仅允许一个处于"审批中"的报废申请 | 抛出 `DuplicatePendingRequestError` |
| C-007 | 保留约束 | 审批驳回后的申请记录必须保留，状态变更为"已驳回" | 不可物理删除 |

### 3.2 技术约束

| 约束编号 | 约束类型 | 约束内容 |
|----------|----------|----------|
| T-001 | 数据库 | PostgreSQL 12+ |
| T-002 | ORM | MyBatis-Plus 3.5+ |
| T-003 | 事务 | 所有状态变更操作必须包裹在事务内 |
| T-004 | 编码 | UTF-8，UTF-8MB4 for TEXT 字段 |
| T-005 | 审计字段 | 必须包含 `created_at`, `updated_at`, `operator_id` |

### 3.3 状态转换规则矩阵

```
┌─────────────────┬────────────────────────┬──────────────────────────────────┐
│ 当前状态        │ 可转换至               │ 触发条件                          │
├─────────────────┼────────────────────────┼──────────────────────────────────┤
│ IN_USE          │ PENDING_RETIREMENT     │ 报废申请创建成功                  │
│ PENDING_RETIREMENT │ RETIRED             │ 审批链全部通过                    │
│ PENDING_RETIREMENT │ IN_USE             │ 审批驳回 OR 申请人撤销            │
│ RETIRED         │ (禁止)                 │ 不可逆状态                        │
└─────────────────┴────────────────────────┴──────────────────────────────────┘
```

### 3.4 审批链配置（默认）

```yaml
approval_chain:
  name: "默认报废审批链"
  levels:
    - level: 1
      role: DIRECTOR
      required: true
      description: "部门总监审批"
    - level: 2
      role: CFO
      required: true
      description: "财务总监审批"
```

---

## 4. 验收测试基准 (ATB)

### 4.1 测试概览

| ATB 编号 | 测试类型 | 测试目标 | 覆盖 AC |
|----------|----------|----------|---------|
| ATB-001 | 单元测试 | 合法状态转换验证 | AC-001 |
| ATB-002 | 单元测试 | 非法状态转换验证 | AC-001 |
| ATB-003 | 集成测试 | 报废申请创建 | AC-001, AC-004 |
| ATB-004 | 集成测试 | 审批链完整通过 | AC-001 |
| ATB-005 | 集成测试 | 审批驳回 | AC-001 |
| ATB-006 | 单元测试 | 历史记录自动创建 | AC-001 |
| ATB-007 | 集成测试 | 历史记录不可变性 | AC-001 |
| ATB-008 | 集成测试 | 并发申请检测 | AC-001 |
| ATB-009 | E2E 测试 | 完整流程端到端 | AC-001 |

### 4.2 单元测试用例

#### ATB-001: 合法状态转换验证

```java
// backend/src/test/java/com/ams/service/AssetStateEngineTest.java
package com.ams.service;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AssetStateEngineTest {

    @Test
    void testValidTransition_InUseToPendingRetirement() {
        // Given: 资产当前状态为 IN_USE
        AssetStateEngine engine = new AssetStateEngine();
        String assetId = "A001";
        
        // When: 执行状态转换
        boolean result = engine.canTransition(assetId, 
            AssetStatus.IN_USE, 
            RetirementEvent.INITIATE_RETIREMENT);
        
        // Then: 转换合法
        assertTrue(result, "在用 -> 待审批 应该是合法转换");
    }

    @Test
    void testValidTransition_PendingToRetired() {
        // Given: 资产当前状态为 PENDING_RETIREMENT
        AssetStateEngine engine = new AssetStateEngine();
        String assetId = "A001";
        
        // When: 执行状态转换
        boolean result = engine.canTransition(assetId,
            AssetStatus.PENDING_RETIREMENT,
            RetirementEvent.APPROVAL_COMPLETED);
        
        // Then: 转换合法
        assertTrue(result, "待审批 -> 已报废 应该是合法转换");
    }
}
```

**物理预期**：
```bash
$ cd backend && mvn test -Dtest=AssetStateEngineTest#testValidTransition*
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

#### ATB-002: 非法状态转换验证

```java
@Test
void testInvalidTransition_InUseToRetiredDirect() {
    // Given
    AssetStateEngine engine = new AssetStateEngine();
    
    // When: 尝试直接跳转（跳过审批）
    boolean result = engine.canTransition("A001",
        AssetStatus.IN_USE,
        RetirementEvent.APPROVAL_COMPLETED);
    
    // Then: 应该被拒绝
    assertFalse(result, "在用 -> 已报废 直接跳转应该被拒绝");
}

@Test
void testInvalidTransition_RetiredToInUse() {
    // Given
    AssetStateEngine engine = new AssetStateEngine();
    
    // When: 尝试反向跳转
    boolean result = engine.canTransition("A001",
        AssetStatus.RETIRED,
        RetirementEvent.REACTIVATE);
    
    // Then: 应该被拒绝（RETIRED 是终态）
    assertFalse(result, "已报废 -> 在用 反向跳转应该被拒绝");
}
```

**物理预期**：
```bash
$ mvn test -Dtest=AssetStateEngineTest#testInvalidTransition*
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0
```

### 4.3 集成测试用例

#### ATB-003: 报废申请创建

```java
// backend/src/test/java/com/ams/service/RetirementRequestServiceTest.java
@Test
void testCreateRetirementRequest_Success() {
    // Given: Manager 角色的用户
    User manager = userRepository.findByRole("MANAGER");
    Asset asset = assetRepository.findById("A001");
    assertEquals(AssetStatus.IN_USE, asset.getStatus());
    
    RetirementApplicationDTO dto = RetirementApplicationDTO.builder()
        .assetId("A001")
        .reason("设备老化无法修复")
        .expectedDate(LocalDate.now().plusDays(30))
        .build();
    
    // When: 创建报废申请
    RetirementRequest request = retirementRequestService.create(
        dto, manager.getId());
    
    // Then: 申请状态为 PENDING_APPROVAL
    assertNotNull(request.getId());
    assertEquals(RequestStatus.PENDING_APPROVAL, request.getStatus());
    
    // And: 资产状态变更为 PENDING_RETIREMENT
    Asset updatedAsset = assetRepository.findById("A001");
    assertEquals(AssetStatus.PENDING_RETIREMENT, updatedAsset.getStatus());
    
    // And: 创建了历史记录
    AssetHistory history = assetHistoryRepository.findLatestByAssetId("A001");
    assertEquals(AssetStatus.IN_USE, history.getFromStatus());
    assertEquals(AssetStatus.PENDING_RETIREMENT, history.getToStatus());
}
```

**物理预期**：
```bash
$ mvn test -Dtest=RetirementRequestServiceTest#testCreateRetirementRequest_Success
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
```

#### ATB-004: 审批链完整通过

```java
@Test
void testApprovalChain_CompleteFlow() {
    // Given: 一个待审批的报废申请
    RetirementRequest request = createPendingRequest("A001");
    
    // When: 第一级审批（DIRECTOR 通过）
    ApprovalResult result1 = retirementApprovalWorkflow.approve(
        request.getId(), "director_001", 1, "同意报废");
    assertTrue(result1.isLevelCompleted());
    assertEquals(1, result1.getCompletedLevels());
    
    // And: 第二级审批（CFO 通过）
    ApprovalResult result2 = retirementApprovalWorkflow.approve(
        request.getId(), "cfo_001", 2, "财务确认");
    assertTrue(result2.isCompleted());
    assertEquals(2, result2.getCompletedLevels());
    
    // Then: 资产状态变更为 RETIRED
    Asset asset = assetRepository.findById(request.getAssetId());
    assertEquals(AssetStatus.RETIRED, asset.getStatus());
    
    // And: 申请状态变更为 APPROVED
    RetirementRequest updatedRequest = retirementRequestRepository.findById(request.getId());
    assertEquals(RequestStatus.APPROVED, updatedRequest.getStatus());
}
```

**物理预期**：
```bash
$ mvn test -Dtest=RetirementRequestServiceTest#testApprovalChain_CompleteFlow
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
```

#### ATB-005: 审批驳回

```java
@Test
void testApproval_Rejection() {
    // Given: 一个待审批的报废申请
    RetirementRequest request = createPendingRequest("A001");
    
    // When: DIRECTOR 驳回
    ApprovalResult result = retirementApprovalWorkflow.reject(
        request.getId(), "director_001", 1, "报废理由不充分");
    
    // Then: 申请状态为 REJECTED
    assertEquals(RequestStatus.REJECTED, result.getRequestStatus());
    
    // And: 资产状态恢复为 IN_USE
    Asset asset = assetRepository.findById(request.getAssetId());
    assertEquals(AssetStatus.IN_USE, asset.getStatus());
    
    // And: 历史记录显示状态回滚
    AssetHistory history = assetHistoryRepository.findLatestByAssetId(request.getAssetId());
    assertEquals(AssetStatus.PENDING_RETIREMENT, history.getFromStatus());
    assertEquals(AssetStatus.IN_USE, history.getToStatus());
}
```

#### ATB-006: 历史记录自动创建

```java
@Test
void testHistory_AutoCreatedOnStateChange() {
    // Given: 资产初始状态为 IN_USE
    String assetId = "A001";
    long initialCount = assetHistoryRepository.countByAssetId(assetId);
    
    // When: 执行状态转换
    assetStateEngine.transition(assetId, 
        AssetStatus.IN_USE, 
        RetirementEvent.INITIATE_RETIREMENT);
    
    // Then: 自动创建历史记录
    long newCount = assetHistoryRepository.countByAssetId(assetId);
    assertEquals(initialCount + 1, newCount);
    
    AssetHistory latest = assetHistoryRepository.findLatestByAssetId(assetId);
    assertNotNull(latest.getId());
    assertNotNull(latest.getChangeTime());
    assertNotNull(latest.getOperatorId());
    assertEquals(AssetStatus.IN_USE, latest.getFromStatus());
    assertEquals(AssetStatus.PENDING_RETIREMENT, latest.getToStatus());
}
```

#### ATB-007: 历史记录不可变性

```java
@Test
void testHistory_Immutability() {
    // Given: 已存在的历史记录
    AssetHistory history = assetHistoryRepository.findLatestByAssetId("A001");
    Long originalId = history.getId();
    
    // When/Then: 尝试修改应该抛出异常
    assertThrows(ImmutableRecordException.class, () -> {
        history.setToStatus(AssetStatus.IN_USE);
        assetHistoryRepository.update(history);
    });
}
```

#### ATB-008: 并发申请检测

```java
@Test
void testConcurrentRequest_Prevention() {
    // Given: 同一资产已有一个 PENDING_APPROVAL 的申请
    createPendingRequest("A001");
    
    // When/Then: 尝试创建第二个申请应该被拒绝
    assertThrows(DuplicatePendingRequestException.class, () -> {
        RetirementApplicationDTO dto = RetirementApplicationDTO.builder()
            .assetId("A001")
            .reason("另一个报废原因")
            .build();
        retirementRequestService.create(dto, "manager_002");
    });
}
```

### 4.4 E2E 测试用例

#### ATB-009: 完整流程端到端

```typescript
// frontend/tests/e2e/retirement_flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('资产报废退役完整流程', () => {
  
  test('端到端报废申请-审批流程', async ({ page }) => {
    // Step 1: Manager 登录
    await page.goto('/login');
    await page.fill('[data-testid="input-username"]', 'manager@test.com');
    await page.fill('[data-testid="input-password"]', 'password');
    await page.click('[data-testid="btn-login"]');
    
    // Step 2: 进入资产详情页
    await page.goto('/assets/A001');
    await expect(page.locator('[data-testid="asset-status"]')).toHaveText('在用');
    
    // Step 3: 点击发起报废
    await page.click('[data-testid="btn-retire-asset"]');
    
    // Step 4: 填写报废申请表单
    await page.fill('[data-testid="input-reason"]', '设备老化无法修复');
    await page.fill('[data-testid="input-expected-date"]', '2024-12-31');
    await page.click('[data-testid="btn-submit-retirement"]');
    
    // Step 5: 验证状态变为待审批
    await expect(page.locator('[data-testid="asset-status"]')).toHaveText('待审批');
    
    // Step 6: 切换到 Director 账号审批
    await page.click('[data-testid="btn-logout"]');
    await page.goto('/login');
    await page.fill('[data-testid="input-username"]', 'director@test.com');
    await page.fill('[data-testid="input-password"]', 'password');
    await page.click('[data-testid="btn-login"]');
    
    // Step 7: 进入审批列表
    await page.goto('/retirement-requests/pending');
    await page.click('[data-testid="btn-approve-001"]');
    await page.fill('[data-testid="input-comment"]', '同意');
    await page.click('[data-testid="btn-confirm-approve"]');
    
    // Step 8: 切换到 CFO 账号
    await page.click('[data-testid="btn-logout"]');
    await page.goto('/login');
    await page.fill('[data-testid="input-username"]', 'cfo@test.com');
    await page.fill('[data-testid="input-password"]', 'password');
    await page.click('[data-testid="btn-login"]');
    
    // Step 9: CFO 最终审批
    await page.goto('/retirement-requests/pending');
    await page.click('[data-testid="btn-approve-001"]');
    await page.click('[data-testid="btn-confirm-approve"]');
    
    // Step 10: 验证最终状态为已报废
    await page.goto('/assets/A001');
    await expect(page.locator('[data-testid="asset-status"]')).toHaveText('已报废');
    
    // Step 11: 验证历史记录
    await page.click('[data-testid="tab-history"]');
    await expect(page.locator('[data-testid="history-item"]').first()).toContainText('已报废');
  });
});
```

**物理预期**：
```bash
$ cd frontend && npx playwright test tests/e2e/retirement_flow.spec.ts
✓ 1 passed (15.3s)
```

---

## 5. 开发切入层级序列

### 5.1 依赖层级图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Phase 3 开发序列                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Layer 0: 数据模型                                                           │
│  ┌──────────────────┐                                                       │
│  │ RetirementRequest│                                                       │
│  │ AssetHistory     │                                                       │
│  │ ApprovalStep     │                                                       │
│  └────────┬─────────┘                                                       │
│           │ 依赖                                                             │
│           ▼                                                                 │
│  Layer 1: 仓储层                                                            │
│  ┌──────────────────┐                                                       │
│  │ RetirementRequest│                                                      │
│  │ Repository       │                                                       │
│  │ AssetHistory     │                                                       │
│  │ Repository       │                                                       │
│  └────────┬─────────┘                                                       │
│           │ 依赖                                                             │
│           ▼                                                                 │
│  Layer 2: 业务逻辑层                                                         │
│  ┌──────────────────┐                                                       │
│  │ AssetStateEngine │                                                       │
│  └────────┬─────────┘                                                       │
│           │ 依赖                                                             │
│           ▼                                                                 │
│  Layer 3: 服务层                                                            │
│  ┌──────────────────────────────┐                                          │
│  │ RetirementRequestService    │                                          │
│  └────────┬─────────────────────┘                                          │
│           │ 依赖                                                             │
│           ▼                                                                 │
│  Layer 4: 工作流层                                                          │
│  ┌──────────────────────────────┐                                          │
│  │ RetirementApprovalWorkflow │                                          │
│  │ ApprovalChainResolver      │                                          │
│  └────────┬─────────────────────┘                                          │
│           │ 依赖                                                             │
│           ▼                                                                 │
│  Layer 5: 集成测试                                                          │
│  ┌──────────────────────────────┐                                          │
│  │ Integration Tests          │                                          │
│  │ E2E Tests                   │                                          │
│  └──────────────────────────────┘                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 详细开发任务序列

| 步骤 | 层级 | 模块 | 任务描述 | 前置依赖 | 工时预估 |
|------|------|------|----------|----------|----------|
| 3.1 | Layer 0 | 数据模型 | 定义 `RetirementRequest` 实体类（status 枚举、reason、applicantId、timestamps） | 无 | 0.5d |
| 3.2 | Layer 0 | 数据模型 | 定义 `AssetHistory` 实体类（assetId、fromStatus、toStatus、operatorId、changeTime、metadata JSON） | 无 | 0.5d |
| 3.3 | Layer 0 | 数据模型 | 定义 `ApprovalStep` 实体类（requestId、level、approverId、status、decidedAt、comment） | 3.1 | 0.5d |
| 3.4 | Layer 1 | 仓储 | 实现 `AssetHistoryRepository`（CRUD + 按资产ID查询 + 按时间范围查询 + 分页） | 3.2 | 1d |
| 3.5 | Layer 1 | 仓储 | 实现 `RetirementRequestRepository`（创建/更新/查询/复合条件查询/分页） | 3.1, 3.3 | 1d |
| 3.6 | Layer 2 | 业务逻辑 | 实现 `AssetStateEngine.canTransition()` 状态转换规则校验 | 3.1 | 1d |
| 3.7 | Layer 2 | 业务逻辑 | 实现 `AssetStateEngine.transition()` 含历史记录写入事务 | 3.4, 3.6 | 1d |
| 3.8 | Layer 2 | 业务逻辑 | 实现 `AssetStateEngine.getAvailableTransitions()` 获取可转换状态列表 | 3.6 | 0.5d |
| 3.9 | Layer 3 | 服务层 | 实现 `RetirementRequestService.create()` 含并发校验 | 3.5, 3.7 | 1d |
| 3.10 | Layer 3 | 服务层 | 实现 `RetirementRequestService.cancel()` 申请人撤销 | 3.5 | 0.5d |
| 3.11 | Layer 4 | 工作流 | 实现 `RetirementApprovalWorkflow` 多级审批逻辑 | 3.9 | 1.5d |
| 3.12 | Layer 4 | 工作流 | 实现 `ApprovalChainResolver` 动态审批链解析 | 3.11 | 1d |
| 3.13 | Layer 5 | 集成测试 | 编写 `RetirementRequestServiceTest` 集成测试套件 | 3.9-3.12 | 1d |
| 3.14 | Layer 5 | E2E 测试 | 编写 `retirement_flow.spec.ts` Playwright E2E 脚本 | 3.13 | 0.5d |

**总工期预估**: 11.5 人/日

### 5.3 关键实现要点

#### 状态转换引擎核心逻辑

```java
// AssetStateEngine.java
public class AssetStateEngine {
    
    private static final Map<AssetStatus, Set<RetirementEvent>> TRANSITION_RULES = 
        Map.of(
            AssetStatus.IN_USE, Set.of(RetirementEvent.INITIATE_RETIREMENT),
            AssetStatus.PENDING_RETIREMENT, Set.of(
                RetirementEvent.APPROVAL_COMPLETED,
                RetirementEvent.REJECT,
                RetirementEvent.CANCEL
            ),
            AssetStatus.RETIRED, Set.of() // 终态，无可转换事件
        );
    
    public boolean canTransition(String assetId, AssetStatus from, RetirementEvent event) {
        Asset asset = assetRepository.findById(assetId);
        if (!asset.getStatus().equals(from)) {
            return false; // 状态不一致
        }
        
        Set<RetirementEvent> allowedEvents = TRANSITION_RULES.get(from);
        if (allowedEvents == null || !allowedEvents.contains(event)) {
            return false; // 不允许的转换
        }
        
        return true;
    }
    
    @Transactional
    public void transition(String assetId, AssetStatus from, RetirementEvent event) {
        if (!canTransition(assetId, from, event)) {
            throw new StateTransitionException(
                String.format("不允许的状态转换: %s + %s", from, event));
        }
        
        AssetStatus toStatus = calculateTargetStatus(from, event);
        Asset asset = assetRepository.findById(assetId);
        String operatorId = SecurityContext.getCurrentUserId();
        
        // 更新资产状态
        asset.setStatus(toStatus);
        asset.setUpdatedAt(LocalDateTime.now());
        assetRepository.update(asset);
        
        // 写入历史记录
        AssetHistory history = AssetHistory.builder()
            .assetId(assetId)
            .fromStatus(from)
            .toStatus(toStatus)
            .event(event)
            .operatorId(operatorId)
            .changeTime(LocalDateTime.now())
            .build();
        assetHistoryRepository.insert(history);
    }
}
```

#### 审批工作流核心逻辑

```java
// RetirementApprovalWorkflow.java
public class RetirementApprovalWorkflow {
    
    @Transactional
    public ApprovalResult approve(Long requestId, String approverId, 
                                   Integer level, String comment) {
        RetirementRequest request = retirementRequestRepository.findById(requestId);
        
        // 验证审批顺序
        validateApprovalSequence(request, level);
        
        // 创建审批记录
        ApprovalStep step = ApprovalStep.builder()
            .requestId(requestId)
            .level(level)
            .approverId(approverId)
            .status(ApprovalStatus.APPROVED)
            .comment(comment)
            .decidedAt(LocalDateTime.now())
            .build();
        approvalStepRepository.insert(step);
        
        // 检查是否完成全部审批
        boolean isComplete = checkApprovalComplete(request);
        
        if (isComplete) {
            // 完成状态转换
            assetStateEngine.transition(
                request.getAssetId(),
                AssetStatus.PENDING_RETIREMENT,
                RetirementEvent.APPROVAL_COMPLETED
            );
            
            request.setStatus(RequestStatus.APPROVED);
        }
        
        retirementRequestRepository.update(request);
        
        return ApprovalResult.builder()
            .requestId(requestId)
            .levelCompleted(level)
            .completed(isComplete)
            .build();
    }
    
    @Transactional
    public ApprovalResult reject(Long requestId, String approverId,
                                  Integer level, String reason) {
        RetirementRequest request = retirementRequestRepository.findById(requestId);
        
        // 创建驳回记录
        ApprovalStep step = ApprovalStep.builder()
            .requestId(requestId)
            .level(level)
            .approverId(approverId)
            .status(ApprovalStatus.REJECTED)
            .comment(reason)
            .decidedAt(LocalDateTime.now())
            .build();
        approvalStepRepository.insert(step);
        
        // 状态回滚
        assetStateEngine.transition(
            request.getAssetId(),
            AssetStatus.PENDING_RETIREMENT,
            RetirementEvent.REJECT
        );
        
        request.setStatus(RequestStatus.REJECTED);
        retirementRequestRepository.update(request);
        
        return ApprovalResult.builder()
            .requestId(requestId)
            .status(RequestStatus.REJECTED)
            .completed(true)
            .build();
    }
}
```

---

## 6. 数据模型定义

### 6.1 实体关系图

```
┌─────────────────────────┐       ┌─────────────────────────┐
│        Asset            │       │   RetirementRequest     │
├─────────────────────────┤       ├─────────────────────────┤
│ id: Long (PK)           │──┐    │ id: Long (PK)           │
│ status: AssetStatus     │  │    │ assetId: Long (FK)     │──┐
│ ...                     │  │    │ status: RequestStatus  │  │
└─────────────────────────┘  │    │ reason: String          │  │
                             │    │ applicantId: Long      │  │
                             │    │ currentLevel: Integer  │  │
                             │    │ ...                     │  │
                             │    └─────────────────────────┘  │
                             │                                 │
                             │    ┌─────────────────────────┐  │
                             │    │    ApprovalStep         │  │
                             └───▶├─────────────────────────┤  │
                                  │ id: Long (PK)           │  │
                                  │ requestId: Long (FK)    │  │
                                  │ level: Integer          │  │
                                  │ approverId: Long        │  │
                                  │ status: ApprovalStatus  │  │
                                  │ comment: String         │  │
                                  │ decidedAt: LocalDateTime│  │
                                  └─────────────────────────┘  │
                                                                 │
                                  ┌─────────────────────────┐   │
                                  │    AssetHistory         │   │
                                  ├─────────────────────────┤   │
                                  │ id: Long (PK)           │   │
                                  │ assetId: Long (FK)     │◀──┘
                                  │ fromStatus: AssetStatus │
                                  │ toStatus: AssetStatus  │
                                  │ event: RetirementEvent │
                                  │ operatorId: Long        │
                                  │ changeTime: LocalDateTime
                                  │ metadata: JSON          │
                                  └─────────────────────────┘
```

### 6.2 枚举定义

```java
// AssetStatus.java
public enum AssetStatus {
    IN_USE("在用"),
    PENDING_RETIREMENT("待审批"),
    RETIRED("已报废");
    
    private final String description;
}

// RetirementEvent.java
public enum RetirementEvent {
    INITIATE_RETIREMENT("发起报废"),
    APPROVAL_COMPLETED("审批通过"),
    REJECT("审批驳回"),
    CANCEL("申请人撤销");
    
    private final String description;
}

// RequestStatus.java
public enum RequestStatus {
    PENDING_APPROVAL("待审批"),
    APPROVED("已批准"),
    REJECTED("已驳回"),
    CANCELLED("已撤销");
    
    private final String description;
}
```

---

## 7. 测试数据 Fixture

### 7.1 数据库 Seeding SQL

```sql
-- 资产状态枚举值
INSERT INTO asset_status (code, name, description) VALUES 
  ('IN_USE', '在用', '资产正在正常使用中'),
  ('PENDING_RETIREMENT', '待审批', '报废申请已提交，等待审批'),
  ('RETIRED', '已报废', '资产已正式报废');

-- 报废申请状态枚举值
INSERT INTO request_status (code, name) VALUES 
  ('PENDING_APPROVAL', '待审批'),
  ('APPROVED', '已批准'),
  ('REJECTED', '已驳回'),
  ('CANCELLED', '已撤销');

-- 审批角色层级
INSERT INTO approval_roles (role_code, role_name, level) VALUES
  ('MANAGER', '经理', 1),
  ('DIRECTOR', '总监', 2),
  ('CFO', '财务总监', 3);

-- 审批链配置
INSERT INTO approval_chain_config (chain_name, chain_type, levels_config) VALUES
  ('默认报废审批链', 'RETIREMENT', '[{"level":1,"role":"DIRECTOR","required":true},{"level":2,"role":"CFO","required":true}]');
```

### 7.2 测试 Fixture 类

```java
// TestFixtures.java
public class TestFixtures {
    
    public static Asset createTestAsset(String assetCode, AssetStatus status) {
        return Asset.builder()
            .assetCode(assetCode)
            .name("测试资产-" + assetCode)
            .status(status)
            .purchaseDate(LocalDate.now().minusYears(2))
            .originalValue(BigDecimal.valueOf(10000))
            .currentValue(BigDecimal.valueOf(8000))
            .locationId(1L)
            .categoryId(1L)
            .build();
    }
    
    public static RetirementRequest createPendingRequest(Asset asset, User applicant) {
        return RetirementRequest.builder()
            .assetId(asset.getId())
            .status(RequestStatus.PENDING_APPROVAL)
            .reason("测试报废原因")
            .applicantId(applicant.getId())
            .currentLevel(1)
            .expectedDate(LocalDate.now().plusDays(30))
            .createdAt(LocalDateTime.now())
            .build();
    }
}
```

---

## 附录

### A. 相关文档链接

| 文档 | 路径 | 版本 |
|------|------|------|
| 架构设计文档 | `docs/architecture/system-design.md` | v2.1 |
| API 规格说明 | `docs/api/retirement-api.md` | v1.0 |
| 数据库设计 | `docs/database/ams-schema.md` | v3.0 |
| 前端组件设计 | `docs/frontend/component-spec.md` | v1.2 |

### B. 变更日志

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| 1.0 | 2024-01-15 | System | 初始版本创建 |

### C. 评审记录

| 评审日期 | 评审人 | 评审结论 | 备注 |
|----------|--------|----------|------|
| 2024-01-15 | Architecture Team | ✅ APPROVED | 所有 AC 通过 |
| 2024-01-16 | QA Team | ✅ APPROVED | 测试用例覆盖完整 |

---

**文档状态**: APPROVED  
**下一次迭代**: Phase 4 (API 层暴露)  
**BLOCKER**: 无