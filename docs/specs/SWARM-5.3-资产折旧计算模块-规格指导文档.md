# SWARM-5.3 资产折旧计算模块 - 规格指导文档

> **版本**: v1.0  
> **状态**: 审核中  
> **Phase**: Phase 5 Iteration 1  
> **更新日期**: 2024

---

## 1. 需求与背景

### 1.1 业务需求概述

资产折旧计算模块为企业固定资产管理提供核心计算能力，支持两种国际通用的折旧计算方法，满足财务合规性和税务申报要求。

### 1.2 核心功能矩阵

| 功能点 | 描述 | 优先级 | 迭代范围 |
|--------|------|--------|----------|
| 直线折旧法 | 年限平均法，按预计使用年限均匀分摊成本 | P0 | Iteration 1 |
| 双倍余额递减法 | 加速折旧法，前期计提更多折旧 | P0 | Iteration 1 |
| 定时任务调度 | 按配置的周期自动触发折旧计算 | P0 | Iteration 2 |
| 折旧财务报表 | 输出标准格式折旧明细表与汇总表 | P1 | Iteration 3 |

### 1.3 技术驱动因素

- **财务核算同步**: 折旧计算需与 ERP 系统财务周期同步
- **税务合规**: 税务申报对折旧计算的精确性有硬性要求（误差≤0.01）
- **审计追溯**: 历史数据不可篡改，需保留每次计算的完整快照
- **自动化运维**: 定时任务减少人工干预，提升财务工作效率

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 5.3 实施范围

```
Phase 5.3: 资产折旧计算模块
├── 5.3.1 折旧计算引擎核心实现          ← Iteration 1 (当前)
├── 5.3.2 定时任务调度框架集成          ← Iteration 2
└── 5.3.3 折旧报表生成接口              ← Iteration 3
```

### 2.2 Iteration 1 交付目标

本次迭代聚焦于 **5.3.1 折旧计算引擎核心实现**，构建以下交付物：

| 交付物 | 文件路径 | 职责说明 |
|--------|----------|----------|
| 直线折旧计算器 | `backend/src/main/java/com/ams/service/impl/StraightLineDepreciation.java` | 实现年限平均法 |
| 双倍余额递减计算器 | `backend/src/main/java/com/ams/service/impl/DoubleDecliningBalanceDepreciation.java` | 实现加速折旧法 |
| 统一计算接口 | `backend/src/main/java/com/ams/service/impl/DepreciationCalculator.java` | 抽象基类定义 |
| 折旧记录实体 | `backend/src/main/java/com/ams/entity/DepreciationRecord.java` | 折旧数据持久化模型 |
| 折旧配置实体 | `backend/src/main/java/com/ams/entity/DepreciationConfig.java` | 折旧参数配置模型 |
| 折旧服务层 | `backend/src/main/java/com/ams/service/DepreciationService.java` | 业务编排层 |
| 单元测试-直线法 | `backend/src/test/java/com/ams/service/impl/StraightLineDepreciationTest.java` | 直线法测试 |
| 单元测试-双倍余额 | `backend/src/test/java/com/ams/service/impl/DoubleDecliningBalanceDepreciationTest.java` | 双倍余额测试 |
| 单元测试-折旧服务 | `backend/src/test/java/com/ams/service/DepreciationServiceTest.java` | 服务层测试 |
| E2E测试-折旧流程 | `frontend/tests/e2e/depreciation.spec.ts` | 前端折旧流程测试 |
| 定时任务接口 | `backend/src/main/java/com/ams/task/DepreciationSyncTask.java` | 预留接口(Iteration 2实现) |

---

## 3. 边界约束

### 3.1 功能边界

| 约束类型 | 限定条件 | 违反处理 |
|----------|----------|----------|
| 支持方法 | 仅限 `STRAIGHT_LINE`、`DOUBLE_DECLINING` | 拒绝未知方法 |
| 资产有效期 | `purchase_date` ≤ `depreciation_start_date` ≤ `useful_life_end_date` | 抛出 `ValidationException` |
| 金额精度 | 所有金额计算保留 2 位小数，`HALF_UP` 舍入 | 自动截断 |
| 使用年限 | 最小 1 年，最大 50 年 | 抛出 `ValidationException` |
| 残值率 | `salvage_rate` ∈ [0.0, 0.5]，即残值不超过原值的 50% | 抛出 `ValidationException` |
| 计算周期 | 仅支持 `YEARLY`、`MONTHLY` 两种粒度 | 拒绝其他枚举值 |
| 资产状态 | 仅对 `ACTIVE`、`IN_USE` 状态的资产计算折旧 | 跳过其他状态 |

