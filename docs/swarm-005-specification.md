# SWARM-005 规格指导文档

## 供应商闭环强攻 - Squad Vendor

**任务编号**: SWARM-005  
**任务主题**: 打通供应商完整生命周期链路，修复高Severity技术债，协同自动变异 round 43/49 风险审计结果进行代码加固  
**迭代周期**: Iteration 1/3  
**文档版本**: 1.0  
**创建日期**: 2024年

---

## 1. 需求与背景

### 1.1 业务背景

Squad Vendor 模块定位为供应商全生命周期闭环管理系统，是资产管理系统（AMS）的核心子模块之一。该模块需要覆盖供应商从准入到退出的完整生命周期，为企业提供供应商资质管理、风险监控、绩效评估等能力。

当前系统存在以下业务痛点：

- **供应商状态管理混乱**：缺乏清晰的状态机定义，导致供应商状态流转不可预测
- **资质管理缺失**：无法自动跟踪供应商资质有效期，存在合规性漏洞
- **批量操作风险**：批量更新操作缺乏事务保护，数据一致性无法保证
- **接口安全不足**：缺乏限流机制，存在被恶意刷接口的风险

### 1.2 技术债现状

依据 round 43/49 风险审计结果，识别到以下高 Severity 问题需要在本迭代修复：

| Severity | 问题编号 | 问题类型 | 影响范围 | 修复优先级 |
|----------|----------|----------|----------|------------|
| Critical | TECH-DEBT-001 | 供应商状态机跃迁竞态 | 并发场景下状态更新冲突 | P0 |
| Critical | TECH-DEBT-002 | 资质过期未自动预警 | 供应商合规性漏洞 | P0 |
| High | TECH-DEBT-003 | 批量操作无事务回滚 | 数据一致性风险 | P1 |
| High | TECH-DEBT-004 | API 限流缺失 | DoS 攻击面 | P1 |

### 1.3 本次迭代目标

本次迭代（Iteration 1）需要完成以下目标：

1. **供应商 CRUD 完整链路**：实现供应商的创建、查询、更新、状态变更全链路
2. **状态机修复**：解决 Critical 级别的状态跃迁竞态问题（TECH-DEBT-001）
3. **事务加固**：批量操作增加事务回滚机制（TECH-DEBT-003）
4. **限流防护**：API 层增加 Rate Limiting（TECH-DEBT-004）
5. **资质预警**：资质过期自动预警机制（TECH-DEBT-002，作为基础框架）

### 1.4 与其他 Squad 的协作关系

```
┌─────────────────────────────────────────────────────────────┐
│                      Squad Architecture                       │
├─────────────────────────────────────────────────────────────┤
│  Squad Vendor (SWARM-005)                                    │
│  ├── 依赖: Squad Core 提供的基础设施（认证、权限、审计）      │
│  ├── 依赖: Squad Integration 提供的事件总线、Kafka           │
│  └── 被依赖: Squad Asset 使用供应商信息进行资产关联           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 映射

参照标准 Phase 拆解，本次迭代对应 **Phase 2: 核心链路打通** 与 **Phase 3: 技术债修复** 的交叉实施：

```
Phase 1: 基础设施搭建     [已历史完成]
    ├── 基础 Entity 定义
    ├── Repository 抽象
    └── Service 层骨架
         ↓
Phase 2: 核心链路打通     [← Iteration 1 主战场]
    ├── 供应商 CRUD 完整实现
    ├── 状态机核心逻辑
    └── 资质管理基础功能
         ↓
Phase 3: 技术债修复       [← 与 Phase 2 并行]
    ├── 状态跃迁竞态修复
    ├── 批量事务加固
    └── 限流防护实现
         ↓
