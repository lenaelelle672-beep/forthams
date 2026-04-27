# SWARM-003: 资产折旧计算模块 规格指导文档

**版本**: 1.0  
**迭代周期**: Iteration 1  
**状态**: 已批准  

---

## 需求与背景

### 业务需求

企业固定资产需按财务准则定期计提折旧，并生成可视化报表。现要求在现有资产管理系统的资产详情页中集成折旧报表展示功能。

用户场景：
- 资产管理员在资产详情页查看该资产的累计折旧、当前账面净值
- 财务人员获取折旧明细数据，用于报表编制
- 系统自动按月计算并持久化折旧记录

### 技术需求

| 需求项 | 规格 |
|--------|------|
| 折旧计算方法 | 支持**直线法（Straight-Line）** 和 **双倍余额递减法（Double Declining Balance）** |
| 数据持久化 | 折旧数据按月计算并写入 `depreciation_record` 表 |
| 报表展示 | 资产详情页实时展示折旧报表（表格 + 趋势图） |
| 性能要求 | 单资产折旧计算 < 100ms |

### 既有系统上下文

| 组件 | 现状 | 本次变更 |
|------|------|----------|
| Asset Entity | 已存在（`backend/src/main/java/com/ams/entity/Asset.java`） | 新增 `depreciation_method` 字段 |
| AssetDepreciation Entity | 已存在（`backend/src/main/java/com/ams/entity/AssetDepreciation.java`） | - |
| DepreciationRecord Entity | 已存在（`backend/src/main/java/com/ams/entity/DepreciationRecord.java`） | 确认字段完整性 |
| 直线法实现 | 已存在（`backend/src/main/java/com/ams/service/impl/StraightLineDepreciation.java`） | 复用 |
| 双倍余额递减法 | 已存在（`backend/src/main/java/com/ams/service/impl/DoubleDecliningBalanceDepreciation.java`） | 复用 |
| 折旧计算器 | 已存在（`backend/src/main/java/com/ams/service/impl/DepreciationCalculator.java`） | 增强 |
| 前端类型定义 | 已存在（`frontend/src/types/depreciation.types.ts`） | 确认完整性 |
| 前端服务层 | 已存在（`frontend/src/services/depreciationService.ts`） | 增强 |
| 详情页组件 | 已存在（`frontend/src/app/components/depreciation/`） | 增强 |
| 数据库迁移 | 需创建 `V003__create_depreciation_record_table.sql` | 新建 |

---

## 当前 Phase 对应实施目标

### Phase 映射

参照 `plan.md` 中 SWARM-003 的 Phase 拆解：

| Phase | 描述 | 本次 Iteration 覆盖 |
|-------|------|:------------------:|
| Phase 1 | 数据库表结构设计与实体映射 | ✅ |
| Phase 2 | 折旧计算服务层（核心算法） | ✅ |
| Phase 3 | REST API 端点暴露 | ✅ |
| Phase 4 | 前端详情页集成与渲染 | ✅ |
| Phase 5 | 定时任务与数据持久化调度 | ❌ (Phase 2 迭代) |

### 本次 Iteration 目标范围

**交付目标（In Scope）**：
1. 完成 Phase 1~4 的端到端实现
2. 折旧报表可在资产详情页查看
3. API `/api/v1/assets/{assetId}/depreciation-report` 可正常调用
4. 所有 AC 验收测试通过

**非交付目标（Out of Scope）**：
- 定时调度自动重算（归入后续迭代）
- 折旧方法变更的历史追溯
- 批量重算接口
- CI/CD 流水线配置
- 生产环境部署

---

## 边界约束

### 数据边界

| 约束项 | 规格 |
|--------|------|
| 资产原值 | 正数，精度 2 位小数，最大值 999,999,999.99 |
| 预计使用年限 | 正整数，范围 1~50 年 |
| 残值率 | 0~1 之间的小数，精度 2 位，默认 0.10 |
| 计算周期 | 按月为单位 |
| 起算日期 | 不得晚于当前日期 + 30 天（支持预约入账） |
| 折旧方法 | 仅限 `STRAIGHT_LINE` / `DOUBLE_DECLINING_BALANCE` 枚举值 |
| 期间范围 | 支持查询任意连续 12 个月的历史记录 |

