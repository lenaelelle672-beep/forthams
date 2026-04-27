# SWARM-002 资产折旧计算模块 - 规格指导文档

## 1. 需求与背景

### 1.1 业务场景

企业固定资产需按财务准则定期计提折旧，当前系统缺乏自动化折旧计算能力。用户需手动导出数据至 Excel 进行线下核算，效率低下且易出错。

### 1.2 核心诉求

| 角色 | 诉求描述 |
|------|----------|
| **用户侧** | 在资产详情页实时查看折旧报表，了解资产当前账面价值及累计折旧 |
| **系统侧** | 后端自动执行折旧计算，支持直线法和双倍余额递减法两种常用方法，定时更新确保数据时效性 |

### 1.3 财务规则约束

| 折旧方法 | 计算公式 | 适用场景 |
|----------|----------|----------|
| **直线法** | `(原值 - 残值) / 预计使用年限` | 资产价值均匀消耗场景 |
| **双倍余额递减法** | `期初账面价值 × (2 / 预计使用年限)`，最后两年改为直线法 | 资产前期价值快速递减场景 |

### 1.4 用户故事

```
作为资产管理员
我希望系统自动计算资产折旧并生成报表
以便我无需手动核算，节省工作时间并确保数据准确性
```

---

## 2. 当前 Phase 对应实施目标

> **Phase 拆分依据**：基于 SWARM-002 迭代规划，Iteration 1 聚焦折旧核心引擎交付

### Phase 2：折旧核心引擎（本次 Iteration 1 覆盖）

| 子任务 ID | 描述 | 交付物 | 优先级 |
|-----------|------|--------|--------|
| P2.1 | 折旧计算服务实现 | `DepreciationCalculator.java` | P0 |
| P2.2 | 折旧数据模型与持久化 | `AssetDepreciation.java` + 迁移脚本 | P0 |
| P2.3 | 折旧查询 REST API | `/api/assets/{id}/depreciation` | P0 |
| P2.4 | 资产详情页折旧报表展示 | `<DepreciationReport>` 组件 | P1 |
| P2.5 | 定时折旧更新任务 | `DepreciationSyncTask` | P1 |

### 范围边界

| 包含范围 ✅ | 排除范围 ❌ |
|-------------|-------------|
| 直线法折旧计算 | 年数总和法（未来 Iteration） |
| 双倍余额递减法折旧计算 | 批量重估/调整（未来 Iteration） |
| 月度折旧报表生成 | 折旧凭证自动生成（未来 Iteration） |
| 资产详情页展示 | 多币种折旧（未来 Iteration） |

---

## 3. 边界约束

### 3.1 数据约束

| 约束项 | 值域 | 精度要求 |
|--------|------|----------|
| 原值 (`original_value`) | `> 0` | 精确到小数点后 2 位 |
| 残值 (`salvage_value`) | `≥ 0` 且 `< 原值` | 精确到小数点后 2 位 |
| 预计使用年限 (`useful_life_years`) | `1 ~ 50` 整数 | 年 |
| 折旧期间 | 仅支持按月计提 | 月 |
| 计算精度 | 货币单位精确至分 | `ROUND_HALF_UP` |

### 3.2 业务规则约束

```
业务规则 BR-001:
  IF asset.status == 'SCRAPPED' OR asset.status == 'DISPOSED':
    → 该资产停止折旧计算，book_value = 残值

业务规则 BR-002:
  IF current_date < asset.acquisition_date:
    → 折旧尚未开始，不生成记录

业务规则 BR-003:
  IF SUM(depreciated_amount) >= (original_value - salvage_value):
    → 折旧计提完毕，book_value = salvage_value
```

### 3.3 双倍余额递减法特殊规则

```
规则 DD-001:
  IF remaining_useful_years == 2:
    → 转换为直线法: monthly_depreciation = book_value / 24

规则 DD-002:
  IF remaining_useful_years == 1:
    → 最后一个月: depreciation = book_value - salvage_value
```

