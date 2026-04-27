/**
 * 资产折旧 E2E 测试套件
 *
 * 测试范围:
 * - 直线法折旧展示 (ATB-004-01)
 * - 双倍余额递减法折旧展示 (ATB-004-02)
 * - 账面净值展示 (ATB-004-03)
 * - 加载状态展示 (ATB-004-04)
 * - 错误状态展示 (ATB-004-05)
 * - 前后端数据一致性验证 (ATB-005-01, ATB-005-02)
 *
 * @module e2e/depreciation
 */

import { test, expect, Page } from '@playwright/test';
import { TEST_BASE_URL } from '../config';

// 测试数据配置
const TEST_CREDENTIALS = {
  username: 'asset_manager',
  password: 'test_password_123'
};

// 折旧测试数据
interface DepreciationTestData {
  assetId: number;
  purchasePrice: number;
  usefulLifeYears: number;
  salvageValue: number;
  method: 'straight_line' | 'double_declining';
}

const STRAIGHT_LINE_ASSET: DepreciationTestData = {
  assetId: 1001,
  purchasePrice: 100000,
  usefulLifeYears: 10,
  salvageValue: 5000,
  method: 'straight_line'
};

const DOUBLE_DECLINING_ASSET: DepreciationTestData = {
  assetId: 1002,
  purchasePrice: 100000,
  usefulLifeYears: 5,
  salvageValue: 0,
  method: 'double_declining'
};

// ============ 辅助函数 ============

/**
 * 用户登录
 *
 * @param page - Playwright Page 对象
 * @param credentials - 登录凭证
 * @returns 认证上下文
 */
async function loginUser(
  page: Page,
  credentials: { username: string; password: string }
): Promise<void> {
  await page.goto(`${TEST_BASE_URL}/login`);
  await page.fill('[data-testid="username-input"]', credentials.username);
  await page.fill('[data-testid="password-input"]', credentials.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL(`${TEST_BASE_URL}/dashboard`);
}

/**
 * 导航到资产详情页
 *
 * @param page - Playwright Page 对象
 * @param assetId - 资产ID
 */
async function navigateToAssetDetail(
  page: Page,
  assetId: number
): Promise<void> {
  await page.goto(`${TEST_BASE_URL}/assets/${assetId}`);
  await page.waitForSelector('[data-testid="asset-detail-page"]');
}

/**
 * 获取折旧信息卡片
 *
 * @param page - Playwright Page 对象
 * @returns 折旧卡片元素
 */
async function getDepreciationCard(
  page: Page
): Promise<Locator> {
  return page.locator('[data-testid="depreciation-card"]');
}

/**
 * 等待折旧数据加载完成
 *
 * @param page - Playwright Page 对象
 */
async function waitForDepreciationLoad(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="depreciation-card"]');
  // 等待骨架屏消失，数据加载完成
  await page.waitForFunction(() => {
    const skeleton = document.querySelector('[data-testid="depreciation-skeleton"]');
    return skeleton === null;
  }, { timeout: 10000 });
}

/**
 * 提取折旧值文本
 *
 * @param page - Playwright Page 对象
 * @param selector - 选择器
 * @returns 数值字符串
 */
async function extractDepreciationValue(
  page: Page,
  selector: string
): Promise<string> {
  const element = page.locator(selector);
  return element.textContent();
}

// ============ 测试套件 ============

/**
 * ATB-004-01: 直线法折旧展示
 *
 * 验证直线法折旧方法正确展示：方法标签、月折旧额、累计折旧
 */
test.describe('ATB-004-01: 直线法折旧展示', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_CREDENTIALS);
    await navigateToAssetDetail(page, STRAIGHT_LINE_ASSET.assetId);
  });

  test('应正确显示直线法折旧标签', async ({ page }) => {
    await waitForDepreciationLoad(page);
    const methodLabel = page.locator('[data-testid="depreciation-method-label"]');
    await expect(methodLabel).toContainText('直线法');
  });

  test('应正确显示月折旧额', async ({ page }) => {
    await waitForDepreciationLoad(page);
    const monthlyDepreciation = page.locator('[data-testid="monthly-depreciation-value"]');
    await expect(monthlyDepreciation).toBeVisible();
    // 月折旧额 = (100000 - 5000) / (10 * 12) = 791.67
    const value = await monthlyDepreciation.textContent();
    expect(value).toMatch(/791\.67|792\.50/);
  });

  test('应正确显示累计折旧', async ({ page }) => {
    await waitForDepreciationLoad(page);
    const accumulatedDepreciation = page.locator('[data-testid="accumulated-depreciation-value"]');
    await expect(accumulatedDepreciation).toBeVisible();
    const value = await accumulatedDepreciation.textContent();
    // 验证格式为货币格式
    expect(value).toMatch(/^\d{1,3}(,\d{3})*(\.\d{2})?$/);
  });
});