### 业务边界

| 约束项 | 规格 |
|--------|------|
| 折旧完成判断 | 累计折旧 ≥ (原值 × (1 - 残值率)) 时停止计算 |
| 双倍余额递减法切换 | 某期折旧额 < 剩余期直线法计算额时，自动切换直线法 |
| 残值保障 | 账面净值不得低于残值（原值 × 残值率） |
| 精度处理 | 计算结果四舍五入至分（2位小数），汇总误差不超过 0.01 |
| 货币单位 | 统一使用资产登记时的币种，不做汇率转换 |
| 停用资产 | 状态为 `RETIRED` / `DISPOSED` 的资产不参与自动计算 |

### 技术边界

| 约束项 | 规格 |
|--------|------|
| 框架 | Spring Boot 3.x + MyBatis-Plus 3.5 |
| 数据库 | MySQL 8.0+ |
| API 协议 | RESTful JSON，UTF-8 编码 |
| 前端 | Vue 3 + Element Plus + TypeScript |
| 响应时限 | API 响应 < 500ms（P95） |
| 并发限制 | 单资产计算互斥，分布式锁粒度 |

### 不在范围内

| 排除项 | 原因 |
|--------|------|
| 固定资产分类折旧政策配置 | 归入配置化模块 |
| 折旧凭证自动生成 | 归入财务集成模块 |
| 多币种换算 | 当前版本仅支持单币种 |
| 资产处置后的折旧冲销 | 归入 Phase 2 迭代 |
| 减值准备计算 | 归入财务模块 |

---

## 验收测试基准 (ATB)

### ATB-1: 数据库表结构验证

**测试目标**：`depreciation_record` 表结构符合设计规格

**物理测试用例**：

```python
# tests/db/test_depreciation_table.py
def test_depreciation_record_table_exists():
    """验证表存在"""
    result = connection.execute(
        "SHOW TABLES LIKE 'depreciation_record'"
    ).fetchall()
    assert len(result) == 1, "表 depreciation_record 不存在"

def test_depreciation_record_columns():
    """验证列定义"""
    columns = {row[0] for row in connection.execute("DESCRIBE depreciation_record")}
    required_columns = {
        'id', 'asset_id', 'period_year', 'period_month',
        'depreciation_method', 'beginning_value', 'depreciation_amount',
        'accumulated_depreciation', 'ending_value', 'created_at', 'updated_at'
    }
    missing = required_columns - columns
    assert not missing, f"缺少列: {missing}"

def test_depreciation_record_indexes():
    """验证索引"""
    indexes = {idx[2] for idx in connection.execute(
        "SHOW INDEX FROM depreciation_record"
    )}
    assert 'idx_asset_period' in indexes, "缺少联合索引 idx_asset_period"

def test_foreign_key_constraint():
    """验证外键约束"""
    fks = connection.execute("""
        SELECT CONSTRAINT_NAME 
        FROM information_schema.TABLE_CONSTRAINTS 
        WHERE TABLE_NAME='depreciation_record' 
        AND CONSTRAINT_TYPE='FOREIGN KEY'
    """).fetchall()
    assert any('asset_id' in str(fk) for fk in fks)
```

**期待结果**：所有断言通过，表结构与 ER 图一致

---

### ATB-2: 直线法折旧计算验证

**测试目标**：直线法计算逻辑正确

**物理测试用例**：

