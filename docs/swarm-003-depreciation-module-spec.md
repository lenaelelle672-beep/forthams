# SWARM-003 资产折旧计算模块规格指导文档

## 1. 需求与背景

### 1.1 业务驱动

资产折旧是企业固定资产核算的核心环节。财务系统需要同时支持国内准则（直线法）及税务/快速回收场景（双倍余额递减法）。SWARM-003 旨在构建统一的折旧计算引擎，向上游资产模块提供实时净值查询、折旧计提及报表导出能力。

### 1.2 功能范围

| 功能点 | 描述 |
|--------|------|
| 直线法计算 | `(原值 - 残值) / 尚可使用月数`，按月均匀摊销 |
| 双倍余额递减法计算 | `期初账面净值 × (2 / 折旧年限)`，期末需切换至直线法补足 |
| 当前净值查询 | 任意时点返回资产当前账面净值 |
| 月折旧额计算 | 按当前方法返回当月计提折旧额 |
| 折旧报表生成 | 按资产类别、折旧方法生成汇总报表，支持导出 |

### 1.3 技术上下文

- 目标系统：资产管理子系统（SWARM-Suite）
- 调用方：资产登记模块（SWARM-001）、财务报表模块（SWARM-004）
- 数据持久层：PostgreSQL + SQLAlchemy ORM
- 测试框架：pytest（单元/集成），Playwright（E2E 页面校验）

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解参照

```
plan.md Phase 结构：
  Phase 1: 核心数据模型与基础设施
  Phase 2: 折旧计算引擎开发
  Phase 3: API 层与查询接口
  Phase 4: 报表生成与前端集成
  Phase 5: 边界异常与数据校验
```

### 2.2 本次 Iteration 1 对准目标

| 层级 | Phase | 交付物 |
|------|-------|--------|
| Domain Model | Phase 1 | `Asset`, `DepreciationMethod` 枚举，`DepreciationRecord` 实体 |
| 计算引擎 | Phase 2 | `StraightLineCalculator`, `DoubleDecliningCalculator`，统一接口 `DepreciationCalculator` |
| API 层 | Phase 3 | REST endpoints: 查询净值 / 计算月折旧 / 生成报表 |
| 异常处理 | Phase 5 | 校验资产状态、残值合理性、累计折旧不超原值 |

---

## 3. 边界约束

### 3.1 数据约束

| 约束编号 | 约束内容 | 校验时机 |
|----------|----------|----------|
| BC-001 | 资产原值 `original_cost > 0` | 资产创建/更新时 |
| BC-002 | 预计残值 `salvage_value >= 0` 且 `salvage_value < original_cost` | 资产创建/更新时 |
| BC-003 | 折旧年限 `useful_life_months > 0` 且为整数 | 资产创建/更新时 |
| BC-004 | 双倍余额递减法在最后两年强制切换直线法 | 每次计算时 |
| BC-005 | 任一资产的累计折旧 `accumulated_depreciation <= original_cost - salvage_value` | 计提折旧后 |
| BC-006 | 已完成折旧（fully_depreciated）的资产不得再次计提 | 折旧计提时 |
| BC-007 | 资产购置日期 `acquisition_date <= 当前日期` | 资产创建时 |
| BC-008 | 报表生成截止日期 `end_date >= 资产购置日期` | 报表请求时 |

### 3.2 计算约束

| 约束编号 | 约束内容 |
|----------|----------|
| CC-001 | 直线法月折旧额 = `(原值 - 残值) / 尚可使用月数`，结果向下取整至分（2位小数） |
| CC-002 | 双倍余额递减法月折旧额 = `期初净值 × 2 / 折旧年限月数`，结果向下取整 |
| CC-003 | DDB 转直线法临界点：当剩余使用年限 ≤ 2 年时，切换为 `剩余净值 / 剩余月数` |
| CC-004 | 折旧计算以月为单位，计提频率为月度批次任务 |
| CC-005 | 净值计算公式：`current_net_value = original_cost - accumulated_depreciation` |

### 3.3 技术约束

