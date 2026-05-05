# SWARM-002 资产折旧计算模块 Specifications

> **版本**: v1.0  
> **迭代周期**: Iteration 1  
> **最后更新**: 2024-01-15

---

## 1. 需求与背景

### 1.1 业务需求

资产折旧是企业财务管理的基础核算需求。本模块实现以下核心功能：

| 功能模块 | 描述 |
|----------|------|
| **直线法折旧** | 每年折旧额固定，适用于使用年限明确的固定资产 |
| **双倍余额递减法** | 加速折旧，适用于技术更新快的资产 |
| **实时折旧查询** | API 提供当前账面价值、累计折旧等数据 |
| **折旧报表生成** | 支持按部门、时间段生成折旧汇总报表 |
| **定时任务** | 月末自动计提折旧、生成报表 |

### 1.2 技术需求

- 提供 RESTful API 接口
- 支持批量折旧计算
- 定时任务自动化
- 完整的单元测试覆盖

---

## 2. 当前 Phase 对应实施目标

### Phase 1：核心折旧引擎 ✅ 已完成

| 交付物 | 状态 | 路径 |
|--------|------|------|
| `StraightLineCalculator` | ✅ | `src/services/depreciation_service.py` |
| `DoubleDecliningBalanceCalculator` | ✅ | `src/services/depreciation_service.py` |
| `DepreciationService` | ✅ | `src/services/depreciation_service.py` |

### Phase 2：数据层与存储

| 交付物 | 状态 | 路径 |
|--------|------|------|
| `FixedAsset` 模型 | 🔄 进行中 | `src/models/` |
| `DepreciationRecord` 模型 | 🔄 进行中 | `src/models/` |
| 数据迁移文件 | 📋 待开发 | `alembic/versions/` |

### Phase 3：API 层

| 交付物 | 状态 | 路径 |
|--------|------|------|
| `DepreciationRouter` | 🔄 进行中 | `src/api/routes/depreciation_router.py` |
| 折旧查询接口 | 📋 待开发 | `GET /api/v1/assets/{id}/depreciation` |
| 报表生成接口 | 📋 待开发 | `POST /api/v1/reports/depreciation` |

### Phase 4：定时任务

| 交付物 | 状态 | 路径 |
|--------|------|------|
| `DepreciationSyncTask` | ✅ | `backend/src/main/java/com/ams/task/DepreciationSyncTask.java` |
| Celery Beat 配置 | 📋 待开发 | `src/tasks/celery_config.py` |

---

## 3. 边界约束

### 3.1 业务边界

| 约束项 | 限定值 | 说明 |
|--------|--------|------|
| 支持折旧方法 | `STRAIGHT_LINE`, `DOUBLE_DECLINING` | 暂不支持年数总和法 |
| 资产原值范围 | > 0 | 单位：元（人民币） |
| 使用年限范围 | 1 ~ 50 年 | 超出需特批 |
| 残值率范围 | 0% ~ 100% | 默认 5% |
| 最小折旧周期 | 日 | 支持按日精确计算 |
| 最大折旧周期 | 年 | 批量计算时按年汇总 |
| 起止日期校验 | 开始日 ≤ 结束日 | 不支持跨年反向查询 |

### 3.2 技术边界

| 约束项 | 限定值 |
|--------|--------|
| 框架 | Python 3.11+ / FastAPI 0.104+ |
| 任务队列 | Celery 5.3+ / Redis 7+ |
| 数据库 | PostgreSQL 15+ / SQLite（开发环境） |
| 测试覆盖率 | ≥ 90% |
| API 响应时间 | < 500ms（单资产），< 5s（批量 1000 条） |
| 并发限制 | 单节点最大 10 并发请求 |

### 3.3 禁止事项

```
⛔ 不支持年数总和法（待后续迭代）
⛔ 不支持无形资产的特殊折旧规则
⛔ 不支持跨境会计准则差异处理
⛔ 定时任务禁止修改历史已审核的折旧记录
⛔ 禁止绕过审批流程直接调整折旧值
```

---

## 4. 验收测试基准 (ATB)

### ATB-1：直线法计算验证

**文件**: `tests/services/test_depreciation_service.py`