```python
# tests/services/test_depreciation_service.py
def test_straight_line_monthly_depreciation():
    """
    场景：原值100000，残值率10%，使用年限5年
    预期：
      - 可折旧总额 = 90000
      - 年折旧额 = 18000
      - 月折旧额 = 1500
    """
    asset = Asset(
        original_value=Decimal('100000.00'),
        residual_rate=Decimal('0.10'),
        useful_life_years=5,
        purchase_date=date(2024, 1, 1),
        depreciation_method=DepreciationMethod.STRAIGHT_LINE
    )
    
    schedule = depreciation_calculator.generate_schedule(asset)
    
    # 验证月折旧额恒定
    monthly_depreciations = [r['monthly_depreciation'] for r in schedule]
    assert all(d == Decimal('1500.00') for d in monthly_depreciations), \
        "月折旧额应恒定"
    
    # 验证总期数 = 5年 × 12月 = 60期
    assert len(schedule) == 60, f"应为60期，实际{len(schedule)}期"
    
    # 验证期末账面净值等于残值
    final_record = schedule[-1]
    assert final_record['ending_value'] == Decimal('10000.00'), \
        f"期末净值应为10000，实际{final_record['ending_value']}"
    
    # 验证累计折旧总额
    total = sum(r['depreciation_amount'] for r in schedule)
    assert total == Decimal('90000.00'), f"累计折旧应为90000，实际{total}"

def test_straight_line_partial_period():
    """验证非完整年度计算"""
    asset = Asset(
        original_value=Decimal('50000.00'),
        residual_rate=Decimal('0.05'),
        useful_life_years=3,
        purchase_date=date(2024, 6, 15),  # 6月开始
        depreciation_method=DepreciationMethod.STRAIGHT_LINE
    )
    
    schedule = depreciation_calculator.generate_schedule(asset)
    
    # 验证首期起始值
    assert schedule[0]['beginning_value'] == Decimal('50000.00')
    # 验证期末净值
    assert schedule[-1]['ending_value'] == Decimal('2500.00')
```

**期待结果**：月折旧额恒定，60期后账面净值等于残值，计算精度符合财务要求

---

### ATB-3: 双倍余额递减法折旧计算验证

**测试目标**：双倍余额递减法计算逻辑正确，包含直线法切换

**物理测试用例**：

```python
# tests/services/test_depreciation_service.py
def test_double_declining_balance_first_year():
    """
    场景：原值100000，残值率10%，使用年限5年
    预期：
      - 首年折旧率 = 2/5 = 40%
      - 首年折旧额 = 40000
      - 首月折旧额 ≈ 3333.33
    """
    asset = Asset(
        original_value=Decimal('100000.00'),
        residual_rate=Decimal('0.10'),
        useful_life_years=5,
        purchase_date=date(2024, 1, 1),
        depreciation_method=DepreciationMethod.DOUBLE_DECLINING_BALANCE
    )
    
    schedule = depreciation_calculator.generate_schedule(asset)
    
    # 验证首月折旧额
    first_month = schedule[0]
    assert first_month['monthly_depreciation'] == Decimal('3333.33'), \
        f"首月折旧额应为3333.33，实际{first_month['monthly_depreciation']}"
    
    # 验证第12期（第1年末）
    month_12 = schedule[11]
    assert month_12['accumulated_depreciation'] == Decimal('40000.00'), \
        f"第12期累计折旧应为40000，实际{month_12['accumulated_depreciation']}"
    assert month_12['ending_value'] == Decimal('60000.00')

def test_ddb_total_depreciation():
    """验证双倍余额递减法总折旧额"""
    asset = Asset(
        original_value=Decimal('100000.00'),
        residual_rate=Decimal('0.10'),
        useful_life_years=5,
        purchase_date=date(2024, 1, 1),
        depreciation_method=DepreciationMethod.DOUBLE_DECLINING_BALANCE
    )
    
    schedule = depreciation_calculator.generate_schedule(asset)
    
    # 验证最终账面净值等于残值
    final_record = schedule[-1]
    assert final_record['ending_value'] == Decimal('10000.00'), \
        f"期末净值应为10000，实际{final_record['ending_value']}"
    
    # 验证总折旧额 = 原值 - 残值
    total_depreciation = sum(r['depreciation_amount'] for r in schedule)
    assert total_depreciation == Decimal('90000.00'), \
        f"总折旧额应为90000，实际{total_depreciation}"

def test_ddb_switch_to_straight_line():
    """验证双倍余额递减法在后期切换直线法"""
    # 场景：第3年后，余额递减法折旧额 < 直线法折旧额时切换
    asset = Asset(
        original_value=Decimal('100000.00'),
        residual_rate=Decimal('0.00'),  # 残值率0，更容易触发切换
        useful_life_years=5,
        purchase_date=date(2024, 1, 1),
        depreciation_method=DepreciationMethod.DOUBLE_DECLINING_BALANCE
    )
    
    schedule = depreciation_calculator.generate_schedule(asset)
    
    # 找到切换点（如果存在）
    switch_point = None
    for i, record in enumerate(schedule):
        if i > 0:
            ddb_amount = record['depreciation_amount']
            remaining_months = len(schedule) - i
            sl_amount = record['ending_value'] / remaining_months if remaining_months > 0 else 0
            
            if ddb_amount < sl_amount:
                switch_point = i
                break
    
    # 验证切换逻辑执行（具体期数因实现而异）
    assert switch_point is not None, "应触发直线法切换"
```

