# SWARM-002 资产折旧计算模块 - 规格指导文档

> **版本**: v1.0  
> **创建日期**: 2024年  
> **迭代**: Iteration 1  
> **状态**: 已审核通过

---

## 1. 需求与背景

### 1.1 业务场景

企业固定资产需按财务准则定期计提折旧。当前系统缺乏自动化折旧计算能力，用户需手动导出数据至Excel进行线下核算，效率低下且易出错。

### 1.2 核心诉求

| 角色 | 诉求 |
|------|------|
| **用户侧** | 在资产详情页实时查看折旧报表，了解资产当前账面价值及累计折旧 |
| **系统侧** | 后端自动执行折旧计算，支持直线法和双倍余额递减法两种常用方法，定时更新确保数据时效性 |

### 1.3 财务规则约束

| 折旧方法 | 计算公式 | 适用场景 |
|---------|---------|---------|
| **直线法** | `(原值 - 残值) / 预计使用年限` | 资产价值均匀消耗场景 |
| **双倍余额递减法** | `期初账面价值 × (2 / 预计使用年限)`，最后两年改为直线法 | 资产前期价值快速递减场景 |

---

## 2. 当前 Phase 对应实施目标

> **注**：以下 Phase 拆解基于项目迭代规划推断，实际应以 `plan.md` 为准。

### Phase 2：折旧核心引擎（本次 Iteration 1 覆盖）

| 子任务 | 描述 | 交付物 |
|-------|------|--------|
| P2.1 | 折旧计算服务实现 | `StraightLineDepreciation.java`<br>`DoubleDecliningBalanceDepreciation.java` |
| P2.2 | 折旧数据持久化 | `AssetDepreciation.java`<br>`DepreciationRecord.java` |
| P2.3 | 折旧查询 API | `DepreciationController.java`<br>`/api/assets/{id}/depreciation` |
| P2.4 | 资产详情页折旧报表展示 | 前端组件 `<AssetDepreciationReport>` |
| P2.5 | 定时折旧更新任务 | `DepreciationSyncTask.java` |

### 范围边界

| 包含 ✅ | 不包含 ❌ |
|--------|----------|
| 直线法折旧计算 | 年数总和法（未来 Iteration） |
| 双倍余额递减法折旧计算 | 批量重估/调整（未来 Iteration） |
| 月度折旧报表生成 | 折旧凭证自动生成（未来 Iteration） |
| 折旧历史记录查询 | 跨期间折旧调整（未来 Iteration） |

---

## 3. 边界约束

### 3.1 数据约束

| 约束项 | 值域 |
|-------|------|
| 原值 (`original_value`) | `> 0`，精确到小数点后2位 |
| 残值 (`salvage_value`) | `≥ 0` 且 `< 原值` |
| 预计使用年限 (`useful_life_years`) | `1 ~ 50` 整数 |
| 计算精度 | 货币单位精确至分，`ROUND_HALF_UP` |
| 折旧期间 | 仅支持按月计提 |

### 3.2 业务规则约束

```
IF asset.status == '已报废' OR asset.status == '已处置':
    → 该资产停止折旧计算

IF current_date < asset.acquisition_date:
    → 折旧尚未开始，不生成记录

IF SUM(已计提折旧) >= (原值 - 残值):
    → 折旧计提完毕，账面价值 = 残值
```

### 3.3 双倍余额递减法特殊规则

```
IF remaining_years == 2:
    → 转换为直线法: 当期折旧 = 账面价值 / 2
    → 最后一年: 账面价值 - 残值
```

### 3.4 定时任务约束

| 约束项 | 规格 |
|-------|------|
| 执行频率 | 每月1日 00:05:00 UTC |
| 重试策略 | 失败后 5 分钟重试，最多重试 3 次 |
| 批次处理 | 每批 100 条资产，防止超时 |
| 锁机制 | 使用分布式锁 `depreciation_update_lock` 防止并发 |

### 3.5 API 约束

| 约束项 | 规格 |
|-------|------|
| 响应格式 | JSON |
| 时区 | 所有日期时间使用 ISO 8601 UTC |
| 分页 | 支持 `?year=YYYY&month=MM` 筛选 |
| 缓存 | API 响应头 `Cache-Control: max-age=3600` |

---

## 4. 验收测试基准 (ATB)

### ATB-1：直线法计算验证

**测试文件**: `tests/services/test_depreciation_service.py`