| 约束编号 | 约束内容 |
|----------|----------|
| TC-001 | 使用 SQLAlchemy 2.0 Session 管理事务，确保并发安全 |
| TC-002 | 所有计算逻辑须有纯函数单元测试覆盖（mock DB） |
| TC-003 | API 响应时间 ≤ 200ms（单资产查询），报表生成 ≤ 5s（≤ 10000 条记录） |
| TC-004 | 数据库索引：`(asset_id, fiscal_year, fiscal_month)` 复合索引用于报表查询 |

### 3.4 业务约束

| 约束编号 | 约束内容 |
|----------|----------|
| BizC-001 | 同一种折旧方法在同一资产的生命周期内不可变更 |
| BizC-002 | 折旧报表以法人主体（legal_entity_id）为口径隔离数据 |
| BizC-003 | 报表导出格式：CSV（本期 MVP），PDF/XLSX 在 Phase 4 扩展 |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 直线法计算验证

| 测试 ID | 测试描述 | 物理测试步骤 | 预期结果 |
|---------|----------|--------------|----------|
| ATB-1.1 | 正常直线法月折旧额 | 原值=120000，残值=12000，使用年限=10年(120月) | 月折旧额 = **900.00** |
| ATB-1.2 | 首月净值 | 创建资产后立即查询净值 | 净值 = **120000.00**（未计提前） |
| ATB-1.3 | 计提一月后净值 | 调用计提后查询净值 | 净值 = **119100.00** |
| ATB-1.4 | 残值边界：残值=0 | 原值=50000，残值=0，使用年限=5年 | 月折旧 = **833.33** |
| ATB-1.5 | 计提完成校验 | 连续计提120个月后 | 累计折旧 = 108000.00，净值 = 12000.00 |
| ATB-1.6 | 重复计提拦截 | 已完全折旧资产再次计提 | 抛出 `AssetFullyDepreciatedError` |

### 4.2 ATB-2: 双倍余额递减法计算验证

| 测试 ID | 测试描述 | 物理测试步骤 | 预期结果 |
|---------|----------|--------------|----------|
| ATB-2.1 | 正常首月 DDB 折旧 | 原值=100000，残值=5000，使用年限=5年(60月) | 月折旧 = **3333.33** |
| ATB-2.2 | 第二月折旧 | 首月计提后，第二月折旧额 | 净值=96666.67，折旧=3222.22 |
| ATB-2.3 | 第37月强制转直线法 | 剩余24月时切换 | 剩余净值/24 |
| ATB-2.4 | 最终净值 = 残值 | 计提第60月后 | 净值 = 残值 5000.00 |
| ATB-2.5 | 残值不得低于计算值 | 若 DDB 计算 < 残值 | 不低于残值 5000.00 |

### 4.3 ATB-3: 净值查询 API

| 测试 ID | 测试描述 | 物理测试步骤 | 预期结果 |
|---------|----------|--------------|----------|
| ATB-3.1 | 实时净值查询 | GET `/api/v1/assets/{asset_id}/net-value?as_of={date}` | HTTP 200，含 `net_value`, `accumulated_depreciation`, `as_of_date` |
| ATB-3.2 | 跨资产汇总净值 | GET `/api/v1/entities/{entity_id}/total-net-value` | HTTP 200，含 `total_net_value`, `asset_count` |
| ATB-3.3 | 不存在的资产 | GET `/api/v1/assets/99999/net-value` | HTTP 404，`{"error": "AssetNotFound"}` |
| ATB-3.4 | 未来日期查询拒绝 | GET `/api/v1/assets/{id}/net-value?as_of=2099-01-01` | HTTP 400，`{"error": "FutureDateNotAllowed"}` |

### 4.4 ATB-4: 折旧报表生成