**期待结果**：计算结果符合财务准则，加速折旧特征明显，切换平滑无跳跃

---

### ATB-4: 数据持久化验证

**测试目标**：折旧记录正确写入数据库

**物理测试用例**：

```python
# tests/services/test_depreciation_service.py
def test_persist_depreciation_records():
    """验证折旧记录批量写入"""
    asset_id = create_test_asset(
        original_value=100000,
        residual_rate=0.10,
        useful_life_years=5
    )
    
    records = depreciation_calculator.generate_schedule(
        asset_repo.find_by_id(asset_id)
    )
    
    result = depreciation_service.persist_records(asset_id, records)
    
    assert result.success is True
    assert result.inserted_count == 60, f"应写入60条，实际{result.inserted_count}"
    
    # 验证数据库查询
    saved = depreciation_repo.find_by_asset_id(asset_id)
    assert len(saved) == 60
    
    # 验证首条记录
    first = saved[0]
    assert first['period_year'] == 2024
    assert first['period_month'] == 1
    assert first['depreciation_amount'] == Decimal('1500.00')

def test_idempotent_persist():
    """验证幂等性：重复计算不产生重复记录"""
    asset_id = create_test_asset(
        original_value=100000,
        residual_rate=0.10,
        useful_life_years=5
    )
    
    # 第一次计算
    depreciation_service.recalculate(asset_id)
    count_after_first = len(depreciation_repo.find_by_asset_id(asset_id))
    
    # 第二次计算（应覆盖而非追加）
    depreciation_service.recalculate(asset_id)
    count_after_second = len(depreciation_repo.find_by_asset_id(asset_id))
    
    assert count_after_second == count_after_first, \
        "重复计算不应产生重复记录"

def test_transaction_rollback_on_error():
    """验证事务回滚"""
    asset_id = create_test_asset(
        original_value=100000,
        residual_rate=0.10,
        useful_life_years=5
    )
    
    # 模拟写入中断
    with pytest.raises(DepreciationCalculationException):
        depreciation_service.persist_with_failure(asset_id)
    
    # 验证无残留记录
    records = depreciation_repo.find_by_asset_id(asset_id)
    assert len(records) == 0, "失败事务应完全回滚"
```

**期待结果**：写入成功，无重复记录，事务完整性保证

---

### ATB-5: API 端点验证

**测试目标**：REST API 按契约返回折旧报表数据

**物理测试用例**：

