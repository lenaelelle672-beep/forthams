# SWARM-002 资产折旧计算模块规格指导文档

## 文档信息

| 字段 | 内容 |
|------|------|
| 模块编号 | SWARM-002 |
| 模块名称 | 资产折旧计算模块 |
| 当前 Iteration | 1 |
| 文档版本 | 1.0.0 |
| 创建日期 | 2024-01-15 |
| 状态 | 已审核 |

---

## 1. 需求与背景

### 1.1 业务场景

企业固定资产需按财务准则定期计提折旧，当前系统缺乏自动化折旧计算能力。用户需手动导出数据至 Excel 进行线下核算，效率低下且易出错。

**痛点分析：**

- 人工计算折旧容易出现算术错误
- 多种折旧方法（直线法、双倍余额递减法）切换困难
- 资产数量庞大时，批量计算耗时
- 折旧报表更新不及时，影响财务决策

### 1.2 核心诉求

| 角色 | 诉求描述 |
|------|---------|
| 资产管理员 | 在资产详情页实时查看折旧报表，了解资产当前账面价值及累计折旧 |
| 财务人员 | 获取标准化的折旧数据，支持月度/年度报表导出 |
| 系统 | 后端自动执行折旧计算，定时更新确保数据时效性 |

### 1.3 业务价值

- **效率提升**：自动化计算替代手动操作，预计减少 80% 的人工核算时间
- **数据准确性**：系统化计算消除人为误差，确保折旧金额精确至分
- **合规性**：内置两种折旧方法，自动适配财务准则要求

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 2：折旧核心引擎（Iteration 1 覆盖）

| 子任务 | 描述 | 交付物 | 优先级 |
|-------|------|--------|--------|
| P2.1 | 折旧计算服务实现 | `DepreciationService.java` + 折旧算法类 | P0 |
| P2.2 | 折旧数据持久化 | `DepreciationRecord` / `AssetDepreciation` 实体 + Mapper | P0 |
| P2.3 | 折旧查询 API | `DepreciationController.java` | P0 |
| P2.4 | 资产详情页折旧报表展示 | 前端组件 `<DepreciationReport>` | P1 |
| P2.5 | 定时折旧更新任务 | `DepreciationSyncTask.java` | P1 |

### 2.2 范围边界

#### 2.2.1 本期覆盖范围

| 功能 | 说明 |
|------|------|
| ✅ 直线法折旧计算 | (原值 - 残值) / 预计使用年限 |
| ✅ 双倍余额递减法计算 | 期初账面价值 × (2 / 预计使用年限)，最后两年转为直线法 |
| ✅ 月度折旧报表生成 | 按自然月生成折旧记录 |
| ✅ 资产详情页展示 | 图表 + 数据表格 |
| ✅ 定时自动更新 | 每月1日凌晨执行 |

#### 2.2.2 未来 Iteration 覆盖

| 功能 | 计划 Iteration |
|------|---------------|
| ❌ 年数总和法 | Iteration 2 |
| ❌ 批量重估/调整 | Iteration 2 |
| ❌ 折旧凭证自动生成 | Iteration 3 |
| ❌ 多种残值率模板 | Iteration 2 |

---

## 3. 边界约束

### 3.1 数据约束

| 约束项 | 值域/规格 | 备注 |
|-------|----------|------|
| 原值 (original_value) | > 0，精确到小数点后 2 位 | 单位：元 |
| 残值 (salvage_value) | ≥ 0 且 < 原值 | 单位：元 |
| 预计使用年限 (useful_life_years) | 1 ~ 50 整数 | 单位：年 |
| 计算精度 | 货币单位精确至分，ROUND_HALF_UP | Java: `BigDecimal.ROUND_HALF_UP` |
| 折旧期间 | 仅支持按月计提 | 日折旧转月度汇总 |

### 3.2 业务规则约束

```java
// 规则1：资产状态判断
if (asset.status == '已报废' || asset.status == '已处置') {
    // 该资产停止折旧计算
    return Collections.emptyList();
}

// 规则2：时间判断
if (currentDate < asset.acquisitionDate) {
    // 折旧尚未开始，不生成记录
    return Collections.emptyList();
}

// 规则3：折旧完毕判断
if (accumulatedDepreciation >= (originalValue - salvageValue)) {
    // 折旧计提完毕，账面价值 = 残值
    bookValue = salvageValue;
}
```

### 3.3 双倍余额递减法特殊规则

```java
// 规则4：最后两年转换为直线法
if (remainingYears == 2) {
    // 当期折旧 = 账面价值 / 2
    currentDepreciation = bookValue / 2;
}

// 规则5：最后一年
if (remainingYears == 1) {
    // 折旧 = 账面价值 - 残值
    currentDepreciation = bookValue - salvageValue;
}
```

