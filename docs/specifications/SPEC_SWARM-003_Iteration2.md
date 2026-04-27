# SWARM-003 资产折旧计算模块 - 规格指导文档
**版本**: v2.0  
**迭代周期**: Iteration 2  
**状态**: 进行中  
**最后更新**: 2024-12-20

---

## 1. 需求与背景

### 1.1 业务需求

资产管理系统的折旧计算模块需支持两种折旧方法：

| 折旧方法 | 英文名称 | 计算特征 | 适用场景 |
|---------|---------|---------|---------|
| 直线法 | Straight-Line Method | 每年折旧额固定 | 使用寿命均匀损耗的资产 |
| 双倍余额递减法 | Double Declining Balance | 前期折旧额高、后期低 | 技术更新快、损耗加速的资产 |

### 1.2 迭代演进

| 迭代 | 完成状态 | 主要交付物 |
|-----|---------|-----------|
| Iteration 1 | ✅ 已完成 | 基础数据模型、理论算法实现 |
| Iteration 2 | 🔄 进行中 | 资产净值实时计算、月折旧额自动化、折旧报表生成 |
| Iteration 3 | 📋 规划中 | 批量折旧处理、跨期间折旧调整 |

### 1.3 当前迭代目标

Iteration 2 聚焦于以下核心能力的工程化实现：

1. **资产净值计算引擎** - 基于购置日期与当前日期的动态净值计算
2. **月折旧额自动化** - 支持全生命周期折旧计划的自动生成
3. **折旧报表服务** - 输出符合财务规范的汇总与明细报表

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 定义

参照项目计划，Phase 2 定义为 **「折旧计算服务层与报表引擎实现」**。

### 2.2 核心目标矩阵

| 目标编号 | 实施目标 | 交付物 | 优先级 |
|---------|---------|--------|-------|
| P2-1 | 资产净值计算引擎 | `DepreciationService.get_current_net_value()` | P0 |
| P2-2 | 月折旧计划生成器 | `DepreciationScheduleGenerator.generate_monthly_schedule()` | P0 |
| P2-3 | 折旧报表生成器 | `DepreciationReportGenerator.generate_report()` | P1 |

### 2.3 与 Phase 1 的衔接关系

```
Phase 1 依赖关系:
├── [x] DepreciationMethod 抽象类定义
├── [x] StraightLineMethod 实现
├── [x] DoubleDecliningBalanceMethod 实现
└── [x] 单期折旧额计算

Phase 2 扩展范围:
├── [ ] 全生命周期折旧计划生成
├── [ ] 净值跟踪与实时计算
└── [ ] 报表数据结构与聚合逻辑
```

### 2.4 文件聚焦

本次迭代仅修改以下文件：

| 文件路径 | 修改类型 | 用途 |
|---------|---------|------|
| `src/application/depreciation/calculators/double_declining.py` | 核心实现 | 双倍余额递减法计算器 |

关联测试文件（仅验证）：

| 测试文件 | 验证内容 |
|---------|---------|
| `tests/unit/calculators/test_double_declining.py` | 单元测试 |
| `tests/unit/test_depreciation_calculator.py` | 集成测试 |
| `tests/integration/test_depreciation_report.py` | 报表集成测试 |

---

## 3. 边界约束

### 3.1 输入边界

| 参数 | 类型约束 | 精度约束 | 业务约束 |
|-----|---------|---------|---------|
| 资产原值 | `Decimal` | 4位小数 | 正数 |
| 预计使用年限 | `Integer` | - | 范围 [1, 50] 年 |
| 预计残值 | `Decimal` | 4位小数 | 非负数，且 ≤ 原值的 50% |
| 计算基准日 | `date` | YYYY-MM-DD | 有效日期格式 |
| 折旧方法 | `Enum` | - | `"STRAIGHT_LINE"` \| `"DOUBLE_DECLINING"` |

### 3.2 输出边界

| 输出项 | 类型约束 | 精度约束 | 业务约束 |
|-------|---------|---------|---------|
| 当前净值 | `Decimal` | 4位小数 | ≥ 0 且 ≤ 资产原值 |
| 月折旧额 | `Decimal` | 4位小数 | 正数或零 |
| 累计折旧额 | `Decimal` | 4位小数 | ≥ 0 且 ≤ (原值 - 残值) |
| 报表期间 | `String` | YYYY-MM | 连续无跳跃，按自然月对齐 |

### 3.3 非功能性约束