```python
# tests/api/test_depreciation_api.py
def test_get_depreciation_report(client, auth_headers):
    """GET /api/v1/assets/{assetId}/depreciation-report"""
    asset_id = create_test_asset(
        original_value=100000,
        residual_rate=0.10,
        useful_life_years=5,
        depreciation_method='STRAIGHT_LINE'
    )
    
    response = client.get(
        f'/api/v1/assets/{asset_id}/depreciation-report',
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # 验证响应结构
    assert data['asset_id'] == asset_id
    assert data['depreciation_method'] == 'STRAIGHT_LINE'
    assert data['original_value'] == '100000.00'
    assert data['residual_value'] == '10000.00'
    assert data['total_depreciation'] == '0.00'  # 初始状态
    assert data['current_book_value'] == '100000.00'
    assert 'schedule' in data
    assert len(data['schedule']) == 60
    
    # 验证 schedule 结构
    first_period = data['schedule'][0]
    assert first_period['year'] == 2024
    assert first_period['month'] == 1
    assert first_period['depreciation_amount'] == '1500.00'
    assert first_period['accumulated'] == '1500.00'
    assert first_period['book_value'] == '98500.00'

def test_get_depreciation_report_with_date_range(client, auth_headers):
    """验证日期范围过滤"""
    asset_id = create_test_asset(...)
    
    response = client.get(
        f'/api/v1/assets/{asset_id}/depreciation-report',
        params={'start_year': 2024, 'start_month': 1, 'months': 12},
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data['schedule']) == 12

def test_asset_not_found(client, auth_headers):
    """资产不存在时返回 404"""
    response = client.get(
        '/api/v1/assets/99999/depreciation-report',
        headers=auth_headers
    )
    assert response.status_code == 404
    assert response.json()['code'] == 'ASSET_NOT_FOUND'

def test_invalid_asset_id_format(client, auth_headers):
    """非法资产ID格式返回 400"""
    response = client.get(
        '/api/v1/assets/abc/depreciation-report',
        headers=auth_headers
    )
    assert response.status_code == 400

def test_unauthorized_access(client):
    """未授权访问返回 401"""
    response = client.get('/api/v1/assets/1/depreciation-report')
    assert response.status_code == 401
```

**期待结果**：响应符合 OpenAPI 规范，HTTP 状态码正确，数据格式一致

---

### ATB-6: 前端渲染验证（Playwright）

**测试目标**：资产详情页正确渲染折旧报表组件

**物理测试用例**：

```typescript
// frontend/tests/e2e/depreciation.spec.ts
describe('折旧报表 E2E 测试', () => {
  beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="username-input"]', 'asset_manager');
    await page.fill('[data-testid="password-input"]', 'password');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/dashboard');
  });

  test('ATB-6.1: 折旧报表在资产详情页正确显示', async ({ page }) => {
    await page.goto('/assets/12345');
    
    // 等待报表加载
    await page.waitForSelector('.depreciation-report', { timeout: 10000 });
    
    // 验证基本信息
    const originalValue = await page.locator('.original-value').textContent();
    expect(originalValue).toBe('100,000.00');
    
    const residualValue = await page.locator('.residual-value').textContent();
    expect(residualValue).toBe('10,000.00');
    
    const method = await page.locator('.depreciation-method').textContent();
    expect(method).toBe('直线法');
    
    // 验证表格渲染
    const rows = page.locator('.depreciation-table tbody tr');
    await expect(rows.first()).toBeVisible();
    
    // 验证首期数据
    const firstPeriod = rows.first();
    await expect(firstPeriod.locator('.period')).toHaveText('2024-01');
    await expect(firstPeriod.locator('.amount')).toHaveText('1,500.00');
  });

  test('ATB-6.2: 折旧趋势图表正确渲染', async ({ page }) => {
    await page.goto('/assets/12345');
    await page.waitForSelector('.depreciation-chart');
    
    const chart = page.locator('.depreciation-chart canvas');
    await expect(chart).toBeVisible();
    
    // 验证图表有数据点
    const dataPoints = page.locator('.chart-tooltip');
    await expect(dataPoints.first()).toBeAttached();
  });

  test('ATB-6.3: 加载状态显示', async ({ page }) => {
    await page.goto('/assets/12345');
    
    // 验证加载骨架屏
    await expect(page.locator('.depreciation-skeleton')).toBeVisible();
    
    // 等待数据加载完成
    await page.waitForSelector('.depreciation-table', { state: 'visible' });
    await expect(page.locator('.depreciation-skeleton')).not.toBeVisible();
  });

  test('ATB-6.4: 错误状态处理', async ({ page }) => {
    // 模拟 API 错误
    await page.route('**/api/v1/assets/*/depreciation-report', route => {
      route.abort('failed');
    });
    
    await page.goto('/assets/12345');
    await page.waitForSelector('.depreciation-report');
    
    // 验证错误提示
    await expect(page.locator('.error-message')).toContainText('加载失败');
  });
});
```