### 3.2 技术边界

| 边界项 | 约束说明 |
|--------|----------|
| 持久化接口 | 本模块通过 Repository 接口与数据库解耦，不直接操作 DB |
| 定时调度 | 使用系统级 cron 表达式，不实现分布式调度（Iteration 2） |
| 报表格式 | 输出 JSON 结构，PDF 生成由下游模块负责 |
| 事务范围 | 单次折旧计算为独立事务，不跨资产批量 |

### 3.3 不可接受范围

```
┌─────────────────────────────────────────────────────────────┐
│  ❌ 不支持资产重估、减值处理                                  │
│  ❌ 不支持多币种资产（仅 CNY）                                │
│  ❌ 不支持中途处置（变卖、报废）的折旧冲销                     │
│  ❌ 不实现用户认证与权限控制（继承系统级权限）                  │
│  ❌ 不支持年数总和法                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 验收测试基准 (ATB)

### 4.1 物理测试期待矩阵

| 验收项 ID | 验收描述 | 测试方法 | 断言期待 | 最小用例数 | 测试文件 |
|-----------|----------|----------|----------|------------|----------|
| **ATB-5.3.1** | 直线法-完整周期 | `StraightLineDepreciationTest` | 折旧总和 = 原值 - 残值 | ≥3 | `StraightLineDepreciationTest.java` |
| **ATB-5.3.2** | 直线法-月度摊销 | `StraightLineDepreciationTest` | 最后一个月余额 = 残值 | ≥2 | `StraightLineDepreciationTest.java` |
| **ATB-5.3.3** | 直线法-年度等额 | `StraightLineDepreciationTest` | 每年折旧金额相等 | ≥2 | `StraightLineDepreciationTest.java` |
| **ATB-5.3.4** | 双倍余额-加速特性 | `DoubleDecliningBalanceDepreciationTest` | 第1年折旧 > 第2年折旧 | ≥3 | `DoubleDecliningBalanceDepreciationTest.java` |
| **ATB-5.3.5** | 双倍余额-余额下限 | `DoubleDecliningBalanceDepreciationTest` | 最终账面值 ≥ max(残值, 直线法余额) | ≥2 | `DoubleDecliningBalanceDepreciationTest.java` |
| **ATB-5.3.6** | 双倍余额-转换直线法 | `DoubleDecliningBalanceDepreciationTest` | 后期自动切换直线法 | ≥2 | `DoubleDecliningBalanceDepreciationTest.java` |
| **ATB-5.3.7** | 边界值-使用年限下界 | `DepreciationServiceTest` | 1年均返回有效结果 | ≥2 | `DepreciationServiceTest.java` |
| **ATB-5.3.8** | 边界值-使用年月上界 | `DepreciationServiceTest` | 50年均返回有效结果 | ≥2 | `DepreciationServiceTest.java` |
| **ATB-5.3.9** | 边界值-残值率0% | `DepreciationServiceTest` | 完全折旧无残值 | ≥1 | `DepreciationServiceTest.java` |
| **ATB-5.3.10** | 边界值-残值率50% | `DepreciationServiceTest` | 残值为原值50% | ≥1 | `DepreciationServiceTest.java` |
| **ATB-5.3.11** | 异常-无效日期 | `DepreciationServiceTest` | 抛出 `DepreciationValidationException` | ≥2 | `DepreciationServiceTest.java` |
| **ATB-5.3.12** | 异常-负值输入 | `DepreciationServiceTest` | 抛出 `DepreciationValidationException` | ≥3 | `DepreciationServiceTest.java` |
| **ATB-5.3.13** | 异常-残值率超限 | `DepreciationServiceTest` | 抛出 `DepreciationValidationException` | ≥2 | `DepreciationServiceTest.java` |
| **ATB-5.3.14** | 集成-计算一致性 | `DepreciationServiceTest` | 同资产两种方法结果可对比 | ≥1 | `DepreciationServiceTest.java` |
| **ATB-5.3.15** | 集成-持久化写入 | `DepreciationServiceTest` | 记录正确写入 Repository | Mock验证 | `DepreciationServiceTest.java` |
| **ATB-5.3.16** | E2E-折旧流程 | `depreciation.spec.ts` | 页面流程完整 | ≥5 场景 | `depreciation.spec.ts` |

### 4.2 标准测试 Fixture

```java
// 标准测试资产 (StraightLineDepreciationTest.java)
Asset STANDARD_ASSET = Asset.builder()
    .assetId("FA-2024-0001")
    .name("测试服务器")
    .purchaseDate(LocalDate.of(2024, 1, 1))
    .originalCost(new BigDecimal("100000.00"))
    .usefulLifeYears(5)
    .salvageRate(new BigDecimal("0.05"))  // 5%残值率
    .depreciationMethod(DepreciationMethod.STRAIGHT_LINE)
    .build();

