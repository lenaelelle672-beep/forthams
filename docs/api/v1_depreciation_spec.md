# SWARM-003 资产折旧计算模块 规格说明书

## 1. 需求与背景

### 1.1 业务背景

资产折旧是固定资产全生命周期管理的核心环节，直接影响企业财务报表的准确性。依据会计准则，固定资产需按预期使用年限合理分摊成本。本模块旨在实现自动化的折旧计算与可视化呈现，解决当前依赖手动计算、Excel 导出、数据不一致等问题。

根据 `backend/src/main/java/com/ams/service/impl/StraightLineDepreciation.java` 和 `backend/src/main/java/com/ams/service/impl/DoubleDecliningBalanceDepreciation.java` 的既有实现，本模块需完成前后端集成、定时任务调度以及前端展示层的完整闭环。

### 1.2 功能需求

| 需求编号 | 描述 | 优先级 | 关联文件 |
|---------|------|--------|----------|
| GSD-003-01 | 直线法折旧计算（年折旧额 = (原值 - 残值) / 预计使用年限） | P0 | `StraightLineDepreciation.java` |
| GSD-003-02 | 双倍余额递减法折旧计算（年折旧率 = 2 / 预计使用年限 × 100%） | P0 | `DoubleDecliningBalanceDepreciation.java` |
| GSD-003-03 | 月度折旧自动计算定时任务（CRON: 每月最后一日 23:59） | P0 | `DepreciationSyncTask.java` |
| GSD-003-04 | 折旧报表前端展示（汇总 + 明细） | P1 | `depreciationService.ts` |
| GSD-003-05 | 资产与折旧记录关联视图 | P1 | `AssetDetailPage/services/auditApi.ts` |

### 1.3 折旧算法定义

**直线法 (Straight-Line Method)**

```
年折旧额 = (原值 - 残值) / 预计使用年限
月折旧额 = 年折旧额 / 12
```

**双倍余额递减法 (Double Declining Balance)**

```
年折旧率 = 2 / 预计使用年限 × 100%
年折旧额 = 年初账面净值 × 年折旧率
月折旧额 = 年折旧额 / 12
（最后两年改为直线法分摊剩余价值）
```

### 1.4 既有代码分析

| 文件路径 | 类/方法 | 职责 |
|----------|---------|------|
| `backend/src/main/java/com/ams/service/impl/StraightLineDepreciation.java` | `calculate()` | 直线法折旧核心算法 |
| `backend/src/main/java/com/ams/service/impl/DoubleDecliningBalanceDepreciation.java` | `calculate()` | 双倍余额递减法核心算法 |
| `backend/src/main/java/com/ams/service/impl/DepreciationCalculator.java` | 策略调度器 | 根据 method 参数路由至具体算法实现 |
| `backend/src/main/java/com/ams/entity/DepreciationRecord.java` | Entity | 折旧记录持久化实体 |
| `backend/src/main/java/com/ams/entity/AssetDepreciation.java` | Entity | 资产折旧配置实体 |
| `backend/src/main/java/com/ams/controller/DepreciationController.java` | REST Controller | 折旧相关 API 端点 |
| `backend/src/main/java/com/ams/task/DepreciationSyncTask.java` | Scheduled Task | 月度折旧同步定时任务 |
| `frontend/src/services/depreciationService.ts` | Angular Service | 前端折旧服务调用层 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 迭代范围定义

| 迭代 | 范围 | 状态 |
|------|------|------|
| Iteration 1 | 核心计算引擎（后端）+ API 端点 + 前后端联调 | 🔄 当前 |
| Iteration 2 | 前端折旧报表展示 + 资产关联视图 | 待开发 |
| Iteration 3 | 历史数据补算 + 折旧凭证集成 | 待开发 |

### 2.2 Iteration 1 交付物清单

| 交付物 | 类型 | 说明 |
|-------|------|------|
| `DepreciationController.java` | REST API | 折旧相关接口端点 |
| `DepreciationSyncTask.java` | Scheduled Task | 月度定时任务调度 |
| `DepreciationService.java` | Service Layer | 折旧计算服务封装 |
| `DepreciationRecordMapper.java` | Data Access | MyBatis Mapper |
| `depreciationService.ts` | Frontend Service | TypeScript 服务调用 |
| `depreciation.types.ts` | Frontend Types | 类型定义 |
| `DepreciationServiceTest.java` | Unit Test | 后端服务单元测试 |
| `StraightLineDepreciationTest.java` | Unit Test | 直线法单元测试 |
| `DoubleDecliningBalanceDepreciationTest.java` | Unit Test | 双倍余额递减法单元测试 |