**期待结果**：页面无 JS 错误，组件正确渲染，数据与后端一致

---

### ATB-7: 边界条件验证

**物理测试用例**：

```python
# tests/services/test_depreciation_boundary.py
def test_zero_useful_life():
    """使用年限为0应抛出业务异常"""
    with pytest.raises(InvalidAssetException) as exc_info:
        depreciation_calculator.calculate(
            original_value=Decimal('100000'),
            residual_rate=Decimal('0.10'),
            useful_life_years=0
        )
    assert 'USEFUL_LIFE_MUST_BE_POSITIVE' in str(exc_info.value.code)

def test_negative_original_value():
    """原值为负应拒绝"""
    with pytest.raises(ValidationException) as exc_info:
        depreciation_calculator.calculate(
            original_value=Decimal('-100000'),
            residual_rate=Decimal('0.10'),
            useful_life_years=5
        )
    assert 'ORIGINAL_VALUE_MUST_BE_POSITIVE' in str(exc_info.value.code)

def test_residual_rate_exceeds_one():
    """残值率>1应拒绝"""
    with pytest.raises(ValidationException) as exc_info:
        depreciation_calculator.calculate(
            original_value=Decimal('100000'),
            residual_rate=Decimal('1.5'),
            useful_life_years=5
        )
    assert 'RESIDUAL_RATE_OUT_OF_RANGE' in str(exc_info.value.code)

def test_residual_rate_negative():
    """残值率为负应拒绝"""
    with pytest.raises(ValidationException):
        depreciation_calculator.calculate(
            original_value=Decimal('100000'),
            residual_rate=Decimal('-0.1'),
            useful_life_years=5
        )

def test_useful_life_exceeds_maximum():
    """使用年限超过50年应拒绝"""
    with pytest.raises(ValidationException) as exc_info:
        depreciation_calculator.calculate(
            original_value=Decimal('100000'),
            residual_rate=Decimal('0.10'),
            useful_life_years=100
        )
    assert 'USEFUL_LIFE_EXCEEDS_MAXIMUM' in str(exc_info.value.code)

def test_future_purchase_date_warning():
    """未来日期起算应警告但允许（支持预约入账）"""
    result = depreciation_calculator.calculate(
        original_value=Decimal('100000'),
        residual_rate=Decimal('0.10'),
        useful_life_years=5,
        purchase_date=date.today() + timedelta(days=30)
    )
    
    assert result.warnings is not None
    assert any(w.code == 'FUTURE_START_DATE' for w in result.warnings)

def test_max_value_precision():
    """最大值边界：999999999.99"""
    asset = depreciation_calculator.calculate(
        original_value=Decimal('999999999.99'),
        residual_rate=Decimal('0.10'),
        useful_life_years=50
    )
    
    assert asset.schedule[-1]['ending_value'] == Decimal('99999999.999')
    # 验证精度：四舍五入至分
    assert str(asset.schedule[-1]['ending_value'])[-3:] == '.99'

def test_one_year_depreciation():
    """使用年限为1年的特殊情况"""
    asset = depreciation_calculator.calculate(
        original_value=Decimal('12000'),
        residual_rate=Decimal('0.00'),
        useful_life_years=1
    )
    
    assert len(asset.schedule) == 12
    monthly = Decimal('12000') / 12
    assert asset.schedule[0]['depreciation_amount'] == monthly
```

---

## 开发切入层级序列

### 层级一：数据库层（Day 1）

**目标**：完成数据库表结构设计与实体映射

**文件变更清单**：

```
backend/src/main/resources/db/migration/
└── V003__create_depreciation_record_table.sql  [新建]

backend/src/main/java/com/ams/entity/
└── DepreciationRecord.java  [确认/增强]

backend/src/main/java/com/ams/mapper/
└── DepreciationRecordMapper.java  [确认]
```

