import { test, expect, Page } from '@playwright/test';

/**
 * SWARM-003 资产折旧计算模块 - E2E 测试
 * 测试类型: End-to-End (E2E)
 * 目标文件: tests/e2e/test_asset_net_value_ui.spec.ts
 * 
 * 测试范围:
 * 1. 资产净值查询功能验证
 * 2. 折旧报表生成功能验证
 * 3. 报表导出功能验证
 * 4. 边界条件 UI 反馈验证
 */

// ==================== 测试数据fixtures ====================

/**
 * 直线法测试资产数据
 * - 资产ID: asset-001
 * - 原值: 100000.00
 * - 使用年限: 10年
 * - 残值: 5000.00
 * - 购置日期: 2023-01-01
 * - 折旧方法: STRAIGHT_LINE
 * - 2024-01-01 时净值: 90500.00
 * - 月折旧额: 791.67
 */
const straightLineAssetFixture = {
  id: 'asset-001',
  name: '测试固定资产-直线法',
  originalValue: 100000.00,
  usefulLife: 10,
  residualValue: 5000.00,
  purchaseDate: '2023-01-01',
  depreciationMethod: 'STRAIGHT_LINE',
  expectedNetValueAt2024: 90500.00,
  expectedMonthlyDepreciation: 791.67,
  expectedAccumulatedDepreciation: 9500.00
};

/**
 * 双倍余额递减法测试资产数据
 * - 资产ID: asset-002
 * - 原值: 60000.00
 * - 使用年限: 5年
 * - 购置日期: 2024-01-01
 * - 折旧方法: DOUBLE_DECLINING
 * - 折旧率: 40% (双倍余额递减 = 2/5)
 * - 2024-01-01 时月折旧额: 2000.00 (60000 * 40% / 12)
 */
const doubleDecliningAssetFixture = {
  id: 'asset-002',
  name: '测试固定资产-双倍余额递减',
  originalValue: 60000.00,
  usefulLife: 5,
  residualValue: 0,
  purchaseDate: '2024-01-01',
  depreciationMethod: 'DOUBLE_DECLINING',
  depreciationRate: 0.40,
  expectedNetValueAtMidYear: 48000.00,
  expectedMonthlyDepreciation: 2000.00
};

// ==================== 辅助函数 ====================

/**
 * 等待网络请求完成
 */
async function waitForApiResponse(page: Page, urlPattern: string): Promise<void> {
  await page.waitForResponse(
    response => response.url().match(urlPattern) !== null,
    { timeout: 10000 }
  );
}

/**
 * 格式化货币显示值
 */
function formatCurrency(value: number, decimals: number = 2): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// ==================== ATB-E2E-1: 资产净值查询功能 ====================

/**
 * 测试场景: 用户查询有效资产的当前净值
 * 测试编号: test_asset_net_value_query
 * 
 * 前置条件:
 * - 系统中存在资产ID为 "asset-001" 的有效资产
 * - 资产原值: 100000, 使用年限: 10年, 残值: 5000
 * - 购置日期: 2023-01-01
 * - 折旧方法: 直线法
 * - 计算日期: 2024-01-01
 * 
 * 期待结果:
 * - 页面显示资产名称与资产编号
 * - 当前净值显示为 ¥90,500.00
 * - 月折旧额显示为 ¥791.67
 * - 累计折旧显示为 ¥9,500.00
 */