### 2.3 前后端职责边界

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (Iteration 1)                │
├──────────────────────────────────────────────────────────────┤
│  ✅ depreciationService.ts - API 调用封装                    │
│  ✅ depreciation.types.ts - 类型定义完善                      │
│  ✅ AssetDetailPage/services/auditApi.ts - 资产详情集成      │
│  ✅ 单元测试覆盖 (auditLog.test.ts)                           │
│  ✅ E2E 测试覆盖 (approval.spec.ts)                           │
├──────────────────────────────────────────────────────────────┤
│                        Backend (已存在/待完善)               │
├──────────────────────────────────────────────────────────────┤
│  ✅ StraightLineDepreciation.java - 直线法算法               │
│  ✅ DoubleDecliningBalanceDepreciation.java - DDB算法       │
│  ✅ DepreciationCalculator.java - 策略调度                   │
│  ✅ DepreciationController.java - REST 端点                   │
│  ⬜ DepreciationSyncTask.java - 定时任务完善                 │
│  ⬜ DepreciationService.java - 服务层封装                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 边界约束

### 3.1 明确排除范围

| 排除项 | 原因 | 关联 Issue |
|--------|------|------------|
| 年数总和法折旧计算 | 暂未纳入需求，待后续迭代 | - |
| 资产新增/变更/报废功能 | 属于 SWARM-001 资产主数据模块 | SWARM-001 |
| 折旧凭证自动生成 | 属于财务系统对接范畴 | SWARM-005 |
| 多币种资产折旧 | 非本期需求 | - |
| 移动端适配 | 前端展示仅支持桌面端 | - |
| 折旧政策配置管理 | 暂使用硬编码配置 | - |

### 3.2 技术边界

| 约束项 | 规则 |
|--------|------|
| 后端框架 | Spring Boot 3.x |
| 前端框架 | Angular (TypeScript) |
| 数据库 | MyBatis Plus (MySQL/PostgreSQL) |
| 定时任务 | Spring @Scheduled |
| API 规范 | RESTful JSON |
| Python 版本 | 不适用（后端 Java） |

### 3.3 数据约束

| 字段约束 | 规则 |
|----------|------|
| 预计使用年限 | 正整数，范围 1-50 年 |
| 残值率 | 0 ≤ 残值率 ≤ 1 |
| 折旧计算基准日 | 每月最后一日 23:59:59 |
| 历史补算 | 仅支持从资产启用日期起算，不可追溯调整 |
| 并发处理 | 定时任务需加分布式锁防重 |

---

## 4. 验收测试基准 (ATB)

### 4.1 后端单元测试 (JUnit 5)

#### ATB-TC-001: 直线法折旧计算

```java
// backend/src/test/java/com/ams/service/impl/StraightLineDepreciationTest.java

@Test
@DisplayName("直线法: 原值100000, 残值率5%, 使用年限5年")
void testStraightLineCalculation() {
    // Given
    BigDecimal originalValue = new BigDecimal("100000");
    BigDecimal residualRate = new BigDecimal("0.05");
    int usefulLifeYears = 5;

    // When
    DepreciationResult result = depreciation.calculate(originalValue, residualRate, usefulLifeYears);

    // Then
    assertEquals(new BigDecimal("19000.00"), result.getAnnualDepreciation());
    assertEquals(new BigDecimal("1583.33"), result.getMonthlyDepreciation());
}
```

**物理测试命令**:

```bash
cd backend && ./mvnw test -Dtest=StraightLineDepreciationTest -q
```

**验收标准**:
- ✅ 年折旧额精确等于 `(100000 - 5000) / 5 = 19000`
- ✅ 月折旧额精度误差 ≤ 0.01

---

#### ATB-TC-002: 双倍余额递减法折旧计算

```java
// backend/src/test/java/com/ams/service/impl/DoubleDecliningBalanceDepreciationTest.java

@Test
@DisplayName("双倍余额递减法: 原值100000, 使用年限5年, 第1年")
void testDoubleDecliningYear1() {
    // Given
    BigDecimal originalValue = new BigDecimal("100000");
    int usefulLifeYears = 5;
    int currentYear = 1;
    BigDecimal currentNetValue = new BigDecimal("100000");

    // When
    DepreciationResult result = depreciation.calculate(
        originalValue, usefulLifeYears, currentYear, currentNetValue
    );

    // Then
    assertEquals(new BigDecimal("0.40"), result.getDepreciationRate());
    assertEquals(new BigDecimal("40000.00"), result.getAnnualDepreciation());
}
```

