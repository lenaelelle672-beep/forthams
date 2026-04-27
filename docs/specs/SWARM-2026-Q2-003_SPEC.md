# SWARM-2026-Q2-003: 资产折旧计算核心模块规格指导文档

**项目代号**: SWARM-2026-Q2-003
**迭代阶段**: Iteration 1
**文档版本**: v1.0
**状态**: Active
**制定日期**: 2026-04-01

---

## 1. 需求与背景

### 1.1 业务背景

企业固定资产需按会计准则进行折旧核算，核心诉求为：

| 序号 | 业务诉求 | 优先级 |
|------|----------|--------|
| 1 | 支持直线法（平均年限法）折旧计算 | P0 |
| 2 | 支持双倍余额递减法折旧计算 | P0 |
| 3 | 提供折旧明细报表供财务审计 | P1 |
| 4 | 定时任务自动触发计提，确保账务及时性 | P1 |

### 1.2 功能范围

本规格文档覆盖资产折旧计算核心模块的全部功能定义与验收标准。

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解结构

```
Phase 1 (当前 Iteration): 核心折旧计算引擎
├── P1.1: 资产实体与折旧属性建模
├── P1.2: 直线法折旧计算服务
├── P1.3: 双倍余额递减法计算服务
└── P1.4: 折旧计算单元测试覆盖

Phase 2: 报表与查询层
├── P2.1: 折旧明细查询 API
├── P2.2: 分页与筛选能力
└── P2.3: 报表导出（CSV/Excel）

Phase 3: 定时任务与集成
├── P3.1: APScheduler 定时任务框架
├── P3.2: 计提任务编排与日志
└── P3.3: 失败重试与告警机制
```

### 2.2 本次 Spec 覆盖范围

**Phase 1: 核心折旧计算引擎** — 交付可测试的折旧计算逻辑。

---

## 3. 边界约束

### 3.1 输入校验约束

| 编号 | 约束项 | 具体定义 |
|------|--------|----------|
| BC-001 | 日期校验 | `depreciation_date` >= `acquisition_date`，否则抛出 `DepreciationDateException` |
| BC-002 | 数值精度 | 折旧金额保留 2 位小数，四舍五入；月折旧额误差不超过 0.01 元 |
| BC-003 | 残值上限 | `residual_value` <= `original_cost`，且 >= 0 |
| BC-004 | 使用寿命 | `useful_life_months` >= 1，最大 600（50年） |

### 3.2 计算逻辑约束

| 编号 | 约束项 | 具体定义 |
|------|--------|----------|
| BC-005 | 双倍余额递减终止 | 当期初净值 - 残值 <= 当前年折旧额时，最后两年平均摊销 |
| BC-006 | 幂等性 | 同一资产同一月份的折旧计算必须幂等，不允许重复计提 |
| BC-007 | 事务边界 | 批量折旧计算以单条资产为最小失败单元，支持部分成功 |

### 3.3 性能约束

| 编号 | 约束项 | 具体定义 |
|------|--------|----------|
| BC-008 | 单笔性能 | 单资产折旧计算 <= 10ms |
| BC-009 | 批量性能 | 批量100个资产 <= 500ms |
| BC-010 | 时间范围 | 仅支持计算未来 60 个月内的折旧 |

### 3.4 禁止事项

| 编号 | 禁止项 |
|------|--------|
| BD-001 | 禁止在计算服务中直接写入数据库（单一职责分离） |
| BD-002 | 禁止硬编码折旧政策参数 |
| BD-003 | 禁止跨资产共享折旧状态 |
| BD-004 | 折旧方法一旦确认，生命周期内不可变更（审计追溯） |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 直线法折旧计算

| 步骤 | 测试输入 | 物理测试期待 |
|------|----------|--------------|
| ATB-1.1 | 原值=100000, 残值=5000, 使用寿命=60月，计提月份=第1月 | 月折旧额 = 1583.33 |
| ATB-1.2 | 原值=100000, 残值=5000, 使用寿命=60月，计提月份=第60月 | 累计折旧 = 95000，账面净值 = 5000 |
| ATB-1.3 | 原值=100000, 残值=0, 使用寿命=120月，计提月份=第1月 | 月折旧额 = 833.33 |
| ATB-1.4 | 计提月份=第0月（早于入账月） | 抛出 `DepreciationDateException` |

**测试用例**: `tests/unit/test_straight_line_depreciation.py`

### 4.2 ATB-2: 双倍余额递减法折旧计算

| 步骤 | 测试输入 | 物理测试期待 |
|------|----------|--------------|
| ATB-2.1 | 原值=100000, 残值=5000, 使用寿命=5年（60月），第1年 | 年折旧额 = 40000 |
| ATB-2.2 | 原值=100000, 残值=5000, 使用寿命=5年，第5年末 | 账面净值 = 5000（残值） |
| ATB-2.3 | 原值=200000, 残值=0, 使用寿命=4年（48月），最后两年转换直线法 | 最后两年月折旧 = 25000 |
| ATB-2.4 | 残值=原值（无效配置） | 抛出 `InvalidDepreciationConfigException` |

**测试用例**: `tests/unit/test_declining_balance_depreciation.py`

### 4.3 ATB-3: 折旧明细报表

| 步骤 | 测试输入 | 物理测试期待 |
|------|----------|--------------|
| ATB-3.1 | 查询资产ID=A001, 年月=2026-04 | 返回含 `original_cost`, `monthly_depreciation`, `accumulated_depreciation`, `book_value` 的 JSON |
| ATB-3.2 | 查询不存在的资产 | 返回 404，错误码 `ASSET_NOT_FOUND` |
| ATB-3.3 | 批量查询10个资产 | 响应时间 <= 200ms |

