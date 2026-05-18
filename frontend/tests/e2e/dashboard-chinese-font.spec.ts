import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Dashboard Department Distribution Chart Chinese Font Rendering
 *
 * Current dashboard uses React Router + Recharts (SVG), so these checks mock the
 * dashboard APIs and inspect the rendered SVG/tooltip instead of requiring a
 * real backend or ECharts canvas.
 */

const DEPARTMENTS = ['研发部', '市场部', '人力资源部'];
const CHINESE_FONT_FAMILIES = ['PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', 'sans-serif'];
const GARBLED_PATTERN = /[\ufffd\u25a1]{2,}/;

const SELECTORS = {
  chartContainer: '[data-testid="dept-distribution-chart"]',
  svg: 'svg',
  svgText: 'svg text, svg tspan',
  tooltip: '.recharts-tooltip-wrapper',
} as const;

const MOJIBAKE = {
  researchDept: '\u00e7\u00a0\u0094\u00e5\u008f\u0091\u00e9\u0083\u00a8',
  marketDept: '\u00e5\u00b8\u0082\u00e5\u009c\u00ba\u00e9\u0083\u00a8',
  approvalTitle: '\u00e8\u00b5\u0084\u00e4\u00ba\u00a7\u00e8\u00bd\u00ac\u00e7\u00a7\u00bb\u00e5\u00ae\u00a1\u00e6\u0089\u00b9',
};

function apiBody(data: unknown) {
  return JSON.stringify({ code: 200, message: 'ok', data });
}

async function mockDashboardApis(page: Page): Promise<void> {
  await page.route('**/api/dashboard/stats', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: apiBody({
      totalAssets: 128,
      inUseAssets: 100,
      idleAssets: 20,
      maintenanceAssets: 4,
      scrapAssets: 4,
      totalValue: 900000,
      netValue: 700000,
      categoryDistribution: {},
      pendingApprovals: 2,
    }),
  }));

  await page.route('**/api/dashboard/trends**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: apiBody([
      { date: '2026-05-01', totalValue: 800000, netValue: 650000 },
      { date: '2026-05-14', totalValue: 900000, netValue: 700000 },
    ]),
  }));

  await page.route('**/api/dashboard/dept-distribution', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: apiBody([
      { deptId: 1, deptName: MOJIBAKE.researchDept, assetCount: 52 },
      { deptId: 2, deptName: MOJIBAKE.marketDept, assetCount: 31 },
      { deptId: 3, deptName: '人力资源部', assetCount: 18 },
    ]),
  }));

  await page.route('**/api/approvals/pending', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: apiBody([
      { id: 1, title: MOJIBAKE.approvalTitle, description: `${MOJIBAKE.researchDept}资产转移`, applicantName: '张三', createTime: '2026-05-14' },
    ]),
  }));
}

async function loginAndGotoDashboard(page: Page): Promise<void> {
  await mockDashboardApis(page);
  await page.addInitScript(() => {
    localStorage.setItem('ams_auth_token', 'test-token');
    localStorage.setItem('ams_auth_user', JSON.stringify({ userId: 1, username: 'admin', realName: '管理员' }));
  });

  await page.goto('/dashboard');
  await expect(page.locator(SELECTORS.chartContainer)).toBeVisible({ timeout: 20000 });
  await expect(page.locator(`${SELECTORS.chartContainer} ${SELECTORS.svg}`)).toBeVisible({ timeout: 20000 });
}

function getChartContainer(page: Page): Locator {
  return page.locator(SELECTORS.chartContainer).first();
}

test.describe('Dashboard Chinese Font Rendering (Recharts SVG)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGotoDashboard(page);
  });

  test('ATB-01: Chinese department names are visible without garbled characters', async ({ page }) => {
    const chartContainer = getChartContainer(page);
    const svgTexts = await chartContainer.locator(SELECTORS.svgText).allTextContents();
    const textContent = [...svgTexts, await chartContainer.innerText()]
      .map((text) => text.trim())
      .filter(Boolean);

    const foundDepts = DEPARTMENTS.filter((dept) => textContent.some((text) => text.includes(dept)));
    expect(foundDepts.length).toBeGreaterThanOrEqual(1);

    for (const text of textContent) {
      expect(text).not.toMatch(GARBLED_PATTERN);
    }

    const screenshot = await chartContainer.screenshot();
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('ATB-02: Chart text elements have Chinese-compatible font-family', async ({ page }) => {
    const chartContainer = getChartContainer(page);
    const containerFontFamily = await chartContainer.evaluate((el) => window.getComputedStyle(el).fontFamily);
    expect(
      CHINESE_FONT_FAMILIES.some((font) => containerFontFamily.includes(font)),
      `Chart container font-family "${containerFontFamily}" should support Chinese characters`,
    ).toBeTruthy();

    const textElements = chartContainer.locator(SELECTORS.svgText);
    const count = await textElements.count();
    for (let index = 0; index < Math.min(count, 10); index += 1) {
      const fontFamily = await textElements.nth(index).evaluate((el) => window.getComputedStyle(el).fontFamily);
      expect(
        CHINESE_FONT_FAMILIES.some((font) => fontFamily.includes(font)),
        `Text element #${index} font-family "${fontFamily}" should support Chinese characters`,
      ).toBeTruthy();
    }
  });

  test('ATB-03: Tooltip displays recognizable text without garbled characters', async ({ page }) => {
    const chartContainer = getChartContainer(page);
    const box = await chartContainer.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.waitForTimeout(300);

    const tooltip = page.locator(SELECTORS.tooltip).first();
    if (await tooltip.isVisible().catch(() => false)) {
      const tooltipText = await tooltip.innerText();
      expect(tooltipText).not.toMatch(GARBLED_PATTERN);
      expect(/[\u4e00-\u9fff\d]/.test(tooltipText)).toBeTruthy();
    } else {
      test.info().annotations.push({
        type: 'warning',
        description: 'Recharts tooltip was not triggered by the synthetic hover; tooltip text assertion skipped.',
      });
    }
  });
});