**物理测试命令**:

```bash
cd backend && ./mvnw test -Dtest=DoubleDecliningBalanceDepreciationTest -q
```

**验收标准**:
- ✅ 年折旧率 = `2/5 = 40%`
- ✅ 第1年折旧额 = `100000 × 40% = 40000`

---

#### ATB-TC-003: 折旧计算边界条件 - 残值率边界

```java
// backend/src/test/java/com/ams/service/impl/StraightLineDepreciationTest.java

@ParameterizedTest
@CsvSource({
    "-0.01, true",   // 负值应拒绝
    "1.5, true",      // 超过100%应拒绝
    "0.0, false",     // 零残值应允许
    "1.0, false"      // 100%残值(理论允许)
})
@DisplayName("残值率边界校验")
void testResidualRateBoundary(String rate, boolean shouldThrow) {
    // implementation
}
```

**验收标准**:
- ✅ 残值率 < 0 或 > 1 时抛出 `BusinessException`
- ✅ 残值率在 `[0, 1]` 区间内正常计算

---

#### ATB-TC-004: 折旧计算边界条件 - 使用年限边界

```java
// backend/src/test/java/com/ams/service/impl/StraightLineDepreciationTest.java

@ParameterizedTest
@CsvSource({
    "0, true",     // 零年应拒绝
    "51, true",    // 超过50年应拒绝
    "1, false",    // 最小有效值
    "50, false"   // 最大有效值
})
@DisplayName("使用年限边界校验")
void testUsefulLifeBoundary(int years, boolean shouldThrow) {
    // implementation
}
```

**验收标准**:
- ✅ 使用年限 < 1 或 > 50 时抛出 `BusinessException`

---

### 4.2 后端集成测试 (SpringBootTest)

#### ATB-TC-005: 折旧记录创建 API

```java
// backend/src/test/java/com/ams/controller/DepreciationControllerTest.java

@Test
@DisplayName("POST /api/v1/depreciation/records - 创建折旧记录")
void testCreateDepreciationRecord() {
    // Given
    DepreciationCreateRequest request = DepreciationCreateRequest.builder()
        .assetId(UUID.randomUUID())
        .calculationMethod("straight_line")
        .originalValue(new BigDecimal("100000"))
        .residualRate(new BigDecimal("0.05"))
        .usefulLifeYears(5)
        .build();

    // When
    Result<DepreciationRecordVO> result = depreciationController.create(request);

    // Then
    assertNotNull(result.getData());
    assertEquals(HttpStatus.CREATED, result.getCode());
}
```

**物理测试命令**:

```bash
cd backend && ./mvnw test -Dtest=DepreciationControllerTest -q
```

**验收标准**:
- ✅ HTTP 201 Created
- ✅ 数据库 `depreciation_record` 表有对应记录
- ✅ `asset_id` 外键关联正确

---

#### ATB-TC-006: 折旧记录查询 API

```java
@Test
@DisplayName("GET /api/v1/depreciation/records?assetId={id} - 按资产ID查询")
void testGetDepreciationByAssetId() {
    // When
    Result<List<DepreciationRecordVO>> result = 
        depreciationController.listByAssetId(assetId, null, null);

    // Then
    assertNotNull(result.getData());
    assertFalse(result.getData().isEmpty());
}
```

**验收标准**:
- ✅ 返回指定资产的全部折旧记录
- ✅ 记录按期间升序排列

---

#### ATB-TC-007: 折旧汇总报表 API

```java
@Test
@DisplayName("GET /api/v1/depreciation/summary?year=2025&month=12")
void testDepreciationSummaryReport() {
    // When
    Result<DepreciationSummaryVO> result = 
        depreciationController.getSummary(2025, 12);

    // Then
    assertNotNull(result.getData());
    assertNotNull(result.getData().getTotalDepreciation());
    assertNotNull(result.getData().getAssetCount());
    assertNotNull(result.getData().getDetails());
}
```

**验收标准**:
- ✅ 返回结构包含 `totalDepreciation`, `assetCount`, `details`
- ✅ `totalDepreciation` = 各资产月折旧额之和

---

### 4.3 前端单元测试 (Jest/Vitest)

#### ATB-TC-008: 前端折旧服务方法覆盖

