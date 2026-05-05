# SWARM-502 资产报废/退役流程规格指导

## 1. 需求与背景

### 业务背景
企业资产管理中，资产退役（报废）是重要的生命周期管理环节。当资产达到使用年限、性能下降或不再满足业务需求时，需要正式执行退役流程。当前系统缺少标准化的资产退役审批链路，导致退役操作不规范、状态管理混乱。

### 核心诉求
1. 构建标准化的资产退役状态机，规范资产退役生命周期
2. 实现资产退役审批链路，支持多级审批流程
3. 用户可提交资产退役申请，审批通过后自动更新资产状态
4. 完整的操作审计日志，支持追溯

### 功能范围
- 资产退役申请创建与编辑
- 资产退役审批工作流
- 资产状态自动变更
- 退役记录查询与统计

---

## 2. 当前 Phase 对应实施目标

### Phase 映射
根据 plan.md 中的 Phase 拆解，本 spec 对准 **Phase 2: 核心流程构建**

### Phase 2 实施目标

| 目标项 | 描述 |
|--------|------|
| 状态机实现 | 构建 Asset Retirement State Machine，覆盖 5 种状态流转 |
| 审批链路 | 实现单级审批流程，支持审批/驳回操作 |
| 申请管理 | 支持创建、编辑、提交、撤销退役申请 |
| 状态同步 | 审批通过后自动更新资产主数据状态 |

### 非本 Phase 范围（后续迭代）
- 多级审批流程
- 退役资产处置跟踪
- 自动化审批规则引擎
- 财务系统集成

---

## 3. 边界约束

### 架构约束
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

### 数据边界约束

| 约束项 | 具体限制 |
|--------|----------|
| 资产范围 | 仅支持 `status = 'ACTIVE'` 的资产发起退役申请 |
| 状态锁定 | `RETIRED` 状态资产不允许状态回退 |
| 审批唯一性 | 同一资产同一时间仅允许存在 1 个有效的退役申请 |
| 字段长度 | 退役原因描述 ≤ 500 字符，审批意见 ≤ 200 字符 |

### 业务规则约束

1. **前置条件检查**
   - 资产必须处于 `ACTIVE` 状态
   - 资产不存在待处理的退役申请
   - 资产不存在待处理的借用/分配记录

2. **状态流转约束**
   ```
   DRAFT ──[提交]──> PENDING_APPROVAL ──[批准]──> APPROVED ──[执行退役]──> RETIRED
                        │
                        ├──[驳回]──> REJECTED ◄───┘
                        │
                        └──[撤回]──> CANCELLED
   ```

3. **权限约束**
   - 退役申请创建：资产归属部门用户
   - 审批操作：审批角色（可配置）
   - 状态查询：所有认证用户

### 性能约束
- 单次 API 响应时间 < 200ms
- 状态机状态变更事务保证原子性
- 并发审批冲突检测：乐观锁机制

---

## 4. 验收测试基准 (ATB)

### ATB-1: 资产退役申请创建

**测试场景**: 用户成功创建资产退役申请

```java
// ATB-1.1: 有效资产创建退役申请
@Test
void createRetirementApplicationSuccess() {
    // 物理期待:
    // - POST /api/v1/assets/{asset_id}/retirement 成功返回 201
    // - 申请状态为 DRAFT
    // - 返回包含 application_id
}

// ATB-1.2: 非活跃资产创建退役申请失败
@Test
void createRetirementInvalidAssetStatus() {
    // 物理期待:
    // - 返回 400 Bad Request
    // - 错误码 RETIRED_ASSET_NOT_ALLOWED
}

// ATB-1.3: 重复申请检测
@Test
void createRetirementDuplicateApplication() {
    // 物理期待:
    // - 返回 409 Conflict
    // - 错误码 DUPLICATE_APPLICATION_EXISTS
}
```

---

### ATB-2: 资产退役状态机流转

**测试场景**: 验证状态机各状态转换合法性

```java
// ATB-2.1: 提交申请 DRAFT -> PENDING_APPROVAL
@Test
void submitApplicationDraftToPending() {
    // 物理期待:
    // - PUT /api/v1/retirement/{id}/submit 返回 200
    // - 状态变更为 PENDING_APPROVAL
    // - submitted_at 时间戳更新
}

// ATB-2.2: 非法状态转换 DRAFT -> RETIRED
@Test
void invalidTransitionDraftToRetired() {
    // 物理期待:
    // - 返回 422 Unprocessable Entity
    // - 错误码 INVALID_STATE_TRANSITION
}

// ATB-2.3: 撤回待审批申请 PENDING_APPROVAL -> CANCELLED
@Test
void withdrawPendingApplication() {
    // 物理期待:
    // - 返回 200
    // - 状态变更为 CANCELLED
}
```