Phase 4: 集成与验收       [后续 Iteration 2/3]
```

### 2.2 Iteration 1 详细目标

| 目标编号 | 目标描述 | 交付物 | 完成标准 |
|----------|----------|--------|----------|
| OBJ-001 | 供应商基础 CRUD | VendorController, VendorService, VendorRepository | 所有 ATB-1 测试通过 |
| OBJ-002 | 供应商状态机 | 状态枚举、跃迁规则、并发控制 | ATB-2 并发测试通过 |
| OBJ-003 | 资质管理框架 | QualificationService, 过期预警基础 | ATB-3 基础测试通过 |
| OBJ-004 | 批量事务加固 | 事务管理器、回滚机制 | ATB-4 回滚测试通过 |
| OBJ-005 | API 限流 | RateLimiter 中间件 | ATB-5 限流测试通过 |

---

## 3. 边界约束

### 3.1 功能边界

| 约束类型 | 说明 | 排除范围 |
|----------|------|----------|
| 模块边界 | 仅覆盖 `vendor` 核心实体及其直接关联的 `qualification`（资质）、`risk_record`（风险记录） | 财务结算、合同签署、第三方信用API对接 |
| 操作边界 | 单次批量操作上限 100 条记录 | 超大规模数据迁移 |
| 状态边界 | 供应商状态：pending → active → suspended → inactive | 特殊业务状态（待扩展） |

### 3.2 技术约束

| 约束类型 | 说明 | 实现方案 |
|----------|------|----------|
| 事务策略 | 跨服务操作使用 Saga 模式，本服务内使用 ACID 事务 | @Transactional + 补偿机制 |
| 并发控制 | 状态变更采用乐观锁（version 字段），重试上限 3 次 | JPA @Version + OptimisticLockException 处理 |
| 幂等性 | 所有写操作需支持幂等，依赖 `idempotency_key` | 请求头或参数携带唯一键 |
| 性能要求 | 单次查询 P99 < 200ms，批量操作 < 2s | 索引优化 + 异步处理 |

### 3.3 质量约束

| 约束类型 | 目标值 | 验收方式 |
|----------|--------|----------|
| Critical/High 技术债关闭率 | 100% | 审计报告比对 |
| 变异测试覆盖率 | ≥ 85% | mutmut/coverage 工具 |
| 回归测试通过率 | 100% | CI 流水线 |
| 代码覆盖率 | ≥ 80% | JaCoCo/ Istanbul |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 供应商基础 CRUD

| 测试编号 | 测试场景 | 输入条件 | 物理测试期待 | 测试工具 |
|----------|----------|----------|--------------|----------|
| ATB-1.1 | 创建供应商成功 | 完整供应商信息，无重复 | HTTP 201，响应包含 `vendor_id`，数据库存在对应记录 | pytest |
| ATB-1.2 | 创建供应商参数校验失败 | 缺少必填字段 | HTTP 422，响应包含字段级错误信息 | pytest |
| ATB-1.3 | 创建供应商重复检测 | 已存在的供应商名称 | HTTP 409，`{"error": "vendor_exists"}` | pytest |
| ATB-1.4 | 查询供应商存在 | 有效的 vendor_id | HTTP 200，返回完整供应商信息 | pytest |
| ATB-1.5 | 查询供应商不存在 | 无效的 vendor_id | HTTP 404，响应包含 `detail` | pytest |
| ATB-1.6 | 更新供应商信息 | 有效的 vendor_id + 更新内容 | HTTP 200，version 自增，数据库已更新 | pytest |
| ATB-1.7 | 删除供应商（软删除） | 有效的 vendor_id | HTTP 204，`is_deleted=True`，关联数据保留 | pytest |

**关键断言点代码示例**：

```java
// ATB-1.1 创建供应商成功
@Test
void createVendor_Success() {
    VendorCreateRequest request = VendorCreateRequest.builder()
        .name("Test Vendor")
        .contactEmail("test@vendor.com")
        .category(VendorCategory.SUPPLIER)
        .build();
    
    ResponseEntity<VendorResponse> response = restTemplate.postForEntity(
        "/api/v1/vendors", request, VendorResponse.class);
    
    assertEquals(HttpStatus.CREATED, response.getStatusCode());
    assertNotNull(response.getBody().getVendorId());
    
    Vendor vendor = vendorRepository.findById(response.getBody().getVendorId());
    assertNotNull(vendor);
    assertEquals("Test Vendor", vendor.getName());
}
```

### 4.2 ATB-2: 供应商状态机

| 测试编号 | 测试场景 | 输入条件 | 物理测试期待 | 测试工具 |
|----------|----------|----------|--------------|----------|
| ATB-2.1 | 合法状态跃迁（pending→active） | 有效的 vendor_id + 目标状态 | HTTP 200，状态更新，version+1 | pytest |
| ATB-2.2 | 非法状态跃迁（active→pending） | 有效的 vendor_id + 非合法目标状态 | HTTP 400，`{"error": "invalid_transition"}` | pytest |
| ATB-2.3 | 并发状态变更竞态修复验证 | 10 并发请求修改同一供应商状态 | 仅 1 成功，其余返回 409 | pytest + threading |
| ATB-2.4 | 状态变更事件发布 | 状态变更成功 | Kafka/EventBus 收到 `VendorStatusChangedEvent` | pytest + kafka-testcontainer |

**关键断言点代码示例**：

```java
// ATB-2.3 并发竞态测试（验证 TECH-DEBT-001 修复）
@Test
void concurrentStatusUpdate_OnlyOneSuccess() throws InterruptedException {
    String vendorId = createActiveVendor();
    CountDownLatch latch = new CountDownLatch(10);
    List<Result> results = Collections.synchronizedList(new ArrayList<>());
    
    ExecutorService executor = Executors.newFixedThreadPool(10);
    for (int i = 0; i < 10; i++) {
        executor.submit(() -> {
            try {
                ResponseEntity<String> response = restTemplate.postForEntity(
                    "/api/v1/vendors/" + vendorId + "/status",
                    new StatusUpdateRequest("suspended"),
                    String.class);
                results.add(new Result(response.getStatusCode()));
            } finally {
                latch.countDown();
            }
        });
    }
    
    latch.await();
    executor.shutdown();
    
    // 严格断言：仅 1 成功，9 个 409 Conflict
    long successCount = results.stream().filter(r -> r.status == HttpStatus.OK).count();
    long conflictCount = results.stream().filter(r -> r.status == HttpStatus.CONFLICT).count();
    
    assertEquals(1, successCount);
    assertEquals(9, conflictCount);
}
```

### 4.3 ATB-3: 资质管理

| 测试编号 | 测试场景 | 输入条件 | 物理测试期待 | 测试工具 |
|----------|----------|----------|--------------|----------|
| ATB-3.1 | 资质创建与关联 | 有效的 vendor_id + 资质信息 | HTTP 201，资质与供应商正确关联 | pytest |
| ATB-3.2 | 资质过期自动预警 | 资质过期前 N 天 | 定时任务触发，生成 `QualificationExpiringEvent` 事件 | pytest + scheduler |
| ATB-3.3 | 资质过期阻断 | 过期资质供应商发起交易 | HTTP 400，`{"error": "qualification_expired"}` | pytest |
| ATB-3.4 | 资质列表查询 | 有效的 vendor_id | HTTP 200，返回该供应商所有资质 | pytest |

### 4.4 ATB-4: 批量操作事务

| 测试编号 | 测试场景 | 输入条件 | 物理测试期待 | 测试工具 |
|----------|----------|----------|--------------|----------|
| ATB-4.1 | 批量更新部分失败回滚 | 5 条记录，其中 1 条无效 | HTTP 400，所有记录均未被修改（事务回滚） | pytest |
| ATB-4.2 | 批量更新全部成功 | 5 条有效记录 | HTTP 200，所有记录已更新 | pytest |
| ATB-4.3 | 批量操作超过上限 | 101 条记录 | HTTP 400，`{"error": "batch_size_exceeded"}` | pytest |

**关键断言点代码示例**：

```java
// ATB-4.1 事务回滚测试（验证 TECH-DEBT-003 修复）
@Test
void batchUpdate_PartialFailure_Rollback() {
    // 准备 5 条有效记录
    List<String> vendorIds = IntStream.range(0, 5)
        .mapToObj(i -> createActiveVendor())
        .collect(Collectors.toList());
    
    List<VendorBatchUpdateRequest> payload = vendorIds.stream()
        .map(id -> VendorBatchUpdateRequest.builder()
            .vendorId(id)
            .name("Updated Name")
            .build())
        .collect(Collectors.toList());
    payload.get(2).setVendorId("non-existent-id"); // 注入失败
    
    ResponseEntity<BatchUpdateResponse> response = restTemplate.postForEntity(
        "/api/v1/vendors/batch-update", payload, BatchUpdateResponse.class);
    
    assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    
    // 验证：所有记录均未被修改（事务回滚）
    for (String vendorId : vendorIds) {
        Vendor vendor = vendorRepository.findById(vendorId);
        assertNotEquals("Updated Name", vendor.getName()); // 未被修改
    }
}
```

### 4.5 ATB-5: API 限流

| 测试编号 | 测试场景 | 输入条件 | 物理测试期待 | 测试工具 |
|----------|----------|----------|--------------|----------|
| ATB-5.1 | 正常请求不触发限流 | 前 100 次请求 | 全部返回 HTTP 200 | pytest |
| ATB-5.2 | 超过限流阈值 | 第 101 次请求 | 返回 HTTP 429 | pytest |
| ATB-5.3 | 限流响应包含 Retry-After | 触发限流 | 响应 Header 包含 `Retry-After: 60` | pytest |
| ATB-5.4 | 限流键隔离 | 不同用户/ IP | 各自分别计数，互不影响 | pytest |

### 4.6 ATB-6: 变异测试协同（Round 43/49）

| 测试编号 | 测试场景 | 验证目标 | 测试工具 |
|----------|----------|----------|----------|
| ATB-6.1 | 状态机变异测试 | mutation-testing 工具检测状态跃迁逻辑缺陷 | pytest + mutmut |
| ATB-6.2 | SQL 注入变异测试 | 所有输入点已参数化，无注入点存活 | pytest + SQLMap |
| ATB-6.3 | 边界条件变异测试 | 整数溢出、空指针、边界值已防护 | pytest + hypothesis |
| ATB-6.4 | 并发变异测试 | 竞态条件已被充分测试 | pytest + flaky |

---

## 5. 开发切入层级序列

### 5.1 层级架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                         │
│  VendorController, QualificationController                     │
├─────────────────────────────────────────────────────────────┤
│                      Service Layer                           │
│  VendorService, QualificationService, VendorStatusMachine     │
├─────────────────────────────────────────────────────────────┤
│                   Repository Layer                            │
│  VendorRepository, QualificationRepository                    │
├─────────────────────────────────────────────────────────────┤
│                     Entity Layer                              │
│  Vendor, Qualification, RiskRecord                           │
├─────────────────────────────────────────────────────────────┤
│                  Middleware Layer                             │
│  RateLimiter, IdempotencyFilter, ExceptionHandler             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 层级 0: Entity 层（优先开发）

**文件路径**: `backend/src/main/java/com/ams/entity/Vendor.java`

**技术债修复重点**：
- Vendor 实体增加 `version` 字段（乐观锁）
- Vendor 实体增加状态枚举约束

```java
/**
 * 供应商实体类
 * 
 * <p>核心领域模型，对应数据库中的 vendor 表
 * 
 * <p>生命周期状态：
 * <ul>
 *   <li>pending - 待审核</li>
 *   <li>active - 正常合作</li>
 *   <li>suspended - 暂停合作</li>
 *   <li>inactive - 终止合作</li>
 * </ul>
 * 
 * @author Squad Vendor
 * @version 1.0
 * @since 2024-01-01
 */