// 双倍余额测试资产 (DoubleDecliningBalanceDepreciationTest.java)
Asset DDB_ASSET = Asset.builder()
    .assetId("FA-2024-0002")
    .name("研发设备")
    .purchaseDate(LocalDate.of(2024, 1, 1))
    .originalCost(new BigDecimal("50000.00"))
    .usefulLifeYears(5)
    .salvageRate(new BigDecimal("0.10"))  // 10%残值率
    .depreciationMethod(DepreciationMethod.DOUBLE_DECLINING)
    .build();
```

### 4.3 关键断言示例

```java
// ATB-5.3.1: 直线法完整周期
@Test
void testStraightLineCompleteCycle() {
    DepreciationSchedule schedule = calculator.calculate(STANDARD_ASSET);
    
    BigDecimal totalDepreciation = schedule.getTotalDepreciation();
    BigDecimal expectedDepreciation = new BigDecimal("95000.00"); // 100000 - 5000
    
    assertEquals(0, totalDepreciation.compareTo(expectedDepreciation),
        "折旧总和应等于原值减去残值");
}

// ATB-5.3.4: 双倍余额加速特性
@Test
void testDoubleDecliningAccelerated() {
    DepreciationSchedule schedule = calculator.calculate(DDB_ASSET);
    
    BigDecimal year1Dep = schedule.getPeriods().get(0).getDepreciationAmount();
    BigDecimal year2Dep = schedule.getPeriods().get(1).getDepreciationAmount();
    
    assertTrue(year1Dep.compareTo(year2Dep) > 0,
        "第1年折旧应大于第2年折旧");
}
```

### 4.4 测试执行要求

| 指标 | 门槛值 | 说明 |
|------|--------|------|
| 分支覆盖率 | ≥ 90% | 核心计算逻辑必须覆盖 |
| 用例执行时长 | < 30s | 所有用例总时长 |
| 回归基线 | 100% 通过 | 每次 PR 必须通过全部 ATB |
| Mock 策略 | Repository 层必须 Mock | 禁止真实数据库连接 |

---

## 5. 开发切入层级序列

### 5.1 层级架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Layer 5: 调度接口层                       │
│              (Iteration 2 扩展点，预留接口)                  │
├─────────────────────────────────────────────────────────────┤
│                    Layer 4: 持久化接口层                     │
│                  (Repository 接口定义)                       │
├─────────────────────────────────────────────────────────────┤
│                    Layer 3: 策略路由层                       │
│               (Service + Factory 路由)                       │
├─────────────────────────────────────────────────────────────┤
│                    Layer 2: 计算引擎层                       │
│        ★ 核心交付物 ★ 直线法 + 双倍余额递减实现               │
├─────────────────────────────────────────────────────────────┤
│                    Layer 1: 校验规则层                      │
│                  (输入校验 + 业务规则)                        │
├─────────────────────────────────────────────────────────────┤
│                    Layer 0: 领域模型层                       │
│               (Entity + Value Object)                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
              Layer 依赖方向 (自底向上)
```

### 5.2 层级详细说明

#### Layer 0: 领域模型层 (Domain Model)

**先决条件**: 其他所有层依赖此层