| 约束类型 | 限制条件 | 备注 |
|---------|---------|------|
| 计算精度 | 金额计算统一使用 `Decimal` 类型 | 精度保留4位小数 |
| 性能要求 | 单笔资产折旧计算响应时间 | ≤ 50ms |
| 并发限制 | 同资产同时只允许一个计算请求 | 乐观锁机制 |
| 报表规模 | 单次报表生成最大支持资产记录数 | 10,000 条 |
| 边界值 | 双倍余额递减法转换点 | 最后两年强制切换直线法 |

### 3.4 明确排除范围

以下功能不在本次迭代范围内：

- ❌ 资产新增、修改、删除操作（由资产管理模块负责）
- ❌ 折旧凭证生成与凭证号管理（由财务模块负责）
- ❌ 多币种换算
- ❌ 税务折旧与会计折旧差异处理
- ❌ 折旧方法变更的历史追溯

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 资产净值计算验证

**测试目标**: 验证 `DepreciationService.get_current_net_value()` 的计算准确性

```python
# tests/unit/test_depreciation_calculator.py

class TestNetValueCalculation:
    """ATB-1: 资产净值计算验证"""
    
    def test_straight_line_net_value_at_year_end(self):
        """
        场景: 直线法资产，购置满1年时的净值计算
        
        输入参数:
        - 资产原值: 100,000.0000
        - 使用年限: 10年
        - 预计残值: 5,000.0000
        - 购置日期: 2023-01-01
        - 计算日期: 2024-01-01
        
        物理测试期待:
        - 年折旧额 = (100000 - 5000) / 10 = 9,500.0000
        - 当前净值 = 100000 - 9500 = 90,500.0000
        """
        asset = Asset(
            original_value=Decimal("100000.0000"),
            useful_life=10,
            residual_value=Decimal("5000.0000"),
            purchase_date=date(2023, 1, 1),
            method="STRAIGHT_LINE"
        )
        service = DepreciationService()
        net_value = service.get_current_net_value(asset, as_of_date=date(2024, 1, 1))
        assert net_value == Decimal("90500.0000")
    
    def test_double_declining_net_value_at_partial_year(self):
        """
        场景: 双倍余额递减法，购置6个月后的净值计算
        
        输入参数:
        - 资产原值: 60,000.0000
        - 使用年限: 5年
        - 购置日期: 2023-07-01
        - 计算日期: 2024-01-01
        
        物理测试期待:
        - 首年折旧率 = 2/5 * 100% = 40%
        - 6个月折旧 = 60000 * 40% / 2 = 12,000.0000
        - 当前净值 = 60000 - 12000 = 48,000.0000
        """
        asset = Asset(
            original_value=Decimal("60000.0000"),
            useful_life=5,
            residual_value=Decimal("0.0000"),
            purchase_date=date(2023, 7, 1),
            method="DOUBLE_DECLINING"
        )
        service = DepreciationService()
        net_value = service.get_current_net_value(asset, as_of_date=date(2024, 1, 1))
        assert net_value == Decimal("48000.0000")
    
    def test_net_value_never_below_residual(self):
        """
        场景: 计算日超过使用年限后，净值不得低于残值
        
        物理测试期待:
        - 净值 = 残值 = 5,000.0000
        """
        asset = Asset(
            original_value=Decimal("100000.0000"),
            useful_life=5,
            residual_value=Decimal("5000.0000"),
            purchase_date=date(2020, 1, 1),
            method="STRAIGHT_LINE"
        )
        service = DepreciationService()
        net_value = service.get_current_net_value(asset, as_of_date=date(2030, 1, 1))
        assert net_value == Decimal("5000.0000")
        assert net_value >= asset.residual_value
    
    def test_zero_residual_value(self):
        """
        场景: 残值为零时，净值最终归零
        
        物理测试期待:
        - 净值 = 0.0000
        """
        asset = Asset(
            original_value=Decimal("100000.0000"),
            useful_life=10,
            residual_value=Decimal("0.0000"),
            purchase_date=date(2024, 1, 1),
            method="STRAIGHT_LINE"
        )
        service = DepreciationService()
        net_value = service.get_current_net_value(asset, as_of_date=date(2034, 1, 1))
        assert net_value == Decimal("0.0000")
```

### 4.2 ATB-2: 月折旧计划生成验证

**测试目标**: 验证 `DepreciationScheduleGenerator.generate_monthly_schedule()` 的完整性

