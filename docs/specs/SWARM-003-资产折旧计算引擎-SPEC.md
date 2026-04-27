# SWARM-003 资产折旧计算引擎 规格指导文档

## 版本与状态

| 属性 | 值 |
|------|-----|
| 任务编号 | SWARM-003 |
| 当前迭代 | Iteration 1 |
| 文档状态 | 正式版 |
| 覆盖范围 | 需求定义 → 技术规格 → 验收基准 |
| 关联实体 | `backend/src/main/java/com/ams/entity/AssetDepreciation.java` |

---

## 1. 需求与背景

### 1.1 业务背景

企业资产管理中，固定资产折旧是财务核算的核心环节。传统手工折旧计算存在以下痛点：

- **时效性差**：人工计算无法保证折旧数据的实时更新
- **误差风险**：多资产批量计算时容易出现公式错误或遗漏
- **口径不统一**：不同人员可能采用不同的折旧计算方式
- **报表滞后**：月末/年末集中计提时工作量剧增

### 1.2 核心需求

| 需求编号 | 描述 | 优先级 |
|----------|------|--------|
| REQ-001 | 支持直线法（平均年限法）折旧计算 | P0 |
| REQ-002 | 支持双倍余额递减法折旧计算 | P0 |
| REQ-003 | 定时任务自动执行折旧数据更新 | P0 |
| REQ-004 | 用户可在线查看资产折旧报表 | P1 |
| REQ-005 | 折旧计算结果可追溯历史记录 | P1 |

### 1.3 功能边界

```
┌─────────────────────────────────────────────────────────────┐
│                      资产折旧计算引擎                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   资产主数据  │  │  折旧算法库  │  │     定时调度器      │  │
│  │  (增删改查)  │  │  (直线法/    │  │  (Cron表达式触发)   │  │
│  │             │  │   双倍余额)  │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │                │                    │             │
│         └────────────────┼────────────────────┘             │
│                          ▼                                  │
│               ┌─────────────────┐                           │
│               │   折旧计算引擎   │                           │
│               │  (核心处理器)    │                           │
│               └─────────────────┘                           │
│                          │                                  │
│         ┌────────────────┼────────────────┐                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ 折旧明细记录 │  │ 折旧汇总报表 │  │  变更日志   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 当前 Phase 对应实施目标

> **Phase 拆解依据**：基于功能依赖关系与交付价值，划分为 3 个 Phase

### Phase 1: 核心引擎与算法实现（本次迭代重点）

| 目标编号 | 目标描述 | 产出物 |
|----------|----------|--------|
| GOAL-1.1 | 实现资产主数据模型与 CRUD 接口 | Asset 实体类 + REST API |
| GOAL-1.2 | 实现直线法折旧算法 | DepreciationService.linear() |
| GOAL-1.3 | 实现双倍余额递减法折旧算法 | DepreciationService.ddb() |
| GOAL-1.4 | 完成折旧计算核心逻辑集成 | CalculationEngine 处理器 |

**技术约束**：
- 资产原值必须 > 0
- 预计使用年限必须 >= 1（年为单位）
- 残值率范围：0% ~ 50%
- 净残值 = 原值 × 残值率

### Phase 2: 定时任务与数据更新机制

| 目标编号 | 目标描述 | 产出物 |
|----------|----------|--------|
| GOAL-2.1 | 实现折旧定时计算任务 | ScheduledJob + Cron 配置 |
| GOAL-2.2 | 实现折旧记录持久化 | DepreciationRecord 实体 + 存储 |
| GOAL-2.3 | 实现计算历史追溯 | AuditLog + 历史版本查询 |

**技术约束**：
- 定时任务默认执行时间：每日凌晨 02:00
- Cron 表达式可配置化
- 任务执行失败需记录重试次数（最多 3 次）
- 计算批次号全局唯一

### Phase 3: 报表展示与用户交互

| 目标编号 | 目标描述 | 产出物 |
|----------|----------|--------|
| GOAL-3.1 | 开发折旧报表 API | /api/v1/depreciation/report |
| GOAL-3.2 | 支持多维度查询（按资产/按期间/按部门） | QueryService + Filter 参数 |
| GOAL-3.3 | 实现报表导出功能（Excel/CSV） | ExportService |

**技术约束**：
- 单次查询最大返回 10,000 条记录
- 报表数据保留期限：至少 7 年（财务合规要求）
- 分页参数：page, page_size（默认 20 条/页）

---

## 3. 边界约束

### 3.1 折旧算法定义

#### 直线法（平均年限法）

```
年折旧额 = (原值 - 净残值) / 预计使用年限
月折旧额 = 年折旧额 / 12

