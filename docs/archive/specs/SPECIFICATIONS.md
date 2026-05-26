# SWARM-003 资产折旧计算模块 - 规格指导文档

**版本**: v2.0  
**迭代周期**: Iteration 2  
**状态**: 进行中  
**最后更新**: 2024-12-31

---

## 1. 需求与背景

### 1.1 业务需求

资产管理系统的折旧计算模块需支持两种折旧方法：

| 折旧方法 | 公式 | 适用场景 |
|---------|------|---------|
| **直线法 (Straight-Line)** | 年折旧额 = (原值 - 残值) / 使用年限 | 使用寿命均匀损耗的资产 |
| **双倍余额递减法 (Double Declining Balance)** | 年折旧率 = 2 / 使用年限，前期折旧高后期低 | 技术迭代快、前期价值损耗大的资产 |

### 1.2 当前迭代目标

Iteration 1 已完成基础数据模型与两种折旧方法的理论算法实现。Iteration 2 聚焦于：

| 目标编号 | 实施目标 | 交付物 |
|---------|---------|--------|
| P2-1 | 资产净值计算引擎 | 折旧计算服务类，含 `get_current_net_value()` 方法 |
| P2-2 | 月折旧额自动计算 | 折旧计划生成器，支持 `generate_monthly_depreciation_schedule()` |
| P2-3 | 折旧报表生成器 | 报表服务类，输出结构化报表数据 |

### 1.3 技术驱动因素

- **日期敏感性**：折旧计算涉及计算基准日，需确保 `purchase_date` 与 `as_of_date` 的时间差准确
- **精度要求**：金额计算统一使用 `Decimal` 类型，避免浮点运算精度丢失
- **报表维度**：支持按月 / 季 / 年维度的数据聚合
- **一致性约束**：净值不得低于残值，不得为负数

---

## 2. 当前 Phase 对应实施目标

> **Phase 2 定义**：「折旧计算服务层与报表引擎实现」

### 2.1 Phase 2 核心交付

```
src/application/depreciation/
├── calculators/
│   ├── base.py              # [Level 1] 抽象基类
│   ├── straight_line.py     # [Level 1] 直线法计算器 ⭐ 本次聚焦
│   └── double_declining.py  # [Level 1] 双倍余额递减计算器
├── services/
│   ├── depreciation_service.py    # [Level 2] 折旧计算聚合服务
│   └── report_service.py          # [Level 3] 报表生成服务
└── schemas/
    └── depreciation.py       # [Level 1] 数据模型定义
```

### 2.2 与 Phase 1 的衔接关系

| Phase 1 已交付 | Phase 2 依赖关系 | 扩展内容 |
|---------------|-----------------|---------|
| `DepreciationMethod` 抽象类 | 被 `StraightLineCalculator` 继承 | 新增 `calculate_net_value()` |
| `StraightLineMethod` 实现 | 被 `StraightLineCalculator` 组合使用 | 扩展为全生命周期计算 |
| `DepreciationRecord` 数据模型 | 复用字段定义 | 新增净值字段 |

---

## 3. 边界约束

### 3.1 功能边界

```
┌─────────────────────────────────────────────────────────┐
│                      输入边界                            │
├─────────────────────────────────────────────────────────┤
│  资产原值 (original_value)    正数，最大精度 4 位小数    │
│  使用年限 (useful_life)       正整数，范围 [1, 50] 年    │
│  预计残值 (residual_value)    非负数，不超过原值的 50%   │
│  购置日期 (purchase_date)     有效日期 YYYY-MM-DD        │
│  计算基准日 (as_of_date)       有效日期，不早于购置日     │
│  折旧方法 (method)            "STRAIGHT_LINE" |         │
│                               "DOUBLE_DECLINING"         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                      输出边界                            │
├─────────────────────────────────────────────────────────┤
│  当前净值 (current_net_value)  ≥ residual_value 且 ≤ original_value │
│  月折旧额 (monthly_depreciation)  正数或零              │
│  累计折旧额 (accumulated_depreciation)  ≤ (原值 - 残值)  │
│  报表期间 (period)             连续无跳跃，按自然月对齐   │
└─────────────────────────────────────────────────────────┘
```

### 3.2 非功能性约束