/**
 * ATB-004-02: 双倍余额递减法折旧展示
 *
 * 验证双倍余额递减法折旧方法正确展示：方法标签、当前折旧率
 */
test.describe('ATB-004-02: 双倍余额递减法折旧展示', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_CREDENTIALS);
    await navigateToAssetDetail(page, DOUBLE_DECLINING_ASSET.assetId);
  });

  test('应正确显示双倍余额递减法标签', async ({ page }) => {
    await waitForDepreciationLoad(page);
    const methodLabel = page.locator('[data-testid="depreciation-method-label"]');
    await expect(methodLabel).toContainText('双倍余额递减法');
  });

  test('应正确显示当前折旧率', async ({ page }) => {
    await waitForDepreciationLoad(page);
    const depreciationRate = page.locator('[data-testid="depreciation-rate-value"]');
    await expect(depreciationRate).toBeVisible();
    // 首年折旧率 = 2 / 5 = 40%
    const value = await depreciationRate.textContent();
    expect(value).toMatch(/40\.00%/);
  });

  test('应正确显示年折旧额', async ({ page }) => {
    await waitForDepreciationLoad(page);
    const annualDepreciation = page.locator('[data-testid="annual-depreciation-value"]');
    await expect(annualDepreciation).toBeVisible();
    // 首年折旧 = 100000 * 40% = 40000
    const value = await annualDepreciation.textContent();
    expect(value).toMatch(/40,?000/);
  });
});

/**
 * ATB-004-03: 账面净值展示
 *
 * 验证任意方法下都能正确显示账面净值
 */
test.describe('ATB-004-03: 账面净值展示', () => {
  test('直线法应显示账面净值', async ({ page }) => {
    await loginUser(page, TEST_CREDENTIALS);
    await navigateToAssetDetail(page, STRAIGHT_LINE_ASSET.assetId);
    await waitForDepreciationLoad(page);

    const netBookValue = page.locator('[data-testid="net-book-value"]');
    await expect(netBookValue).toBeVisible();
    // 账面净值 = 购置价格 - 累计折旧
    const value = await netBookValue.textContent();
    expect(value).toMatch(/^\d{1,3}(,\d{3})*(\.\d{2})?$/);
  });

  test('双倍余额递减法应显示账面净值', async ({ page }) => {
    await loginUser(page, TEST_CREDENTIALS);
    await navigateToAssetDetail(page, DOUBLE_DECLINING_ASSET.assetId);
    await waitForDepreciationLoad(page);

    const netBookValue = page.locator('[data-testid="net-book-value"]');
    await expect(netBookValue).toBeVisible();
    const value = await netBookValue.textContent();
    expect(value).toMatch(/^\d{1,3}(,\d{3})*(\.\d{2})?$/);
  });
});

/**
 * ATB-004-04: 加载状态展示
 *
 * 验证 API 请求中正确显示加载指示器
 */
test.describe('ATB-004-04: 加载状态展示', () => {
  test('应显示骨架屏或加载指示器', async ({ page }) => {
    await loginUser(page, TEST_CREDENTIALS);

    // 监听网络请求以控制响应时间
    await page.route('**/api/v1/assets/*/depreciation', async (route) => {
      // 延迟 2 秒模拟加载
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.continue();
    });

    await navigateToAssetDetail(page, STRAIGHT_LINE_ASSET.assetId);

    // 初始应有加载指示器
    const skeleton = page.locator('[data-testid="depreciation-skeleton"]');
    const spinner = page.locator('[data-testid="depreciation-spinner"]');
    const hasLoadingIndicator = await skeleton.isVisible() || await spinner.isVisible();
    expect(hasLoadingIndicator).toBeTruthy();
  });

  test('加载完成后加载指示器应消失', async ({ page }) => {
    await loginUser(page, TEST_CREDENTIALS);
    await navigateToAssetDetail(page, STRAIGHT_LINE_ASSET.assetId);
    await waitForDepreciationLoad(page);

    const skeleton = page.locator('[data-testid="depreciation-skeleton"]');
    const spinner = page.locator('[data-testid="depreciation-spinner"]');
    const loadingGone = !(await skeleton.isVisible()) && !(await spinner.isVisible());
    expect(loadingGone).toBeTruthy();
  });
});