其中：
- 净残值 = 原值 × 残值率
- 当残值率未指定时，默认 5%
```

#### 双倍余额递减法

```
年折旧率 = 2 / 预计使用年限 × 100%
年折旧额 = 年初账面净值 × 年折旧率

约束条件：
- 最后两年改用直线法（摊销剩余净值 - 净残值）
- 账面净值最低降至净残值
```

### 3.2 数据约束

| 字段 | 类型 | 约束 | 备注 |
|------|------|------|------|
| asset_code | VARCHAR(50) | NOT NULL, UNIQUE | 资产编码 |
| asset_name | VARCHAR(200) | NOT NULL | 资产名称 |
| original_value | DECIMAL(18,2) | > 0 | 原值 |
| useful_life | INT | >= 1 | 使用年限（年） |
| salvage_rate | DECIMAL(5,2) | 0~50 | 残值率(%) |
| depreciation_method | ENUM | 'LINEAR', 'DDB' | 折旧方法 |
| purchase_date | DATE | NOT NULL | 购置日期 |
| status | ENUM | 'ACTIVE', 'DISPOSED', 'IMPAIRED' | 资产状态 |

### 3.3 业务约束

```
禁止项：
✗ 已处置(Disposed)的资产不再计提折旧
✗ 已全额计提折旧的资产不再计入计算
✗ 减值处理后的资产需重新计算剩余期间

限制项：
○ 单次计算任务最大处理资产数：50,000
○ 定时任务执行超时阈值：30 分钟
○ 报表导出最大行数：100,000
```

### 3.4 系统边界

```
┌──────────────────────────────────────────────────────────────┐
│                        系统边界定义                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   用户请求 ──► API Gateway ──► 业务服务层                     │
│                                     │                        │
│                           ┌─────────┴─────────┐             │
│                           ▼                   ▼              │
│                    折旧计算引擎         报表查询服务           │
│                           │                   │              │
│                           ▼                   ▼              │
│                    定时调度中心 ←─────── 数据持久化层           │
│                           │                                    │
│                           ▼                                    │
│                    折旧记录存储 (MySQL)                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘

外部依赖边界：
- 数据库：MySQL 8.0+ / PostgreSQL 12+
- 定时框架：Quartz / Spring Scheduler
- 禁止循环依赖业务模块
```

---

## 4. 验收测试基准 (ATB)

### 4.1 Phase 1 核心验收

#### ATB-1.1: 资产主数据管理

```java
/**
 * AssetDepreciation 实体类验收测试
 * 
 * TC-001: 创建有效资产折旧记录应返回成功
 * TC-002: 原值为 0 或负数应返回校验错误
 * TC-003: 重复资产编码应返回 409 Conflict
 */
class AssetDepreciationEntityTest {
    
    @Test
    void testCreateDepreciationRecord_Success() {
        // 场景：原值 100,000，残值率 5%，使用年限 5 年
        AssetDepreciation record = AssetDepreciation.builder()
            .assetCode("FA-2024-001")
            .assetName("生产设备 A")
            .originalValue(new BigDecimal("100000.00"))
            .usefulLife(5)
            .salvageRate(new BigDecimal("5.0"))
            .depreciationMethod(DepreciationMethod.LINEAR)
            .purchaseDate(LocalDate.of(2024, 1, 15))
            .build();
        
        assertNotNull(record.getId());
        assertEquals("FA-2024-001", record.getAssetCode());
        assertEquals(new BigDecimal("100000.00"), record.getOriginalValue());
    }
    
    @Test
    void testOriginalValueMustBePositive() {
        // 场景：原值为 0
        assertThrows(ConstraintViolationException.class, () -> {
            AssetDepreciation record = AssetDepreciation.builder()
                .originalValue(BigDecimal.ZERO)  // 必须 > 0
                .build();
        });
    }
}
```

#### ATB-1.2: 直线法折旧计算

```java
/**
 * 直线法折旧算法验证
 * 
 * TC-010: 直线法年折旧额计算
 * TC-011: 直线法月折旧额计算
 * TC-012: 36 个月后累计折旧验证
 */
class StraightLineDepreciationTest {
    