| 约束类型 | 限制条件 |
|---------|---------|
| **计算精度** | `Decimal` 类型，金额精度保留 4 位小数 |
| **性能要求** | 单笔资产折旧计算响应时间 ≤ 50ms |
| **并发限制** | 同资产同时只允许一个计算请求（乐观锁） |
| **报表规模** | 单次报表生成最大支持 10,000 条资产记录 |
| **使用年限** | 范围 [1, 50] 年，超出范围抛出 `ValidationError` |
| **残值上限** | 不得超过原值的 50% |

### 3.3 明确排除范围

- ❌ 资产新增、修改、删除操作（由资产管理模块负责）
- ❌ 折旧凭证生成与凭证号管理（由财务模块负责）
- ❌ 多币种换算
- ❌ 税务折旧与会计折旧差异处理

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 直线法资产净值计算验证

**测试目标**: 验证 `StraightLineCalculator.calculate_net_value()` 的计算准确性

#### ATB-1.1: 满年计算

```python
# 场景: 直线法资产，购置满 1 年时的净值计算
# 输入: 原值=100000, 年限=10, 残值=5000, 购置日=2023-01-01, 计算日=2024-01-01
# 期待: 年折旧额 = (100000-5000)/10 = 9500, 净值 = 100000-9500 = 90500

def test_straight_line_net_value_at_year_end():
    """
    验证直线法满年净值计算正确性
    
    Given: 原值=100000, 使用年限=10年, 残值=5000, 购置日=2023-01-01
    When: 计算日期为 2024-01-01 (满1年)
    Then: 净值应为 90500.0000
    """
    calculator = StraightLineCalculator()
    result = calculator.calculate_net_value(
        original_value=Decimal("100000"),
        useful_life=10,
        residual_value=Decimal("5000"),
        purchase_date=date(2023, 1, 1),
        as_of_date=date(2024, 1, 1)
    )
    assert result == Decimal("90500.0000")
```

#### ATB-1.2: 部分年计算

```python
# 场景: 直线法资产，购置 6 个月后的净值计算
# 输入: 原值=60000, 年限=5, 残值=6000, 购置日=2023-07-01, 计算日=2024-01-01
# 期待: 月折旧额 = (60000-6000)/(5*12) = 900, 6个月折旧 = 5400, 净值 = 54600

def test_straight_line_net_value_partial_year():
    """
    验证直线法部分年（月）净值计算正确性
    
    Given: 原值=60000, 使用年限=5年, 残值=6000, 购置日=2023-07-01
    When: 计算日期为 2024-01-01 (6个月后)
    Then: 净值应为 54600.0000
    """
    calculator = StraightLineCalculator()
    result = calculator.calculate_net_value(
        original_value=Decimal("60000"),
        useful_life=5,
        residual_value=Decimal("6000"),
        purchase_date=date(2023, 7, 1),
        as_of_date=date(2024, 1, 1)
    )
    assert result == Decimal("54600.0000")
```

#### ATB-1.3: 残值为零

```python
# 场景: 残值为零，净值最终归零
# 输入: 原值=50000, 年限=5, 残值=0, 购置日=2020-01-01, 计算日=2025-01-01
# 期待: 折旧完毕，净值 = 0

def test_straight_line_zero_residual_value():
    """
    验证残值为零时净值正确归零
    
    Given: 原值=50000, 使用年限=5年, 残值=0, 购置日=2020-01-01
    When: 计算日期为 2025-01-01 (满5年)
    Then: 净值应为 0.0000
    """
    calculator = StraightLineCalculator()
    result = calculator.calculate_net_value(
        original_value=Decimal("50000"),
        useful_life=5,
        residual_value=Decimal("0"),
        purchase_date=date(2020, 1, 1),
        as_of_date=date(2025, 1, 1)
    )
    assert result == Decimal("0.0000")
```

#### ATB-1.4: 超期计算（净值保底残值）

```python
# 场景: 计算日超过使用年限后，净值不得低于残值
# 输入: 原值=100000, 年限=5, 残值=10000, 购置日=2020-01-01, 计算日=2030-01-01
# 期待: 净值 = 残值 = 10000

def test_straight_line_net_value_never_below_residual():
    """
    验证超期计算时净值不低于残值
    
    Given: 原值=100000, 使用年限=5年, 残值=10000, 购置日=2020-01-01
    When: 计算日期为 2030-01-01 (超过使用年限5年)
    Then: 净值应为 10000.0000 (保底残值)
    """
    calculator = StraightLineCalculator()
    result = calculator.calculate_net_value(
        original_value=Decimal("100000"),
        useful_life=5,
        residual_value=Decimal("10000"),
        purchase_date=date(2020, 1, 1),
        as_of_date=date(2030, 1, 1)
    )
    assert result == Decimal("10000.0000")
```

