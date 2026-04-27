# SWARM-2026-Q2-003: 资产折旧计算核心模块规格指导文档

**任务类型**: User Task
**迭代阶段**: Iteration 1
**文档版本**: v1.0
**状态**: Active
**生成时间**: 2026-01-24

---

## 需求与背景

### 业务需求描述

资产折旧计算核心模块旨在为企业固定资产提供符合会计准则的自动化折旧核算能力，支持直线法和双倍余额递减法两种折旧计算策略，并提供折旧明细报表查询及定时自动计提功能。

### 核心功能清单

| 功能编号 | 功能名称 | 功能描述 |
|----------|----------|----------|
| F-001 | 直线法折旧计算 | 按平均年限法计算月折旧额：折旧额 = (原值 - 残值) / 使用寿命(月) |
| F-002 | 双倍余额递减法计算 | 年折旧率 = 2 / 折旧年限，月折旧额 = 期初净值 × 年折旧率 / 12，最后两年转为直线法摊销余额 |
| F-003 | 折旧明细报表 | 按资产维度输出每月折旧金额、本年累计折旧、账面净值，支持分页查询 |
| F-004 | 定时任务自动计提 | 基于 APScheduler 实现月末自动触发折旧计提，支持 Cron 表达式配置 |

### 约束条件

- 折旧年月不可早于资产入账年月
- 折旧方法一旦确认，生命周期内不可变更（审计追溯）
- 账面净值不得低于残值
- 仅支持计算未来 60 个月内的折旧

---

## 当前 Phase 对应实施目标

### Phase 架构拆分

```
SWARM-2026-Q2-003: 资产折旧计算核心模块
│
├── Phase 1: 核心折旧计算引擎 (当前迭代)
│   ├── P1.1: 资产实体与折旧属性建模
│   │   └── src/swarm_003/depreciation/domain/entities.py
│   ├── P1.2: 直线法折旧计算服务
│   │   └── src/swarm_003/depreciation/calculators/straight_line.py
│   ├── P1.3: 双倍余额递减法计算服务
│   │   └── src/swarm_003/depreciation/engine/double_declining.py
│   └── P1.4: 计算器工厂与策略模式抽象
│       └── src/swarm_003/depreciation/engine/factory.py
│
├── Phase 2: 报表与查询层
│   ├── P2.1: 折旧明细 Repository
│   │   └── src/swarm_003/depreciation/domain/repositories.py
│   ├── P2.2: 折旧报表 Service 层
│   │   └── src/swarm_003/depreciation/services/report_service.py
│   └── P2.3: REST API 端点
│       └── src/swarm_003/depreciation/api/routes.py
│
└── Phase 3: 定时任务与集成
    ├── P3.1: APScheduler 定时任务框架
    │   └── src/infrastructure/scheduling/depreciation_scheduler.py
    ├── P3.2: 折旧同步 Task
    │   └── src/infrastructure/scheduler/tasks/depreciation_update_task.py
    └── P3.3: 失败重试与告警机制
```

### 本次 Spec 覆盖范围

**Phase 1 + Phase 2**: 核心折旧计算引擎与报表查询层

---

## 边界约束

### 输入校验约束

| 约束编号 | 约束项 | 验证规则 | 异常类型 |
|----------|--------|----------|----------|
| BC-001 | 入账日期校验 | `depreciation_date >= acquisition_date` | `DepreciationDateException` |
| BC-002 | 残值上限 | `0 <= residual_value <= original_cost` | `ValidationException` |
| BC-003 | 使用寿命 | `1 <= useful_life_months <= 600` | `ValidationException` |
| BC-004 | 原值正数 | `original_cost > 0` | `ValidationException` |
| BC-005 | 未来期限 | 仅支持计算当前月至未来 60 个月的折旧 | 返回空列表 |

### 计算逻辑约束

| 约束编号 | 约束项 | 验证规则 |
|----------|--------|----------|
| BC-006 | 双倍余额递减终止条件 | 当 `期初净值 - 残值 <= 当前年折旧额` 时，最后两年转为直线法摊销 |
| BC-007 | 账面净值下限 | 计算结果 `book_value >= residual_value` |
| BC-008 | 数值精度 | 折旧金额保留 2 位小数，四舍五入 |
| BC-009 | 月折旧误差容限 | 月折旧额累计误差不超过 0.01 元 |