**测试用例**: `tests/unit/test_depreciation_report_api.py`

### 4.4 ATB-4: 定时任务集成

| 步骤 | 测试输入 | 物理测试期待 |
|------|----------|--------------|
| ATB-4.1 | 设置月末触发，检查任务调度状态 | 任务状态 = `SCHEDULED` |
| ATB-4.2 | 手动触发 `trigger_depreciation_job` | 幂等执行，日志记录执行结果 |
| ATB-4.3 | 模拟执行失败，验证重试机制 | 最多重试 3 次，间隔 30s |

**测试用例**: `tests/unit/test_scheduled_task.py`

### 4.5 ATB-5: 边界约束校验

| 步骤 | 测试输入 | 物理测试期待 |
|------|----------|--------------|
| ATB-5.1 | 残值 > 原值 | 抛出 `ValidationException` |
| ATB-5.2 | 使用寿命 = 0 | 抛出 `ValidationException` |
| ATB-5.3 | 重复计算同一资产同一月份 | 返回已存在的折旧记录，不重复计算 |

**测试用例**: `tests/unit/test_boundary_validation.py`

---

## 5. 开发切入层级序列

### 5.1 层级依赖图

```
Layer 0: Domain Models (资产实体、折旧策略)
    ↓
Layer 1: Depreciation Calculator Engine (核心计算逻辑)
    ↓
Layer 2: Depreciation Report Service (报表聚合服务)
    ↓
Layer 3: Scheduled Task Controller (定时任务编排)
    ↓
Layer 4: API Endpoints (外部接入层)
```

### 5.2 开发时序与交付物

| 顺序 | 开发任务 | 交付物 | 前置依赖 |
|------|----------|--------|----------|
| 1 | `Asset` / `DepreciationPolicy` 模型定义 | `src/domain/entities/asset.py` | 无 |
| 2 | 直线法计算器实现 | `src/domain/calculators/straight_line.py` | 1 |
| 3 | 双倍余额递减计算器实现 | `src/domain/calculators/double_declining.py` | 1 |
| 4 | 计算器单元测试 | `tests/unit/test_*.py` (ATB-1, ATB-2) | 2, 3 |
| 5 | 折旧报表 Repository | `src/repositories/depreciation_repository.py` | 无 |
| 6 | 报表 Service 层 | `src/services/depreciation_report_service.py` | 5 |
| 7 | 报表 API 端点 | `src/api/depreciation_routes.py` | 6 |
| 8 | 报表 API 测试 | `tests/unit/test_depreciation_report_api.py` (ATB-3) | 7 |
| 9 | APScheduler 定时任务配置 | `src/scheduler/depreciation_scheduler.py` | 4, 6 |
| 10 | 定时任务集成测试 | `tests/unit/test_scheduled_task.py` (ATB-4) | 9 |
| 11 | 边界约束集成测试 | `tests/unit/test_boundary_validation.py` (ATB-5) | 2, 3, 6 |

### 5.3 关键实现约束

| 编号 | 约束项 | 实现要求 |
|------|--------|----------|
| IC-001 | 依赖注入 | 计算器通过 Strategy Pattern 注入，`DepreciationCalculator` 接口统一抽象 |
| IC-002 | 事务处理 | Repository 层不处理事务，事务在 Service 层控制 |
| IC-003 | 日志规范 | 每条折旧计算记录需记录 `asset_id`, `calculation_date`, `method`, `amount` |

---

## 6. 核心接口契约

### 6.1 计算器抽象接口

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from datetime import date
from typing import Protocol
from enum import Enum


class DepreciationMethod(Enum):
    """折旧方法枚举"""
    STRAIGHT_LINE = "STRAIGHT_LINE"
    DOUBLE_DECLINING_BALANCE = "DOUBLE_DECLINING_BALANCE"


@dataclass
class Asset:
    """资产实体"""
    asset_id: str
    asset_name: str
    original_cost: Decimal
    acquisition_date: date
    useful_life_months: int
    residual_value: Decimal
    depreciation_method: DepreciationMethod


@dataclass
class DepreciationResult:
    """折旧计算结果"""
    asset_id: str
    period: str  # YYYY-MM
    method: DepreciationMethod
    monthly_depreciation: Decimal
    accumulated_depreciation: Decimal
    book_value: Decimal
    calculated_at: date


class DepreciationCalculator(Protocol):
    """折旧计算器协议"""
    
    def calculate(
        self,
        asset: Asset,
        period: str
    ) -> DepreciationResult:
        """计算指定期间的折旧额"""
        ...
    
    def validate_asset(self, asset: Asset) -> None:
        """校验资产折旧参数"""
        ...
```

### 6.2 异常定义

```python
class DepreciationException(Exception):
    """折旧计算基础异常"""
    pass


class DepreciationDateException(DepreciationException):
    """折旧日期异常：计提日期早于入账日期"""
    pass


class InvalidDepreciationConfigException(DepreciationException):
    """折旧配置异常：参数不合法"""
    pass


class DuplicateDepreciationException(DepreciationException):
    """重复折旧异常：同一资产同一期间已计算"""
    pass
```

---

## 7. 附录

### 7.1 公式定义

**直线法（月折旧额）**:
```
月折旧额 = (原值 - 残值) / 折旧月数
```

**双倍余额递减法（年折旧率）**:
```
年折旧率 = 2 / 折旧年限
年折旧额 = 期初净值 × 年折旧率
最后两年转换为直线法摊销余额
```

### 7.2 审计追溯要求

| 字段 | 要求 |
|------|------|
| 折旧方法 | 生命周期内不可变更 |
| 计算公式 | 需记录每一步计算的中间值 |
| 操作日志 | 需记录计算人、计算时间、计算版本 |

---

**文档结束**