---

### 4.2 ATB-2: 月折旧计划生成验证

**测试目标**: 验证 `DepreciationScheduleGenerator.generate_monthly_schedule()` 的完整性

#### ATB-2.1: 计划完整性

```python
# 场景: 5 年期直线法资产，折旧计划条数验证
# 期待: 应生成 60 个月 (5*12) 条记录

def test_monthly_schedule_completeness():
    """
    验证折旧计划覆盖完整使用周期
    
    Given: 使用年限=5年
    When: 调用 generate_monthly_schedule()
    Then: 应生成 60 条月度记录 (5*12)
    """
    asset = Asset(
        original_value=Decimal("50000"),
        useful_life=5,
        residual_value=Decimal("5000"),
        purchase_date=date(2024, 1, 1),
        method="STRAIGHT_LINE"
    )
    generator = DepreciationScheduleGenerator()
    schedule = generator.generate_monthly_schedule(asset)
    
    assert len(schedule) == 60
    assert schedule[0].period == "2024-01"
    assert schedule[59].period == "2028-12"
```

#### ATB-2.2: 月折旧额精度

```python
# 场景: 月折旧额精度验证
# 输入: 原值=50000, 年限=5, 残值=5000
# 期待: 月折旧额 = (50000-5000)/(5*12) = 750.0000

def test_monthly_depreciation_amount():
    """
    验证月折旧额计算精度
    
    Given: 原值=50000, 使用年限=5年, 残值=5000
    When: 计算月折旧额
    Then: 月折旧额应为 750.0000
    """
    asset = Asset(
        original_value=Decimal("50000"),
        useful_life=5,
        residual_value=Decimal("5000"),
        purchase_date=date(2024, 1, 1),
        method="STRAIGHT_LINE"
    )
    generator = DepreciationScheduleGenerator()
    schedule = generator.generate_monthly_schedule(asset)
    
    for entry in schedule:
        assert entry.monthly_depreciation == Decimal("750.0000")
```

---

### 4.3 ATB-3: 边界条件与异常处理验证

#### ATB-3.1: 计算日期早于购置日期

```python
# 场景: 计算日期早于购置日期时应抛出 ValueError
# 输入: 购置日=2024-01-01, 计算日=2023-12-31
# 期待: 抛出 ValueError

def test_invalid_date_range_raises_error():
    """
    验证计算日期早于购置日期时抛出异常
    
    Given: 购置日=2024-01-01
    When: 计算日期为 2023-12-31 (早于购置日)
    Then: 应抛出 ValueError
    """
    with pytest.raises(ValueError, match="Calculation date cannot be before purchase date"):
        calculator = StraightLineCalculator()
        calculator.calculate_net_value(
            original_value=Decimal("100000"),
            useful_life=10,
            residual_value=Decimal("5000"),
            purchase_date=date(2024, 1, 1),
            as_of_date=date(2023, 12, 31)
        )
```

#### ATB-3.2: 使用年限超出范围

```python
# 场景: 使用年限超出 [1, 50] 范围时抛出 ValidationError
# 输入: useful_life=51
# 期待: 抛出 ValidationError

def test_invalid_useful_life_range():
    """
    验证使用年限范围校验
    
    Given: 使用年限=51 (超出范围)
    When: 创建资产对象
    Then: 应抛出 ValidationError
    """
    with pytest.raises(ValidationError, match="Useful life must be between 1 and 50"):
        Asset(
            original_value=Decimal("100000"),
            useful_life=51,
            residual_value=Decimal("5000"),
            purchase_date=date(2024, 1, 1),
            method="STRAIGHT_LINE"
        )
```

#### ATB-3.3: 残值超过原值 50%