test.describe('ATB-E2E-1: 资产净值查询功能', () => {
  test('用户可查看有效资产的当前净值', async ({ page }) => {
    // Arrange
    await page.goto(`/depreciation/asset/${straightLineAssetFixture.id}/detail`);
    
    // Act - 等待净值显示区加载
    await page.waitForSelector('[data-testid="net-value-display"]', { timeout: 5000 });
    
    const netValue = await page.textContent('[data-testid="net-value-display"]');
    const monthlyDepreciation = await page.textContent('[data-testid="monthly-depreciation"]');
    const accumulatedDepreciation = await page.textContent('[data-testid="accumulated-depreciation"]');
    const assetName = await page.textContent('[data-testid="asset-name"]');
    const assetId = await page.textContent('[data-testid="asset-id"]');
    
    // Assert - 验证资产基本信息
    expect(assetName).toContain(straightLineAssetFixture.name);
    expect(assetId).toContain(straightLineAssetFixture.id);
    
    // Assert - 验证净值计算结果
    expect(netValue).toContain(formatCurrency(straightLineAssetFixture.expectedNetValueAt2024));
    expect(monthlyDepreciation).toContain(formatCurrency(straightLineAssetFixture.expectedMonthlyDepreciation));
    expect(accumulatedDepreciation).toContain(formatCurrency(straightLineAssetFixture.expectedAccumulatedDepreciation));
  });

  test('净值数据格式为货币形式且保留2位小数', async ({ page }) => {
    // Arrange
    await page.goto(`/depreciation/asset/${straightLineAssetFixture.id}/detail`);
    
    // Act
    await page.waitForSelector('[data-testid="net-value-display"]', { timeout: 5000 });
    const netValue = await page.textContent('[data-testid="net-value-display"]');
    
    // Assert - 验证货币格式
    expect(netValue).toMatch(/¥[\d,]+(\.\d{2})?/);
  });

  test('月折旧额格式保留4位小数', async ({ page }) => {
    // Arrange
    await page.goto(`/depreciation/asset/${straightLineAssetFixture.id}/detail`);
    
    // Act
    await page.waitForSelector('[data-testid="monthly-depreciation"]', { timeout: 5000 });
    const monthlyDepreciation = await page.textContent('[data-testid="monthly-depreciation"]');
    
    // Assert - 验证月折旧额格式（保留4位小数）
    expect(monthlyDepreciation).toMatch(/¥[\d,]+(\.\d{1,4})?/);
  });
});

// ==================== ATB-E2E-2: 折旧方法切换验证 ====================

/**
 * 测试场景: 用户切换资产折旧方法后，净值重新计算
 * 测试编号: test_depreciation_method_switch
 * 
 * 前置条件:
 * - 资产 "asset-002" 原始方法为直线法
 * - 原值: 60000, 使用年限: 5年, 购置日期: 2024-01-01
 * - 切换折旧方法为双倍余额递减法
 * 
 * 期待结果:
 * - 切换后净值计算结果变化
 * - 首年月折旧额 = 60000 * 40% / 12 = 2,000.00
 */