```python
# tests/unit/test_depreciation_calculator.py

class TestMonthlyDepreciationSchedule:
    """ATB-2: 月折旧计划生成验证"""
    
    def test_schedule_completeness(self):
        """
        场景: 5年期直线法资产，折旧计划条数验证
        
        物理测试期待:
        - 折旧计划条数 = 5 * 12 = 60 条
        - 期间范围: 2024-01 至 2028-12
        """
        asset = Asset(
            original_value=Decimal("50000.0000"),
            useful_life=5,
            residual_value=Decimal("5000.0000"),
            purchase_date=date(2024, 1, 1),
            method="STRAIGHT_LINE"
        )
        generator = DepreciationScheduleGenerator()
        schedule = generator.generate_monthly_schedule(asset)
        
        assert len(schedule) == 60
        assert schedule[0].period == "2024-01"
        assert schedule[59].period == "2028-12"
    
    def test_monthly_amount_accuracy(self):
        """
        场景: 月折旧额精度验证
        
        物理测试期待:
        - 月折旧额 = (50000 - 5000) / (5 * 12) = 750.0000
        - 所有月份折旧额一致
        """
        asset = Asset(
            original_value=Decimal("50000.0000"),
            useful_life=5,
            residual_value=Decimal("5000.0000"),
            purchase_date=date(2024, 1, 1),
            method="STRAIGHT_LINE"
        )
        generator = DepreciationScheduleGenerator()
        schedule = generator.generate_monthly_schedule(asset)
        
        for entry in schedule:
            assert entry.monthly_depreciation == Decimal("750.0000")
    
    def test_double_declining_switch_to_straight_line(self):
        """
        场景: 双倍余额递减法转为直线法的临界点验证
        
        物理测试期待:
        - 当直线法折旧额 >= 双倍余额递减法时，自动切换
        - 最后24个月折旧额应保持一致
        """
        asset = Asset(
            original_value=Decimal("100000.0000"),
            useful_life=5,
            residual_value=Decimal("5000.0000"),
            purchase_date=date(2024, 1, 1),
            method="DOUBLE_DECLINING"
        )
        generator = DepreciationScheduleGenerator()
        schedule = generator.generate_monthly_schedule(asset)
        
        # 验证最后两年切换为直线法
        last_24_months = [s.monthly_depreciation for s in schedule[-24:]]
        assert len(set(last_24_months)) == 1  # 折旧额一致
```

### 4.3 ATB-3: 折旧报表生成验证

**测试目标**: 验证 `DepreciationReportGenerator.generate_report()` 的输出结构与数据准确性

```python
# tests/integration/test_depreciation_report.py

class TestDepreciationReport:
    """ATB-3: 折旧报表生成验证"""
    
    def test_report_structure(self):
        """
        场景: 验证报表返回结构完整性
        
        物理测试期待返回结构:
        {
            "report_date": "2024-12-31",
            "period_start": "2024-01",
            "period_end": "2024-12",
            "summary": {
                "total_original_value": Decimal,
                "total_accumulated_depreciation": Decimal,
                "total_current_net_value": Decimal,
                "asset_count": int
            },
            "details": [
                {
                    "asset_id": str,
                    "asset_name": str,
                    "original_value": Decimal,
                    "monthly_depreciation": Decimal,
                    "accumulated_depreciation": Decimal,
                    "current_net_value": Decimal,
                    "depreciation_rate": Decimal
                }
            ]
        }
        """
        report_generator = DepreciationReportGenerator()
        assets = [asset1, asset2, asset3]  # 测试数据集
        report = report_generator.generate_report(
            assets=assets,
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31)
        )
        
        assert "report_date" in report
        assert "summary" in report
        assert "details" in report
        assert len(report["details"]) == 3
    
    def test_period_filtering(self):
        """
        场景: 报表期间过滤验证
        
        物理测试期待:
        - 仅返回 2024-03 至 2024-05 期间的折旧数据
        """
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=[test_asset],
            period_start=date(2024, 3, 1),
            period_end=date(2024, 5, 31)
        )
        
        for detail in report["details"]:
            period = int(detail["period"].replace("-", ""))
            assert 202403 <= period <= 202405
    
    def test_summary_accuracy(self):
        """
        场景: 报表汇总数据准确性验证
        
        物理测试期待:
        - 汇总净值 = SUM(各资产净值)
        - 汇总折旧 = SUM(各资产折旧)
        """
        report_generator = DepreciationReportGenerator()
        report = report_generator.generate_report(
            assets=[asset1, asset2],
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31)
        )
        
        expected_net_value = asset1.current_net_value + asset2.current_net_value
        assert report["summary"]["total_current_net_value"] == expected_net_value
```

### 4.4 ATB-4: 边界条件与异常处理验证