```python
def test_straight_line_monthly_depreciation():
    """
    Given: 资产原值=100000, 残值=10000, 使用年限=5年
    Expected: 每月折旧=(100000-10000)/5/12=1500
    """
    asset = Asset(original_value=100000, salvage_value=10000, 
                  useful_life_years=5, acquisition_date="2024-01-01")
    service = DepreciationService()
    
    monthly_depr = service.calculate_monthly_straight_line(asset)
    assert monthly_depr == Decimal("1500.00")


def test_straight_line_accumulated_after_12_months():
    """
    验证12个月后累计折旧 = 1500 * 12 = 18000
    """
    # ... 
    assert accumulated == Decimal("18000.00")
```

**通过标准**:
- 单一资产12个月折旧误差 ≤ 0.01
- 账面价值计算误差 ≤ 0.01
- 累计折旧与理论值误差 ≤ 0.01

---

### ATB-2：双倍余额递减法计算验证

**测试文件**: `backend/src/test/java/com/ams/service/impl/DoubleDecliningBalanceDepreciationTest.java`

```java
@Test
void testDoubleDecliningFirstMonth() {
    // Given: 原值=100000, 使用年限=5年
    // Expected: 首月折旧=100000 * (2/5) / 12 = 3333.33
    BigDecimal rate = new BigDecimal("0.4"); // 2/5 = 0.4
    BigDecimal firstMonth = new BigDecimal("100000").multiply(rate)
                                            .divide(new BigDecimal("12"), 2, RoundingMode.HALF_UP);
    assertEquals(new BigDecimal("3333.33"), firstMonth);
}

@Test
void testSwitchToStraightLineInFinalTwoYears() {
    // 验证倒数第二年自动切换直线法
    // ...
    assertTrue(methodSwitched);
}
```

**通过标准**:
- 首月折旧率精确至 4 位小数
- 转换时点账面价值计算误差 ≤ 0.01
- 最终残值精确吻合

---

### ATB-3：资产状态流转验证

**测试文件**: `tests/db/test_depreciation_table.py`

```python
@pytest.mark.parametrize("status,expected_depreciation", [
    ("在用", True),
    ("已报废", False),
    ("已处置", False),
    ("闲置", True),
])
def test_depreciation_by_asset_status(status, expected_depreciation):
    """验证非"在用"和"闲置"状态的资产不计提折旧"""
    # ...
```

---

### ATB-4：API 接口验证

**测试文件**: `frontend/tests/e2e/depreciation.spec.ts`

```typescript
test('GET /api/assets/{id}/depreciation 返回折旧报表', async ({ request }) => {
  const response = await request.get('/api/assets/123/depreciation', {
    params: { year: 2024, month: 6 }
  });
  
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.assetId).toBe(123);
  expect(data.currentBookValue).toBeDefined();
  expect(data.accumulatedDepreciation).toBeDefined();
  expect(data.monthlyRecords.length).toBe(6); // 半年记录
});

test('资产详情页显示折旧报表', async ({ page }) => {
  await page.goto('/assets/123');
  await expect(page.locator('.depreciation-report')).toBeVisible();
  await expect(page.locator('.book-value')).toContainText('¥85,000.00');
  await expect(page.locator('.chart-depreciation')).toBeVisible();
});
```

---

### ATB-5：定时任务验证

**测试文件**: `tests/scheduler/test_depreciation_scheduler.py`

```python
def test_monthly_depreciation_job_execution():
    """验证定时任务正确触发并更新折旧"""
    with patch('scheduler.jobs.depreciation_sync_task.run') as mock_run:
        scheduler.add_job(mock_run, 'cron', day=1, hour=0, minute=5)
        # 触发
        scheduler._run_job(...)
        mock_run.assert_called_once()


def test_distributed_lock_prevents_duplicate():
    """验证分布式锁防止重复执行"""
    # ...
```

---

### ATB-6：数据一致性验证

**测试文件**: `tests/services/test_depreciation_service.py`

```python
def test_book_value_equals_original_minus_accumulated():
    """账面价值 = 原值 - 累计折旧"""
    asset_id = 123
    record = DepreciationRecord.get_latest(asset_id)
    
    assert record.book_value == (
        record.original_value - record.accumulated_depreciation
    )
```

---

## 5. 开发切入层级序列