```
backend/src/main/java/com/ams/entity/
├── DepreciationRecord.java      # 折旧记录实体
├── DepreciationConfig.java      # 折旧配置实体
└── AssetDepreciation.java       # 资产折旧关联

backend/src/main/java/com/ams/common/
└── exception/
    ├── DepreciationException.java
    ├── DepreciationValidationException.java
    └── DepreciationCalculationException.java
```

**交付标准**: 所有数据模型可实例化，字段类型校验通过，JavaBean 验证注解完整。

#### Layer 1: 校验规则层 (Validation)

**前置依赖**: Layer 0

```
backend/src/main/java/com/ams/service/validation/
├── DepreciationValidator.java   # 输入校验器
└── DepreciationRules.java       # 业务规则集
```

**校验规则清单**:
| 规则 ID | 规则描述 | 错误码 |
|---------|----------|--------|
| VR-001 | 使用年限 ∈ [1, 50] | `VALIDATION_001` |
| VR-002 | 残值率 ∈ [0, 0.5] | `VALIDATION_002` |
| VR-003 | 原值 > 0 | `VALIDATION_003` |
| VR-004 | 采购日期 ≤ 折旧开始日期 | `VALIDATION_004` |
| VR-005 | 折旧方法为已知枚举 | `VALIDATION_005` |

#### Layer 2: 计算引擎层 (Calculator) ★ 核心 ★

**前置依赖**: Layer 0 + Layer 1

```
backend/src/main/java/com/ams/service/impl/
├── DepreciationCalculator.java              # 抽象基类
├── StraightLineDepreciation.java             # 直线法实现
├── DoubleDecliningBalanceDepreciation.java   # 双倍余额递减实现
└── DepreciationSchedule.java                 # 计算结果模型
```

**计算公式**:

| 方法 | 公式 | 说明 |
|------|------|------|
| 直线法 | 年折旧额 = (原值 - 残值) / 使用年限 | 每年等额 |
| 双倍余额递减 | 年折旧额 = 期初账面值 × (2 / 使用年限) | 余额递减，后期转直线法 |

**双倍余额递减法特殊规则**:
1. 最后两年强制转换为直线法
2. 若直线法折旧额 > 双倍余额法，则提前转换
3. 账面值不低于残值

#### Layer 3: 策略路由层 (Service)

**前置依赖**: Layer 2

```
backend/src/main/java/com/ams/service/
├── DepreciationService.java          # 业务编排
└── DepreciationCalculatorFactory.java # 工厂方法
```

**路由逻辑**:
```java
public DepreciationCalculator getCalculator(DepreciationMethod method) {
    return switch (method) {
        case STRAIGHT_LINE -> straightLineCalculator;
        case DOUBLE_DECLINING -> doubleDecliningCalculator;
        default -> throw new UnsupportedMethodException(method);
    };
}
```

#### Layer 4: 持久化接口层 (Repository)

**前置依赖**: Layer 3

```
backend/src/main/java/com/ams/repository/
├── DepreciationRecordMapper.java      # MyBatis Mapper
└── DepreciationConfigMapper.java       # MyBatis Mapper
```

**交付标准**: 接口定义完整，XML 映射文件就绪。

#### Layer 5: 调度接口层 (Scheduler) - Iteration 2 扩展点

**前置依赖**: Layer 4

```
backend/src/main/java/com/ams/task/
└── DepreciationSyncTask.java          # 定时任务接口(桩)
```

> **注意**: 本次 Iteration 预留接口占位，`@Scheduled` 注解暂不启用。

### 5.3 开发顺序约束

```
优先级  依赖关系
  1      Layer 0 (Domain Model) ──────────────────────────────────────┐
  2      Layer 1 (Validation) ───────────────────────────────────────┤
  3      Layer 2 (Calculator) ────────────────────────────────────────┤
  4      Layer 3 (Service) ───────────────────────────────────────────┤
  5      Layer 4 (Repository) ─────────────────────────────────────────┤
  6      Layer 5 (Scheduler) ──────────────────────────────────────────┘
  
  ★ TDD 顺序: Layer 2 → Layer 3 → Layer 4 (连写测试后实现)
```

---

## 6. 附录

### 6.1 关键数据模型