```python
# tests/unit/test_depreciation_calculator.py

class TestEdgeCases:
    """ATB-4: 边界条件与异常处理验证"""
    
    def test_invalid_date_range(self):
        """
        场景: 计算日期早于购置日期时抛出 ValueError
        
        物理测试期待:
        - 抛出 ValueError
        - 错误信息包含 "cannot be before purchase date"
        """
        asset = Asset(
            original_value=Decimal("100000.0000"),
            useful_life=10,
            residual_value=Decimal("5000.0000"),
            purchase_date=date(2024, 1, 1),
            method="STRAIGHT_LINE"
        )
        service = DepreciationService()
        
        with pytest.raises(ValueError, match="Calculation date cannot be before purchase date"):
            service.get_current_net_value(asset, as_of_date=date(2023, 12, 31))
    
    def test_invalid_useful_life_too_long(self):
        """
        场景: 使用年限超出最大范围时抛出 ValidationError
        
        物理测试期待:
        - 抛出 ValidationError
        - 错误信息包含 "must be between 1 and 50"
        """
        with pytest.raises(ValidationError, match="Useful life must be between 1 and 50"):
            Asset(
                original_value=Decimal("100000.0000"),
                useful_life=51,
                residual_value=Decimal("5000.0000"),
                purchase_date=date(2024, 1, 1),
                method="STRAIGHT_LINE"
            )
    
    def test_residual_exceeds_half_original(self):
        """
        场景: 残值超过原值50%时抛出 ValidationError
        
        物理测试期待:
        - 抛出 ValidationError
        """
        with pytest.raises(ValidationError, match="Residual value cannot exceed"):
            Asset(
                original_value=Decimal("100000.0000"),
                useful_life=10,
                residual_value=Decimal("50001.0000"),
                purchase_date=date(2024, 1, 1),
                method="STRAIGHT_LINE"
            )
```

---

## 5. 开发切入层级序列

### 5.1 开发顺序依赖图

```
Level 1: 数据模型与核心算法 (无依赖)
    │
    ├── [1.1] 扩展 Asset 模型，添加计算所需字段
    ├── [1.2] 实现净值计算方法 get_current_net_value()
    ├── [1.3] 实现月折旧计划生成器
    │
    ▼
Level 2: 折旧计算服务层 (依赖 Level 1)
    │
    ├── [2.1] 实现 DepreciationCalculationService 聚合计算服务
    ├── [2.2] 实现日期敏感性校验逻辑
    ├── [2.3] 实现双倍余额递减法的直线法切换逻辑
    │
    ▼
Level 3: 报表引擎层 (依赖 Level 2)
    │
    ├── [3.1] 实现 DepreciationReportGenerator 报表生成器
    ├── [3.2] 实现期间汇总计算逻辑
    ├── [3.3] 实现按资产类别/部门的聚合维度
    │
    ▼
Level 4: API 端点与集成 (依赖 Level 3)
    │
    ├── [4.1] REST API 端点实现 (可选，本次可不实现)
    └── [4.2] 集成测试与端到端验证
```

### 5.2 各层级交付检查点

| 层级 | 检查点命令 | 通过标准 |
|-----|---------|---------|
| Level 1 | `pytest tests/unit/test_depreciation_calculator.py -v` | 全部用例通过 |
| Level 2 | `pytest tests/unit/services/test_depreciation_service.py -v` | 全部用例通过 |
| Level 3 | `pytest tests/unit/test_report_generator.py -v` | 报表结构与数据验证通过 |
| Level 4 | `pytest tests/integration/test_depreciation_report.py -v` | 端到端流程验证通过 |

### 5.3 关键实现要点

#### Level 1 - 净值计算核心逻辑

```python
# src/application/depreciation/calculators/double_declining.py

class DoubleDecliningBalanceCalculator:
    """双倍余额递减法计算器"""
    
    def calculate_net_value(self, asset: Asset, as_of_date: date) -> Decimal:
        """
        计算资产在指定日期的当前净值
        
        计算公式:
        1. 年折旧率 = 2 / 预计使用年限
        2. 年折旧额 = 年初净值 * 年折旧率
        3. 月折旧额 = 年折旧额 / 12
        4. 净值不得低于残值
        """
        years_elapsed = self._calculate_years_elapsed(asset.purchase_date, as_of_date)
        current_value = asset.original_value
        
        # 按年累计折旧
        for year in range(int(years_elapsed)):
            annual_depreciation = current_value * self._get_annual_rate(asset.useful_life)
            current_value -= annual_depreciation
            # 保障不低于残值
            if current_value < asset.residual_value:
                current_value = asset.residual_value
        
        # 处理不满一年的部分
        partial_year = years_elapsed - int(years_elapsed)
        if partial_year > 0 and current_value > asset.residual_value:
            annual_depreciation = current_value * self._get_annual_rate(asset.useful_life)
            monthly_depreciation = annual_depreciation / 12
            current_value -= monthly_depreciation * (partial_year * 12)
        
        return max(current_value, asset.residual_value)
    
    def _get_annual_rate(self, useful_life: int) -> Decimal:
        """计算年折旧率"""
        return Decimal("2") / Decimal(str(useful_life))
```