### Phase 2 开发顺序

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 0: 数据模型层 (Day 1)                                     │
├─────────────────────────────────────────────────────────────────┤
│  1.1 资产表扩展字段 (alter table assets add ...)                  │
│       - depreciation_method ENUM('straight_line', 'declining')  │
│       - useful_life_years INT                                   │
│       - salvage_value DECIMAL(15,2)                             │
│                                                                 │
│  1.2 新建折旧记录表 asset_depreciation_records                   │
│       - id, asset_id, period_year, period_month                 │
│       - monthly_depreciation, accumulated_depreciation           │
│       - book_value, calculated_at                               │
│                                                                 │
│  1.3 Alembic 迁移脚本                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: 折旧计算服务层 (Day 2-3)                               │
├─────────────────────────────────────────────────────────────────┤
│  2.1 StraightLineDepreciation.calculate(asset)                  │
│  2.2 DoubleDecliningBalanceDepreciation.calculate(asset)        │
│  2.3 DepreciationCalculator.calculate_and_save(asset_id, period) │
│  2.4 DepreciationService.batchCalculate(asset_ids, period)      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: 业务逻辑层 (Day 4)                                     │
├─────────────────────────────────────────────────────────────────┤
│  3.1 DepreciationFacade.getReport(asset_id, year, month)        │
│  3.2 DepreciationFacade.shouldDepreciate(asset) 状态判断         │
│  3.3 DepreciationValidator 数据校验                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: API 接口层 (Day 5)                                    │
├─────────────────────────────────────────────────────────────────┤
│  4.1 GET /api/assets/{id}/depreciation  折旧报表查询            │
│  4.2 GET /api/assets/{id}/depreciation/summary  汇总数据        │
│  4.3 POST /api/assets/{id}/depreciation/recalculate  手动重算   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: 前端展示层 (Day 6-7)                                   │
├─────────────────────────────────────────────────────────────────┤
│  5.1 <AssetDepreciationReport> 组件                             │
│  5.2 折旧趋势图 (ECharts Line Chart)                             │
│  5.3 资产详情页集成                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 5: 定时任务层 (Day 8)                                     │
├─────────────────────────────────────────────────────────────────┤
│  6.1 Scheduler Job: depreciation_sync_task                      │
│  6.2 分布式锁实现 (Redis SETNX)                                 │
│  6.3 失败告警 (Webhook → Slack)                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 依赖关系矩阵

| 前置依赖 | 被依赖项 |
|---------|---------|
| Layer 0 | Layer 1, Layer 2 |
| Layer 1 | Layer 2 |
| Layer 2 | Layer 3 |
| Layer 3 | Layer 4, Layer 5 |
| Layer 4, Layer 5 | Layer 6 |

---

## 7. 风险登记

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 闰年/月末日期计算差异 | 高 | 使用 `dateutil.relativedelta` 或 Java `LocalDate.plusMonths()` 处理月份计算 |
| 历史数据迁移 | 中 | 提供一次性迁移脚本，支持回滚 |
| 并发写入冲突 | 中 | 使用 `SELECT FOR UPDATE` 行锁或数据库事务 |
| 双倍余额递减法转换时点误差 | 高 | 独立测试用例覆盖边界条件 |

---

## 8. 相关文件索引

### 后端核心文件

| 文件路径 | 描述 |
|---------|------|
| `backend/src/main/java/com/ams/entity/AssetDepreciation.java` | 折旧实体类 |
| `backend/src/main/java/com/ams/entity/DepreciationRecord.java` | 折旧记录实体 |
| `backend/src/main/java/com/ams/service/impl/StraightLineDepreciation.java` | 直线法计算实现 |
| `backend/src/main/java/com/ams/service/impl/DoubleDecliningBalanceDepreciation.java` | 双倍余额递减法实现 |
| `backend/src/main/java/com/ams/service/impl/DepreciationCalculator.java` | 折旧计算器 |
| `backend/src/main/java/com/ams/service/DepreciationService.java` | 折旧服务 |
| `backend/src/main/java/com/ams/controller/DepreciationController.java` | 折旧控制器 |
| `backend/src/main/java/com/ams/task/DepreciationSyncTask.java` | 折旧同步定时任务 |

### 测试文件

| 文件路径 | 描述 |
|---------|------|
| `tests/services/test_depreciation_service.py` | 折旧服务单元测试 |
| `tests/scheduler/test_depreciation_scheduler.py` | 定时任务测试 |
| `tests/db/test_depreciation_table.py` | 数据库表测试 |
| `backend/src/test/java/com/ams/service/impl/StraightLineDepreciationTest.java` | 直线法 Java 测试 |
| `backend/src/test/java/com/ams/service/impl/DoubleDecliningBalanceDepreciationTest.java` | 双倍余额递减法 Java 测试 |
| `frontend/tests/e2e/depreciation.spec.ts` | 前端 E2E 测试 |

### 前端文件

| 文件路径 | 描述 |
|---------|------|
| `frontend/src/services/depreciationService.ts` | 折旧服务 API 调用 |
| `frontend/src/types/depreciation.types.ts` | 折旧类型定义 |
| `frontend/src/app/hooks/useDepreciation.ts` | 折旧 Hook |
| `frontend/src/app/components/depreciation/DepreciationReport.module.css` | 折旧报表样式 |
| `frontend/src/app/pages/OperationLogDashboard/components/TrendChart.tsx` | 趋势图表组件 |

---

*文档结束*