@Entity
@Table(name = "vendor")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Vendor {
    
    /**
     * 供应商唯一标识
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long vendorId;
    
    /**
     * 供应商名称
     */
    @Column(nullable = false, length = 200)
    private String name;
    
    /**
     * 供应商编码（唯一）
     */
    @Column(unique = true, length = 50)
    private String vendorCode;
    
    /**
     * 供应商状态
     * 
     * @see VendorStatus
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private VendorStatus status;
    
    /**
     * 乐观锁版本号
     * 
     * <p>用于解决并发状态更新时的竞态问题（TECH-DEBT-001）
     * 当多个请求同时尝试更新同一供应商时，只有版本号匹配的请求能成功
     */
    @Version
    private Integer version;
    
    /**
     * 联系人邮箱
     */
    @Column(length = 100)
    private String contactEmail;
    
    /**
     * 联系人电话
     */
    @Column(length = 20)
    private String contactPhone;
    
    /**
     * 供应商类别
     */
    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private VendorCategory category;
    
    /**
     * 信用评分
     */
    @Column(precision = 5, scale = 2)
    private BigDecimal creditScore;
    
    /**
     * 是否删除（软删除标记）
     */
    @Column(nullable = false)
    @Builder.Default
    private Boolean isDeleted = false;
    
    /**
     * 创建时间
     */
    @Column(nullable = false, updatable = false)
    private LocalDateTime createTime;
    
    /**
     * 更新时间
     */
    @Column(nullable = false)
    private LocalDateTime updateTime;
    
    /**
     * 创建人
     */
    @Column(length = 50)
    private String createBy;
    
    /**
     * 更新人
     */
    @Column(length = 50)
    private String updateBy;
}
```

### 5.3 层级 1: Repository 层

**技术债修复重点**：
- 批量操作增加事务管理
- 状态变更增加乐观锁检查

### 5.4 层级 2: Service 层

**技术债修复重点**：
- 状态机增加并发控制
- 批量操作增加事务回滚
- 资质过期预警逻辑

### 5.5 层级 3: API 层

**技术债修复重点**：
- 增加 Rate Limiting 中间件
- 增加幂等性校验
- 统一异常处理

### 5.6 层级 4: 中间件与防护

```java
// Rate Limiter 实现
@Component
public class RateLimiter {
    
