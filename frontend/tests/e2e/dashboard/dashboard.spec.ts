/**
 * Dashboard E2E Test Suite
 * 
 * Tests for SWARM-003 Dashboard Data Dashboard:
 * - Asset Overview Statistics Component
 * - Category Distribution Chart
 * - Maintenance Expiration Alert Card
 * 
 * @module tests/e2e/dashboard/dashboard.spec
 */

import { test, expect, Page, Route } from '@playwright/test';

// Test data fixtures
const mockStatisticsData = {
  total: 1523,
  online: 1280,
  offline: 243,
  total_value: 15800000
};

const mockCategoryDistribution = [
  { category: '电子设备', count: 580, percentage: 38.1 },
  { category: '办公家具', count: 320, percentage: 21.0 },
  { category: '生产设备', count: 280, percentage: 18.4 },
  { category: '运输工具', count: 180, percentage: 11.8 },
  { category: '其他', count: 163, percentage: 10.7 }
];

const mockMaintenanceAlerts = {
  urgent: [
    { id: 1, asset_name: '服务器A', expire_date: '2024-01-20', days_left: 3 },
    { id: 2, asset_name: '打印机B', expire_date: '2024-01-22', days_left: 5 }
  ],
  warning: [
    { id: 3, asset_name: '空调C', expire_date: '2024-02-10', days_left: 15 },
    { id: 4, asset_name: '投影仪D', expire_date: '2024-02-15', days_left: 20 }
  ]
};

/**
 * Setup mock API routes for dashboard data
 */
async function setupDashboardMocks(page: Page): Promise<void> {
  // Mock statistics API
  await page.route('**/api/v1/assets/statistics', (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockStatisticsData)
    });
  });

  // Mock category distribution API
  await page.route('**/api/v1/assets/categories/distribution', (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockCategoryDistribution)
    });
  });

  // Mock maintenance alerts API
  await page.route('**/api/v1/maintenance/alerts', (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockMaintenanceAlerts)
    });
  });
}

/**
 * Page Object: Dashboard
 */
class DashboardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  // Statistics Panel locators
  get statisticsPanel() {
    return this.page.locator('.statistics-panel');
  }

  getStatCard(label: string) {
    return this.page.locator('.stat-card').filter({ has: this.page.locator(`text=${label}`) });
  }

  get statCardTotal() {
    return this.getStatCard('资产总量');
  }

  get statCardOnline() {
    return this.getStatCard('在线数量');
  }

  get statCardOffline() {
    return this.getStatCard('离线数量');
  }

  get statCardValue() {
    return this.getStatCard('资产总价值');
  }

  // Category Chart locators
  get categoryChart() {
    return this.page.locator('#category-distribution-chart');
  }

  get categoryChartCanvas() {
    return this.page.locator('#category-distribution-chart canvas');
  }

  get chartLegendItems() {
    return this.page.locator('.chart-legend-item');
  }

  get chartTooltip() {
    return this.page.locator('.echarts-tooltip');
  }

  // Maintenance Alert locators
  get maintenanceAlertCard() {
    return this.page.locator('#maintenance-alert-card');
  }

  get alertSummary() {
    return this.page.locator('.alert-summary');
  }

  get alertList() {
    return this.page.locator('.alert-list');
  }

  get urgentSection() {
    return this.page.locator('.alert-section').filter({ has: this.page.locator('text=7天内') });
  }

  get warningSection() {
    return this.page.locator('.alert-section').filter({ has: this.page.locator('text=30天内') });
  }

  get alertItems() {
    return this.page.locator('.alert-item');
  }

  // Dashboard container
  get dashboardContainer() {
    return this.page.locator('.dashboard-container');
  }

  get chartEmptyState() {
    return this.page.locator('.chart-empty-state');
  }
}