```python
def test_straight_line_basic():
    """
    测试场景：资产原值 100,000，使用年限 5 年，残值率 5%
    期待结果：年折旧额 = 19,000，月折旧额 = 1,583.33
    
    公式：年折旧额 = (原值 - 残值) / 使用年限
         残值 = 100,000 × 5% = 5,000
         年折旧额 = (100,000 - 5,000) / 5 = 19,000
    """
    calculator = StraightLineCalculator(
        original_value=100000,
        useful_life_years=5,
        residual_rate=0.05
    )
    
    assert calculator.annual_depreciation == 19000.0
    assert calculator.monthly_depreciation == pytest.approx(1583.33, rel=0.01)
```

**Playwright E2E**: `frontend/tests/e2e/depreciation.spec.ts`

```typescript
test('should display correct straight-line depreciation for standard asset', async ({ page }) => {
  await page.goto('/assets/1001');
  await page.click('[data-testid="depreciation-tab"]');
  
  const annualDepreciation = page.locator('[data-testid="annual-depreciation"]');
  await expect(annualDepreciation).toHaveText('¥19,000.00');
  
  const currentValue = page.locator('[data-testid="current-book-value"]');
  await expect(currentValue).toHaveText('¥81,000.00');
});
```

---

### ATB-2：双倍余额递减法计算验证

**文件**: `tests/services/test_depreciation_service.py`

```python
def test_double_declining_basic():
    """
    测试场景：资产原值 120,000，使用年限 5 年
    期待结果：
        第1年折旧额 = 48,000 (2/5 × 120,000)
        第2年折旧额 = 28,800 (2/5 × 72,000)
        第3年折旧额 = 17,280 (2/5 × 43,200)
        后续年份需转换为直线法
    
    注意：折旧不能低于直线法计算的金额
    """
    calculator = DoubleDecliningBalanceCalculator(
        original_value=120000,
        useful_life_years=5
    )
    
    assert calculator.get_depreciation_for_year(1) == 48000.0
    assert calculator.get_depreciation_for_year(2) == 28800.0
    assert calculator.get_depreciation_for_year(3) == 17280.0
```

**Playwright E2E**:

```typescript
test('should display double-declining depreciation schedule', async ({ page }) => {
  await page.goto('/assets/1002');
  await page.click('[data-testid="depreciation-tab"]');
  await page.click('[data-testid="method-select"]');
  await page.selectOption('DOUBLE_DECLINING');
  
  const scheduleTable = page.locator('[data-testid="depreciation-schedule"]');
  await expect(scheduleTable.locator('tr:nth-child(1) td:nth-child(2)')).toHaveText('¥48,000.00');
  await expect(scheduleTable.locator('tr:nth-child(2) td:nth-child(2)')).toHaveText('¥28,800.00');
});
```

---

### ATB-3：实时折旧值 API 验证

**API Endpoint**: `GET /api/v1/assets/{asset_id}/depreciation`

**请求参数**:
```json
{
  "asset_id": 1001,
  "as_of_date": "2024-12-31"  // 可选，默认当前日期
}
```

**期待响应**:
```json
{
  "asset_id": 1001,
  "original_value": 100000.00,
  "current_value": 81000.00,
  "accumulated_depreciation": 19000.00,
  "monthly_depreciation": 1583.33,
  "residual_value": 5000.00,
  "useful_life_years": 5,
  "elapsed_years": 1.0,
  "remaining_years": 4.0,
  "depreciation_rate": 0.019,
  "method": "STRAIGHT_LINE",
  "as_of_date": "2024-12-31"
}
```

**测试用例**:
```python
# tests/integration/test_depreciation_api.py
def test_get_depreciation_endpoint():
    response = client.get("/api/v1/assets/1001/depreciation")
    assert response.status_code == 200
    data = response.json()
    assert data["current_value"] == 81000.00
    assert data["accumulated_depreciation"] == 19000.00
```

---

### ATB-4：折旧报表生成验证

**API Endpoint**: `POST /api/v1/reports/depreciation`

**请求体**:
```json
{
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "department": "IT",        // 可选
  "category_id": 101,       // 可选
  "method": "STRAIGHT_LINE" // 可选
}
```

**期待响应**:
```json
{
  "report_id": "RPT-2024-001",
  "generated_at": "2024-12-31T23:59:59Z",
  "period": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "summary": {
    "total_assets": 150,
    "total_original_value": 15000000.00,
    "total_current_value": 12000000.00,
    "total_depreciation": 3000000.00
  },
  "details": [
    {
      "asset_id": 1001,
      "asset_name": "Dell 服务器 R740",
      "original_value": 100000.00,
      "current_value": 81000.00,
      "annual_depreciation": 19000.00,
      "department": "IT",
      "method": "STRAIGHT_LINE"
    }
  ]
}
```

