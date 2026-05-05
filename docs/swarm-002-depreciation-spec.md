# SWARM-002 资产折旧计算模块 Specifications

## 需求与背景

### 业务需求
资产折旧是企业财务管理的基础核算需求。资产折旧计算模块需支持：
- **直线法（Straight-Line Method）**：每年折旧额固定，适用于使用年限明确的固定资产
- **双倍余额递减法（Double Declining Balance Method）**：加速折旧，适用于技术更新快的资产

### 技术需求
- 提供实时折旧值计算 API
- 生成折旧报表
- 支持定时任务自动更新折旧数据

---

## 当前 Phase 对应实施目标

### Phase 1：核心折旧引擎
- [ ] `DepreciationCalculator` 类实现
- [ ] 直线法计算逻辑
- [ ] 双倍余额递减法计算逻辑
- [ ] 折旧参数配置模型

### Phase 2：数据层与存储
- [ ] `FixedAsset` 模型设计
- [ ] `DepreciationRecord` 折旧记录模型
- [ ] 折旧数据持久化

### Phase 3：API 层
- [ ] 实时折旧值查询接口
- [ ] 折旧报表生成接口
- [ ] 资产 CRUD 接口

### Phase 4：定时任务
- [ ] Celery Beat 定时任务配置
- [ ] 月末折旧自动计提任务
- [ ] 报表自动生成任务

---

## 边界约束

### 业务边界
| 约束项 | 限定值 |
|--------|--------|
| 支持折旧方法 | 直线法、双倍余额递减法 |
| 资产原值范围 | > 0 |
| 使用年限范围 | 1 ~ 50 年 |
| 残值率范围 | 0% ~ 100% |
| 最小折旧周期 | 日 |
| 最大折旧周期 | 年 |

### 技术边界
| 约束项 | 限定值 |
|--------|--------|
| 框架 | Python 3.11+ / Django 4.2+ |
| 任务队列 | Celery 5.3+ |
| 数据库 | PostgreSQL 15+ |
| 缓存 | Redis 7+ |
| 测试覆盖率 | ≥ 90% |

### 禁止事项
- 不支持年数总和法（待后续迭代）
- 不支持无形资产的特殊折旧规则
- 不支持跨境会计准则差异处理
- 定时任务禁止修改历史已审核的折旧记录

---

## 验收测试基准 (ATB)

### ATB-1：直线法计算验证

```python
# pytest tests/test_depreciation_calculator.py::test_straight_line_basic
def test_straight_line_basic():
    """
    测试场景：资产原值 100,000，使用年限 5 年，残值率 5%
    期待结果：年折旧额 = 19,000，月折旧额 = 1,583.33
    """
    asset = FixedAsset(
        original_value=100000,
        useful_life_years=5,
        residual_rate=0.05,
        depreciation_method='STRAIGHT_LINE'
    )
    calculator = DepreciationCalculator(asset)
    annual_depreciation = calculator.get_annual_depreciation()
    assert annual_depreciation == 19000.0
```

### ATB-2：双倍余额递减法计算验证

```python
# pytest tests/test_depreciation_calculator.py::test_double_declining_basic
def test_double_declining_basic():
    """
    测试场景：资产原值 120,000，使用年限 5 年
    期待结果：
        第1年折旧额 = 48,000 (2/5 * 120,000)
        第2年折旧额 = 28,800 (2/5 * 72,000)
        第3年折旧额 = 17,280 (转换为直线法后)
    """
    asset = FixedAsset(
        original_value=120000,
        useful_life_years=5,
        depreciation_method='DOUBLE_DECLINING'
    )
    calculator = DepreciationCalculator(asset)
    
    year1 = calculator.get_depreciation_for_year(1)
    assert year1 == 48000.0
    
    year2 = calculator.get_depreciation_for_year(2)
    assert year2 == 28800.0
```

### ATB-3：实时折旧值 API 验证

```python
# pytest tests/test_api.py::test_get_current_depreciation - playwright
async def test_get_current_depreciation(page: Page):
    """
    测试场景：GET /api/v1/assets/{asset_id}/depreciation
    前置条件：存在 ID=1001 的资产记录
    期待结果：返回 JSON 包含 current_value, accumulated_depreciation, depreciation_rate
    """
    response = await page.request.get("/api/v1/assets/1001/depreciation")
    assert response.status == 200
    data = await response.json()
    assert "current_value" in data
    assert "accumulated_depreciation" in data
    assert data["current_value"] >= 0
```

### ATB-4：折旧报表生成验证