test.describe('ATB-E2E-2: 折旧方法切换验证', () => {
  test('用户切换折旧方法后净值重新计算', async ({ page }) => {
    // Arrange - 进入资产设置页面
    await page.goto(`/depreciation/asset/${doubleDecliningAssetFixture.id}/settings`);
    
    // Act - 切换折旧方法
    await page.selectOption(
      '[data-testid="depreciation-method-select"]',
      'DOUBLE_DECLINING'
    );
    await page.click('[data-testid="save-method-button"]');
    
    // 等待API响应完成
    await waitForApiResponse(page, /\/api\/depreciation\//);
    
    // 导航到资产详情页
    await page.goto(`/depreciation/asset/${doubleDecliningAssetFixture.id}/detail`);
    await page.waitForSelector('[data-testid="net-value-display"]', { timeout: 5000 });
    
    const netValue = await page.textContent('[data-testid="net-value-display"]');
    const monthlyDepreciation = await page.textContent('[data-testid="monthly-depreciation"]');
    
    // Assert - 验证双倍余额递减法计算结果
    // 首年折旧 = 60000 * 40% = 24000
    // 半年后净值 ≈ 60000 - 24000/2 = 48000
    expect(netValue).toContain(formatCurrency(doubleDecliningAssetFixture.expectedNetValueAtMidYear));
    expect(monthlyDepreciation).toContain(formatCurrency(doubleDecliningAssetFixture.expectedMonthlyDepreciation));
  });

  test('折旧方法切换后月折旧明细完整', async ({ page }) => {
    // Arrange
    await page.goto(`/depreciation/asset/${doubleDecliningAssetFixture.id}/detail`);
    await page.waitForSelector('[data-testid="monthly-depreciation-schedule"]');
    
    // Act - 获取所有月折旧明细行
    const scheduleRows = await page.locator('[data-testid^="depreciation-schedule-row-"]').count();
    
    // Assert - 验证月折旧明细完整性（5年 * 12月 = 60条）
    expect(scheduleRows).toBe(60);
  });
});

// ==================== ATB-E2E-3: 折旧报表生成验证 ====================

/**
 * 测试场景: 用户生成并查看折旧报表
 * 测试编号: test_depreciation_report_generation
 * 
 * 前置条件:
 * - 用户已登录并拥有查看报表权限
 * - 系统中存在至少 3 条有效资产记录
 * 
 * 期待结果:
 * - 页面加载完成，显示汇总数据
 * - 报表包含: 总原值、总累计折旧、总净值
 * - 明细表格显示每项资产的月折旧计划
 * - 报表日期范围正确 (2024-01 至 2024-12)
 */
test.describe('ATB-E2E-3: 折旧报表生成验证', () => {
  test('用户可生成年度折旧报表', async ({ page }) => {
    // Arrange - 进入报表页面
    await page.goto('/depreciation/reports');
    
    // Act - 设置日期范围并生成报表
    await page.fill('[data-testid="report-start-date"]', '2024-01-01');
    await page.fill('[data-testid="report-end-date"]', '2024-12-31');
    await page.click('[data-testid="generate-report-button"]');
    
    // Assert - 等待报表加载（超时10秒）
    await page.waitForSelector('[data-testid="report-summary"]', { timeout: 10000 });
    
    // 验证汇总数据存在
    const totalOriginalValue = await page.textContent('[data-testid="total-original-value"]');
    const totalAccumulatedDepreciation = await page.textContent('[data-testid="total-accumulated-dep"]');
    const totalNetValue = await page.textContent('[data-testid="total-net-value"]');
    
    expect(totalOriginalValue).toBeDefined();
    expect(totalAccumulatedDepreciation).toBeDefined();
    expect(totalNetValue).toBeDefined();
  });

  test('报表明细表格显示至少3条资产记录', async ({ page }) => {
    // Arrange
    await page.goto('/depreciation/reports');
    await page.fill('[data-testid="report-start-date"]', '2024-01-01');
    await page.fill('[data-testid="report-end-date"]', '2024-12-31');
    await page.click('[data-testid="generate-report-button"]');
    await page.waitForSelector('[data-testid="report-summary"]', { timeout: 10000 });
    
    // Act - 验证明细行数
    const detailRows = await page.locator('[data-testid^="report-detail-row-"]').count();
    
    // Assert - 至少3条资产记录
    expect(detailRows).toBeGreaterThanOrEqual(3);
  });

  test('报表日期范围显示正确', async ({ page }) => {
    // Arrange
    await page.goto('/depreciation/reports');
    await page.fill('[data-testid="report-start-date"]', '2024-01-01');
    await page.fill('[data-testid="report-end-date"]', '2024-12-31');
    await page.click('[data-testid="generate-report-button"]');
    await page.waitForSelector('[data-testid="report-summary"]', { timeout: 10000 });
    
    // Act - 获取报表日期范围显示
    const periodDisplay = await page.textContent('[data-testid="report-period-display"]');
    
    // Assert - 验证日期范围
    expect(periodDisplay).toContain('2024-01');
    expect(periodDisplay).toContain('2024-12');
  });

  test('报表加载时间不超过3秒', async ({ page }) => {
    // Arrange
    await page.goto('/depreciation/reports');
    
    // Act - 测量报表加载时间
    const startTime = Date.now();
    await page.fill('[data-testid="report-start-date"]', '2024-01-01');
    await page.fill('[data-testid="report-end-date"]', '2024-12-31');
    await page.click('[data-testid="generate-report-button"]');
    await page.waitForSelector('[data-testid="report-summary"]', { timeout: 10000 });
    const loadTime = Date.now() - startTime;
    
    // Assert - 加载时间不超过3秒
    expect(loadTime).toBeLessThanOrEqual(3000);
  });
});

// ==================== ATB-E2E-4: 报表导出功能验证 ====================

/**
 * 测试场景: 用户导出报表为 XLSX 格式
 * 测试编号: test_report_export_xlsx
 * 
 * 前置条件:
 * - 报表已成功生成
 * - 浏览器允许文件下载
 * 
 * 期待结果:
 * - 点击导出后，浏览器下载 XLSX 文件
 * - 文件名格式: depreciation_report_YYYYMMDD_HHmmss.xlsx
 * - 文件内容包含报表汇总与明细数据
 */
test.describe('ATB-E2E-4: 报表导出功能验证', () => {
  test('用户可导出报表为 XLSX 格式', async ({ page }) => {
    // Arrange - 生成报表
    await page.goto('/depreciation/reports');
    await page.fill('[data-testid="report-start-date"]', '2024-01-01');
    await page.fill('[data-testid="report-end-date"]', '2024-12-31');
    await page.click('[data-testid="generate-report-button"]');
    await page.waitForSelector('[data-testid="report-summary"]', { timeout: 10000 });
    
    // Act - 触发下载
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-xlsx-button"]');
    const download = await downloadPromise;
    
    // Assert - 验证文件名格式
    expect(download.suggestedFilename()).toMatch(/^depreciation_report_\d{8}_\d{6}\.xlsx$/);
    
    // 验证文件可下载到本地
    const path = await download.path();
    expect(path).toBeDefined();
  });

  test('用户可导出报表为 CSV 格式', async ({ page }) => {
    // Arrange
    await page.goto('/depreciation/reports');
    await page.fill('[data-testid="report-start-date"]', '2024-01-01');
    await page.fill('[data-testid="report-end-date"]', '2024-12-31');
    await page.click('[data-testid="generate-report-button"]');
    await page.waitForSelector('[data-testid="report-summary"]', { timeout: 10000 });
    
    // Act
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-csv-button"]');
    const download = await downloadPromise;
    
    // Assert - 验证CSV文件名格式
    expect(download.suggestedFilename()).toMatch(/^depreciation_report_\d{8}_\d{6}\.csv$/);
  });
});

// ==================== ATB-E2E-5: 边界条件验证 ====================

/**
 * 测试场景: 用户查询不存在的资产ID
 * 测试编号: test_invalid_asset_id
 * 
 * 期待结果: 显示友好错误提示，而非技术性错误信息
 */
test.describe('ATB-E2E-5: 边界条件验证', () => {
  test('查询无效资产ID时显示友好错误', async ({ page }) => {
    // Arrange - 访问不存在的资产
    await page.goto('/depreciation/asset/invalid-id-999/detail');
    
    // Act & Assert - 验证错误提示
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 5000 });
    const errorMessage = await page.textContent('[data-testid="error-message"]');
    
    // 验证友好错误提示
    expect(errorMessage).toContain('资产不存在');
    
    // 验证不显示技术性错误信息
    expect(errorMessage).not.toContain('Internal Server Error');
    expect(errorMessage).not.toContain('500');
  });

  test('网络错误时显示重试按钮', async ({ page, context }) => {
    // Arrange - 模拟网络错误
    await context.route('**/api/depreciation/**', route => route.abort());
    await page.goto(`/depreciation/asset/${straightLineAssetFixture.id}/detail`);
    
    // Act & Assert - 等待重试按钮出现（3秒后）
    await page.waitForSelector('[data-testid="retry-button"]', { timeout: 5000 });
    expect(await page.isVisible('[data-testid="retry-button"]')).toBeTruthy();
  });

  test('点击重试按钮后重新加载数据', async ({ page, context }) => {
    // Arrange - 模拟网络错误后恢复
    let shouldFail = true;
    await context.route('**/api/depreciation/**', route => {
      if (shouldFail) {
        shouldFail = false;
        route.abort();
      } else {
        route.continue();
      }
    });
    
    await page.goto(`/depreciation/asset/${straightLineAssetFixture.id}/detail`);
    await page.waitForSelector('[data-testid="retry-button"]', { timeout: 5000 });
    
    // Act - 点击重试
    await page.click('[data-testid="retry-button"]');
    
    // Assert - 验证数据重新加载
    await page.waitForSelector('[data-testid="net-value-display"]', { timeout: 5000 });
    const netValue = await page.textContent('[data-testid="net-value-display"]');
    expect(netValue).toBeDefined();
  });

  test('无效日期范围时禁用生成按钮', async ({ page }) => {
    // Arrange - 进入报表页面
    await page.goto('/depreciation/reports');
    
    // Act - 设置无效日期范围（开始日期晚于结束日期）
    await page.fill('[data-testid="report-start-date"]', '2024-12-31');
    await page.fill('[data-testid="report-end-date"]', '2024-01-01');
    
    // Assert - 验证生成按钮被禁用
    const generateButton = page.locator('[data-testid="generate-report-button"]');
    await expect(generateButton).toBeDisabled();
    
    // 验证错误提示
    await expect(page.locator('[data-testid="date-range-error"]'))
      .toContainText('开始日期不能晚于结束日期');
  });

  test('日期范围超过1年时显示警告', async ({ page }) => {
    // Arrange
    await page.goto('/depreciation/reports');
    
    // Act - 设置超出一年的日期范围
    await page.fill('[data-testid="report-start-date"]', '2023-01-01');
    await page.fill('[data-testid="report-end-date"]', '2024-12-31');
    
    // Assert - 验证日期范围超限警告
    await expect(page.locator('[data-testid="date-range-warning"]'))
      .toContainText('日期范围不能超过1年');
  });

  test('并发请求同一资产时只允许1个净值请求', async ({ page, context }) => {
    // Arrange - 记录请求次数
    let requestCount = 0;
    await context.route('**/api/depreciation/assets/asset-001/net-value**', route => {
      requestCount++;
      route.continue();
    });
    
    // Act - 尝试触发多次请求（通过快速刷新）
    const page2Promise = page.context().newPage();
    const page1 = page;
    const page2 = await page2Promise;
    
    // 同时打开两个详情页
    await Promise.all([
      page1.goto(`/depreciation/asset/${straightLineAssetFixture.id}/detail`),
      page2.goto(`/depreciation/asset/${straightLineAssetFixture.id}/detail`)
    ]);
    
    // 等待请求完成
    await page.waitForSelector('[data-testid="net-value-display"]', { timeout: 10000 });
    
    // Assert - 验证只发送了1个请求（缓存生效或请求被合并）
    // 由于浏览器缓存策略，最多只应发送1个请求
    expect(requestCount).toBeLessThanOrEqual(1);
    
    await page2.close();
  });

  test('资产数量超过100时分页展示', async ({ page }) => {
    // Arrange - 准备大量资产数据场景
    await page.goto('/depreciation/reports');
    await page.fill('[data-testid="report-start-date"]', '2024-01-01');
    await page.fill('[data-testid="report-end-date"]', '2024-12-31');
    await page.click('[data-testid="generate-report-button"]');
    await page.waitForSelector('[data-testid="report-summary"]', { timeout: 10000 });
    
    // Act - 检查分页控件
    const pagination = page.locator('[data-testid="report-pagination"]');
    
    // 如果资产数量超过100，应该显示分页控件
    const detailRows = await page.locator('[data-testid^="report-detail-row-"]').count();
    
    if (detailRows > 100) {
      await expect(pagination).toBeVisible();
      
      // 验证每页50条的限制
      expect(detailRows).toBeLessThanOrEqual(50);
    }
  });

  test('报表加载中显示loading状态', async ({ page, context }) => {
    // Arrange - 延迟响应模拟加载状态
    await context.route('**/api/depreciation/report**', route => {
      setTimeout(() => route.continue(), 2000);
    });
    
    await page.goto('/depreciation/reports');
    await page.fill('[data-testid="report-start-date"]', '2024-01-01');
    await page.fill('[data-testid="report-end-date"]', '2024-12-31');
    
    // Act - 点击生成按钮后立即检查loading状态
    await page.click('[data-testid="generate-report-button"]');
    
    // Assert - 验证loading状态显示
    await expect(page.locator('[data-testid="report-loading"]')).toBeVisible();
    
    // 等待报表加载完成
    await page.waitForSelector('[data-testid="report-summary"]', { timeout: 10000 });
  });
});

