import { test, expect } from '@playwright/test';

/**
 * SWARM-003 资产折旧计算模块 - Iteration 2
 * ATB-3: 折旧报表生成验证 End-to-End 测试套件
 * 
 * 验证目标:
 * - DepreciationReportGenerator.generate_report() 的输出结构完整性
 * - 期间过滤功能准确性
 * - 数据汇总计算正确性
 * - 资产净值与月折旧额数据显示
 */
describe('ATB-3: 折旧报表生成验证', () => {
  
  /**
   * 测试目标: 验证报表返回结构完整性
   * 输入: 多笔资产数据, 查询期间 2024-01 至 2024-12
   * 期待返回结构包含 report_date, summary, details 字段
   */
  test('报表结构完整性验证', async ({ page }) => {
    // Navigate to depreciation report page
    await page.goto('/depreciation/report');
    
    // Set query period
    await page.fill('input[name="periodStart"]', '2024-01-01');
    await page.fill('input[name="periodEnd"]', '2024-12-31');
    
    // Click generate button
    await page.click('button[type="submit"]');
    
    // Wait for report to load
    await page.waitForSelector('[data-testid="depreciation-report"]');
    
    // Verify report structure
    const report = await page.locator('[data-testid="depreciation-report"]');
    await expect(report).toBeVisible();
    
    // Verify summary section
    const summary = await page.locator('[data-testid="report-summary"]');
    await expect(summary).toBeVisible();
    
    // Verify details section
    const details = await page.locator('[data-testid="report-details"]');
    await expect(details).toBeVisible();
    
    // Verify report metadata
    const reportDate = await page.locator('[data-testid="report-date"]');
    await expect(reportDate).toBeVisible();
  });

  /**
   * 测试目标: 验证月折旧额精度
   * 输入: 原值=50000, 年限=5, 残值=5000 的资产
   * 期待: 月折旧额 = (50000-5000)/(5*12) = 750.00
   */
  test('月折旧额精度验证', async ({ page }) => {
    // Navigate to depreciation report page
    await page.goto('/depreciation/report');
    
    // Set query for specific asset
    await page.fill('input[name="assetId"]', 'AST-2024-001');
    await page.fill('input[name="periodStart"]', '2024-01-01');
    await page.fill('input[name="periodEnd"]', '2024-12-31');
    
    // Generate report
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="report-details"]');
    
    // Verify monthly depreciation amount
    const monthlyAmount = await page.locator('[data-testid="monthly-depreciation"]').first();
    await expect(monthlyAmount).toHaveText('750.00');
  });

  /**
   * 测试目标: 验证报表期间过滤
   * 输入: 查询期间 2024-03 至 2024-05
   * 期待: 仅返回该期间的折旧数据
   */
  test('期间过滤功能验证', async ({ page }) => {
    await page.goto('/depreciation/report');
    
    // Set narrow period filter
    await page.fill('input[name="periodStart"]', '2024-03-01');
    await page.fill('input[name="periodEnd"]', '2024-05-31');
    
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="report-details"]');
    
    // Count detail rows - should only include filtered months
    const detailRows = await page.locator('[data-testid="detail-row"]').all();
    expect(detailRows.length).toBeLessThanOrEqual(3); // Mar, Apr, May
    
    // Verify all entries fall within period
    for (const row of detailRows) {
      const period = await row.locator('[data-testid="period"]').textContent();
      const periodNum = parseInt(period?.replace('-', '') || '0');
      expect(periodNum).toBeGreaterThanOrEqual(202403);
      expect(periodNum).toBeLessThanOrEqual(202405);
    }
  });

  /**
   * 测试目标: 验证汇总数据计算正确性
   * 输入: 多笔资产数据的报表
   * 期待: summary.total_original_value = 各资产原值之和
   */
  test('汇总数据计算验证', async ({ page }) => {
    await page.goto('/depreciation/report');
    
    await page.fill('input[name="periodStart"]', '2024-01-01');
    await page.fill('input[name="periodEnd"]', '2024-12-31');
    
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="report-summary"]');
    
    // Verify summary totals are calculated
    const totalOriginalValue = await page.locator('[data-testid="total-original-value"]').textContent();
    const totalAccumulatedDepreciation = await page.locator('[data-testid="total-accumulated-depreciation"]').textContent();
    const totalCurrentNetValue = await page.locator('[data-testid="total-current-net-value"]').textContent();
    
    // Parse and validate values
    const original = parseFloat(totalOriginalValue?.replace(/,/g, '') || '0');
    const accumulated = parseFloat(totalAccumulatedDepreciation?.replace(/,/g, '') || '0');
    const netValue = parseFloat(totalCurrentNetValue?.replace(/,/g, '') || '0');
    
    expect(original).toBeGreaterThan(0);
    expect(accumulated).toBeGreaterThanOrEqual(0);
    expect(netValue).toBeGreaterThan(0);
    expect(original).toBeCloseTo(accumulated + netValue, 2);
  });

  /**
   * 测试目标: 验证直线法报表数据
   * 输入: 采用 STRAIGHT_LINE 折旧方法的资产
   * 期待: 每月折旧额一致
   */
  test('直线法折旧报表验证', async ({ page }) => {
    await page.goto('/depreciation/report');
    
    // Filter for straight-line method assets
    await page.selectOption('select[name="depreciationMethod"]', 'STRAIGHT_LINE');
    await page.fill('input[name="periodStart"]', '2024-01-01');
    await page.fill('input[name="periodEnd"]', '2024-12-31');
    
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="report-details"]');
    
    // Verify consistent monthly amounts for straight-line
    const monthlyAmounts = await page.locator('[data-testid="monthly-depreciation"]').all();
    
    if (monthlyAmounts.length > 1) {
      const firstAmount = await monthlyAmounts[0].textContent();
      for (let i = 1; i < monthlyAmounts.length; i++) {
        const amount = await monthlyAmounts[i].textContent();
        expect(amount).toBe(firstAmount);
      }
    }
  });

  /**
   * 测试目标: 验证双倍余额递减法报表数据
   * 输入: 采用 DOUBLE_DECLINING 折旧方法的资产
   * 期待: 前期折旧额高，逐期递减
   */
  test('双倍余额递减法折旧报表验证', async ({ page }) => {
    await page.goto('/depreciation/report');
    
    // Filter for double declining method assets
    await page.selectOption('select[name="depreciationMethod"]', 'DOUBLE_DECLINING');
    await page.fill('input[name="periodStart"]', '2024-01-01');
    await page.fill('input[name="periodEnd"]', '2024-12-31');
    
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="report-details"]');
    
    // Verify decreasing depreciation amounts
    const monthlyAmounts = await page.locator('[data-testid="monthly-depreciation"]').all();
    
    if (monthlyAmounts.length > 1) {
      for (let i = 1; i < Math.min(monthlyAmounts.length, 13); i++) {
        const prevAmount = parseFloat((await monthlyAmounts[i-1].textContent())?.replace(/,/g, '') || '0');
        const currAmount = parseFloat((await monthlyAmounts[i].textContent())?.replace(/,/g, '') || '0');
        expect(currAmount).toBeLessThanOrEqual(prevAmount);
      }
    }
  });

  /**
   * 测试目标: 验证资产净值显示
   * 输入: 任一资产
   * 期待: current_net_value 显示正确，累计折旧计算无误
   */
  test('资产净值显示验证', async ({ page }) => {
    await page.goto('/depreciation/report');
    
    await page.fill('input[name="assetId"]', 'AST-2024-001');
    await page.fill('input[name="periodStart"]', '2024-01-01');
    await page.fill('input[name="periodEnd"]', '2024-06-30');
    
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="report-details"]');
    
    // Verify net value is calculated correctly
    const originalValue = parseFloat(
      (await page.locator('[data-testid="original-value"]').first().textContent())?.replace(/,/g, '') || '0'
    );
    const accumulatedDepreciation = parseFloat(
      (await page.locator('[data-testid="accumulated-depreciation"]').last().textContent())?.replace(/,/g, '') || '0'
    );
    const currentNetValue = parseFloat(
      (await page.locator('[data-testid="current-net-value"]').textContent())?.replace(/,/g, '') || '0'
    );
    
    // Net value should equal original value minus accumulated depreciation
    expect(currentNetValue).toBeCloseTo(originalValue - accumulatedDepreciation, 2);
    
    // Net value should never be negative
    expect(currentNetValue).toBeGreaterThanOrEqual(0);
    
    // Net value should never exceed original value
    expect(currentNetValue).toBeLessThanOrEqual(originalValue);
  });

  /**
   * 测试目标: 验证无数据时的空报表处理
   * 输入: 不存在的资产ID
   * 期待: 显示空状态提示，无错误
   */
  test('空报表状态处理', async ({ page }) => {
    await page.goto('/depreciation/report');
    
    await page.fill('input[name="assetId"]', 'AST-NONEXISTENT-999');
    await page.fill('input[name="periodStart"]', '2024-01-01');
    await page.fill('input[name="periodEnd"]', '2024-12-31');
    
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="empty-state"]');
    
    const emptyState = await page.locator('[data-testid="empty-state"]');
    await expect(emptyState).toBeVisible();
    
    // Should show appropriate message
    const message = await emptyState.textContent();
    expect(message).toContain('No data' || '无数据' || '暂无数据');
  });

  /**
   * 测试目标: 验证导出功能
   * 输入: 有效的报表数据
   * 期待: 点击导出按钮触发文件下载
   */
  test('报表导出功能验证', async ({ page }) => {
    await page.goto('/depreciation/report');
    
    await page.fill('input[name="periodStart"]', '2024-01-01');
    await page.fill('input[name="periodEnd"]', '2024-12-31');
    
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="report-details"]');
    
    // Set up download listener
    const downloadPromise = page.waitForEvent('download');
    
    // Click export button
    await page.click('button[data-testid="export-report"]');
    
    // Verify download started
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/depreciation_report.*\.xlsx/);
  });

  /**
   * 测试目标: 验证日期范围边界处理
   * 输入: 计算日期超出资产使用年限
   * 期待: 净值锁定为残值，不再递减
   */
  test('超使用年限边界处理', async ({ page }) => {
    await page.goto('/depreciation/report');
    
    // Asset with 5-year useful life, purchased in 2018
    await page.fill('input[name="assetId"]', 'AST-2018-001');
    await page.fill('input[name="periodStart"]', '2023-01-01');
    await page.fill('input[name="periodEnd"]', '2023-12-31');
    
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="report-details"]');
    
    // Net value should equal residual value at end of useful life
    const currentNetValue = parseFloat(
      (await page.locator('[data-testid="current-net-value"]').textContent())?.replace(/,/g, '') || '0'
    );
    const residualValue = parseFloat(
      (await page.locator('[data-testid="residual-value"]').textContent())?.replace(/,/g, '') || '0'
    );
    
    expect(currentNetValue).toBeLessThanOrEqual(residualValue + 0.01);
  });

  /**
   * 测试目标: 验证批量资产报表生成性能
   * 输入: 100+ 笔资产数据
   * 期待: 报表生成时间 < 5s
   */
  test('批量报表性能验证', async ({ page }) => {
    await page.goto('/depreciation/report');
    
    // Select multiple assets filter
    await page.fill('input[name="periodStart"]', '2024-01-01');
    await page.fill('input[name="periodEnd"]', '2024-12-31');
    
    const startTime = Date.now();
    
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="report-details"]');
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Performance expectation: should complete within 5 seconds
    expect(duration).toBeLessThan(5000);
  });
});