**V003 Migration 脚本示例**：

```sql
-- V003__create_depreciation_record_table.sql
CREATE TABLE IF NOT EXISTS depreciation_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    asset_id BIGINT NOT NULL COMMENT '资产ID',
    period_year INT NOT NULL COMMENT '折旧期间-年',
    period_month INT NOT NULL COMMENT '折旧期间-月',
    depreciation_method VARCHAR(32) NOT NULL COMMENT '折旧方法:STRAIGHT_LINE/DOUBLE_DECLINING_BALANCE',
    beginning_value DECIMAL(15,2) NOT NULL COMMENT '期初账面价值',
    depreciation_amount DECIMAL(15,2) NOT NULL COMMENT '本期折旧额',
    accumulated_depreciation DECIMAL(15,2) NOT NULL COMMENT '累计折旧',
    ending_value DECIMAL(15,2) NOT NULL COMMENT '期末账面价值',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_asset_period (asset_id, period_year, period_month),
    INDEX idx_asset_id (asset_id),
    CONSTRAINT fk_depreciation_asset FOREIGN KEY (asset_id) 
        REFERENCES asset(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产折旧记录表';
```

**前置依赖**：无  
**阻塞项**：无  
**验收桩点**：ATB-1

---

### 层级二：核心业务层（Day 2-3）

**目标**：实现/复用折旧计算服务层（核心算法）

**文件变更清单**：

```
backend/src/main/java/com/ams/service/
├── DepreciationService.java  [新建接口]
└── impl/
    ├── DepreciationCalculator.java  [增强]
    ├── StraightLineDepreciation.java  [确认]
    └── DoubleDecliningBalanceDepreciation.java  [确认]

tests/services/
└── test_depreciation_service.py  [新建]
```

**核心接口设计**：

```java
// DepreciationService.java
public interface DepreciationService {
    /**
     * 生成折旧计划
     * @param asset 资产实体
     * @return 折旧计划列表
     */
    List<DepreciationRecord> generateSchedule(Asset asset);
    
    /**
     * 计算指定期间的折旧
     * @param assetId 资产ID
     * @param year 年份
     * @param month 月份
     * @return 折旧记录
     */
    DepreciationRecord calculateForPeriod(Long assetId, int year, int month);
    
    /**
     * 持久化折旧记录
     * @param assetId 资产ID
     * @param records 折旧记录列表
     * @return 操作结果
     */
    PersistResult persistRecords(Long assetId, List<DepreciationRecord> records);
}
```

**前置依赖**：层级一完成  
**验收桩点**：ATB-2, ATB-3

---

### 层级三：持久化与事务层（Day 3-4）

**目标**：实现数据持久化与事务管理

**文件变更清单**：

```
backend/src/main/java/com/ams/repository/
└── DepreciationRecordRepository.java  [新建/增强]

backend/src/main/java/com/ams/service/
└── impl/DepreciationPersistenceService.java  [新建]

tests/db/
└── test_depreciation_table.py  [新建]
```

**前置依赖**：层级一、二完成  
**验收桩点**：ATB-4

---

### 层级四：API 层（Day 4-5）

**目标**：暴露 REST API 端点

**文件变更清单**：

```
backend/src/main/java/com/ams/controller/
└── DepreciationController.java  [新建/增强]

backend/src/main/java/com/ams/dto/
├── DepreciationReportResponse.java  [新建]
└── DepreciationScheduleItemDTO.java  [新建]

tests/api/
└── test_depreciation_api.py  [新建]
```

**API 契约**：