### 3.4 定时任务约束

| 约束项 | 规格 |
|--------|------|
| 执行频率 | 每月 1 日 `00:05:00` UTC |
| 重试策略 | 失败后 5 分钟重试，最多重试 3 次 |
| 批次处理 | 每批 100 条资产，防止超时 |
| 锁机制 | 使用分布式锁 `depreciation_update_lock` 防止并发执行 |
| 超时限制 | 单批次最大执行时间 5 分钟 |

### 3.5 API 约束

| 约束项 | 规格 |
|--------|------|
| 响应格式 | `Content-Type: application/json` |
| 时区 | 所有日期时间使用 ISO 8601 UTC |
| 筛选参数 | 支持 `?year=YYYY&month=MM` 筛选特定期间 |
| 缓存策略 | `Cache-Control: max-age=3600` |
| 错误码 | 遵循统一错误响应格式 `Result<T>` |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1：直线法计算验证

**测试文件**: `tests/unit/test_straight_line_depreciation.py`

```python
def test_straight_line_monthly_depreciation():
    """
    Given: 资产原值=100000, 残值=10000, 使用年限=5年
    Expected: 每月折旧=(100000-10000)/5/12=1500.00
    """
    asset = Asset(
        original_value=Decimal("100000.00"),
        salvage_value=Decimal("10000.00"),
        useful_life_years=5,
        acquisition_date=LocalDate.of(2024, 1, 1)
    )
    calculator = StraightLineDepreciation()
    
    monthly_depr = calculator.calculate_monthly(asset, LocalDate.of(2024, 1, 31))
    assert monthly_depr == Decimal("1500.00")

def test_straight_line_accumulated_after_12_months():
    """
    验证12个月后累计折旧 = 1500 * 12 = 18000.00
    """
    accumulated = calculator.calculate_accumulated(
        asset, 
        end_date=LocalDate.of(2025, 1, 31)
    )
    assert accumulated == Decimal("18000.00")

def test_book_value_after_full_depreciation():
    """
    验证5年折旧完成后账面价值 = 残值
    """
    book_value = calculator.calculate_book_value(
        asset,
        date=LocalDate.of(2029, 12, 31)
    )
    assert book_value == Decimal("10000.00")
```

**通过标准**:
- [ ] 单一资产 12 个月折旧误差 ≤ 0.01
- [ ] 账面价值计算误差 ≤ 0.01
- [ ] 累计折旧与理论值误差 ≤ 0.01
- [ ] 闰年 2 月天数处理正确

---

### 4.2 ATB-2：双倍余额递减法计算验证

**测试文件**: `tests/unit/test_double_declining_balance.py`

```python
def test_double_declining_first_month():
    """
    Given: 原值=100000, 使用年限=5年
    Expected: 首月折旧=100000 * (2/5) / 12 = 3333.33
    """
    rate = Decimal("0.4")  # 2/5 = 0.4
    first_month = Decimal("100000.00") * rate / 12
    assert first_month == Decimal("3333.33")

def test_switch_to_straight_line_at_year_4():
    """
    验证倒数第二年自动切换直线法
    Given: 第4年初账面价值=15552, 剩余2年
    Expected: 每年折旧=15552/2=7776
    """
    asset = Asset(
        original_value=Decimal("100000.00"),
        salvage_value=Decimal("0.00"),
        useful_life_years=5,
        depreciation_method="DOUBLE_DECLINING"
    )
    
    switch_date = LocalDate.of(2027, 1, 1)
    yearly_depr = calculator.calculate_yearly(asset, switch_date)
    assert yearly_depr == Decimal("7776.00")

def test_final_year_net_book_value_equals_salvage():
    """
    验证折旧结束时账面价值 = 残值
    """
    book_value = calculator.calculate_book_value(
        asset,
        date=LocalDate.of(2029, 12, 31)
    )
    assert book_value == Decimal("0.00")
```