```python
# 场景: 残值超过原值 50% 时应抛出 ValidationError
# 输入: 原值=100000, 残值=60000 (60%)
# 期待: 抛出 ValidationError

def test_residual_value_exceeds_limit():
    """
    验证残值不超过原值 50% 的约束
    
    Given: 原值=100000, 残值=60000 (60%)
    When: 创建资产对象
    Then: 应抛出 ValidationError
    """
    with pytest.raises(ValidationError, match="Residual value cannot exceed 50% of original value"):
        Asset(
            original_value=Decimal("100000"),
            useful_life=10,
            residual_value=Decimal("60000"),
            purchase_date=date(2024, 1, 1),
            method="STRAIGHT_LINE"
        )
```

---

## 5. 开发切入层级序列

### 5.1 开发顺序依赖图

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Level 1: 数据模型与核心算法 (无依赖)                                     │
│  ─────────────────────────────────────────                              │
│  [1.1] 扩展 Asset 数据模型，添加计算所需字段                              │
│  [1.2] 实现 StraightLineCalculator.calculate_net_value()               │
│  [1.3] 实现 DepreciationScheduleGenerator 月折旧计划生成器               │
│  [1.4] 单元测试覆盖 (ATB-1, ATB-2)                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Level 2: 折旧计算服务层 (依赖 Level 1)                                  │
│  ─────────────────────────────────────────                              │
│  [2.1] 实现 DepreciationCalculationService 聚合计算服务                  │
│  [2.2] 实现日期敏感性校验逻辑                                             │
│  [2.3] 实现双倍余额递减法的直线法切换逻辑                                 │
│  [2.4] 单元测试覆盖 (ATB-3)                                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Level 3: 报表引擎层 (依赖 Level 2)                                      │
│  ─────────────────────────────────────────                              │
│  [3.1] 实现 DepreciationReportGenerator 报表生成器                       │
│  [3.2] 实现期间汇总计算逻辑                                              │
│  [3.3] 实现按资产类别/部门的聚合维度                                     │
│  [3.4] 集成测试覆盖                                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Level 4: API 端点与集成 (依赖 Level 3)                                  │
│  ─────────────────────────────────────────                              │
│  [4.1] REST API 端点实现 (GET /depreciation/net-value, etc.)             │
│  [4.2] 端到端测试覆盖                                                     │
│  [4.3] 性能基准测试 (单笔计算 ≤ 50ms)                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 各层级交付检查点

| 层级 | 检查点命令 | 通过标准 |
|-----|-----------|---------|
| Level 1 | `pytest tests/unit/test_straight_line_calculator.py -v` | 全部用例通过 (≥ 95% 覆盖率) |
| Level 2 | `pytest tests/unit/test_depreciation_service.py -v` | 全部用例通过 |
| Level 3 | `pytest tests/unit/test_report_generator.py -v` | 报表结构与数据验证通过 |
| Level 4 | `pytest tests/integration/test_depreciation_api.py -v` | 端到端流程验证通过 |

---

## 6. 附录

### 6.1 核心接口定义

```python
# src/application/depreciation/calculators/base.py
from abc import ABC, abstractmethod
from decimal import Decimal
from datetime import date
from dataclasses import dataclass
from typing import List

@dataclass(frozen=True)
class DepreciationResult:
    """折旧计算结果"""
    current_net_value: Decimal
    accumulated_depreciation: Decimal
    period_depreciation: Decimal
    as_of_date: date

@dataclass(frozen=True)
class MonthlyDepreciationEntry:
    """月度折旧条目"""
    period: str                          # 格式: "YYYY-MM"
    monthly_depreciation: Decimal
    accumulated_depreciation: Decimal
    net_value_at_period_end: Decimal

class DepreciationCalculator(ABC):
    """折旧计算器抽象基类"""
    
    @abstractmethod
    def calculate_net_value(
        self,
        original_value: Decimal,
        useful_life: int,
        residual_value: Decimal,
        purchase_date: date,
        as_of_date: date
    ) -> DepreciationResult:
        """计算指定日期的资产净值"""
        pass
    
    @abstractmethod
    def generate_monthly_schedule(
        self,
        original_value: Decimal,
        useful_life: int,
        residual_value: Decimal,
        purchase_date: date
    ) -> List[MonthlyDepreciationEntry]:
        """生成完整的月度折旧计划"""
        pass
```