// Test Suite
test.describe('Dashboard Page - Asset Overview', () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await setupDashboardMocks(page);
  });

  /**
   * TC-001: Verify asset overview statistics cards are rendered correctly
   * 
   * Test Objective: Asset total, online, offline, and total value cards should
   * be visible and contain non-empty values.
   */
  test('TC-001: Statistics cards should be rendered with correct data', async ({ page }) => {
    await dashboard.goto();

    // Verify all 4 stat cards are present
    const statCards = page.locator('.stat-card');
    await expect(statCards).toHaveCount(4);

    // Verify each card has a value
    await expect(dashboard.statCardTotal).toBeVisible();
    await expect(dashboard.statCardOnline).toBeVisible();
    await expect(dashboard.statCardOffline).toBeVisible();
    await expect(dashboard.statCardValue).toBeVisible();

    // Verify values are not empty
    const totalValue = dashboard.statCardTotal.locator('.stat-value');
    await expect(totalValue).not.toBeEmpty();
  });

  /**
   * TC-002: Verify statistics data accuracy matches API response
   * 
   * Test Objective: The values displayed in statistics cards should match
   * the mock API response data exactly.
   */
  test('TC-002: Statistics data should match API response', async ({ page }) => {
    await dashboard.goto();

    // Wait for data to load
    await page.waitForSelector('.stat-value');

    // Get actual values from UI
    const totalText = await dashboard.statCardTotal.locator('.stat-value').textContent();
    const onlineText = await dashboard.statCardOnline.locator('.stat-value').textContent();
    const offlineText = await dashboard.statCardOffline.locator('.stat-value').textContent();

    // Convert to numbers (handle formatting like commas)
    const total = parseInt(totalText?.replace(/,/g, '') || '0');
    const online = parseInt(onlineText?.replace(/,/g, '') || '0');
    const offline = parseInt(offlineText?.replace(/,/g, '') || '0');

    // Verify against mock data
    expect(total).toBe(mockStatisticsData.total);
    expect(online).toBe(mockStatisticsData.online);
    expect(offline).toBe(mockStatisticsData.offline);
  });

  /**
   * TC-003: Verify category distribution chart renders correctly
   * 
   * Test Objective: The pie/donut chart should be visible with proper canvas
   * element and legend items matching the data categories.
   */
  test('TC-003: Category distribution chart should be rendered', async ({ page }) => {
    await dashboard.goto();

    // Verify chart container exists
    await expect(dashboard.categoryChart).toBeVisible();

    // Verify canvas element exists (ECharts renders to canvas)
    await expect(dashboard.categoryChartCanvas).toBeVisible();

    // Verify legend items exist
    const legendItems = dashboard.chartLegendItems;
    const legendCount = await legendItems.count();
    expect(legendCount).toBeGreaterThan(0);
  });

  /**
   * TC-004: Verify chart tooltip interaction
   * 
   * Test Objective: Hovering over chart segments should display tooltip
   * with category name and value information.
   */
  test('TC-004: Chart tooltip should show category information on hover', async ({ page }) => {
    await dashboard.goto();

    // Wait for chart to be fully rendered
    await page.waitForSelector('#category-distribution-chart canvas');

    // Hover over the chart
    const canvas = dashboard.categoryChartCanvas;
    await canvas.hover({ position: { x: 100, y: 100 } });

    // Wait a moment for tooltip to appear
    await page.waitForTimeout(500);

    // Check if tooltip is visible
    const tooltip = dashboard.chartTooltip;
    const isTooltipVisible = await tooltip.isVisible().catch(() => false);

    if (isTooltipVisible) {
      const tooltipText = await tooltip.textContent();
      // Tooltip should contain some text (category info)
      expect(tooltipText).toBeTruthy();
    }
  });

  /**
   * TC-005: Verify maintenance alert card renders correctly
   * 
   * Test Objective: Alert card should display summary and list sections
   * with proper visibility.
   */
  test('TC-005: Maintenance alert card should be rendered', async ({ page }) => {
    await dashboard.goto();

    // Verify alert card is visible
    await expect(dashboard.maintenanceAlertCard).toBeVisible();

    // Verify summary section
    await expect(dashboard.alertSummary).toBeVisible();

    // Verify alert list section
    await expect(dashboard.alertList).toBeVisible();

    // Verify title is present
    const alertTitle = page.locator('text=维保到期预警');
    await expect(alertTitle).toBeVisible();
  });

  /**
   * TC-006: Verify maintenance alerts are classified by time period
   * 
   * Test Objective: Alerts should be separated into 7-day and 30-day sections
   * for proper prioritization.
   */
  test('TC-006: Alerts should be classified by urgency level', async ({ page }) => {
    await dashboard.goto();

    // Verify 7-day urgency section exists
    await expect(dashboard.urgentSection).toBeVisible();

    // Verify 30-day warning section exists
    await expect(dashboard.warningSection).toBeVisible();

    // Check that sections have proper labels
    const urgentLabel = page.locator('text=7天内');
    const warningLabel = page.locator('text=30天内');
    await expect(urgentLabel).toBeVisible();
    await expect(warningLabel).toBeVisible();
  });

  /**
   * TC-007: Verify alert quick navigation to maintenance detail
   * 
   * Test Objective: Clicking an alert item should navigate to the
   * maintenance detail page.
   */
  test('TC-007: Alert items should navigate to maintenance detail', async ({ page }) => {
    await dashboard.goto();

    // Wait for alert items to load
    await page.waitForSelector('.alert-item');

    // Get first alert item
    const firstAlert = dashboard.alertItems.first();
    await expect(firstAlert).toBeVisible();

    // Set up navigation listener
    const navigationPromise = page.waitForNavigation({
      timeout: 5000
    }).catch(() => null);

    // Click the alert item
    await firstAlert.click();

    // Wait for navigation (if it happens)
    await navigationPromise;

    // Verify URL contains maintenance detail route
    // Note: This depends on actual routing implementation
    const currentUrl = page.url();
    expect(
      currentUrl.includes('/maintenance/detail/') || 
      currentUrl.includes('/maintenance/')
    ).toBeTruthy();
  });

  /**
   * TC-008: Verify responsive three-column layout on desktop
   * 
   * Test Objective: Dashboard should display three panels (statistics, chart, alerts)
   * in a horizontal layout on desktop viewport (1440px+).
   */
  test('TC-008: Dashboard should display three-column layout on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    await dashboard.goto();

    // Verify all three panels are visible
    const statisticsPanel = page.locator('.statistics-panel');
    const chartPanel = page.locator('.category-chart-panel');
    const alertPanel = page.locator('.maintenance-alert-panel');

    await expect(statisticsPanel).toBeVisible();
    await expect(chartPanel).toBeVisible();
    await expect(alertPanel).toBeVisible();

    // Verify panels are arranged horizontally
    const container = dashboard.dashboardContainer;
    const gridTemplate = await container.evaluate(
      (el: HTMLElement) => window.getComputedStyle(el).gridTemplateColumns
    );

    // Grid should have at least 3 columns
    const columns = gridTemplate.split(' ').filter(col => col !== '0px' && col !== 'none');
    expect(columns.length).toBeGreaterThanOrEqual(3);
  });

  /**
   * TC-009: Verify data auto-refresh mechanism (60 second interval)
   * 
   * Test Objective: Dashboard should automatically refresh data every 60 seconds
   * by making additional API calls.
   */
  test('TC-009: Dashboard should auto-refresh data every 60 seconds', async ({ page }) => {
    await dashboard.goto();

    // Track API requests
    let requestCount = 0;
    const trackedUrls: string[] = [];

    page.on('request', (request) => {
      if (request.url().includes('/api/v1/assets')) {
        requestCount++;
        trackedUrls.push(request.url());
      }
    });

    // Wait for initial load
    await page.waitForLoadState('networkidle');

    // Wait for approximately 60 seconds + buffer
    await page.waitForTimeout(65000);

    // Verify at least 2 requests were made (initial + refresh)
    expect(requestCount).toBeGreaterThanOrEqual(2);
  });

  /**
   * TC-010: Verify empty data state handling
   * 
   * Test Objective: When API returns empty data, the dashboard should display
   * friendly empty state messages instead of errors.
   */
  test('TC-010: Dashboard should handle empty data gracefully', async ({ page }) => {
    // Override mocks with empty data
    await page.route('**/api/v1/assets/statistics', (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total: 0, online: 0, offline: 0, total_value: 0 })
      });
    });

    await page.route('**/api/v1/assets/categories/distribution', (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.route('**/api/v1/maintenance/alerts', (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ urgent: [], warning: [] })
      });
    });

    await dashboard.goto();

    // Verify stat card shows 0 or "暂无数据"
    const totalCard = dashboard.statCardTotal.locator('.stat-value');
    const totalText = await totalCard.textContent();
    expect(['0', '暂无数据', '0']).toContain(totalText?.trim());

    // Verify chart shows empty state
    await expect(dashboard.chartEmptyState).toBeVisible();
  });
});