```yaml
# /api/v1/assets/{assetId}/depreciation-report
GET /api/v1/assets/{assetId}/depreciation-report
Parameters:
  - assetId: path, required, integer
  - start_year: query, optional, integer (default: 当前年份)
  - start_month: query, optional, integer (default: 当前月份)
  - months: query, optional, integer (default: 12, max: 60)

Response 200:
{
  "asset_id": 12345,
  "depreciation_method": "STRAIGHT_LINE",
  "original_value": "100000.00",
  "residual_value": "10000.00",
  "total_depreciation": "45000.00",
  "current_book_value": "55000.00",
  "useful_life_years": 5,
  "elapsed_months": 30,
  "remaining_months": 30,
  "schedule": [
    {
      "year": 2024,
      "month": 1,
      "depreciation_amount": "1500.00",
      "accumulated": "1500.00",
      "book_value": "98500.00"
    }
  ]
}
```

**前置依赖**：层级二、三完成  
**验收桩点**：ATB-5

---

### 层级五：前端集成层（Day 5-7）

**目标**：前端详情页集成与渲染

**文件变更清单**：

```
frontend/src/
├── components/depreciation/
│   ├── DepreciationReport.vue  [增强]
│   ├── DepreciationTable.vue  [新建/增强]
│   └── DepreciationChart.vue  [新建]
├── composables/
│   └── useDepreciation.ts  [增强]
└── services/
    └── depreciationService.ts  [增强]

frontend/tests/e2e/
└── depreciation.spec.ts  [新建/增强]
```

**组件结构**：

```
DepreciationReport.vue (主组件)
├── DepreciationSummary.vue (摘要卡片)
├── DepreciationTable.vue (明细表格)
└── DepreciationChart.vue (趋势图表)
```

**前置依赖**：层级四 API 联调通过  
**验收桩点**：ATB-6

---

### 层级六：集成与边界测试（Day 7-8）

**目标**：全链路集成测试与边界条件覆盖

**文件变更清单**：

```
tests/
├── integration/
│   └── test_depreciation_full_flow.py  [新建]
└── services/
    └── test_depreciation_boundary.py  [新建]
```

**测试策略**：

| 测试类型 | 覆盖内容 |
|----------|----------|
| 单元测试 | 折旧计算算法、边界条件 |
| 集成测试 | Repository → Service → Controller 全链路 |
| E2E 测试 | 资产详情页完整用户流程 |
| 性能测试 | 单资产计算响应时间 < 100ms |

**前置依赖**：层级一~五 全部完成  
**验收桩点**：ATB-7

---

### 开发依赖图

```
[层级一] ──→ [层级二] ──→ [层级三] ──→ [层级四] ──→ [层级五]
   │            │            │            │            │
   ↓            ↓            ↓            ↓            ↓
 ATB-1      ATB-2/3       ATB-4        ATB-5       ATB-6/7
 (DB)       (Calc)       (Persist)     (API)      (UI/Integration)
```

---

## 附录

### 术语表

| 术语 | 英文 | 定义 |
|------|------|------|
| 直线法 | Straight-Line Depreciation | 折旧额 = (原值 - 残值) / 使用年限，年数平均分摊 |
| 双倍余额递减法 | Double Declining Balance (DDB) | 年折旧率 = 2/使用年限，折旧额 = 期初账面净值 × 年折旧率 |
| 残值 | Residual Value | 资产报废时可回收的估计价值 |
| 账面净值 | Book Value | 原值 - 累计折旧 |
| 累计折旧 | Accumulated Depreciation | 各期折旧额之和 |
| 月折旧额 | Monthly Depreciation | 按月计算的折旧金额 |

### 折旧计算公式

**直线法**：
```
月折旧额 = (原值 × (1 - 残值率)) ÷ (使用年限 × 12)
```

**双倍余额递减法**：
```
年折旧率 = 2 ÷ 使用年限
首年折旧额 = 原值 × 年折旧率
次年起 = 期初账面净值 × 年折旧率
当 账面净值 ÷ 剩余月数 > 当期折旧额 时，切换直线法
```

### 参考规范

| 规范 | 描述 |
|------|------|
| 企业会计准则第4号 | 固定资产 |
| IFRS 16 / IAS 16 | Leases / Property, Plant and Equipment |
| ISO 4217 | 货币代码标准 |
| IEEE 754 | 浮点计算精度要求 |

### 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| 1.0 | 2024-XX-XX | SWARM Team | 初始版本 |

---

**文档结束**