```typescript
// frontend/tests/unit/depreciationService.test.ts

describe('DepreciationService', () => {
  it('should calculate straight-line depreciation correctly', async () => {
    // Given
    const params = {
      originalValue: 100000,
      residualRate: 0.05,
      usefulLifeYears: 5
    };

    // When
    const result = await depreciationService.calculateStraightLine(params);

    // Then
    expect(result.annualDepreciation).toBe(19000);
    expect(result.monthlyDepreciation).toBeCloseTo(1583.33, 2);
  });

  it('should get depreciation records by asset ID', async () => {
    const records = await depreciationService.getDepreciationRecords('ASSET-001');
    expect(Array.isArray(records)).toBe(true);
  });

  it('should get depreciation summary report', async () => {
    const summary = await depreciationService.getDepreciationSummary(2025, 12);
    expect(summary).toHaveProperty('totalDepreciation');
    expect(summary).toHaveProperty('assetCount');
  });
});
```

**物理测试命令**:

```bash
cd frontend && npx vitest run tests/unit/depreciationService.test.ts
```

**验收标准**:
- ✅ 所有 `depreciationService.ts` 导出方法有对应测试用例
- ✅ 测试覆盖率 ≥ 80%

---

#### ATB-TC-009: 资产详情折旧关联测试

```typescript
// frontend/tests/unit/auditLog.test.ts

describe('Asset Detail Depreciation Integration', () => {
  it('should load depreciation data in asset detail page', async () => {
    // Mock API response
    mockOnGet('/api/v1/depreciation/records?assetId=ASSET-001').reply(200, {
      data: mockDepreciationRecords
    });

    const records = await auditApi.getDepreciationByAssetId('ASSET-001');
    expect(records.length).toBeGreaterThan(0);
  });
});
```

**物理测试命令**:

```bash
cd frontend && npx vitest run tests/unit/auditLog.test.ts
```

**验收标准**:
- ✅ 资产详情页能正确加载折旧数据
- ✅ TypeScript 编译无错误

---

### 4.4 E2E 测试 (Playwright)

#### ATB-TC-010: 折旧报表页面渲染

```typescript
// frontend/tests/e2e/approval.spec.ts (扩展)

test('depreciation report page renders correctly', async ({ page }) => {
  await page.goto('/reports/depreciation');

  // Wait for data loading
  await page.waitForSelector('[data-testid="depreciation-table"]');

  // Verify table headers
  const headers = await page.locator('th').allTextContents();
  expect(headers).toContain('资产编号');
  expect(headers).toContain('资产名称');
  expect(headers).toContain('月折旧额');
  expect(headers).toContain('累计折旧');
  expect(headers).toContain('账面净值');

  // Verify data rows exist
  const rows = await page.locator('tbody tr').count();
  expect(rows).toBeGreaterThan(0);
});
```

**物理测试命令**:

```bash
cd frontend && npx playwright test tests/e2e/approval.spec.ts
```

**验收标准**:
- ✅ 页面加载成功，无 JS Error
- ✅ 表格渲染完整，包含所有必需列
- ✅ 数据行数 > 0

---

### 4.5 定时任务测试

#### ATB-TC-011: 月度折旧定时任务执行

```java
// backend/src/test/java/com/ams/task/DepreciationSyncTaskTest.java

@Test
@DisplayName("月度折旧同步任务正常执行")
void testMonthlyDepreciationSync() {
    // Given
    when(assetRepository.findActiveAssets()).thenReturn(mockActiveAssets);

    // When
    DepreciationSyncResult result = depreciationSyncTask.execute();

    // Then
    assertEquals(mockActiveAssets.size(), result.getProcessedCount());
    assertTrue(result.getTotalDepreciation().compareTo(BigDecimal.ZERO) > 0);
    verify(depreciationRecordRepository, times(mockActiveAssets.size())).save(any());
}
```

**物理测试命令**:

```bash
cd backend && ./mvnw test -Dtest=DepreciationSyncTaskTest -q
```

**验收标准**:
- ✅ 处理数量 = 活跃资产数量
- ✅ 每个资产生成 1 条月度折旧记录
- ✅ 分布式锁机制正常工作（并发执行不重复计算）

---

## 5. 开发切入层级序列

### 5.1 层级依赖图