---

### ATB-5：定时任务执行验证

**Celery Task**: `src/tasks/depreciation_tasks.py`

```python
# pytest tests/tasks/test_depreciation_sync_task.py
def test_monthly_depreciation_task():
    """
    测试场景：手动触发月度折旧计提任务
    期待结果：
        1. 创建当月折旧记录
        2. 更新资产累计折旧
        3. 发送通知消息
    """
    with patch('tasks.depreciation_tasks.send_notification') as mock_notify:
        result = calculate_monthly_depreciation.apply()
        
        assert result.successful()
        assert result.result['records_created'] > 0
        mock_notify.assert_called_once()
```

**定时配置** (Celery Beat):
```python
CELERYBEAT_SCHEDULE = {
    'monthly-depreciation': {
        'task': 'tasks.depreciation_tasks.calculate_monthly_depreciation',
        'schedule': crontab(day_of_month=1, hour=0, minute=5),  # 每月1日 00:05
    },
    'daily-depreciation-report': {
        'task': 'tasks.depreciation_tasks.generate_daily_report',
        'schedule': crontab(hour=8, minute=0),  # 每天 08:00
    },
}
```

---

### ATB-6：边界条件验证

```python
# tests/services/test_depreciation_service.py
@pytest.mark.parametrize("original_value,expected_error", [
    (0, ValidationError),           # 原值不能为0
    (-1000, ValidationError),       # 原值不能为负
    (None, ValidationError),         # 原值不能为空
    (100000, None),                 # 正常值
])
def test_value_boundaries(original_value, expected_error):
    """资产原值边界验证"""
    if expected_error:
        with pytest.raises(expected_error):
            StraightLineCalculator(original_value=original_value, ...)
    else:
        calc = StraightLineCalculator(original_value=original_value, ...)
        assert calc.original_value == 100000

@pytest.mark.parametrize("useful_life,expected_error", [
    (0, ValidationError),           # 使用年限不能为0
    (51, ValidationError),          # 超过最大年限
    (1, None),                      # 最小年限
    (50, None),                     # 最大年限
])
def test_useful_life_boundaries(useful_life, expected_error):
    """使用年限边界验证"""
```

---

## 5. 开发切入层级序列

### 5.1 层级架构

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 5: Tests（测试层）                                    │
│  ├── 单元测试 test_depreciation_service.py                   │
│  ├── 集成测试 test_depreciation_api.py                       │
│  └── E2E 测试 depreciation.spec.ts                          │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Tasks（任务调度层）                                 │
│  ├── depreciation_tasks.py                                  │
│  └── report_tasks.py                                        │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: API（接口层）                                       │
│  ├── depreciation_router.py                                 │
│  └── response_schemas.py                                    │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Repositories（数据访问层）                          │
│  ├── asset_repository.py                                    │
│  └── depreciation_repository.py                             │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Services（业务逻辑层）                              │
│  ├── depreciation_service.py  ✅                            │
│  └── report_generator.py                                    │
├─────────────────────────────────────────────────────────────┤
│  Layer 0: Models（领域模型层）                                │
│  ├── FixedAsset.py                                          │
│  └── DepreciationRecord.py                                  │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 文件路径映射

| 层级 | 文件路径 |
|------|----------|
| Layer 0 | `src/models/fixed_asset.py` |
| Layer 0 | `src/models/depreciation_record.py` |
| Layer 1 | `src/services/depreciation_service.py` |
| Layer 2 | `src/repositories/asset_repository.py` |
| Layer 2 | `src/repositories/depreciation_repository.py` |
| Layer 3 | `src/api/routes/depreciation_router.py` |
| Layer 4 | `src/tasks/depreciation_tasks.py` |
| Layer 5 | `tests/services/test_depreciation_service.py` |
| Layer 5 | `tests/integration/test_depreciation_api.py` |
| Layer 5 | `frontend/tests/e2e/depreciation.spec.ts` |

---

## 6. 关键公式

### 6.1 直线法（Straight-Line Method）

```
年折旧额 = (原值 - 残值) / 使用年限
月折旧额 = 年折旧额 / 12
残值 = 原值 × 残值率

示例：
  原值 = 100,000 元
  使用年限 = 5 年
  残值率 = 5%
  残值 = 100,000 × 5% = 5,000 元
  年折旧额 = (100,000 - 5,000) / 5 = 19,000 元/年
  月折旧额 = 19,000 / 12 ≈ 1,583.33 元/月
```