### 3.4 定时任务约束

| 约束项 | 规格 |
|-------|------|
| 执行频率 | 每月 1 日 00:05:00 UTC |
| 重试策略 | 失败后 5 分钟重试，最多重试 3 次 |
| 批次处理 | 每批 100 条资产，防止数据库连接超时 |
| 锁机制 | 使用分布式锁 `depreciation_update_lock` 防止并发执行 |
| 告警机制 | 执行失败发送告警至 Slack |

### 3.5 API 约束

| 约束项 | 规格 |
|-------|------|
| 响应格式 | JSON (`application/json`) |
| 时区 | 所有日期时间使用 ISO 8601 UTC |
| 筛选参数 | 支持 `?year=YYYY&month=MM` 筛选指定期间 |
| 缓存策略 | 响应头 `Cache-Control: max-age=3600` |
| 分页 | 默认分页大小 20，最大 100 |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1：直线法计算验证

**测试文件**：`backend/src/test/java/com/ams/service/impl/StraightLineDepreciationTest.java`

```java
@Test
@DisplayName("ATB-1: 直线法月度折旧计算")
void testStraightLineMonthlyDepreciation() {
    // Given: 资产原值=100000, 残值=10000, 使用年限=5年
    BigDecimal originalValue = new BigDecimal("100000.00");
    BigDecimal salvageValue = new BigDecimal("10000.00");
    int usefulLifeYears = 5;
    
    // Expected: 每月折旧=(100000-10000)/5/12=1500
    BigDecimal expectedMonthly = new BigDecimal("1500.00");
    
    BigDecimal actualMonthly = straightLineDepreciation.calculate(
        originalValue, salvageValue, usefulLifeYears
    );
    
    assertEquals(0, expectedMonthly.compareTo(actualMonthly));
}

@Test
@DisplayName("ATB-1.1: 12个月后累计折旧验证")
void testAccumulatedAfter12Months() {
    // 验证12个月后累计折旧 = 1500 * 12 = 18000
    BigDecimal accumulated = monthlyDepreciation.multiply(new BigDecimal("12"));
    assertEquals(0, new BigDecimal("18000.00").compareTo(accumulated));
}
```

**通过标准**：
- [ ] 单一资产12个月折旧误差 ≤ 0.01
- [ ] 账面价值计算误差 ≤ 0.01
- [ ] 累计折旧与理论值误差 ≤ 0.01

### 4.2 ATB-2：双倍余额递减法计算验证

**测试文件**：`backend/src/test/java/com/ams/service/impl/DoubleDecliningBalanceDepreciationTest.java`

```java
@Test
@DisplayName("ATB-2: 双倍余额递减法首月折旧")
void testDoubleDecliningFirstMonth() {
    // Given: 原值=100000, 使用年限=5年
    BigDecimal originalValue = new BigDecimal("100000.00");
    int usefulLifeYears = 5;
    
    // Expected: 首月折旧=100000 * (2/5) / 12 = 3333.33
    BigDecimal rate = new BigDecimal("2").divide(new BigDecimal("5"), 10, RoundingMode.HALF_UP);
    BigDecimal expectedFirstMonth = originalValue.multiply(rate)
                                                  .divide(new BigDecimal("12"), 2, RoundingMode.HALF_UP);
    
    assertEquals(0, new BigDecimal("3333.33").compareTo(expectedFirstMonth));
}

@Test
@DisplayName("ATB-2.1: 倒数第二年自动切换直线法")
void testSwitchToStraightLineInFinalTwoYears() {
    // 验证在剩余年限=2时，自动切换为直线法
    // 当期账面价值 / 2 = 当期折旧
    assertTrue(methodSwitched);
}
```

**通过标准**：
- [ ] 首月折旧率精确至 4 位小数
- [ ] 转换时点账面价值计算误差 ≤ 0.01
- [ ] 最终残值精确吻合

### 4.3 ATB-3：资产状态流转验证

**测试文件**：`tests/services/test_depreciation_service.py`

```python
@pytest.mark.parametrize("status,expected_depreciation", [
    ("在用", True),
    ("已报废", False),
    ("已处置", False),
    ("闲置", True),
])
def test_depreciation_by_asset_status(status, expected_depreciation):
    """验证非"在用"和"闲置"状态的资产不计提折旧"""
    asset = Asset(status=status)
    result = depreciation_service.should_calculate(asset)
    assert result == expected_depreciation
```

**通过标准**：
- [ ] 状态为"已报废"时返回 False
- [ ] 状态为"已处置"时返回 False
- [ ] 状态为"在用"/"闲置"时返回 True

### 4.4 ATB-4：API 接口验证

**后端测试文件**：`backend/src/test/java/com/ams/controller/DepreciationControllerTest.java`