    /**
     * 限流配置
     * - 默认速率：100 请求/分钟
     * - 限流键：用户 ID 或 IP 地址
     * - 存储：Redis 或内存 Map
     */
    private static final int DEFAULT_RATE = 100;
    private static final int TIME_WINDOW = 60; // 秒
    
    // 实现滑动窗口算法或令牌桶算法
}
```

### 5.7 开发顺序与时间分配

| Day | 开发任务 | 技术债修复 | 测试任务 |
|-----|----------|------------|----------|
| Day 1 | Entity + Repository | 乐观锁字段 | 单元测试 |
| Day 2 | Service 层 + 状态机 | 状态机竞态修复 | 状态机测试 |
| Day 3 | API 层 + 中间件 | 限流实现 | API 测试 |
| Day 4 | 批量操作 + 事务 | 事务回滚修复 | 集成测试 |
| Day 5 | 变异测试验证 | 全部技术债 | ATB 全量 + plan 更新 |

---

## 6. 关键文件清单

### 6.1 交付物文件

| 文件路径 | 描述 | 修改类型 | 优先级 |
|----------|------|----------|--------|
| `backend/src/main/java/com/ams/entity/Vendor.java` | 供应商实体（增加 version 字段） | 修改 | P0 |
| `backend/src/main/java/com/ams/entity/Qualification.java` | 资质实体 | 新建 | P1 |
| `backend/src/main/java/com/ams/service/VendorService.java` | 供应商服务 | 修改 | P0 |
| `backend/src/main/java/com/ams/service/impl/VendorServiceImpl.java` | 供应商服务实现 | 修改 | P0 |
| `backend/src/main/java/com/ams/service/QualificationService.java` | 资质服务 | 新建 | P1 |
| `backend/src/main/java/com/ams/controller/VendorController.java` | 供应商控制器 | 修改 | P0 |
| `backend/src/main/java/com/ams/mapper/VendorMapper.java` | 供应商 Mapper | 修改 | P0 |
| `backend/src/main/java/com/ams/mapper/QualificationMapper.java` | 资质 Mapper | 新建 | P1 |
| `backend/src/main/java/com/ams/middleware/RateLimiter.java` | 限流中间件 | 新建 | P1 |
| `backend/src/main/java/com/ams/common/GlobalExceptionHandler.java` | 全局异常处理 | 修改 | P1 |

### 6.2 测试文件

| 文件路径 | 描述 | 覆盖 ATB |
|----------|------|----------|
| `backend/src/test/java/com/ams/service/VendorServiceTest.java` | 供应商服务单元测试 | ATB-1, ATB-2 |
| `backend/src/test/java/com/ams/service/VendorConcurrencyTest.java` | 并发测试 | ATB-2.3 |
| `backend/src/test/java/com/ams/service/BatchOperationTest.java` | 批量操作测试 | ATB-4 |
| `backend/src/test/java/com/ams/controller/VendorControllerTest.java` | API 测试 | ATB-1, ATB-5 |

---

## 7. 强制落地指令

### 7.1 代码开发收尾

完成本次代码开发后，**必须**执行以下收尾工作：

#### 步骤 1: 更新 plan.md

前往项目根目录的 `/docs/plan.md` 或 `/plan.md`，定位到 **SWARM-005** 相关章节，更新迭代进度：

```markdown
## SWARM-005: 供应商闭环强攻