```python
# pytest tests/test_api.py::test_depreciation_report - playwright
async def test_depreciation_report(page: Page):
    """
    测试场景：POST /api/v1/reports/depreciation
    请求体：{"start_date": "2024-01-01", "end_date": "2024-12-31", "department": "IT"}
    期待结果：返回包含所有满足条件的资产的折旧明细表
    """
    response = await page.request.post("/api/v1/reports/depreciation", data={
        "start_date": "2024-01-01",
        "end_date": "2024-12-31",
        "department": "IT"
    })
    assert response.status == 200
    report = await response.json()
    assert "summary" in report
    assert "details" in report
    assert report["summary"]["total_assets"] > 0
```

### ATB-5：定时任务执行验证

```bash
# Celery Worker 日志验证
$ celery -A config inspect scheduled
# 期待结果：显示 active_scheduled 包含 depreciation_task 和 report_task
```

```python
# pytest tests/test_tasks.py::test_monthly_depreciation_task
def test_monthly_depreciation_task():
    """
    测试场景：手动触发月度折旧计提任务
    期待结果：
        1. 创建当月折旧记录
        2. 更新资产累计折旧
        3. 发送通知消息
    """
    result = depreciation_task.apply()
    assert result.successful()
    assert DepreciationRecord.objects.filter(
        period='2024-12'
    ).count() > 0
```

### ATB-6：边界条件验证

```python
# pytest tests/test_depreciation_calculator.py::test_boundary_conditions
@pytest.mark.parametrize("original_value,expected_error", [
    (0, ValidationError),          # 原值不能为0
    (-1000, ValidationError),      # 原值不能为负
    (100000, None),                # 正常值
])
def test_value_boundaries(original_value, expected_error):
    """资产原值边界验证"""
```

---

## 开发切入层级序列

### Layer 0：领域模型层（先决依赖）

```
src/
└── models/
    ├── fixed_asset.py          # FixedAsset 实体
    └── depreciation_record.py  # DepreciationRecord 实体
```

**交付物**：Django ORM 模型 + 数据迁移文件

### Layer 1：业务逻辑层

```
src/
└── services/
    ├── depreciation_calculator.py  # 折旧计算引擎
    └── report_generator.py        # 报表生成服务
```

**交付物**：纯计算逻辑，无外部依赖，支持单元测试

### Layer 2：数据访问层

```
src/
└── repositories/
    ├── asset_repository.py       # 资产数据访问
    └── depreciation_repository.py # 折旧数据访问
```

**交付物**：Repository 实现类，封装数据库查询

### Layer 3：API 层

```
src/
└── api/
    ├── views/
    │   ├── asset_views.py        # 资产管理视图
    │   └── depreciation_views.py # 折旧查询视图
    └── serializers/
        └── depreciation_serializer.py
```

**交付物**：RESTful API 端点

### Layer 4：任务调度层

```
src/
└── tasks/
    ├── depreciation_tasks.py     # 折旧任务
    └── report_tasks.py           # 报表任务
```

**交付物**：Celery 任务定义 + Beat Schedule 配置

### Layer 5：集成测试层

```
tests/
├── unit/
│   ├── test_depreciation_calculator.py
│   └── test_report_generator.py
├── integration/
│   ├── test_api_endpoints.py
│   └── test_task_execution.py
└── e2e/
    └── test_depreciation_flow.spec.py  # Playwright E2E
```

---

## 依赖关系图

```
[Layer 0: Models] ──────────► [Layer 1: Services]
        │                              │
        │                              ▼
        └─────────────────► [Layer 2: Repositories]
                                   │
                                   ▼
                           [Layer 3: API Views]
                                   │
                                   ▼
                           [Layer 4: Tasks]
                                   │
                                   ▼
                           [Layer 5: Tests]
```

---

## 关键公式

### 直线法
```
年折旧额 = (原值 - 残值) / 使用年限
残值 = 原值 × 残值率
```

### 双倍余额递减法
```
年折旧率 = 2 / 使用年限
年折旧额 = 期初账面价值 × 年折旧率
转换时机：当年折旧额 < (期末账面价值 - 残值) / 剩余年限
```

---

## 异常处理规范

| 异常类型 | HTTP Code | 处理策略 |
|----------|-----------|----------|
| AssetNotFoundError | 404 | 返回资源不存在提示 |
| InvalidDepreciationMethodError | 400 | 返回支持的折旧方法列表 |
| CalculationOverflowError | 422 | 返回参数超限说明 |
| ConcurrentModificationError | 409 | 重试机制（最多3次） |