    @Test
    void testLinearYearlyDepreciation() {
        // 场景：原值 100,000，残值率 5%，使用年限 5 年
        // 预期：净残值 = 5,000，年折旧额 = 19,000
        DepreciationResult result = depreciationService.calculateLinear(
            DepreciationRequest.builder()
                .originalValue(new BigDecimal("100000.00"))
                .salvageRate(new BigDecimal("5.0"))
                .usefulLife(5)
                .calculationType(CalculationType.YEARLY)
                .build()
        );
        
        assertEquals(new BigDecimal("19000.00"), result.getAnnualDepreciation());
        assertEquals(new BigDecimal("5000.00"), result.getNetSalvageValue());
        assertEquals(new BigDecimal("95000.00"), result.getTotalDepreciation());
    }
    
    @Test
    void testLinearMonthlyDepreciation() {
        // 月折旧 = (120000 - 6000) / 10 / 12 = 950
        DepreciationResult result = depreciationService.calculateLinear(
            DepreciationRequest.builder()
                .originalValue(new BigDecimal("120000.00"))
                .salvageRate(new BigDecimal("5.0"))
                .usefulLife(10)
                .calculationType(CalculationType.MONTHLY)
                .build()
        );
        
        assertEquals(new BigDecimal("950.00"), result.getMonthlyDepreciation());
    }
    
    @Test
    void testLinearAccumulatedAfter36Months() {
        // 36 个月后累计折旧
        DepreciationResult result = depreciationService.calculateLinear(
            DepreciationRequest.builder()
                .originalValue(new BigDecimal("60000.00"))
                .salvageRate(new BigDecimal("10.0"))
                .usefulLife(5)
                .calculationType(CalculationType.ACCUMULATED)
                .months(36)
                .build()
        );
        
        // (60000 - 6000) / 5 * 3 = 32400
        assertEquals(new BigDecimal("32400.00"), result.getAccumulatedDepreciation());
        assertEquals(new BigDecimal("21600.00"), result.getCurrentBookValue());
    }
}
```

#### ATB-1.3: 双倍余额递减法折旧计算

```java
/**
 * 双倍余额递减法折旧算法验证
 * 
 * TC-020: 双倍余额递减法年折旧计算
 * TC-021: 双倍余额递减法最后两年转直线法
 * TC-022: 账面净值不得低于净残值
 */
class DoubleDecliningBalanceDepreciationTest {
    
    @Test
    void testDDBAnnualDepreciation() {
        // 场景：原值 100,000，使用年限 5 年
        // 年折旧率 = 2/5 = 40%
        // 第1年：100,000 × 40% = 40,000
        // 第2年：(100,000-40,000) × 40% = 24,000
        // 第3年：(60,000-24,000) × 40% = 14,400
        DepreciationResult result = depreciationService.calculateDDB(
            DepreciationRequest.builder()
                .originalValue(new BigDecimal("100000.00"))
                .usefulLife(5)
                .year(1)
                .build()
        );
        
        assertEquals(new BigDecimal("40.0"), result.getDepreciationRate());
        assertEquals(new BigDecimal("40000.00"), result.getYearDepreciation());
        assertEquals(new BigDecimal("60000.00"), result.getEndingBookValue());
    }
    
    @Test
    void testDDBSwitchToLinearLastTwoYears() {
        // 第4年（第1个"最后两年"）：剩余账面值 / 2
        // 账面净值约 21,600，最后两年各摊 10,800
        DepreciationResult resultY4 = depreciationService.calculateDDB(
            DepreciationRequest.builder()
                .originalValue(new BigDecimal("100000.00"))
                .usefulLife(5)
                .year(4)
                .priorBookValues(Arrays.asList(
                    new BigDecimal("100000"),
                    new BigDecimal("60000"),
                    new BigDecimal("36000"),
                    new BigDecimal("21600")
                ))
                .build()
        );
        
        assertEquals(DepreciationMethod.LINEAR_SWITCH, resultY4.getDepreciationMethod());
        assertEquals(new BigDecimal("8800.00"), resultY4.getYearDepreciation());
    }
    
    @Test
    void testDDBBookValueNotBelowSalvage() {
        // 账面净值不得低于净残值
        DepreciationResult result = depreciationService.calculateDDB(
            DepreciationRequest.builder()
                .originalValue(new BigDecimal("50000.00"))
                .usefulLife(5)
                .year(5)
                .salvageValue(new BigDecimal("2500.00"))
                .build()
        );
        
        assertTrue(result.getEndingBookValue().compareTo(new BigDecimal("2500.00")) >= 0);
    }
}
```

### 4.2 Phase 2 验收

#### ATB-2.1: 定时任务执行

```java
/**
 * 定时折旧任务验证
 * 
 * TC-030: 定时任务在指定时间触发
 * TC-031: 只处理状态为 ACTIVE 的资产
 * TC-032: 每批次生成唯一批次号
 */