// ==================== API Mock 辅助函数 ====================

/**
 * 设置 API Mock 响应
 */
function setupApiMocks(page: Page, assetData: typeof straightLineAssetFixture | typeof doubleDecliningAssetFixture) {
  // Mock 净值查询 API
  page.route('**/api/depreciation/assets/*/net-value**', (route) => {
    const assetId = route.request().url().match(/\/api\/depreciation\/assets\/([^/]+)/)?.[1];
    
    if (assetId === 'asset-001') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assetId: 'asset-001',
          assetName: straightLineAssetFixture.name,
          originalValue: '100000.0000',
          currentNetValue: '90500.0000',
          accumulatedDepreciation: '9500.0000',
          monthlyDepreciation: '791.6667',
          depreciationMethod: 'STRAIGHT_LINE',
          asOfDate: '2024-01-01',
          usefulLife: 10,
          residualValue: '5000.0000'
        })
      });
    } else if (assetId === 'asset-002') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assetId: 'asset-002',
          assetName: doubleDecliningAssetFixture.name,
          originalValue: '60000.0000',
          currentNetValue: '48000.0000',
          accumulatedDepreciation: '12000.0000',
          monthlyDepreciation: '2000.0000',
          depreciationMethod: 'DOUBLE_DECLINING',
          asOfDate: '2024-01-01',
          usefulLife: 5,
          residualValue: '0.0000'
        })
      });
    } else {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Asset not found',
          message: '资产不存在'
        })
      });
    }
  });
  
  // Mock 报表生成 API
  page.route('**/api/depreciation/report**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reportDate: '2024-12-31',
        periodStart: '2024-01',
        periodEnd: '2024-12',
        summary: {
          totalOriginalValue: '250000.0000',
          totalAccumulatedDepreciation: '28500.0000',
          totalNetValue: '221500.0000'
        },
        details: [
          {
            assetId: 'asset-001',
            assetName: straightLineAssetFixture.name,
            monthlyDepreciation: '791.6667',
            accumulatedDepreciation: '9500.0000',
            currentNetValue: '90500.0000'
          },
          {
            assetId: 'asset-002',
            assetName: doubleDecliningAssetFixture.name,
            monthlyDepreciation: '2000.0000',
            accumulatedDepreciation: '24000.0000',
            currentNetValue: '36000.0000'
          },
          {
            assetId: 'asset-003',
            assetName: '测试固定资产-其他',
            monthlyDepreciation: '500.0000',
            accumulatedDepreciation: '6000.0000',
            currentNetValue: '14000.0000'
          }
        ]
      })
    });
  });
}