```python
# src/application/depreciation/calculators/straight_line.py
from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from dateutil.relativedelta import relativedelta
from typing import List

from .base import (
    DepreciationCalculator,
    DepreciationResult,
    MonthlyDepreciationEntry
)

class StraightLineCalculator(DepreciationCalculator):
    """直线法折旧计算器"""
    
    def calculate_net_value(
        self,
        original_value: Decimal,
        useful_life: int,
        residual_value: Decimal,
        purchase_date: date,
        as_of_date: date
    ) -> DepreciationResult:
        """
        计算直线法下指定日期的资产净值
        
        公式:
            年折旧额 = (原值 - 残值) / 使用年限
            累计折旧 = 年折旧额 × 已计提年数
            当前净值 = 原值 - 累计折旧 (保底残值)
        """
        if as_of_date < purchase_date:
            raise ValueError("Calculation date cannot be before purchase date")
        
        # 计算年折旧额
        depreciable_amount = original_value - residual_value
        annual_depreciation = depreciable_amount / Decimal(str(useful_life))
        annual_depreciation = annual_depreciation.quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
        
        # 计算已计提年数 (含月份)
        delta = relativedelta(as_of_date, purchase_date)
        total_months = delta.years * 12 + delta.months
        
        # 计算累计折旧
        monthly_depreciation = annual_depreciation / Decimal("12")
        accumulated_depreciation = monthly_depreciation * Decimal(str(total_months))
        accumulated_depreciation = accumulated_depreciation.quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
        
        # 计算当前净值 (保底残值)
        current_net_value = original_value - accumulated_depreciation
        if current_net_value < residual_value:
            current_net_value = residual_value
        current_net_value = current_net_value.quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
        
        # 确保净值不为负
        current_net_value = max(current_net_value, residual_value)
        
        return DepreciationResult(
            current_net_value=current_net_value,
            accumulated_depreciation=min(accumulated_depreciation, depreciable_amount),
            period_depreciation=monthly_depreciation,
            as_of_date=as_of_date
        )
    
    def generate_monthly_schedule(
        self,
        original_value: Decimal,
        useful_life: int,
        residual_value: Decimal,
        purchase_date: date
    ) -> List[MonthlyDepreciationEntry]:
        """
        生成直线法月度折旧计划
        
        生成从购置月起、覆盖整个使用年限的月度折旧表
        """
        depreciable_amount = original_value - residual_value
        total_months = useful_life * 12
        
        # 计算月折旧额 (平均分摊，精确到分)
        monthly_depreciation = (depreciable_amount / Decimal(str(total_months))).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
        
        schedule: List[MonthlyDepreciationEntry] = []
        accumulated = Decimal("0.0000")
        
        for month_idx in range(total_months):
            current_period = purchase_date + relativedelta(months=month_idx)
            period_str = current_period.strftime("%Y-%m")
            
            accumulated += monthly_depreciation
            
            # 最后一期调整，确保合计等于可折旧金额
            if month_idx == total_months - 1:
                accumulated = depreciable_amount
            
            net_value = original_value - accumulated
            net_value = max(net_value, residual_value).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP
            )
            
            schedule.append(MonthlyDepreciationEntry(
                period=period_str,
                monthly_depreciation=monthly_depreciation,
                accumulated_depreciation=accumulated.quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_UP
                ),
                net_value_at_period_end=net_value
            ))
        
        return schedule
```

### 6.2 字段定义

| 字段名 | 类型 | 说明 |
|-------|------|-----|
| `original_value` | `Decimal(16,4)` | 资产原值 |
| `residual_value` | `Decimal(16,4)` | 预计残值 |
| `useful_life` | `Integer` | 使用年限（年），范围 [1, 50] |
| `purchase_date` | `Date` | 购置日期 |
| `depreciation_method` | `Enum` | 折旧方法 (`STRAIGHT_LINE` / `DOUBLE_DECLINING`) |
| `current_net_value` | `Decimal(16,4)` | 当前净值 |
| `accumulated_depreciation` | `Decimal(16,4)` | 累计折旧额 |
| `monthly_depreciation` | `Decimal(16,4)` | 月折旧额 |
| `period` | `String` | 折旧期间，格式 `YYYY-MM` |

### 6.3 依赖清单

```toml
# pyproject.toml
[project.dependencies]
python-dateutil = "^2.8.2"
pydantic = "^2.0.0

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
addopts = "-v --tb=short"
```

---

**文档结束**