### 幂等性约束

| 约束编号 | 约束项 | 验证规则 |
|----------|--------|----------|
| BC-010 | 重复计算防护 | 同一资产同一月份的折旧计算必须幂等，不允许重复计提 |
| BC-011 | 部分成功容错 | 批量折旧计算以单条资产为最小失败单元 |

### 禁止事项

- **B-001**: 禁止在计算服务中直接写入数据库（单一职责分离）
- **B-002**: 禁止硬编码折旧政策参数
- **B-003**: 禁止跨资产共享折旧状态
- **B-004**: 折旧方法一旦确认后，生命周期内不可变更

---

## 验收测试基准 (ATB)

### ATB-1: 直线法折旧计算

**测试文件**: `tests/unit/test_depreciation_straight_line.py`

| 步骤 | 测试输入 | 物理测试期待 |
|------|----------|--------------|
| ATB-1.1 | `original_cost=100000`, `residual_value=5000`, `useful_life_months=60`, `period=1` | `monthly_depreciation=1583.33`, `accumulated_depreciation=1583.33`, `book_value=98416.67` |
| ATB-1.2 | `original_cost=100000`, `residual_value=5000`, `useful_life_months=60`, `period=60` | `accumulated_depreciation=95000.00`, `book_value=5000.00` |
| ATB-1.3 | `original_cost=100000`, `residual_value=0`, `useful_life_months=120`, `period=1` | `monthly_depreciation=833.33` |
| ATB-1.4 | `depreciation_date` 早于 `acquisition_date` | 抛出 `DepreciationDateException` |
| ATB-1.5 | `residual_value > original_cost` | 抛出 `ValidationException` |

### ATB-2: 双倍余额递减法折旧计算

**测试文件**: `tests/unit/calculators/test_double_declining.py`

| 步骤 | 测试输入 | 物理测试期待 |
|------|----------|--------------|
| ATB-2.1 | `original_cost=100000`, `residual_value=5000`, `useful_life_years=5`, 第1年 | `annual_depreciation=40000.00`, `book_value=60000.00` |
| ATB-2.2 | `original_cost=100000`, `residual_value=5000`, `useful_life_years=5`, 第4年末 | 转换直线法，最后两年平均摊销 |
| ATB-2.3 | `original_cost=100000`, `residual_value=5000`, `useful_life_years=5`, 第5年末 | `book_value=5000.00` |
| ATB-2.4 | `residual_value == original_cost` | 抛出 `InvalidDepreciationConfigException` |
| ATB-2.5 | `useful_life_years=0` | 抛出 `ValidationException` |

### ATB-3: 折旧明细报表 API

**测试文件**: `tests/integration/test_depreciation_report.py`

| 步骤 | 测试输入 | 物理测试期待 |
|------|----------|--------------|
| ATB-3.1 | 查询 `asset_id=A001`, `period=2026-04` | 返回 JSON 包含 `original_cost`, `monthly_depreciation`, `accumulated_depreciation`, `book_value` |
| ATB-3.2 | 查询不存在的资产 `asset_id=INVALID` | HTTP 404, 错误码 `ASSET_NOT_FOUND` |
| ATB-3.3 | 批量查询 10 个资产 | 响应时间 <= 200ms |
| ATB-3.4 | 分页查询 `page=1`, `page_size=20` | 返回 `total`, `page`, `page_size`, `items` |

### ATB-4: 定时任务集成

**测试文件**: `tests/scheduler/test_depreciation_scheduler.py`

| 步骤 | 测试输入 | 物理测试期待 |
|------|----------|--------------|
| ATB-4.1 | 设置月末 Cron `0 0 1 * *` 触发 | 任务状态 = `SCHEDULED` |
| ATB-4.2 | 手动触发 `trigger_depreciation_job` | 幂等执行，日志记录执行结果 |
| ATB-4.3 | 模拟执行失败 | 最多重试 3 次，间隔 30s |
| ATB-4.4 | 重复执行同月份 | 返回已存在的折旧记录，不重复计算 |

### ATB-5: 模块导入验证

**测试文件**: `tests/test_ac_004.py`