#### Level 2 - 服务聚合层

```python
# src/application/depreciation/services/depreciation_service.py

class DepreciationService:
    """折旧计算聚合服务"""
    
    def get_current_net_value(self, asset: Asset, as_of_date: date) -> Decimal:
        """统一净值计算入口"""
        if as_of_date < asset.purchase_date:
            raise ValueError("Calculation date cannot be before purchase date")
        
        calculator = self._get_calculator(asset.method)
        return calculator.calculate_net_value(asset, as_of_date)
    
    def _get_calculator(self, method: str) -> BaseDepreciationCalculator:
        """根据折旧方法获取对应计算器"""
        calculators = {
            "STRAIGHT_LINE": StraightLineCalculator(),
            "DOUBLE_DECLINING": DoubleDecliningBalanceCalculator()
        }
        return calculators.get(method)
```

#### Level 3 - 报表生成

```python
# src/application/depreciation/services/report_service.py

@dataclass
class DepreciationReport:
    """折旧报表数据结构"""
    report_date: date
    period_start: str
    period_end: str
    summary: ReportSummary
    details: List[AssetDepreciationDetail]

@dataclass
class ReportSummary:
    """报表汇总"""
    total_original_value: Decimal
    total_accumulated_depreciation: Decimal
    total_current_net_value: Decimal
    asset_count: int
```

### 5.4 精准定位的修改文件

根据 AST 扫描结果，本次 Iteration 2 涉及的核心文件：

| 文件 | 相关度 | 行数 | 备注 |
|-----|-------|------|------|
| `src/application/depreciation/calculators/double_declining.py` | ⭐⭐⭐ 核心 | - | 主要修改对象 |
| `frontend/tests/unit/dashboard/components/StatCard.spec.ts` | 3 | 427 | 关联测试文件 |
| `frontend/src/pages/DashboardPage/types/dashboard.types.ts` | 3 | 225 | 类型定义 |
| `frontend/src/pages/DashboardPage/components/StatCard/StatCard.module.css` | 3 | 263 | 样式文件 |
| `frontend/src/pages/DashboardPage/components/StatCard/StatCard.tsx` | 3 | 209 | UI组件 |

---

## 附录 A: 字段定义

| 字段名 | 类型 | 精度 | 说明 |
|-------|------|------|-----|
| `original_value` | `Decimal(16,4)` | 4位小数 | 资产原值 |
| `residual_value` | `Decimal(16,4)` | 4位小数 | 预计残值 |
| `useful_life` | `Integer` | - | 使用年限（年） |
| `purchase_date` | `Date` | YYYY-MM-DD | 购置日期 |
| `depreciation_method` | `Enum` | - | 折旧方法 |
| `current_net_value` | `Decimal(16,4)` | 4位小数 | 当前净值 |
| `accumulated_depreciation` | `Decimal(16,4)` | 4位小数 | 累计折旧额 |
| `monthly_depreciation` | `Decimal(16,4)` | 4位小数 | 月折旧额 |

## 附录 B: 双倍余额递减法特殊规则

### B.1 直线法切换规则

```
切换条件: 当 账面净值 - 预计残值 < 剩余年限 * 直线法折旧额 时

示例:
- 资产原值: 100,000
- 使用年限: 5年
- 残值: 5,000
- 第3年末净值: 36,000
- 剩余年限: 2年
- 直线法折旧: (36,000 - 5,000) / 2 = 15,500/年
- 双倍递减折旧: 36,000 * 40% = 14,400/年
- 因 14,400 < 15,500，应切换为直线法
```

## 附录 C: 术语表

| 术语 | 英文 | 定义 |
|-----|------|-----|
| 折旧 | Depreciation | 资产价值在使用寿命内的系统分摊 |
| 净值 | Net Value | 资产原值减去累计折旧后的余额 |
| 直线法 | Straight-Line | 均匀分摊折旧额的计算方法 |
| 双倍余额递减 | Double Declining Balance | 加速折旧方法，首年折旧率加倍 |
| 残值 | Residual Value | 资产使用寿命结束时的预计剩余价值 |