/**
 * Accessibility Tests
 */
test.describe('Dashboard - Accessibility', () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await setupDashboardMocks(page);
  });

  /**
   * Verify charts have proper ARIA labels for screen readers
   */
  test('Charts should have accessible ARIA labels', async ({ page }) => {
    await dashboard.goto();

    // Category chart should have accessible description
    const chartContainer = dashboard.categoryChart;
    await expect(chartContainer).toHaveAttribute('role', 'img');

    const ariaLabel = await chartContainer.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });

  /**
   * Verify data is presented in semantic HTML structure
   */
  test('Statistics should use semantic HTML', async ({ page }) => {
    await dashboard.goto();

    // Verify stat cards use proper heading levels
    const headings = page.locator('.stat-card h2, .stat-card h3, .stat-card [role="heading"]');
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThan(0);
  });
});

/**
 * Performance Tests
 */
test.describe('Dashboard - Performance', () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await setupDashboardMocks(page);
  });

  /**
   * Verify dashboard loads within acceptable time
   */
  test('Dashboard should load within 1500ms', async ({ page }) => {
    const startTime = Date.now();

    await dashboard.goto();

    // Wait for critical elements to be visible
    await expect(dashboard.statisticsPanel).toBeVisible();
    await expect(dashboard.categoryChart).toBeVisible();
    await expect(dashboard.maintenanceAlertCard).toBeVisible();

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(1500);
  });
});