class ScheduledDepreciationJobTest {
    
    @Test
    void testScheduledJobExecutesOnTime() {
        // 模拟时钟到达 02:00
        when(clock.instant()).thenReturn(
            Instant.parse("2024-02-01T02:00:00Z")
        );
        
        scheduledJob.trigger();
        
        assertEquals(
            LocalDateTime.of(2024, 2, 1, 2, 0, 0),
            scheduledJob.getLastExecutionTime()
        );
    }
    
    @Test
    void testJobProcessesActiveAssetsOnly() {
        // 创建测试数据
        assetRepository.save(createAsset("ACTIVE-001", AssetStatus.ACTIVE));
        assetRepository.save(createAsset("DISPOSED-001", AssetStatus.DISPOSED));
        
        ScheduledDepreciationJob job = new ScheduledDepreciationJob();
        DepreciationBatchResult result = job.execute();
        
        List<String> processedAssets = result.getRecords()
            .stream()
            .map(DepreciationRecord::getAssetCode)
            .collect(Collectors.toList());
        
        assertTrue(processedAssets.contains("ACTIVE-001"));
        assertFalse(processedAssets.contains("DISPOSED-001"));
    }
    
    @Test
    void testBatchNumberGenerated() {
        String batch1 = scheduledJob.generateBatchNumber();
        String batch2 = scheduledJob.generateBatchNumber();
        
        assertNotEquals(batch1, batch2);
        assertTrue(batch1.startsWith("DEP"));
        assertTrue(batch1.matches("DEP\\d{14}")); // DEP + yyyyMMddHHmmss
    }
}
```

#### ATB-2.2: 计算历史追溯

```java
/**
 * 折旧计算历史追溯验证
 * 
 * TC-040: 计算完成后记录正确持久化
 * TC-041: 可按资产查询完整折旧历史
 * TC-042: 同一月份重复计算不产生重复记录
 */
class DepreciationHistoryTest {
    
    @Test
    void testRecordPersistedAfterCalculation() {
        DepreciationRecord record = depreciationService.calculateAndSave(
            DepreciationSaveRequest.builder()
                .assetId("ASSET-001")
                .calculationDate(LocalDate.of(2024, 1, 31))
                .build()
        );
        
        DepreciationRecord saved = depreciationRecordRepository
            .findById(record.getId())
            .orElse(null);
        
        assertNotNull(saved);
        assertTrue(saved.getDepreciationAmount().compareTo(BigDecimal.ZERO) > 0);
    }
    
    @Test
    void testHistoryQueryByAsset() {
        List<DepreciationRecord> records = depreciationService
            .getHistory(HistoryQueryRequest.builder()
                .assetId("ASSET-001")
                .build());
        
        // 验证按日期升序排列
        for (int i = 0; i < records.size() - 1; i++) {
            assertTrue(
                records.get(i).getCalculationDate()
                    .isBefore(records.get(i + 1).getCalculationDate())
            );
        }
    }
    
    @Test
    void testIdempotentSameMonthNoDuplicate() {
        // 第1次计算
        DepreciationRecord record1 = depreciationService.calculateAndSave(
            DepreciationSaveRequest.builder()
                .assetId("ASSET-001")
                .calculationDate(LocalDate.of(2024, 1, 31))
                .build()
        );
        
        // 第2次计算（幂等）
        DepreciationRecord record2 = depreciationService.calculateAndSave(
            DepreciationSaveRequest.builder()
                .assetId("ASSET-001")
                .calculationDate(LocalDate.of(2024, 1, 31))
                .build()
        );
        
        assertEquals(record1.getId(), record2.getId()); // 应返回同一记录
    }
}
```

### 4.3 Phase 3 验收

#### ATB-3.1: 报表 API

```java
/**
 * 折旧报表 API 验证
 * 
 * TC-050: 按资产编码查询报表
 * TC-051: 按日期区间查询报表
 * TC-052: 分页参数验证
 */
class DepreciationReportAPITest {
    