```java
@Test
@DisplayName("ATB-4: 获取折旧报表 API")
void testGetDepreciationReport() {
    // GET /api/depreciation/assets/{id}
    // Params: year=2024, month=6
    
    Result<DepreciationReportDTO> result = depreciationController
        .getDepreciationReport(123L, 2024, 6);
    
    assertEquals(ResultCode.SUCCESS, result.getCode());
    assertNotNull(result.getData());
    assertEquals(123L, result.getData().getAssetId());
    assertNotNull(result.getData().getCurrentBookValue());
    assertNotNull(result.getData().getAccumulatedDepreciation());
    assertFalse(result.getData().getMonthlyRecords().isEmpty());
}
```

**前端 E2E 测试文件**：`frontend/tests/e2e/depreciation.spec.ts`

```typescript
test('资产详情页显示折旧报表', async ({ page }) => {
  await page.goto('/assets/123');
  
  // 等待折旧报表加载
  await expect(page.locator('.depreciation-report')).toBeVisible({ timeout: 10000 });
  
  // 验证账面价值显示
  await expect(page.locator('.book-value')).toContainText('¥85,000.00');
  
  // 验证趋势图显示
  await expect(page.locator('.chart-depreciation')).toBeVisible();
  
  // 验证表格数据
  await expect(page.locator('.depreciation-table tbody tr')).toHaveCount(6);
});
```

**通过标准**：
- [ ] API 返回 200 状态码
- [ ] 响应数据结构完整
- [ ] 前端 E2E 测试通过

### 4.5 ATB-5：定时任务验证

**测试文件**：`backend/src/test/java/com/ams/task/DepreciationSyncTaskTest.java`

```java
@Test
@DisplayName("ATB-5: 定时任务正确触发并更新折旧")
void testMonthlyDepreciationJobExecution() {
    // 模拟定时任务执行
    depreciationSyncTask.execute();
    
    // 验证折旧记录已更新
    List<DepreciationRecord> records = depreciationRecordMapper.selectList(
        new LambdaQueryWrapper<DepreciationRecord>()
            .eq(DepreciationRecord::getPeriodYear, 2024)
            .eq(DepreciationRecord::getPeriodMonth, 6)
    );
    
    assertFalse(records.isEmpty());
}

@Test
@DisplayName("ATB-5.1: 分布式锁防止重复执行")
void testDistributedLockPreventsDuplicate() {
    // 验证分布式锁逻辑
    String lockKey = "depreciation_update_lock:2024-06";
    Boolean acquired = redisTemplate.opsForValue()
        .setIfAbsent(lockKey, "locked", Duration.ofMinutes(30));
    assertTrue(acquired);
}
```

**通过标准**：
- [ ] 定时任务按计划执行
- [ ] 分布式锁生效，防止并发
- [ ] 失败重试机制正常

### 4.6 ATB-6：数据一致性验证

**测试文件**：`tests/db/test_depreciation_table.py`

```python
def test_book_value_equals_original_minus_accumulated():
    """账面价值 = 原值 - 累计折旧"""
    record = DepreciationRecord.get_latest(asset_id=123)
    
    expected_book_value = record.original_value - record.accumulated_depreciation
    assert record.book_value == expected_book_value

def test_total_depreciation_not_exceed_depreciable_amount():
    """累计折旧不超过可折旧金额（原值-残值）"""
    record = DepreciationRecord.get_latest(asset_id=123)
    depreciable_amount = record.original_value - record.salvage_value
    
    assert record.accumulated_depreciation <= depreciable_amount
```

**通过标准**：
- [ ] 账面价值计算公式恒成立
- [ ] 累计折旧不超过可折旧金额

---

## 5. 开发切入层级序列