**通过标准**:
- [ ] 首月折旧率精确至 4 位小数
- [ ] 转换时点账面价值计算误差 ≤ 0.01
- [ ] 最终残值精确吻合
- [ ] 切换时点计算正确

---

### 4.3 ATB-3：资产状态流转验证

**测试文件**: `tests/unit/test_depreciation_asset_status.py`

```python
@pytest.mark.parametrize("status,should_depreciate", [
    ("IN_USE", True),
    ("SCRAPPED", False),
    ("DISPOSED", False),
    ("IDLE", True),
    ("UNDER_MAINTENANCE", True),
])
def test_depreciation_by_asset_status(status, should_depreciate):
    """验证非"报废"和"处置"状态的资产不计提折旧"""
    asset = Asset(
        status=AssetStatus[status],
        acquisition_date=LocalDate.of(2023, 1, 1)
    )
    
    service = DepreciationService()
    assert service.should_depreciate(asset) == should_depreciate
```

**通过标准**:
- [ ] 所有状态枚举覆盖测试
- [ ] 状态变更后折旧策略正确响应

---

### 4.4 ATB-4：API 接口验证

**测试文件**: `tests/api/test_depreciation_api.py`

```python
def test_get_depreciation_report_success():
    """GET /api/assets/{id}/depreciation"""
    response = client.get(
        "/api/assets/123/depreciation",
        params={"year": 2024, "month": 6},
        headers={"Authorization": "Bearer test-token"}
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # 验证响应结构
    assert data["code"] == 200
    assert data["data"]["asset_id"] == 123
    assert "current_book_value" in data["data"]
    assert "accumulated_depreciation" in data["data"]
    assert len(data["data"]["monthly_records"]) == 6  # 半年记录

def test_get_depreciation_report_not_found():
    """资产不存在时返回 404"""
    response = client.get(
        "/api/assets/99999/depreciation",
        headers={"Authorization": "Bearer test-token"}
    )
    assert response.status_code == 404

def test_recalculate_depreciation():
    """POST /api/assets/{id}/depreciation/recalculate"""
    response = client.post(
        "/api/assets/123/depreciation/recalculate",
        headers={"Authorization": "Bearer test-token"}
    )
    assert response.status_code == 200
```

**Playwright UI 测试** (`tests/e2e/depreciation.spec.ts`):

```typescript
test.describe('资产折旧报表', () => {
  test('资产详情页显示折旧报表', async ({ page }) => {
    await page.goto('/assets/123');
    
    // 等待折旧报表加载
    await expect(page.locator('[data-testid="depreciation-report"]')).toBeVisible();
    
    // 验证账面价值展示
    await expect(page.locator('[data-testid="book-value"]')).toContainText('¥85,000.00');
    
    // 验证折旧趋势图
    await expect(page.locator('[data-testid="depreciation-chart"]')).toBeVisible();
    
    // 验证月度明细表格
    await expect(page.locator('[data-testid="monthly-table"]')).toBeVisible();
  });

  test('选择不同月份查看折旧明细', async ({ page }) => {
    await page.goto('/assets/123');
    
    // 切换到 2024 年 3 月
    await page.selectOption('[data-testid="year-select"]', '2024');
    await page.selectOption('[data-testid="month-select"]', '3');
    
    await expect(page.locator('[data-testid="monthly-depreciation"]')).toContainText('¥1,500.00');
  });
});
```

**通过标准**:
- [ ] API 响应结构符合 `Result<T>` 格式
- [ ] 资产不存在时返回 404
- [ ] UI 折旧报表正常渲染
- [ ] 月份筛选功能正常

---

### 4.5 ATB-5：定时任务验证

**测试文件**: `tests/scheduler/test_depreciation_scheduler.py`