/**
 * ATB-004-05: 错误状态展示
 *
 * 验证 API 返回错误时正确处理，不崩溃
 */
test.describe('ATB-004-05: 错误状态展示', () => {
  test('API 500 错误应显示错误提示', async ({ page }) => {
    await loginUser(page, TEST_CREDENTIALS);

    // 模拟服务器错误
    await page.route('**/api/v1/assets/*/depreciation', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    await navigateToAssetDetail(page, STRAIGHT_LINE_ASSET.assetId);

    // 应显示错误提示
    const errorAlert = page.locator('[data-testid="depreciation-error-alert"]');
    await expect(errorAlert).toBeVisible();
  });

  test('错误状态页面不应崩溃', async ({ page }) => {
    await loginUser(page, TEST_CREDENTIALS);

    await page.route('**/api/v1/assets/*/depreciation', async (route) => {
      await route.abort();
    });

    // 导航不应抛出未捕获的异常
    await expect(async () => {
      await navigateToAssetDetail(page, STRAIGHT_LINE_ASSET.assetId);
    }).not.toThrow();
  });

  test('资产不存在时显示 404 提示', async ({ page }) => {
    await loginUser(page, TEST_CREDENTIALS);

    await page.route('**/api/v1/assets/99999/depreciation', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Asset not found' })
      });
    });

    await navigateToAssetDetail(page, 99999);

    const notFoundMessage = page.locator('[data-testid="asset-not-found-message"]');
    await expect(notFoundMessage).toBeVisible();
  });
});

/**
 * ATB-005-01: 前后端数值一致
 *
 * 验证前端显示值与 API 返回值完全匹配
 */
test.describe('ATB-005-01: 前后端数值一致', () => {
  let apiResponse: {
    current_depreciation: number;
    accumulated_depreciation: number;
    net_book_value: number;
  };

  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_CREDENTIALS);
    await navigateToAssetDetail(page, STRAIGHT_LINE_ASSET.assetId);
    await waitForDepreciationLoad(page);
  });

  test('月折旧额与 API 返回一致', async ({ page }) => {
    // 获取 API 响应
    const response = await page.request.get(
      `${TEST_BASE_URL}/api/v1/assets/${STRAIGHT_LINE_ASSET.assetId}/depreciation`,
      { params: { method: 'straight_line' } }
    );
    apiResponse = await response.json();

    // 获取前端显示值
    const frontendValue = await extractDepreciationValue(
      page,
      '[data-testid="monthly-depreciation-value"]'
    );
    const frontendNumeric = parseFloat(frontendValue.replace(/,/g, ''));

    // 验证精度（保留2位小数）
    expect(frontendNumeric).toBeCloseTo(apiResponse.current_depreciation, 2);
  });

  test('累计折旧与 API 返回一致', async ({ page }) => {
    const response = await page.request.get(
      `${TEST_BASE_URL}/api/v1/assets/${STRAIGHT_LINE_ASSET.assetId}/depreciation`,
      { params: { method: 'straight_line' } }
    );
    apiResponse = await response.json();

    const frontendValue = await extractDepreciationValue(
      page,
      '[data-testid="accumulated-depreciation-value"]'
    );
    const frontendNumeric = parseFloat(frontendValue.replace(/,/g, ''));

    expect(frontendNumeric).toBeCloseTo(apiResponse.accumulated_depreciation, 2);
  });

  test('账面净值与 API 返回一致', async ({ page }) => {
    const response = await page.request.get(
      `${TEST_BASE_URL}/api/v1/assets/${STRAIGHT_LINE_ASSET.assetId}/depreciation`,
      { params: { method: 'straight_line' } }
    );
    apiResponse = await response.json();

    const frontendValue = await extractDepreciationValue(
      page,
      '[data-testid="net-book-value"]'
    );
    const frontendNumeric = parseFloat(frontendValue.replace(/,/g, ''));

    expect(frontendNumeric).toBeCloseTo(apiResponse.net_book_value, 2);
  });
});