### Iteration 1 (当前)
- [x] 供应商 CRUD 完整链路
- [x] 状态机竞态修复 (TECH-DEBT-001)
- [x] 批量事务加固 (TECH-DEBT-003)
- [x] API 限流实现 (TECH-DEBT-004)
- [x] 资质预警框架 (TECH-DEBT-002)

**完成时间**: YYYY-MM-DD
**ATB 覆盖率**: 100%
**Critical/High 技术债**: 已全部关闭

### Iteration 2 (待开始)
- [ ] 供应商绩效评估
- [ ] 风险评估模型
- [ ] 完整资质管理流程

### Iteration 3 (待开始)
- [ ] 合同管理集成
- [ ] 财务结算对接
```

#### 步骤 2: 更新相关文档

如有必要，更新以下文档：
- API 文档（Swagger/OpenAPI）
- 数据库变更日志（CHANGELOG.md）
- 技术债追踪文档

#### 步骤 3: 提交 PR

- 创建分支：`feature/swarm-005-iteration-1`
- 提交代码并推送
- 创建 Pull Request
- 关联相关 Issue

### 7.2 禁止事项

| 禁止行为 | 说明 |
|----------|------|
| 未经 plan.md 更新即退出 | 违反强制落地指令 |
| 遗留未关闭的 Critical/High 技术债 | 必须在本次迭代关闭 |
| 回归测试不通过即交付 | 必须 100% 通过 |
| 未经代码评审即合并 | 必须经过至少 1 人 Review |

---

## 8. 附录

### 8.1 供应商状态机定义

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
                    ▼                                          │
              ┌──────────┐      ┌──────────┐      ┌──────────┐  │
    ─────────►│  PENDING │─────►│  ACTIVE  │─────►│SUSPENDED │  │
              └──────────┘      └──────────┘      └──────────┘  │
                    │                │                   │      │
                    │                │                   │      │
                    │                ▼                   │      │
                    │           ┌──────────┐             │      │
                    │           │ INACTIVE │◄────────────┘      │
                    │           └──────────┘                   │
                    │                │                         │
                    └────────────────┴─────────────────────────┘
                                           │
                                           ▼
                                    (永久终止，不可逆)
```