| 测试 ID | 测试描述 | 物理测试步骤 | 预期结果 |
|---------|----------|--------------|----------|
| ATB-4.1 | 按法人主体生成报表 | POST `/api/v1/reports/depreciation` | HTTP 200，CSV 文件下载 |
| ATB-4.2 | 报表字段完整性 | 校验 CSV 列头 | 必须包含所有必需字段 |
| ATB-4.3 | 无数据场景 | 查询无资产法人主体 | HTTP 200，CSV 仅含列头 |
| ATB-4.4 | 日期范围校验 | `end_date` 早于 `start_date` | HTTP 400，`{"error": "InvalidDateRange"}` |
| ATB-4.5 | 数据行数一致性 | CSV 行数 = DB 查询结果数 | 验证一致性 |

### 4.5 ATB-5: 边界异常与校验

| 测试 ID | 测试描述 | 物理测试步骤 | 预期结果 |
|---------|----------|--------------|----------|
| ATB-5.1 | 残值 >= 原值 | 原值=10000，残值=10000 | HTTP 422，`{"error": "InvalidSalvageValue"}` |
| ATB-5.2 | 累计折旧超限 | 手动注入异常数据 | HTTP 500，`DepreciationExceedsCostError` |
| ATB-5.3 | 负数原值拒绝 | `original_cost=-1000` | HTTP 422，`{"error": "ValidationError"}` |
| ATB-5.4 | 非整数月数 | `useful_life_months=30.5` | HTTP 422，`{"error": "ValidationError"}` |

---

## 5. 开发切入层级序列

### 5.1 序列总览

```
[Layer 0: 数据模型]
    → Layer 1: 计算引擎
    → Layer 2: 服务层编排
    → Layer 3: API 端点
    → Layer 4: 集成测试
```

### 5.2 Layer 0: 数据模型

**文件路径**：`src/domain/entities/` 或 `models/`

| 文件 | 职责 | 关键类型/方法 |
|------|------|---------------|
| `asset.py` | 资产实体定义 | `Asset`, `DepreciationMethod(enum)` |
| `depreciation_record.py` | 折旧记录实体 | `DepreciationRecord` |
| `schemas/depreciation.py` | Pydantic 校验模式 | `ReportRequestSchema` |

### 5.3 Layer 1: 计算引擎

**文件路径**：`services/calculators/` 或 `src/domain/calculators/`

| 文件 | 职责 |
|------|------|
| `base.py` | `DepreciationCalculator` 抽象基类 |
| `straight_line.py` | 直线法实现 |
| `double_declining.py` | 双倍余额递减法实现，含直线法切换逻辑 |

### 5.4 Layer 2: 服务层编排

**文件路径**：`services/`

| 文件 | 职责 |
|------|------|
| `depreciation_service.py` | 业务逻辑编排：校验 → 计算 → 持久化 |
| `report_generator.py` | 报表聚合逻辑，批量查询 + CSV 格式化 |

### 5.5 Layer 3: API 端点

**文件路径**：`routes/` 或 `api/`

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/assets/{asset_id}/net-value` | GET | 查询当前净值 |
| `/api/v1/assets/{asset_id}/monthly-depreciation` | GET | 计算月折旧额 |
| `/api/v1/assets/{asset_id}/depreciate` | POST | 执行月度计提 |
| `/api/v1/reports/depreciation` | POST | 生成折旧报表 |

### 5.6 Layer 4: 集成测试

| 层级 | 测试类型 | 工具 | 覆盖率要求 |
|------|----------|------|------------|
| 计算引擎 | 单元测试 | pytest | 分支覆盖 100% |
| 服务层 | 集成测试 | pytest + test DB | 核心路径覆盖 |
| API | 接口测试 | pytest + FastAPI TestClient | 所有端点覆盖 |
| E2E | UI 校验 | Playwright | 净值展示页、报表下载流 |

---

## 附录：关键公式速查

| 方法 | 月折旧公式 | 备注 |
|------|------------|------|
| 直线法 | `(C - S) / N` | C=原值, S=残值, N=使用月数 |
| 双倍余额递减法 | `BV × 2 / N` | BV=期初账面净值, N=总使用月数 |
| DDB 转直线临界 | `Remaining_BV / Remaining_Months` | 剩余月数 ≤ 24 时触发 |

---

*文档版本：SWARM-003-Iteration-1-spec-v1.0*
*维护责任人：架构评审委员会*
*下次评审节点：Phase 2 完成时*