| 步骤 | 测试输入 | 物理测试期待 |
|------|----------|--------------|
| ATB-5.1 | `from src.swarm_003.depreciation.calculators.straight_line import StraightLineCalculator` | 导入成功，无 `ModuleNotFoundError` |
| ATB-5.2 | `from src.swarm_003.depreciation.engine.factory import DepreciationCalculatorFactory` | 导入成功 |
| ATB-5.3 | `from src.swarm_003.depreciation.domain.entities import Asset` | 导入成功 |

### ATB-6: Docstring 覆盖验证

**测试文件**: `tests/test_docstring_coverage.py`

| 步骤 | 测试输入 | 物理测试期待 |
|------|----------|--------------|
| ATB-6.1 | 检查 `endless_daemon.py:__init__` | 包含 docstring |
| ATB-6.2 | 检查 `StraightLineCalculator.calculate` | 包含 docstring |
| ATB-6.3 | 检查 `DoubleDecliningCalculator.calculate` | 包含 docstring |
| ATB-6.4 | 检查 `DepreciationScheduler.execute` | 包含 docstring |

---

## 开发切入层级序列

### 层级依赖图

```
Layer 0: Domain Entities (资产实体、折旧策略)
    │
    │  src/swarm_003/depreciation/domain/entities.py
    │  src/swarm_003/depreciation/domain/schemas.py
    ▼
Layer 1: Depreciation Calculator Engine (核心计算逻辑)
    │
    │  src/swarm_003/depreciation/calculators/base.py
    │  src/swarm_003/depreciation/calculators/straight_line.py
    │  src/swarm_003/depreciation/engine/double_declining.py
    │  src/swarm_003/depreciation/engine/factory.py
    ▼
Layer 2: Depreciation Report Service (报表聚合服务)
    │
    │  src/swarm_003/depreciation/domain/repositories.py
    │  src/swarm_003/depreciation/services/report_service.py
    ▼
Layer 3: API Endpoints (外部接入层)
    │
    │  src/swarm_003/depreciation/api/routes.py
    │  src/swarm_003/depreciation/api/dependencies.py
    ▼
Layer 4: Scheduled Task (定时任务层)
    │
    │  src/infrastructure/scheduling/depreciation_scheduler.py
    │  src/infrastructure/scheduler/tasks/depreciation_update_task.py
```

### 开发时序与交付物

| 顺序 | 开发任务 | 交付物路径 | 前置依赖 |
|------|----------|------------|----------|
| 1 | Domain Entities 定义 | `src/swarm_003/depreciation/domain/entities.py` | 无 |
| 2 | Domain Schemas 定义 | `src/swarm_003/depreciation/domain/schemas.py` | 1 |
| 3 | 基础计算器接口 | `src/swarm_003/depreciation/calculators/base.py` | 1 |
| 4 | 直线法计算器实现 | `src/swarm_003/depreciation/calculators/straight_line.py` | 3 |
| 5 | 双倍余额递减计算器实现 | `src/swarm_003/depreciation/engine/double_declining.py` | 3 |
| 6 | 计算器工厂 | `src/swarm_003/depreciation/engine/factory.py` | 4, 5 |
| 7 | 折旧报表 Repository | `src/swarm_003/depreciation/domain/repositories.py` | 2 |
| 8 | 报表 Service 层 | `src/swarm_003/depreciation/services/report_service.py` | 7 |
| 9 | REST API 端点 | `src/swarm_003/depreciation/api/routes.py` | 8 |
| 10 | API 依赖注入 | `src/swarm_003/depreciation/api/dependencies.py` | 9 |
| 11 | 定时任务调度器 | `src/infrastructure/scheduling/depreciation_scheduler.py` | 6, 8 |
| 12 | 折旧同步 Task | `src/infrastructure/scheduler/tasks/depreciation_update_task.py` | 11 |

### 单元测试开发序列