---

### ATB-3: 审批链路

**测试场景**: 审批人执行审批操作

```java
// ATB-3.1: 审批通过
@Test
void approveRetirementApplication() {
    // 物理期待:
    // - POST /api/v1/retirement/{id}/approve 返回 200
    // - 申请状态变更为 APPROVED
    // - 创建审批记录 approval_record
}

// ATB-3.2: 审批驳回
@Test
void rejectRetirementApplication() {
    // 物理期待:
    // - 返回 200
    // - 申请状态变更为 REJECTED
    // - 需要填写驳回原因
}

// ATB-3.3: 执行退役后资产状态同步
@Test
void executeRetirementUpdatesAssetStatus() {
    // 物理期待:
    // - PUT /api/v1/retirement/{id}/execute 返回 200
    // - 申请状态变更为 RETIRED
    // - 关联资产 status 更新为 RETIRED
}

// ATB-3.4: 非审批人权限校验
@Test
void nonApproverCannotApprove() {
    // 物理期待:
    // - 返回 403 Forbidden
    // - 错误码 INSUFFICIENT_PERMISSION
}
```

---

### ATB-4: 数据一致性

**测试场景**: 事务与并发控制

```java
// ATB-4.1: 并发审批冲突检测
@Test
void concurrentApprovalConflict() {
    // 物理期待:
    // - 第二个审批请求返回 409 Conflict
    // - 使用乐观锁 version 字段检测
}

// ATB-4.2: 退役执行事务原子性
@Test
void retirementAtomicTransaction() {
    // 物理期待:
    // - 状态变更与资产更新在同一个事务中
    // - 失败时完整回滚
}
```

---

## 5. 开发切入层级序列

### Phase 2 开发任务分解

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

### 技术栈定位

| 层级 | 技术选型 | 关键实现 |
|------|----------|----------|
| 数据层 | JPA/Hibernate + PostgreSQL | ORM 模型、迁移脚本 |
| 服务层 | Java Spring Service | 业务逻辑、状态机 |
| 接口层 | Spring MVC Controllers | REST API、Schema 验证 |
| 测试层 | JUnit 5 + Mockito | ATB 覆盖、覆盖率 > 80% |

### 代码目录结构建议

```
backend/
├── src/main/java/com/ams/
│   ├── dto/
│   │   └── RetirementCreateDTO.java   # 退役申请创建DTO
│   ├── entity/
│   │   └── RetirementApplication.java # 退役申请实体
│   ├── service/
│   │   └── RetirementService.java     # 退役服务
│   ├── controller/
│   │   └── RetirementController.java   # 退役控制器
│   └── repository/
│       └── RetirementApplicationRepository.java
└── src/test/java/com/ams/
    ├── service/
    │   └── RetirementServiceTest.java
    └── controller/
        └── RetirementControllerTest.java
```

---

## 附录：状态机完整定义

### 状态枚举

```java
public enum RetirementStatus {
    DRAFT("草稿"),
    PENDING_APPROVAL("待审批"),
    APPROVED("已批准"),
    REJECTED("已驳回"),
    CANCELLED("已撤回"),
    RETIRED("已退役");
    
    private final String description;
    
    RetirementStatus(String description) {
        this.description = description;
    }
}
```

### 状态转换规则

| 当前状态 | 允许转换 | 触发事件 | 目标状态 |
|----------|----------|----------|----------|
| DRAFT | PENDING_APPROVAL | submit | 提交 |
| DRAFT | CANCELLED | cancel | 取消 |
| PENDING_APPROVAL | APPROVED | approve | 批准 |
| PENDING_APPROVAL | REJECTED | reject | 驳回 |
| PENDING_APPROVAL | CANCELLED | withdraw | 撤回 |
| APPROVED | RETIRED | execute | 执行退役 |
| REJECTED | DRAFT | revise | 修订重提 |

---

*文档版本: v1.0 | 对应迭代: Iteration 1 | 最后更新: 2025-01-20*