/**
 * ATB-005-02: 刷新后一致
 *
 * 验证页面刷新后数据无变化
 */
test.describe('ATB-005-02: 刷新后一致', () => {
  test('刷新后折旧数据保持一致', async ({ page }) => {
    await loginUser(page, TEST_CREDENTIALS);
    await navigateToAssetDetail(page, STRAIGHT_LINE_ASSET.assetId);
    await waitForDepreciationLoad(page);

    // 记录初始值
    const initialMonthly = await extractDepreciationValue(
      page,
      '[data-testid="monthly-depreciation-value"]'
    );
    const initialAccumulated = await extractDepreciationValue(
      page,
      '[data-testid="accumulated-depreciation-value"]'
    );
    const initialNetBook = await extractDepreciationValue(
      page,
      '[data-testid="net-book-value"]'
    );

    // 刷新页面
    await page.reload();
    await waitForDepreciationLoad(page);

    // 验证值未变
    const refreshedMonthly = await extractDepreciationValue(
      page,
      '[data-testid="monthly-depreciation-value"]'
    );
    const refreshedAccumulated = await extractDepreciationValue(
      page,
      '[data-testid="accumulated-depreciation-value"]'
    );
    const refreshedNetBook = await extractDepreciationValue(
      page,
      '[data-testid="net-book-value"]'
    );

    expect(refreshedMonthly).toBe(initialMonthly);
    expect(refreshedAccumulated).toBe(initialAccumulated);
    expect(refreshedNetBook).toBe(initialNetBook);
  });
});

/**
 * ATB-005-03: 精度丢失检测
 *
 * 验证多次计算后端点误差不超过 0.01
 */
test.describe('ATB-005-03: 精度丢失检测', () => {
  test('连续请求精度一致', async ({ page }) => {
    await loginUser(page, TEST_CREDENTIALS);
    await navigateToAssetDetail(page, STRAIGHT_LINE_ASSET.assetId);

    const results: Array<{ accumulated: number; net_book: number }> = [];

    // 连续发起 3 次请求
    for (let i = 0; i < 3; i++) {
      const response = await page.request.get(
        `${TEST_BASE_URL}/api/v1/assets/${STRAIGHT_LINE_ASSET.assetId}/depreciation`,
        { params: { method: 'straight_line' } }
      );
      const data = await response.json();
      results.push({
        accumulated: data.accumulated_depreciation,
        net_book: data.net_book_value
      });
    }

    // 验证所有结果的误差不超过 0.01
    for (let i = 1; i < results.length; i++) {
      expect(
        Math.abs(results[i].accumulated - results[i - 1].accumulated)
      ).toBeLessThanOrEqual(0.01);
      expect(
        Math.abs(results[i].net_book - results[i - 1].net_book)
      ).toBeLessThanOrEqual(0.01);
    }
  });
});

/**
 * 回归测试：折旧方法切换
 *
 * 确保用户可切换折旧方法查看不同结果
 */
test.describe('回归测试：折旧方法切换', () => {
  test('应支持切换直线法和双倍余额递减法', async ({ page }) => {
    await loginUser(page, TEST_CREDENTIALS);
    await navigateToAssetDetail(page, STRAIGHT_LINE_ASSET.assetId);
    await waitForDepreciationLoad(page);

    // 切换到双倍余额递减法
    const methodSelect = page.locator('[data-testid="depreciation-method-select"]');
    await methodSelect.click();
    await page.selectOption(methodSelect, 'double_declining');

    // 等待数据更新
    await page.waitForTimeout(500);

    // 验证方法已切换
    const methodLabel = page.locator('[data-testid="depreciation-method-label"]');
    await expect(methodLabel).toContainText('双倍余额递减法');
  });
});

// ============ Locator 类型定义 ============
import { Locator } from '@playwright/test';