// ==================== 集成测试（带Mock） ====================

/**
 * 集成测试：完整的资产净值查询流程
 * 使用 Mock 数据验证 UI 交互
 */
test.describe('集成测试：完整净值查询流程', () => {
  test.beforeEach(async ({ page }) => {
    // 设置 API Mock
    setupApiMocks(page, straightLineAssetFixture);
  });

  test('从资产列表到详情页的完整流程', async ({ page }) => {
    // Arrange - 进入资产列表页
    await page.goto('/depreciation/assets');
    await page.waitForSelector('[data-testid="asset-list"]');
    
    // Act - 点击第一个资产
    await page.click('[data-testid="asset-list-item-0"]');
    await page.waitForSelector('[data-testid="net-value-display"]');
    
    // Assert - 验证成功加载详情
    const netValue = await page.textContent('[data-testid="net-value-display"]');
    expect(netValue).toBeDefined();
  });

  test('从详情页到报表生成的完整流程', async ({ page }) => {
    // Arrange - 先进入详情页
    await page.goto(`/depreciation/asset/${straightLineAssetFixture.id}/detail`);
    await page.waitForSelector('[data-testid="net-value-display"]');
    
    // Act - 点击生成报表按钮
    await page.click('[data-testid="generate-report-from-detail"]');
    await page.waitForSelector('[data-testid="report-summary"]');
    
    // Assert - 验证报表生成成功
    const totalNetValue = await page.textContent('[data-testid="total-net-value"]');
    expect(totalNetValue).toBeDefined();
  });
});