```python
def test_monthly_depreciation_job_execution():
    """验证定时任务正确触发并更新折旧"""
    with patch('scheduler.jobs.update_depreciation.execute') as mock_execute:
        scheduler.add_job(
            mock_execute,
            'cron',
            day=1,
            hour=0,
            minute=5,
            timezone='UTC'
        )
        
        # 触发定时任务
        scheduler._run_job(...)
        
        mock_execute.assert_called_once()

def test_distributed_lock_prevents_duplicate():
    """验证分布式锁防止重复执行"""
    lock1 = RedisLock('depreciation_update_lock', timeout=300)
    lock2 = RedisLock('depreciation_update_lock', timeout=300)
    
    assert lock1.acquire() == True
    assert lock2.acquire() == False  # 锁已被占用
    
    lock1.release()

def test_batch_processing_100_assets():
    """验证批次处理限制"""
    assets = [Asset(id=i) for i in range(250)]
    
    batches = list(batch_process(assets, batch_size=100))
    
    assert len(batches) == 3
    assert len(batches[0]) == 100
    assert len(batches[1]) == 100
    assert len(batches[2]) == 50
```

**通过标准**:
- [ ] 定时任务在指定时间触发
- [ ] 分布式锁防止并发执行
- [ ] 批次大小限制生效

---

### 4.6 ATB-6：数据一致性验证

**测试文件**: `tests/db/test_depreciation_consistency.py`

```python
def test_book_value_equals_original_minus_accumulated():
    """账面价值 = 原值 - 累计折旧"""
    record = db.query(AssetDepreciation).filter(
        AssetDepreciation.asset_id == 123
    ).order_by(AssetDepreciation.period.desc()).first()
    
    expected_book_value = record.original_value - record.accumulated_depreciation
    
    assert record.book_value == expected_book_value

def test_no_duplicate_records_for_same_period():
    """同一期间无重复记录"""
    count = db.query(AssetDepreciation).filter(
        AssetDepreciation.asset_id == 123,
        AssetDepreciation.period_year == 2024,
        AssetDepreciation.period_month == 6
    ).count()
    
    assert count == 1
```

**通过标准**:
- [ ] 账面价值计算公式一致
- [ ] 无重复期间记录
- [ ] 历史数据不被覆盖

---

## 5. 开发切入层级序列

### Phase 2 开发顺序

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 0: 数据模型层 (Day 1)                                      │
├─────────────────────────────────────────────────────────────────┤
│  1.1 资产表扩展字段 (ALTER TABLE assets ADD COLUMN ...)           │
│       - depreciation_method ENUM('STRAIGHT_LINE', 'DOUBLE_DEC')  │
│       - useful_life_years INT                                    │
│       - salvage_value DECIMAL(15,2)                             │
│       - last_depreciation_date DATE                             │
│                                                                  │
│  1.2 新建折旧记录表 asset_depreciation                            │
│       - id BIGINT PRIMARY KEY                                    │
│       - asset_id BIGINT REFERENCES assets(id)                   │
│       - period_year INT NOT NULL                                │
│       - period_month INT NOT NULL                               │
│       - monthly_depreciation DECIMAL(15,2) NOT NULL             │
│       - accumulated_depreciation DECIMAL(15,2) NOT NULL         │
│       - book_value DECIMAL(15,2) NOT NULL                       │
│       - calculated_at TIMESTAMP DEFAULT NOW()                    │
│       - UNIQUE(asset_id, period_year, period_month)             │
│                                                                  │
│  1.3 Flyway 迁移脚本                                             │
│       - V2.1__add_depreciation_fields.sql                        │
│       - V2.2__create_asset_depreciation_table.sql                │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: 折旧计算服务层 (Day 2-3)                                │
├─────────────────────────────────────────────────────────────────┤
│  2.1 DepreciationCalculator interface                            │
│  2.2 StraightLineDepreciation.calculate_monthly(asset, date)    │
│  2.3 DoubleDecliningBalanceDepreciation.calculate_monthly(...)   │
│  2.4 DepreciationService.calculate_and_save(asset_id, period)    │
│  2.5 DepreciationService.batch_calculate(asset_ids, period)     │
│  2.6 DepreciationValidator 数据校验                              │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: 业务逻辑层 (Day 4)                                      │
├─────────────────────────────────────────────────────────────────┤
│  3.1 DepreciationFacade.get_report(asset_id, year, month)        │
│  3.2 DepreciationFacade.should_depreciate(asset) 状态判断        │
│  3.3 DepreciationCalculatorFactory 工厂类                        │
│  3.4 AssetDepreciationMapper MyBatis CRUD                       │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: API 接口层 (Day 5)                                      │
├─────────────────────────────────────────────────────────────────┤
│  4.1 GET /api/assets/{id}/depreciation  折旧报表查询              │
│  4.2 GET /api/assets/{id}/depreciation/summary  汇总数据          │
│  4.3 POST /api/assets/{id}/depreciation/recalculate  手动重算     │
│  4.4 DepreciationController 统一异常处理                         │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: 前端展示层 (Day 6-7)                                    │
├─────────────────────────────────────────────────────────────────┤
│  5.1 DepreciationReport component (React)                        │
│  5.2 DepreciationTrendChart (ECharts Line Chart)                 │
│  5.3 MonthlyDepreciationTable                                    │
│  5.4 资产详情页集成 <AssetDetailPage>                             │
│  5.5 useDepreciation hook                                        │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 5: 定时任务层 (Day 8)                                      │
├─────────────────────────────────────────────────────────────────┤
│  6.1 @Scheduled cron="0 5 0 1 * *" 折旧月度更新                  │
│  6.2 Redis 分布式锁实现                                          │
│  6.3 批次处理逻辑 (每批 100 条)                                   │
│  6.4 失败告警 (Webhook → Slack/钉钉)                             │
│  6.5 DepreciationSyncTask 单元测试                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 依赖关系矩阵