### 6.2 双倍余额递减法（Double Declining Balance）

```
年折旧率 = 2 / 使用年限
年折旧额 = 期初账面价值 × 年折旧率

转换条件：当某年按双倍余额递减法计算的折旧额 < 
         (期末账面价值 - 残值) / 剩余使用年限
         此时转换为直线法

示例（使用年限 = 5 年）：
  第1年折旧率 = 2/5 = 40%
  第1年折旧额 = 100,000 × 40% = 40,000 元
  第2年折旧额 = 60,000 × 40% = 24,000 元
  第3年折旧额 = 36,000 × 40% = 14,400 元
  ...（后续年份需评估是否转换）
```

---

## 7. 异常处理规范

| 异常类型 | HTTP Code | 错误码 | 处理策略 |
|----------|-----------|--------|----------|
| `AssetNotFoundError` | 404 | `ASSET_001` | 返回资源不存在提示 |
| `InvalidDepreciationMethodError` | 400 | `DEPR_001` | 返回支持的折旧方法列表 |
| `CalculationOverflowError` | 422 | `DEPR_002` | 返回参数超限说明 |
| `DateRangeInvalidError` | 400 | `DEPR_003` | 起止日期校验失败 |
| `ConcurrentModificationError` | 409 | `DEPR_004` | 重试机制（最多3次） |
| `DepreciationAlreadyLockedError` | 423 | `DEPR_005` | 记录已锁定，禁止修改 |

**错误响应格式**:
```json
{
  "error": {
    "code": "DEPR_001",
    "message": "不支持的折旧方法",
    "details": {
      "received": "SUM_OF_YEARS",
      "supported": ["STRAIGHT_LINE", "DOUBLE_DECLINING"]
    }
  }
}
```

---

## 8. 依赖关系图

```
                    ┌──────────────────┐
                    │  FixedAsset      │
                    │  (Layer 0)       │
                    └────────┬─────────┘
                             │
                             ▼
┌──────────────────┐   ┌──────────────────┐
│  Depreciation    │   │  StraightLine    │   ┌──────────────────┐
│  Record          │◄──│  Calculator      │   │ DoubleDeclining  │
│  (Layer 0)       │   │  (Layer 1)       │   │ Calculator       │
└────────┬─────────┘   └──────────────────┘   │ (Layer 1)        │
         │                   ▲               └──────────────────┘
         │                   │                       ▲
         ▼                   │                       │
┌──────────────────┐         │                       │
│  Depreciation    │         │                       │
│  Repository      │─────────┘                       │
│  (Layer 2)       │                                 │
└────────┬─────────┘                                 │
         │                                           │
         ▼                                           │
┌──────────────────┐         ┌──────────────────────┴─────┐
│  Depreciation    │◄────────│  DepreciationRouter          │
│  Service         │         │  (Layer 3)                   │
│  (Layer 1)       │         └──────────────────────────────┘
└────────┬─────────┘                    │
         │                              ▼
         ▼                 ┌──────────────────────────────┐
┌──────────────────┐       │  Frontend API Client          │
│  Depreciation    │       │  (depreciationService.ts)     │
│  Tasks           │       └──────────────────────────────┘
│  (Layer 4)       │                    │
└──────────────────┘                    ▼
                           ┌──────────────────────────────┐
                           │  E2E Tests                   │
                           │  (depreciation.spec.ts)       │
                           │  (Layer 5)                   │
                           └──────────────────────────────┘
```

---

## 9. 交付清单

### 9.1 Iteration 1 交付物

| 交付物 | 负责方 | 路径 | 状态 |
|--------|--------|------|------|
| 规格文档 | Architect | `docs/SWARM-002-Depreciation-Module-Spec.md` | ✅ |
| 直线法计算器 | Backend | `src/services/depreciation_service.py` | ✅ |
| 双倍余额递减法计算器 | Backend | `src/services/depreciation_service.py` | ✅ |
| API 路由 | Backend | `src/api/routes/depreciation_router.py` | 🔄 |
| E2E 测试 | QA | `frontend/tests/e2e/depreciation.spec.ts` | 📋 |

### 9.2 AC 验收状态

| AC ID | 描述 | 状态 |
|-------|------|------|
| AC-001 | 单元测试覆盖核心计算逻辑 | 🔄 |
| AC-002 | AST 静态检查通过 | 🔄 |
| AC-003 | 函数包含 docstring | 🔄 |
| AC-004 | 模块可正常 import | 🔄 |

---

*文档结束*