| 顺序 | 测试任务 | 测试文件 | 前置依赖 |
|------|----------|----------|----------|
| T1 | 直线法计算器单元测试 | `tests/unit/test_depreciation_straight_line.py` | 交付物 4 |
| T2 | 双倍余额递减计算器单元测试 | `tests/unit/calculators/test_double_declining.py` | 交付物 5 |
| T3 | 工厂模式集成测试 | `tests/unit/test_depreciation_calculator.py` | 交付物 6 |
| T4 | 报表 API 集成测试 | `tests/integration/test_depreciation_report.py` | 交付物 9 |
| T5 | 定时任务调度测试 | `tests/scheduler/test_depreciation_scheduler.py` | 交付物 11 |
| T6 | 模块导入验证测试 | `tests/test_ac_004.py` | 交付物 1-12 |
| T7 | Docstring 覆盖测试 | `tests/test_docstring_coverage.py` | 交付物 1-12 |

---

## 关键接口契约

### 计算器抽象接口

```python
# src/swarm_003/depreciation/calculators/base.py

from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Protocol
from datetime import date


class DepreciationCalculator(Protocol):
    """折旧计算器协议"""
    
    @property
    def method_name(self) -> str:
        """折旧方法名称"""
        ...
    
    def calculate(
        self,
        original_cost: Decimal,
        residual_value: Decimal,
        useful_life_months: int,
        current_period: int,
        acquisition_date: date
    ) -> "DepreciationResult":
        """
        计算指定期间的折旧金额
        
        Args:
            original_cost: 资产原值
            residual_value: 预计残值
            useful_life_months: 使用寿命（月）
            current_period: 当前期间（第N月）
            acquisition_date: 入账日期
        
        Returns:
            DepreciationResult: 折旧计算结果
        
        Raises:
            DepreciationDateException: 折旧日期早于入账日期
            ValidationException: 参数校验失败
        """
        ...
```

### 结果对象定义

```python
# src/swarm_003/depreciation/domain/schemas.py

from dataclasses import dataclass
from decimal import Decimal
from datetime import date
from typing import Optional


@dataclass(frozen=True)
class DepreciationResult:
    """折旧计算结果"""
    
    asset_id: str
    period: str  # YYYY-MM
    method: str  # 'STRAIGHT_LINE' | 'DOUBLE_DECLINING_BALANCE'
    original_cost: Decimal
    monthly_depreciation: Decimal
    accumulated_depreciation: Decimal
    book_value: Decimal
    calculated_at: date
    
    @property
    def is_depreciation_complete(self) -> bool:
        """折旧是否已完成"""
        return self.book_value <= Decimal("0")
```

### 资产实体定义

```python
# src/swarm_003/depreciation/domain/entities.py

from dataclasses import dataclass
from decimal import Decimal
from datetime import date
from enum import Enum


class DepreciationMethod(str, Enum):
    """折旧方法枚举"""
    STRAIGHT_LINE = "STRAIGHT_LINE"
    DOUBLE_DECLINING_BALANCE = "DOUBLE_DECLINING_BALANCE"


@dataclass
class Asset:
    """资产实体"""
    
    asset_id: str
    asset_name: str
    original_cost: Decimal
    residual_value: Decimal
    useful_life_months: int
    depreciation_method: DepreciationMethod
    acquisition_date: date
    
    def validate(self) -> None:
        """
        验证资产折旧参数
        
        Raises:
            ValidationException: 参数校验失败
        """
        if self.original_cost <= Decimal("0"):
            raise ValidationException("original_cost must be positive")
        if not (Decimal("0") <= self.residual_value <= self.original_cost):
            raise ValidationException("residual_value must be between 0 and original_cost")
        if not (1 <= self.useful_life_months <= 600):
            raise ValidationException("useful_life_months must be between 1 and 600")
```

---

## 附录：验收标准映射

| AC ID | 验收标准描述 | 验证方法 | 覆盖 ATB |
|--------|--------------|----------|----------|
| AC-001 | 用户可以按直线法或双倍余额递减法自动计算资产折旧 | unit_test | ATB-1, ATB-2 |
| AC-002 | 代码变更不引入新的语法错误（AST 静态检查通过） | static_analysis | 所有交付物 |
| AC-003 | 所有修改的函数包含 docstring 文档注释 | static_analysis | ATB-6 |
| AC-004 | 变更后的模块可被正常 import 不抛出 ImportError | unit_test | ATB-5 |

---

**文档结束**

**修订历史**

| 版本 | 日期 | 修订内容 |
|------|------|----------|
| v1.0 | 2026-01-24 | 初始版本 |