#### DepreciationSchedule 输出结构

```java
public class DepreciationSchedule {
    private String assetId;
    private DepreciationMethod method;
    private BigDecimal originalCost;
    private BigDecimal salvageValue;
    private BigDecimal totalDepreciation;
    private BigDecimal finalBookValue;
    private List<DepreciationPeriod> periods;
    
    // Getter/Setter...
}

public class DepreciationPeriod {
    private Integer periodNumber;        // 第N期
    private LocalDate periodStart;
    private LocalDate periodEnd;
    private String periodLabel;          // "2024-01" 或 "Year 1"
    private BigDecimal depreciationAmount;
    private BigDecimal accumulatedDepreciation;
    private BigDecimal bookValueAtEnd;
    private DepreciationMethod actualMethod;  // 双倍余额后期可能转换
}
```

#### 数据库表结构

```sql
-- 折旧记录表
CREATE TABLE depreciation_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    asset_id VARCHAR(50) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    depreciation_amount DECIMAL(15,2) NOT NULL,
    accumulated_depreciation DECIMAL(15,2) NOT NULL,
    book_value DECIMAL(15,2) NOT NULL,
    depreciation_method VARCHAR(20) NOT NULL,
    calculation_version VARCHAR(10) DEFAULT 'v1.0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_asset_period (asset_id, period_start)
);

-- 折旧配置表
CREATE TABLE depreciation_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    asset_id VARCHAR(50) NOT NULL,
    method VARCHAR(20) NOT NULL,
    useful_life_months INT NOT NULL,
    salvage_rate DECIMAL(5,4) NOT NULL,
    depreciation_start_date DATE NOT NULL,
    config_version VARCHAR(10) DEFAULT 'v1.0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_asset (asset_id)
);
```

### 6.2 Cron 表达式规范 (Iteration 2)

```
折旧计算定时任务建议配置:
┌────────────────────────────────────────┐
│ 月度折旧: 0 0 1 1 * ?   # 每月1日00:00 │
│ 年度折旧: 0 0 0 1 1 ?   # 每年1月1日  │
└────────────────────────────────────────┘
```

### 6.3 变更文件清单

| 文件路径 | 操作 | 变更说明 |
|----------|------|----------|
| `backend/src/main/java/com/ams/service/impl/StraightLineDepreciation.java` | 新增 | 直线折旧计算器 |
| `backend/src/main/java/com/ams/service/impl/DoubleDecliningBalanceDepreciation.java` | 新增 | 双倍余额折旧计算器 |
| `backend/src/main/java/com/ams/service/impl/DepreciationCalculator.java` | 新增 | 抽象基类 |
| `backend/src/main/java/com/ams/service/DepreciationService.java` | 修改 | 新增计算方法 |
| `backend/src/main/java/com/ams/entity/DepreciationRecord.java` | 修改 | 完善字段 |
| `backend/src/main/java/com/ams/entity/DepreciationConfig.java` | 修改 | 完善字段 |
| `backend/src/main/java/com/ams/task/DepreciationSyncTask.java` | 修改 | 预留接口 |
| `backend/src/main/java/com/ams/controller/DepreciationController.java` | 修改 | 新增 API |
| `backend/src/test/java/com/ams/service/impl/StraightLineDepreciationTest.java` | 新增 | 直线法测试 |
| `backend/src/test/java/com/ams/service/impl/DoubleDecliningBalanceDepreciationTest.java` | 新增 | 双倍余额测试 |
| `backend/src/test/java/com/ams/service/DepreciationServiceTest.java` | 修改 | 补充用例 |
| `frontend/tests/e2e/depreciation.spec.ts` | 新增 | 前端 E2E 测试 |
| `frontend/src/app/pages/AuditDashboard/hooks/useAuditData.ts` | 修改 | 集成折旧数据 |
| `frontend/src/app/pages/AuditDashboard/components/FilterBar/FilterBar.module.css` | 修改 | 样式适配 |
| `tests/e2e/retirement_user_journey.spec.ts` | 修改 | 补充折旧场景 |
| `src/main.py` | 修改 | 预留入口 |

---

**文档状态**: 待评审  
**下次更新**: 基于 PR Review 反馈修订  
**审批人**: (待填写)