**合法跃迁规则**：
| 当前状态 | 允许目标状态 |
|----------|--------------|
| PENDING | ACTIVE, INACTIVE |
| ACTIVE | SUSPENDED, INACTIVE |
| SUSPENDED | ACTIVE, INACTIVE |
| INACTIVE | (无，永久终止) |

### 8.2 API 接口清单

| 接口路径 | 方法 | 描述 | 限流 |
|----------|------|------|------|
| `/api/v1/vendors` | POST | 创建供应商 | 100/min |
| `/api/v1/vendors` | GET | 查询供应商列表 | 100/min |
| `/api/v1/vendors/{id}` | GET | 查询单个供应商 | 100/min |
| `/api/v1/vendors/{id}` | PUT | 更新供应商 | 100/min |
| `/api/v1/vendors/{id}` | DELETE | 删除供应商（软删除） | 50/min |
| `/api/v1/vendors/{id}/status` | POST | 更新供应商状态 | 50/min |
| `/api/v1/vendors/batch-update` | POST | 批量更新 | 10/min |

### 8.3 参考文档

- [Vendor Entity 设计文档](./design/vendor-entity.md)
- [状态机实现指南](./guides/state-machine.md)
- [变异测试 Round 43/49 报告](./audit/round-43-report.md)

---

**文档结束**

*本文档由 SWARM-005 任务负责人维护，如有问题请联系 Squad Vendor 团队。*