### 5.1 Phase 2 开发顺序

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 0: 数据模型层 (Day 1)                                      │
├─────────────────────────────────────────────────────────────────┤
│  1.1 资产表扩展字段                                               │
│       - depreciation_method ENUM('STRAIGHT_LINE', 'DECLINING')  │
│       - useful_life_years INT                                    │
│       - salvage_value DECIMAL(15,2)                             │
│                                                                 │
│  1.2 新建折旧记录表 asset_depreciation_records                   │
│       - id, asset_id, period_year, period_month                 │
│       - monthly_depreciation, accumulated_depreciation           │
│       - book_value, calculated_at                                │
│                                                                 │
│  1.3 数据库迁移脚本 (Flyway/Liquibase)                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: 折旧计算服务层 (Day 2-3)                               │
├─────────────────────────────────────────────────────────────────┤
│  2.1 StraightLineDepreciation.calculate()                       │
│  2.2 DoubleDecliningBalanceDepreciation.calculate()             │
│  2.3 DepreciationCalculator 工厂类                              │
│  2.4 DepreciationService.calculateAndSave()                     │
│  2.5 DepreciationService.batchCalculate()                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: 业务逻辑层 (Day 4)                                     │
├─────────────────────────────────────────────────────────────────┤
│  3.1 DepreciationService.getReport()                            │
│  3.2 DepreciationService.shouldCalculate() 状态判断              │
│  3.3 DepreciationValidator 数据校验                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: API 接口层 (Day 5)                                     │
├─────────────────────────────────────────────────────────────────┤
│  3.1 GET /api/depreciation/assets/{id} 折旧报表查询             │
│  3.2 GET /api/depreciation/assets/{id}/summary 汇总数据          │
│  3.3 POST /api/depreciation/assets/{id}/recalculate 手动重算     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: 前端展示层 (Day 6-7)                                   │
├─────────────────────────────────────────────────────────────────┤
│  4.1 <DepreciationReport /> 组件                                │
│  4.2 折旧趋势图 (ECharts Line Chart)                            │
│  4.3 资产详情页集成                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 5: 定时任务层 (Day 8)                                     │
├─────────────────────────────────────────────────────────────────┤
│  5.1 @Scheduled Job: depreciationMonthlyUpdate                   │
│  5.2 分布式锁实现 (Redis SETNX)                                  │
│  5.3 失败告警 (Webhook → Slack)                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 依赖关系矩阵

| 前置依赖 | 被依赖项 | 依赖类型 |
|---------|---------|---------|
| Layer 0 | Layer 1 | 编译时 |
| Layer 0 | Layer 2 | 编译时 |
| Layer 1 | Layer 2 | 编译时 |
| Layer 2 | Layer 3 | 编译时 |
| Layer 2 | Layer 4 | 编译时 |
| Layer 4 | Layer 5 | 运行时不强制 |

### 5.3 关键文件清单

| 层级 | 文件路径 | 职责 |
|------|---------|------|
| Entity | `backend/src/main/java/com/ams/entity/AssetDepreciation.java` | 折旧实体 |
| Entity | `backend/src/main/java/com/ams/entity/DepreciationRecord.java` | 折旧记录实体 |
| Mapper | `backend/src/main/java/com/ams/mapper/AssetDepreciationMapper.java` | 折旧 Mapper |
| Service | `backend/src/main/java/com/ams/service/impl/StraightLineDepreciation.java` | 直线法计算 |
| Service | `backend/src/main/java/com/ams/service/impl/DoubleDecliningBalanceDepreciation.java` | 双倍余额递减计算 |
| Service | `backend/src/main/java/com/ams/service/impl/DepreciationCalculator.java` | 计算工厂 |
| Service | `backend/src/main/java/com/ams/service/DepreciationService.java` | 折旧服务 |
| Controller | `backend/src/main/java/com/ams/controller/DepreciationController.java` | 折旧 API |
| Task | `backend/src/main/java/com/ams/task/DepreciationSyncTask.java` | 定时任务 |
| Frontend | `frontend/src/app/components/depreciation/DepreciationReport.tsx` | 折旧报表组件 |

---

## 6. 风险登记

| 风险 ID | 风险描述 | 影响等级 | 发生概率 | 缓解措施 |
|--------|---------|---------|---------|---------|
| RISK-001 | 闰年/月末日期计算差异 | 高 | 中 | 使用 `java.time.YearMonth` 处理月份计算 |
| RISK-002 | 历史数据迁移 | 中 | 低 | 提供一次性迁移脚本，支持回滚 |
| RISK-003 | 并发写入冲突 | 中 | 中 | 使用 `SELECT FOR UPDATE` 行锁 |
| RISK-004 | 双倍余额递减法转换时点误差 | 高 | 高 | 独立测试用例覆盖边界条件 |
| RISK-005 | 定时任务在服务重启后漏执行 | 中 | 低 | 记录任务执行状态，支持补执行 |

---

## 7. 附录

### 7.1 术语表

| 术语 | 英文 | 定义 |
|------|------|------|
| 直线法 | Straight-Line Method | 折旧额在资产使用年限内平均分摊 |
| 双倍余额递减法 | Double Declining Balance | 折旧率固定为 2/使用年限，按期初账面价值计算 |
| 账面价值 | Book Value | 资产原值减去累计折旧后的余额 |
| 累计折旧 | Accumulated Depreciation | 截至当前已计提的折旧总额 |
| 残值 | Salvage Value | 资产报废时可回收的估计价值 |

### 7.2 参考标准

- 《企业会计准则第 4 号——固定资产》
- 《企业会计准则第 6 号——无形资产》
- ISO 4217 货币代码标准

### 7.3 修改记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|---------|
| 1.0.0 | 2024-01-15 | 系统 | 初始版本 |