    @Test
    void testReportByAssetCode() {
        ResponseEntity<DepreciationReportResponse> response = restTemplate
            .getForEntity(
                "/api/v1/depreciation/report?asset_code=FA-2024-001",
                DepreciationReportResponse.class
            );
        
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().getTotal() >= 1);
        assertTrue(response.getBody().getItems().stream()
            .allMatch(item -> "FA-2024-001".equals(item.getAssetCode())));
    }
    
    @Test
    void testReportByDateRange() {
        ResponseEntity<DepreciationReportResponse> response = restTemplate
            .getForEntity(
                "/api/v1/depreciation/report?start_date=2024-01-01&end_date=2024-03-31",
                DepreciationReportResponse.class
            );
        
        assertEquals(HttpStatus.OK, response.getStatusCode());
        for (DepreciationReportItem item : response.getBody().getItems()) {
            LocalDate date = item.getCalculationDate();
            assertTrue(date.compareTo(LocalDate.of(2024, 1, 1)) >= 0);
            assertTrue(date.compareTo(LocalDate.of(2024, 3, 31)) <= 0);
        }
    }
    
    @Test
    void testPaginationLimits() {
        // 超过最大限制应返回 400
        ResponseEntity<ErrorResponse> response = restTemplate
            .getForEntity(
                "/api/v1/depreciation/report?page_size=1000", // 最大 500
                ErrorResponse.class
            );
        
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }
}
```

#### ATB-3.2: 报表导出

```java
/**
 * 报表导出功能验证
 * 
 * TC-060: Excel 格式导出
 * TC-061: 导出行数限制验证
 */
class ReportExportTest {
    
    @Test
    void testExportExcelFormat() {
        ResponseEntity<byte[]> response = restTemplate.exchange(
            "/api/v1/depreciation/report/export?format=excel&asset_code=FA-2024-001",
            HttpMethod.GET,
            null,
            byte[].class
        );
        
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            response.getHeaders().getContentType().toString()
        );
        assertTrue(
            response.getHeaders().getContentDisposition().toString().contains("attachment")
        );
    }
    
    @Test
    void testExportRowCountLimit() {
        // 请求导出超过 100,000 行应返回 400
        ResponseEntity<ErrorResponse> response = restTemplate
            .getForEntity(
                "/api/v1/depreciation/report/export?format=csv&limit=150000",
                ErrorResponse.class
            );
        
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(
            response.getBody().getDetail().toLowerCase().contains("exceeds maximum")
        );
    }
}
```

### 4.4 集成测试

```java
/**
 * 端到端集成测试
 * 
 * TC-100: 完整折旧生命周期
 */
class DepreciationEndToEndTest {
    
    @Test
    void testFullDepreciationLifecycle() {
        // 1. 创建资产
        Asset asset = assetService.createAsset(
            AssetCreateRequest.builder()
                .assetCode("E2E-001")
                .originalValue(new BigDecimal("60000.00"))
                .usefulLife(5)
                .salvageRate(new BigDecimal("5.0"))
                .depreciationMethod(DepreciationMethod.LINEAR)
                .build()
        );
        assertNotNull(asset.getId());
        
        // 2. 触发折旧计算（模拟定时任务）
        DepreciationRecord result = depreciationService.calculateAndSave(
            DepreciationSaveRequest.builder()
                .assetId(asset.getId())
                .calculationDate(LocalDate.of(2024, 12, 31))
                .build()
        );
        assertTrue(result.getDepreciationAmount().compareTo(BigDecimal.ZERO) > 0);
        
        // 3. 验证报表数据
        ResponseEntity<DepreciationReportResponse> report = restTemplate
            .getForEntity(
                "/api/v1/depreciation/report?asset_code=E2E-001",
                DepreciationReportResponse.class
            );
        assertEquals(HttpStatus.OK, report.getStatusCode());
        
        // 4. 导出验证
        byte[] exported = exportService.toExcel(
            ExportRequest.builder()
                .assetIds(Collections.singletonList(asset.getId()))
                .build()
        );
        assertNotNull(exported);
        assertTrue(exported.length > 0);
    }
}
```

---

## 5. 开发切入层级序列

### 5.1 依赖关系图

```
层级 0: 数据模型层
    │
    ▼
层级 1: 核心算法层
    │  依赖: Layer 0
    ▼
层级 2: 服务编排层
    │  依赖: Layer 1
    ▼
层级 3: 调度与任务层
    │  依赖: Layer 2
    ▼
层级 4: 接口与视图层
       依赖: Layer 2, Layer 3