| 前置依赖 (Layer) | 被依赖项 | 说明 |
|------------------|---------|------|
| Layer 0 | Layer 1, Layer 2 | 数据模型是计算和持久化的基础 |
| Layer 1 | Layer 2 | 计算器被服务层调用 |
| Layer 2 | Layer 3, Layer 4 | 业务逻辑暴露 API 和前端组件 |
| Layer 3, Layer 4 | Layer 5 | API 可触发手动重算 |

---

## 7. 风险登记

| 风险 ID | 风险描述 | 影响等级 | 概率 | 缓解措施 |
|---------|----------|----------|------|----------|
| R-001 | 闰年/月末日期计算差异 | 高 | 中 | 使用 `java.time` API 处理月份计算，避免手动天数计算 |
| R-002 | 历史数据迁移 | 中 | 中 | 提供一次性迁移脚本，支持回滚测试 |
| R-003 | 并发写入冲突 | 中 | 低 | 使用 `SELECT FOR UPDATE` 行锁 |
| R-004 | 双倍余额递减法转换时点误差 | 高 | 中 | 独立测试用例覆盖边界条件 |
| R-005 | 定时任务与手动重算冲突 | 低 | 低 | 分布式锁 + 乐观锁双重保护 |

---

## 8. 非功能性需求

| 需求类型 | 规格 |
|----------|------|
| **性能** | 单个资产折旧计算 < 10ms，100 条批量 < 1s |
| **可用性** | 定时任务失败自动重试，不阻塞主流程 |
| **可观测性** | 折旧计算操作写入审计日志 |
| **可维护性** | 计算器策略模式设计，便于扩展新折旧方法 |

---

## 9. 相关文档索引

| 文档 | 路径 |
|------|------|
| 系统架构文档 | `docs/architecture/system-design.md` |
| 数据库变更日志 | `docs/database/changelog.md` |
| API 接口文档 | `docs/api/swagger-ui/index.html` |
| 前端组件库 | `frontend/src/components/depreciation/` |

---

*本文档版本: v1.0.0 | 最后更新: 2024-01-15 | 维护者: SWARM-002 Team*