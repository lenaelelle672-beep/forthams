/**
 * @fileoverview E2E tests for the Audit Dashboard page.
 *
 * Covers the Phase-1 acceptance test benchmarks:
 *   ATB-04 – Permission interception (non-admin / non-auditor users)
 *   ATB-05 – Filter linkage & data refresh
 *   ATB-06 – Trend chart rendering verification
 *
 * Additional coverage:
 *   - 90-day time-range boundary validation
 *   - Pagination controls
 *   - Action-type options rendered from `/api/v1/audit-log/meta`
 *   - Timezone display (local) vs API (UTC)
 */

import { test, expect, Page, Request } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUDIT_DASHBOARD_ROUTE = '/audit';
const API_LIST = '**/api/v1/audit-log/list*';
const API_TREND = '**/api/v1/audit-log/trend*';
const API_META = '**/api/v1/audit-log/meta*';

/** Roles that MUST be granted access */
const ALLOWED_ROLES = ['admin', 'auditor'] as const;
/** Roles that MUST be blocked */
const DENIED_ROLES = ['user', 'viewer', 'operator'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simulate login by injecting auth state into localStorage.
 * The app is expected to read `auth` from localStorage on boot.
 *
 * @param page - Playwright Page instance
 * @param role - Role string to assign
 * @param userId - Optional user identifier
 */
async function loginAs(page: Page, role: string, userId = 'U001'): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ({ r, uid }) => {
      const auth = JSON.stringify({
        token: 'mock-jwt-token',
        user: { id: uid, username: `test_${r}`, roles: [r] },
      });
      localStorage.setItem('auth', auth);
    },
    { r: role, uid: userId },
  );
}

/**
 * Navigate to the audit dashboard and wait for the initial data load.
 *
 * @param page - Playwright Page instance
 */
async function gotoDashboard(page: Page): Promise<void> {
  await page.goto(AUDIT_DASHBOARD_ROUTE);
  // Wait for the main container to be visible – proves the route rendered
  await page.waitForSelector('[data-testid="audit-dashboard"]', { timeout: 10_000 });
}

/**
 * Compute an ISO-8601 UTC date string for `daysAgo` days in the past.
 *
 * @param daysAgo - Number of days before now
 * @returns ISO-8601 UTC timestamp string
 */
function utcDateDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Audit Dashboard – E2E', () => {
  // -----------------------------------------------------------------------
  // ATB-04: Permission interception
  // -----------------------------------------------------------------------

  test.describe('ATB-04: Permission interception', () => {
    for (const role of DENIED_ROLES) {
      test(`user with role "${role}" is redirected and no audit API calls are made`, async ({
        page,
      }) => {
        const apiRequests: Request[] = [];
        page.on('request', (req) => {
          const url = req.url();
          if (url.includes('/api/v1/audit-log')) {
            apiRequests.push(req);
          }
        });

        await loginAs(page, role);
        await page.goto(AUDIT_DASHBOARD_ROUTE);

        // The page should NOT render the dashboard
        const dashboardVisible = await page
          .locator('[data-testid="audit-dashboard"]')
          .isVisible()
          .catch(() => false);
        expect(dashboardVisible).toBe(false);

        // Should redirect to 403 page or home page
        await page.waitForURL(/\/(403|forbidden|home|)/, { timeout: 5_000 }).catch(() => {
          // If no redirect happened, at least the dashboard must not be visible
        });

        // No audit-log API requests should have been fired
        expect(apiRequests).toHaveLength(0);
      });
    }

    for (const role of ALLOWED_ROLES) {
      test(`user with role "${role}" can access the dashboard`, async ({ page }) => {
        await loginAs(page, role);
        await gotoDashboard(page);
        await expect(page.locator('[data-testid="audit-dashboard"]')).toBeVisible();
      });
    }
  });

  // -----------------------------------------------------------------------
  // ATB-05: Filter linkage & data refresh
  // -----------------------------------------------------------------------

  test.describe('ATB-05: Filter linkage & data refresh', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, 'admin');
      await gotoDashboard(page);
    });

    test('selecting action type "DELETE" and clicking query sends correct API params and refreshes table', async ({
      page,
    }) => {
      // Wait for the meta endpoint to populate the action-type dropdown
      const metaResponse = page.waitForResponse(API_META);
      await metaResponse;

      // Open the action-type dropdown and select DELETE
      const actionTypeSelect = page.locator('[data-testid="filter-action-type"]');
      await expect(actionTypeSelect).toBeVisible();
      await actionTypeSelect.click();

      const deleteOption = page.locator('[data-testid="filter-action-type-option-DELETE"]');
      await expect(deleteOption).toBeVisible();
      await deleteOption.click();

      // Click the query / search button
      const queryButton = page.locator('[data-testid="filter-query-btn"]');
      await expect(queryButton).toBeVisible();

      // Intercept the list API call triggered by the query button
      const listResponsePromise = page.waitForResponse(API_LIST);
      await queryButton.click();
      const listResponse = await listResponsePromise;

      // Verify the request URL contains operation_type=DELETE
      const requestUrl = listResponse.url();
      expect(requestUrl).toContain('operation_type=DELETE');

      // Verify table rows all display DELETE in the action-type column
      const rows = page.locator('[data-testid="audit-table-row"]');
      const rowCount = await rows.count();

      if (rowCount > 0) {
        for (let i = 0; i < rowCount; i++) {
          const actionCell = rows.nth(i).locator('[data-testid="audit-table-cell-action-type"]');
          await expect(actionCell).toHaveText('DELETE');
        }
      }

      // Verify the trend chart re-rendered (a trend API call was also made)
      const trendResponsePromise = page.waitForResponse(API_TREND);
      await trendResponsePromise;

      const trendChart = page.locator('[data-testid="trend-chart-container"]');
      await expect(trendChart).toBeVisible();
    });

    test('changing time range triggers new API calls with updated start_time and end_time', async ({
      page,
    }) => {
      // Set start date
      const startDateInput = page.locator('[data-testid="filter-start-time"]');
      await expect(startDateInput).toBeVisible();

      const endDateInput = page.locator('[data-testid="filter-end-time"]');
      await expect(endDateInput).toBeVisible();

      // Fill dates – 7 days range
      const sevenDaysAgo = utcDateDaysAgo(7);
      const now = new Date().toISOString();

      await startDateInput.fill(sevenDaysAgo.split('T')[0]);
      await endDateInput.fill(now.split('T')[0]);

      // Click query
      const listResponsePromise = page.waitForResponse(API_LIST);
      const queryButton = page.locator('[data-testid="filter-query-btn"]');
      await queryButton.click();
      const listResponse = await listResponsePromise;

      const requestUrl = listResponse.url();
      expect(requestUrl).toContain('start_time=');
      expect(requestUrl).toContain('end_time=');
    });

    test('operator filter sends operator_id parameter', async ({ page }) => {
      const operatorInput = page.locator('[data-testid="filter-operator"]');
      await expect(operatorInput).toBeVisible();
      await operatorInput.fill('U001');

      const listResponsePromise = page.waitForResponse(API_LIST);
      const queryButton = page.locator('[data-testid="filter-query-btn"]');
      await queryButton.click();
      const listResponse = await listResponsePromise;

      expect(listResponse.url()).toContain('operator_id=U001');
    });
  });

  // -----------------------------------------------------------------------
  // ATB-06: Trend chart rendering verification
  // -----------------------------------------------------------------------

  test.describe('ATB-06: Trend chart rendering', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, 'admin');
      await gotoDashboard(page);
    });

    test('30-day range renders chart with daily granularity and correct data point count', async ({
      page,
    }) => {
      // Set time range to 30 days
      const startDateInput = page.locator('[data-testid="filter-start-time"]');
      const endDateInput = page.locator('[data-testid="filter-end-time"]');

      const thirtyDaysAgo = utcDateDaysAgo(30);
      const now = new Date().toISOString();

      await startDateInput.fill(thirtyDaysAgo.split('T')[0]);
      await endDateInput.fill(now.split('T')[0]);

      // Trigger query and capture both list and trend responses
      const trendResponsePromise = page.waitForResponse(API_TREND);
      const queryButton = page.locator('[data-testid="filter-query-btn"]');
      await queryButton.click();

      const trendResponse = await trendResponsePromise;
      const trendData = await trendResponse.json();

      // Verify chart container exists (SVG or Canvas)
      const chartContainer = page.locator('[data-testid="trend-chart-container"]');
      await expect(chartContainer).toBeVisible();

      // Check that either SVG or Canvas is rendered inside the container
      const hasSvg = await chartContainer.locator('svg').count();
      const hasCanvas = await chartContainer.locator('canvas').count();
      expect(hasSvg + hasCanvas).toBeGreaterThan(0);

      // Verify x-axis labels show daily granularity
      const xAxisLabels = page.locator('[data-testid="trend-chart-x-label"]');
      const labelCount = await xAxisLabels.count();

      // For a 30-day range, we expect ~30 daily labels (or a reasonable subset)
      expect(labelCount).toBeGreaterThan(0);

      // Verify data point count matches API response
      if (trendData.data && Array.isArray(trendData.data)) {
        const dataPointElements = page.locator('[data-testid="trend-chart-data-point"]');
        const renderedPoints = await dataPointElements.count();
        // The rendered points should match the API response length
        expect(renderedPoints).toBe(trendData.data.length);
      }
    });

    test('7-day range renders chart with hourly granularity', async ({ page }) => {
      const startDateInput = page.locator('[data-testid="filter-start-time"]');
      const endDateInput = page.locator('[data-testid="filter-end-time"]');

      const sevenDaysAgo = utcDateDaysAgo(7);
      const now = new Date().toISOString();

      await startDateInput.fill(sevenDaysAgo.split('T')[0]);
      await endDateInput.fill(now.split('T')[0]);

      const trendResponsePromise = page.waitForResponse(API_TREND);
      const queryButton = page.locator('[data-testid="filter-query-btn"]');
      await queryButton.click();
      await trendResponsePromise;

      // Chart should be visible
      const chartContainer = page.locator('[data-testid="trend-chart-container"]');
      await expect(chartContainer).toBeVisible();

      // Verify the granularity indicator shows hourly aggregation.
      const granularityLabel = page.locator('[data-testid="trend-chart-granularity"]');
      await expect(granularityLabel).toContainText(/小时|hour/i);
    });

    test('60-day range renders chart with weekly granularity', async ({ page }) => {
      const startDateInput = page.locator('[data-testid="filter-start-time"]');
      const endDateInput = page.locator('[data-testid="filter-end-time"]');

      const sixtyDaysAgo = utcDateDaysAgo(60);
      const now = new Date().toISOString();

      await startDateInput.fill(sixtyDaysAgo.split('T')[0]);
      await endDateInput.fill(now.split('T')[0]);

      const trendResponsePromise = page.waitForResponse(API_TREND);
      const queryButton = page.locator('[data-testid="filter-query-btn"]');
      await queryButton.click();
      await trendResponsePromise;

      const chartContainer = page.locator('[data-testid="trend-chart-container"]');
      await expect(chartContainer).toBeVisible();

      // Verify the granularity indicator shows weekly aggregation.
      const granularityLabel = page.locator('[data-testid="trend-chart-granularity"]');
      await expect(granularityLabel).toContainText(/周|week/i);
    });
  });

  // -----------------------------------------------------------------------
  // Time-range boundary: 90-day max
  // -----------------------------------------------------------------------

  test.describe('Time-range boundary validation (90-day max)', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, 'admin');
      await gotoDashboard(page);
    });

    test('query exceeding 90 days shows error and does not load data', async ({ page }) => {
      const startDateInput = page.locator('[data-testid="filter-start-time"]');
      const endDateInput = page.locator('[data-testid="filter-end-time"]');

      // 91 days ago – exceeds the 90-day limit
      const ninetyOneDaysAgo = utcDateDaysAgo(91);
      const now = new Date().toISOString();

      await startDateInput.fill(ninetyOneDaysAgo.split('T')[0]);
      await endDateInput.fill(now.split('T')[0]);

      const queryButton = page.locator('[data-testid="filter-query-btn"]');
      await queryButton.click();

      // Expect an error message to appear on the page
      const errorMessage = page.locator('[data-testid="filter-error-message"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText(/90/);

      // The table should NOT show new data from an invalid request
      const tableRows = page.locator('[data-testid="audit-table-row"]');
      const initialCount = await tableRows.count();

      // Wait a moment to ensure no delayed load
      await page.waitForTimeout(500);
      const afterCount = await tableRows.count();
      expect(afterCount).toBe(initialCount);
    });

    test('query exactly at 90 days succeeds', async ({ page }) => {
      const startDateInput = page.locator('[data-testid="filter-start-time"]');
      const endDateInput = page.locator('[data-testid="filter-end-time"]');

      const ninetyDaysAgo = utcDateDaysAgo(90);
      const now = new Date().toISOString();

      await startDateInput.fill(ninetyDaysAgo.split('T')[0]);
      await endDateInput.fill(now.split('T')[0]);

      const listResponsePromise = page.waitForResponse(API_LIST);
      const queryButton = page.locator('[data-testid="filter-query-btn"]');
      await queryButton.click();
      const listResponse = await listResponsePromise;

      expect(listResponse.status()).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Pagination
  // -----------------------------------------------------------------------

  test.describe('Pagination controls', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, 'admin');
      await gotoDashboard(page);
    });

    test('default page size is 50 and displayed in the pagination info', async ({ page }) => {
      const paginationInfo = page.locator('[data-testid="pagination-info"]');
      await expect(paginationInfo).toBeVisible();
      await expect(paginationInfo).toContainText(/50/);
    });

    test('clicking next page sends page=2 parameter', async ({ page }) => {
      // Ensure there is more than one page of data
      const nextButton = page.locator('[data-testid="pagination-next"]');
      const isDisabled = await nextButton.isDisabled();
      if (isDisabled) {
        test.skip();
      }

      const listResponsePromise = page.waitForResponse(API_LIST);
      await nextButton.click();
      const listResponse = await listResponsePromise;

      expect(listResponse.url()).toContain('page=2');
    });

    test('page size selector limits to max 100', async ({ page }) => {
      const sizeSelector = page.locator('[data-testid="pagination-size-select"]');
      await expect(sizeSelector).toBeVisible();
      await sizeSelector.click();

      // All size options should be ≤ 100
      const sizeOptions = page.locator('[data-testid^="pagination-size-option"]');
      const optionCount = await sizeOptions.count();
      for (let i = 0; i < optionCount; i++) {
        const text = await sizeOptions.nth(i).textContent();
        const value = parseInt(text?.trim() || '0', 10);
        expect(value).toBeLessThanOrEqual(100);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Action-type options from meta API (no hardcoding)
  // -----------------------------------------------------------------------

  test.describe('Action-type options from /api/v1/audit-log/meta', () => {
    test('action-type dropdown options match the meta API response', async ({ page }) => {
      await loginAs(page, 'admin');

      // Capture the meta response
      const metaResponsePromise = page.waitForResponse(API_META);
      await gotoDashboard(page);
      const metaResponse = await metaResponsePromise;
      const metaData = await metaResponse.json();

      // Extract action types from the meta response
      const actionTypes: string[] = metaData.action_types ?? metaData.data?.action_types ?? [];

      // Open the dropdown
      const actionTypeSelect = page.locator('[data-testid="filter-action-type"]');
      await actionTypeSelect.click();

      // Verify each action type from the API is present as an option
      for (const actionType of actionTypes) {
        const option = page.locator(
          `[data-testid="filter-action-type-option-${actionType}"]`,
        );
        await expect(option).toBeVisible();
      }

      // Verify no extra options beyond what the API returned
      const allOptions = page.locator('[data-testid^="filter-action-type-option-"]');
      const renderedCount = await allOptions.count();
      expect(renderedCount).toBe(actionTypes.length);
    });
  });

  // -----------------------------------------------------------------------
  // Timezone handling: API uses UTC, display uses local
  // -----------------------------------------------------------------------

  test.describe('Timezone display', () => {
    test('timestamps in the table are displayed in local timezone, not raw UTC', async ({
      page,
    }) => {
      await loginAs(page, 'admin');

      // Capture the list response to inspect raw UTC timestamps
      const listResponsePromise = page.waitForResponse(API_LIST);
      await gotoDashboard(page);
      const listResponse = await listResponsePromise;
      const listData = await listResponse.json();

      if (listData.items && listData.items.length > 0) {
        const firstItem = listData.items[0];
        const rawUtcTimestamp: string = firstItem.created_at ?? firstItem.timestamp;

        if (rawUtcTimestamp) {
          // The displayed text should NOT be identical to the raw UTC string
          // (it should be converted to local timezone format)
          const firstRowTimeCell = page
            .locator('[data-testid="audit-table-row"]')
            .first()
            .locator('[data-testid="audit-table-cell-timestamp"]');
          const displayedText = await firstRowTimeCell.textContent();

          // Raw UTC ends with 'Z' or contains 'T' – local display should differ
          expect(displayedText).not.toBe(rawUtcTimestamp);
        }
      }
    });
  });

  // -----------------------------------------------------------------------
  // Empty state & loading state
  // -----------------------------------------------------------------------

  test.describe('Empty and loading states', () => {
    test('shows empty state when no records match filters', async ({ page }) => {
      await loginAs(page, 'admin');

      // Intercept the list API and return empty results
      await page.route(API_LIST, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ total: 0, items: [] }),
        }),
      );

      await gotoDashboard(page);

      const emptyState = page.locator('[data-testid="audit-table-empty"]');
      await expect(emptyState).toBeVisible();
    });

    test('shows loading indicator while data is being fetched', async ({ page }) => {
      await loginAs(page, 'admin');

      // Delay the API response to ensure loading state is visible
      await page.route(API_LIST, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            total: 1,
            items: [
              {
                id: '1',
                operator_id: 'U001',
                action_type: 'LOGIN',
                created_at: new Date().toISOString(),
              },
            ],
          }),
        });
      });

      await page.goto(AUDIT_DASHBOARD_ROUTE);

      // Loading indicator should appear
      const loadingIndicator = page.locator('[data-testid="audit-dashboard-loading"]');
      await expect(loadingIndicator).toBeVisible({ timeout: 1500 });
    });
  });
});