```

### 5.2 开发顺序与交付里程碑

| 阶段 | 层级 | 模块 | 交付物 | 验收关联 |
|------|------|------|--------|----------|
| **Sprint 1** | L0 | 资产折旧实体模型 | `AssetDepreciation.java` | ATB-1.1 |
| | L0 | 折旧记录实体 | `DepreciationRecord.java` | ATB-2.2 |
| | L1 | 直线法算法 | `StraightLineDepreciation.java` | ATB-1.2 |
| | L1 | 双倍余额递减法算法 | `DoubleDecliningBalanceDepreciation.java` | ATB-1.3 |
| **Sprint 2** | L2 | 折旧计算服务 | `DepreciationService.java` | ATB-1.2, ATB-1.3 |
| | L2 | 报表查询服务 | `DepreciationReportService.java` | ATB-3.1 |
| | L3 | 定时任务调度器 | `DepreciationScheduler.java` | ATB-2.1 |
| **Sprint 3** | L4 | REST API 控制器 | `DepreciationController.java` | ATB-1.1, ATB-3.1 |
| | L4 | 导出功能 | `DepreciationExportController.java` | ATB-3.2 |
| **Sprint 4** | 全层 | 集成测试与修复 | E2E 测试报告 | ATB-E2E |

### 5.3 关键技术决策点

#### 决策点 1: 数据库选型

| 选项 | 优势 | 劣势 | 推荐 |
|------|------|------|------|
| MySQL | 生态成熟，事务支持 | 复杂查询性能一般 | ✓ 首选 |
| PostgreSQL | 高级 SQL 支持，JSON 类型 | 运维复杂度稍高 | 备选 |
| MongoDB | 文档存储灵活 | 事务支持较弱 | ✗ 不采用 |

#### 决策点 2: 定时框架选型

| 选项 | 适用场景 | 配置复杂度 | 推荐 |
|------|----------|------------|------|
| Spring @Scheduler | 简单定时任务 | 低 | ✓ 首选 |
| Quartz | 分布式/复杂调度 | 高 | 备选（扩展用） |

#### 决策点 3: 计算精度处理

```java
/**
 * 货币精度处理工具类
 * 
 * 决策：统一使用 DECIMAL(18,4) 存储中间计算结果
 *       最终报表展示 DECIMAL(18,2)
 * 理由：避免浮点精度丢失影响累计折旧准确性
 */
public class MoneyUtils {
    
    /** 数据库存储精度 */
    private static final int STORAGE_SCALE = 4;
    
    /** 显示精度 */
    private static final int DISPLAY_SCALE = 2;
    
    /**
     * 四舍五入到存储精度
     *
     * @param value 原始金额
     * @return 存储精度金额
     */
    public static BigDecimal roundForStorage(BigDecimal value) {
        return value.setScale(STORAGE_SCALE, RoundingMode.HALF_UP);
    }
    
    /**
     * 四舍五入到显示精度
     *
     * @param value 原始金额
     * @return 显示精度金额
     */
    public static BigDecimal roundForDisplay(BigDecimal value) {
        return value.setScale(DISPLAY_SCALE, RoundingMode.HALF_UP);
    }
}
```

---

## 6. 附录

### 6.1 术语表

| 术语 | 定义 |
|------|------|
| 直线法 (Linear/SLM) | 平均年限法，每年折旧额相等 |
| 双倍余额递减法 (DDB) | 加速折旧法，年折旧率固定但基数递减 |
| 账面净值 | 原值 - 累计折旧 |
| 净残值 | 原值 × 残值率 |
| 批次号 | 标识一次批量计算任务的唯一编码 |

### 6.2 参考标准

- 企业会计准则第 4 号——固定资产
- 企业所得税法实施条例第六十条（固定资产折旧年限表）
- ISO/IEC 25010:2011 软件产品质量要求

### 6.3 关联文件清单

| 文件路径 | 用途 | 状态 |
|----------|------|------|
| `backend/src/main/java/com/ams/entity/AssetDepreciation.java` | 资产折旧实体 | 待实现 |
| `backend/src/main/java/com/ams/entity/DepreciationRecord.java` | 折旧记录实体 | 待实现 |
| `backend/src/main/java/com/ams/service/impl/StraightLineDepreciation.java` | 直线法实现 | 已存在 |
| `backend/src/main/java/com/ams/service/impl/DoubleDecliningBalanceDepreciation.java` | 双倍余额递减法 | 已存在 |
| `backend/src/main/java/com/ams/service/DepreciationService.java` | 折旧服务 | 待扩展 |

### 6.4 文档版本

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0.0 | 2024-01-15 | 初始版本 | SWARM Team |

---

**文档结束**