```
┌─────────────────────────────────────────────────────────────────┐
│                        6. 前端展示层                             │
│         (折旧报表组件 / 资产关联视图)                           │
├─────────────────────────────────────────────────────────────────┤
│                        5. 前端服务层                            │
│         (depreciationService.ts / 类型定义)                     │
├─────────────────────────────────────────────────────────────────┤
│                        4. API 端点层                            │
│         (DepreciationController.java / 请求校验)                │
├─────────────────────────────────────────────────────────────────┤
│                        3. 业务逻辑层                             │
│         (DepreciationService.java / 算法调度)                   │
├─────────────────────────────────────────────────────────────────┤
│                        2. 数据访问层                            │
│         (DepreciationRecordMapper.java / Repository)           │
├─────────────────────────────────────────────────────────────────┤
│                        1. 数据库层                              │
│         (Entity 定义 / Table Schema)                           │
└─────────────────────────────────────────────────────────────────┘
                           ↑
                     开发起点
```

### 5.2 详细实施步骤

#### Phase 1: 后端服务层完善 (Day 1-3)

| 步骤 | 任务 | 交付物 | 时长 |
|------|------|--------|------|
| 1.1 | 分析既有 `StraightLineDepreciation.java` 和 `DoubleDecliningBalanceDepreciation.java` | 代码理解文档 | 0.5d |
| 1.2 | 完善 `DepreciationService.java` 服务封装 | `service/DepreciationService.java` | 1d |
| 1.3 | 完善 `DepreciationController.java` REST 端点 | `controller/DepreciationController.java` | 1d |
| 1.4 | 编写服务层单元测试 | `DepreciationServiceTest.java` | 0.5d |

**DepreciationService.java 接口定义**:

```java
public interface DepreciationService {
    
    /**
     * 计算直线法折旧
     *
     * @param originalValue 原值
     * @param residualRate 残值率 (0-1)
     * @param usefulLifeYears 使用年限
     * @return 折旧计算结果
     */
    DepreciationResult calculateStraightLine(
        BigDecimal originalValue, 
        BigDecimal residualRate, 
        int usefulLifeYears
    );
    
    /**
     * 计算双倍余额递减法折旧
     *
     * @param originalValue 原值
     * @param usefulLifeYears 使用年限
     * @param currentYear 当前年度
     * @param currentNetValue 当前账面净值
     * @return 折旧计算结果
     */
    DepreciationResult calculateDoubleDeclining(
        BigDecimal originalValue,
        int usefulLifeYears,
        int currentYear,
        BigDecimal currentNetValue
    );
    
    /**
     * 生成月度折旧记录
     *
     * @param assetId 资产ID
     * @param calculateDate 计算日期
     * @return 折旧记录列表
     */
    List<DepreciationRecord> generateMonthlyRecords(UUID assetId, LocalDate calculateDate);
    
    /**
     * 获取资产折旧明细表
     *
     * @param assetId 资产ID
     * @return 折旧记录列表
     */
    List<DepreciationRecord> getAssetDepreciationSchedule(UUID assetId);
}
```

---

#### Phase 2: 定时任务完善 (Day 4-5)

| 步骤 | 任务 | 交付物 | 时长 |
|------|------|--------|------|
| 2.1 | 分析既有 `DepreciationSyncTask.java` | 代码理解文档 | 0.5d |
| 2.2 | 完善定时任务逻辑（分布式锁、错误处理） | `task/DepreciationSyncTask.java` | 1d |
| 2.3 | 编写定时任务单元测试 | `DepreciationSyncTaskTest.java` | 0.5d |

**定时任务 CRON 配置**:

```java
@Scheduled(cron = "0 59 23 L * ?")  // 每月最后一日 23:59
public DepreciationSyncResult executeMonthlySync() {
    // 分布式锁保护
    String lockKey = "depreciation:sync:" + YearMonth.now();
    return distributedLock.executeWithLock(lockKey, () -> {
        return doSync();
    });
}
```

---

#### Phase 3: 前端服务层实现 (Day 6-8)

| 步骤 | 任务 | 交付物 | 时长 |
|------|------|--------|------|
| 3.1 | 完善 `depreciationService.ts` 方法实现 | `services/depreciationService.ts` | 1d |
| 3.2 | 完善 `depreciation.types.ts` 类型定义 | `types/depreciation.types.ts` | 0.5d |
| 3.3 | 集成 `auditApi.ts` 资产详情折旧数据 | `pages/AssetDetailPage/services/auditApi.ts` | 1d |
| 3.4 | 编写前端单元测试 | `tests/unit/depreciationService.test.ts` | 1d |

**depreciationService.ts 核心方法**:

```typescript
/**
 * 获取资产折旧记录
 *
 * @param assetId - 资产ID
 * @param startPeriod - 起始期间 (YYYY-MM, 可选)
 * @param endPeriod - 结束期间 (YYYY-MM, 可选)
 * @returns Promise<DepreciationRecord[]> 折旧记录列表
 */
export async function getDepreciationRecords(
  assetId: string,
  startPeriod?: string,
  endPeriod?: string
): Promise<DepreciationRecord[]> {
  const response = await request.get<DepreciationRecord[]>(
    '/api/v1/depreciation/records',
    { params: { assetId, startPeriod, endPeriod } }
  );
  return response.data;
}

/**
 * 获取折旧汇总报表
 *
 * @param year - 年份
 * @param month - 月份
 * @returns Promise<DepreciationSummary> 折旧汇总数据
 */
export async function getDepreciationSummary(
  year: number,
  month: number
): Promise<DepreciationSummary> {
  const response = await request.get<DepreciationSummary>(
    '/api/v1/depreciation/summary',
    { params: { year, month } }
  );
  return response.data;
}

/**
 * 获取折旧任务状态
 *
 * @returns Promise<DepreciationSyncTaskStatus> 任务执行状态
 */
export async function getDepreciationTaskStatus(): Promise<DepreciationSyncTaskStatus> {
  const response = await request.get<DepreciationSyncTaskStatus>(
    '/api/v1/depreciation/task/status'
  );
  return response.data;
}
```

---

#### Phase 4: 前后端联调 (Day 9-10)

| 步骤 | 任务 | 交付物 | 时长 |
|------|------|--------|------|
| 4.1 | API 接口联调 | - | 1d |
| 4.2 | E2E 测试执行 | `tests/e2e/approval.spec.ts` | 0.5d |
| 4.3 | 缺陷修复 | - | 0.5d |

---

#### Phase 5: 交付验收 (Day 11-14)

| 步骤 | 任务 | 交付物 | 时长 |
|------|------|--------|------|
| 5.1 | 执行全量 ATB 测试用例 | 11 项测试全部通过 | 1d |
| 5.2 | 代码审查 | - | 1d |
| 5.3 | 文档完善 | `docs/api/v1_depreciation_spec.md` | 0.5d |
| 5.4 | 迭代总结 | `docs/iteration/iteration1_summary.md` | 0.5d |

---

### 5.3 风险项与缓解策略

| 风险 ID | 风险描述 | 影响等级 | 缓解策略 |
|---------|----------|----------|----------|
| RISK-003-01 | 双倍余额递减法最后两年转直线法逻辑复杂 | 中 | 增加边界 case 单元测试覆盖率至 100% |
| RISK-003-02 | 定时任务与手动重算可能冲突 | 高 | Redis 分布式锁 + 数据库 UNIQUE 约束双重保护 |
| RISK-003-03 | 历史数据补算影响已有折旧记录 | 高 | 手动重算需二次确认 + 审计日志记录 |
| RISK-003-04 | 资产属性变更（如使用年限调整） | 中 | 折旧计算基于快照，变更后重新生成后续记录 |
| RISK-003-05 | 前端 TypeScript 类型与后端 DTO 不一致 | 中 | 使用 OpenAPI Schema 生成类型定义 |

---

## 附录

### A. 术语表

| 术语 | 定义 |
|------|------|
| 直线法 | Straight-Line Method，年折旧额固定的折旧方法 |
| 双倍余额递减法 | Double Declining Balance Method，年折旧率固定的加速折旧法 |
| 残值率 | 预计残值占原值的比例 |
| 账面净值 | Original Value - Accumulated Depreciation |
| 月折旧额 | Annual Depreciation / 12 |
| 累计折旧 | Accumulated Depreciation，已计提折旧总额 |

### B. 参考标准

| 标准 | 说明 |
|------|------|
| 企业会计准则第4号 | 固定资产 |
| IFRS IAS 16 | Property, Plant and Equipment |

### C. 相关文档链接

| 文档 | 路径 |
|------|------|
| 系统架构设计 | `docs/architecture/system_design.md` |
| 数据库设计 | `docs/database/schema_design.md` |
| 后端折旧服务实现 | `backend/src/main/java/com/ams/service/impl/` |
| 前端折旧服务 | `frontend/src/services/depreciationService.ts` |
| 部署手册 | `docs/deployment/deployment_guide.md` |

### D. 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| 1.0.0 | 2025-01-15 | - | 初始版本创建 |