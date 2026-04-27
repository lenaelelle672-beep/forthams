/**
 * Asset Detail E2E Test Suite
 * 
 * This module implements end-to-end tests for the Asset Detail Page (SWARM-051),
 * verifying audit log integration and @Auditable field visualization.
 * 
 * @module tests/test_asset_detail_e2e.spec
 * @version 1.0
 * @iteration Iteration 8
 * @see {@link https://spec.example.com/SWARM-051|SWARM-051 Specification}
 */

import { test, expect, Page, Request, Route, WebSocketRoute } from '@playwright/test';

/**
 * Test data factory for audit log entries
 * Generates mock audit data matching the AuditLogEntry interface
 */
function createMockAuditLogEntry(overrides: Partial<{
  eventId: string;
  assetId: string;
  assetType: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  operator: string;
  timestamp: string;
  changedFields: Array<{
    field: string;
    displayName: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  metadata: Record<string, unknown>;
}> = {}): {
  eventId: string;
  assetId: string;
  assetType: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  operator: string;
  timestamp: string;
  changedFields: Array<{
    field: string;
    displayName: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  metadata: Record<string, unknown>;
} {
  return {
    eventId: 'evt-001',
    assetId: 'asset-uuid-12345',
    assetType: 'EQUIPMENT',
    operation: 'UPDATE',
    operator: 'user@example.com',
    timestamp: '2024-01-15T10:30:00Z',
    changedFields: [
      {
        field: 'name',
        displayName: '资产名称',
        oldValue: '旧名称',
        newValue: '新名称'
      }
    ],
    metadata: {},
    ...overrides
  };
}

/**
 * Mock audit log response factory
 * Creates paginated response matching AuditLogResponse interface
 */
function createMockAuditLogResponse(logs: ReturnType<typeof createMockAuditLogEntry>[]): {
  data: ReturnType<typeof createMockAuditLogEntry>[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
} {
  return {
    data: logs,
    pagination: {
      page: 1,
      pageSize: 20,
      total: logs.length
    }
  };
}

/**
 * Mock asset detail data
 * Provides complete asset information for page rendering
 */
const mockAssetDetail = {
  assetId: 'asset-uuid-12345',
  name: '测试资产',
  category: '电子设备',
  location: 'A栋101',
  status: '在用',
  value: 50000,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-15T10:30:00Z',
  properties: {
    serialNumber: 'SN-2024-001',
    manufacturer: '测试厂商',
    purchaseDate: '2024-01-01'
  }
};

/**
 * Test suite configuration
 * Shared setup and teardown for asset detail E2E tests
 */
test.describe('Asset Detail Page - SWARM-051', () => {
  
  /**
   * Navigate to asset detail page
   * Helper function to handle navigation with proper waiting
   */
  async function navigateToAssetDetail(page: Page, assetId: string = 'asset-uuid-12345'): Promise<void> {
    await page.goto(`/asset/${assetId}`);
    await page.waitForLoadState('networkidle');
  }

  /**
   * Setup API mocking for audit logs
   * Intercepts GET /api/audit/asset/{assetId} requests
   */
  function setupAuditLogMock(route: Route, logs: ReturnType<typeof createMockAuditLogEntry>[]): void {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createMockAuditLogResponse(logs))
    });
  }

  /**
   * Setup error mocking for audit API
   * Simulates service unavailability
   */
  function setupAuditLogErrorMock(route: Route, statusCode: number = 503): void {
    route.fulfill({
      status: statusCode,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Service Unavailable',
        message: 'AuditService is temporarily unavailable'
      })
    });
  }

  test.beforeEach(async ({ page }) => {
    // Set viewport for consistent rendering
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Mock asset detail API
    await page.route('**/api/assets/asset-uuid-12345', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAssetDetail)
      });
    });
  });

  /**
   * TC-051-01: Asset Detail Page Route Access
   * 
   * Validates that the asset detail page route is properly registered
   * and accessible with correct HTTP status and page content.
   * 
   * @remarks
   * - GIVEN user is logged into Graphify system
   * - WHEN user navigates to /asset/{assetId} route
   * - THEN page should return 200 status code
   * - AND page title should contain "资产详情"
   */
  test('TC-051-01: Asset Detail Page Route Access', async ({ page }) => {
    // Arrange: Set up audit log mock for successful page load
    await page.route('**/api/audit/asset/asset-uuid-12345**', (route) => {
      setupAuditLogMock(route, []);
    });

    // Act: Navigate to asset detail page
    await navigateToAssetDetail(page);

    // Assert: Verify page loads successfully
    await expect(page).toHaveURL(/\/asset\/asset-uuid-12345/);
    
    // Verify page contains asset detail indicator
    const pageContent = await page.content();
    expect(pageContent).toMatch(/资产详情|Asset Detail/i);
  });

  /**
   * TC-051-02: Audit Log Panel Rendering
   * 
   * Validates that the AuditLogPanel component correctly renders
   * audit log entries with proper formatting.
   * 
   * @remarks
   * - GIVEN asset detail page is loaded
   * - WHEN API returns audit log data
   * - THEN AuditLogPanel should render timeline list
   * - AND each log should display: operation type, operator, timestamp, changed fields
   */
  test('TC-051-02: Audit Log Panel Displays Entries', async ({ page }) => {
    // Arrange: Create mock audit logs
    const mockLogs = [
      createMockAuditLogEntry({
        eventId: 'evt-001',
        operation: 'UPDATE',
        operator: 'user@example.com',
        timestamp: '2024-01-15T10:30:00Z',
        changedFields: [
          { field: 'name', displayName: '资产名称', oldValue: '旧名称', newValue: '新名称' }
        ]
      }),
      createMockAuditLogEntry({
        eventId: 'evt-002',
        operation: 'CREATE',
        operator: 'admin@example.com',
        timestamp: '2024-01-01T09:00:00Z',
        changedFields: []
      })
    ];

    await page.route('**/api/audit/asset/asset-uuid-12345**', (route) => {
      setupAuditLogMock(route, mockLogs);
    });

    // Act: Navigate to asset detail page
    await navigateToAssetDetail(page);

    // Assert: Verify audit log panel renders
    const auditPanel = page.locator('[data-testid="audit-log-panel"]');
    await expect(auditPanel).toBeVisible();

    // Verify log entries are rendered
    const logEntries = page.locator('[data-testid="audit-log-entry"]');
    await expect(logEntries).toHaveCount(mockLogs.length);

    // Verify log entry content
    const firstEntry = logEntries.first();
    await expect(firstEntry.locator('[data-testid="operation-type"]')).toContainText('UPDATE');
    await expect(firstEntry.locator('[data-testid="operator"]')).toContainText('user@example.com');
    await expect(firstEntry.locator('[data-testid="timestamp"]')).toContainText('2024-01-15');
  });

  /**
   * TC-051-03: @Auditable Field Change Diff Visualization
   * 
   * Validates that field-level changes are displayed with proper
   * diff visualization using color coding.
   * 
   * @remarks
   * - GIVEN audit log entry contains changedFields
   * - WHEN user clicks "查看变更" button
   * - THEN should display field-level Diff view
   * - AND old value uses red background (#fee2e2)
   * - AND new value uses green background (#dcfce7)
   */
  test('TC-051-03: @Auditable Field Changes Display Correctly', async ({ page }) => {
    // Arrange: Create mock audit log with changed fields
    const mockLogs = [
      createMockAuditLogEntry({
        eventId: 'evt-001',
        operation: 'UPDATE',
        changedFields: [
          { field: 'name', displayName: '资产名称', oldValue: '旧名称', newValue: '新名称' },
          { field: 'status', displayName: '资产状态', oldValue: '闲置', newValue: '在用' },
          { field: 'value', displayName: '资产价值', oldValue: 45000, newValue: 50000 }
        ]
      })
    ];

    await page.route('**/api/audit/asset/asset-uuid-12345**', (route) => {
      setupAuditLogMock(route, mockLogs);
    });

    // Act: Navigate and expand diff view
    await navigateToAssetDetail(page);
    
    // Click "View Changes" button
    const viewDiffButton = page.locator('[data-testid="view-diff-btn"]').first();
    await viewDiffButton.click();

    // Assert: Verify diff visualization
    const diffOldValue = page.locator('.diff-old-value').first();
    const diffNewValue = page.locator('.diff-new-value').first();

    await expect(diffOldValue).toBeVisible();
    await expect(diffNewValue).toBeVisible();

    // Verify color coding for old value (red)
    const oldValueStyle = await diffOldValue.getAttribute('style');
    expect(oldValueStyle).toContain('background-color: #fee2e2');

    // Verify color coding for new value (green)
    const newValueStyle = await diffNewValue.getAttribute('style');
    expect(newValueStyle).toContain('background-color: #dcfce7');

    // Verify content
    await expect(diffOldValue).toContainText('旧名称');
    await expect(diffNewValue).toContainText('新名称');
  });

  /**
   * TC-051-04: Time Range Filter for Audit Logs
   * 
   * Validates that audit logs can be filtered by time range,
   * ensuring only logs within the specified range are displayed.
   * 
   * @remarks
   * - GIVEN audit log list is displayed
   * - WHEN user sets time range [2024-01-01, 2024-01-31]
   * - AND clicks "应用筛选"
   * - THEN only logs within that time range should be displayed
   * - AND logs outside the range should be filtered
   */
  test('TC-051-04: Time Range Filter Works', async ({ page }) => {
    // Arrange: Create mock logs across different dates
    const mockLogs = [
      createMockAuditLogEntry({
        eventId: 'evt-001',
        timestamp: '2024-01-15T10:30:00Z',
        changedFields: [{ field: 'name', displayName: '资产名称', oldValue: 'A', newValue: 'B' }]
      }),
      createMockAuditLogEntry({
        eventId: 'evt-002',
        timestamp: '2024-02-15T10:30:00Z',
        changedFields: []
      }),
      createMockAuditLogEntry({
        eventId: 'evt-003',
        timestamp: '2024-01-20T10:30:00Z',
        changedFields: []
      })
    ];

    await page.route('**/api/audit/asset/asset-uuid-12345**', (route) => {
      setupAuditLogMock(route, mockLogs);
    });

    // Act: Navigate and apply time filter
    await navigateToAssetDetail(page);

    // Fill start date
    const startDateInput = page.locator('[data-testid="start-date-input"]');
    await startDateInput.fill('2024-01-01');

    // Fill end date
    const endDateInput = page.locator('[data-testid="end-date-input"]');
    await endDateInput.fill('2024-01-31');

    // Click apply filter
    const applyFilterButton = page.locator('[data-testid="apply-filter-btn"]');
    await applyFilterButton.click();

    // Assert: Verify filtered results
    // Wait for API call with filter parameters
    const filteredLogs = page.locator('[data-testid="audit-log-entry"]');
    
    // Should only show logs within January 2024
    const logCount = await filteredLogs.count();
    expect(logCount).toBeGreaterThanOrEqual(2);
    
    // Verify all rendered logs are within range
    const logTimestamps = page.locator('[data-testid="timestamp"]');
    for (let i = 0; i < logCount; i++) {
      const timestamp = await logTimestamps.nth(i).textContent();
      if (timestamp) {
        const date = new Date(timestamp);
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');
        expect(date >= startDate && date <= endDate).toBeTruthy();
      }
    }
  });

  /**
   * TC-051-05: WebSocket Real-time Update Push
   * 
   * Validates that real-time audit log updates are pushed via
   * WebSocket connection without page refresh.
   * 
   * @remarks
   * - GIVEN asset detail page is open
   * - WHEN backend publishes audit.asset.updated event
   * - THEN frontend should automatically append new audit log entry
   * - AND page should not refresh
   */
  test('TC-051-05: WebSocket Real-time Push', async ({ page, context }) => {
    // Arrange: Initial empty audit logs
    const initialLogs: ReturnType<typeof createMockAuditLogEntry>[] = [];

    await page.route('**/api/audit/asset/asset-uuid-12345**', (route) => {
      setupAuditLogMock(route, initialLogs);
    });

    // Act: Navigate to page
    await navigateToAssetDetail(page);

    // Wait for initial render
    await expect(page.locator('[data-testid="audit-log-panel"]')).toBeVisible();

    // Simulate WebSocket message for new audit event
    const newAuditEvent = {
      assetId: 'asset-uuid-12345',
      event: createMockAuditLogEntry({
        eventId: 'evt-realtime-001',
        operation: 'UPDATE',
        operator: 'realtime@example.com',
        timestamp: new Date().toISOString(),
        changedFields: [
          { field: 'location', displayName: '存放地点', oldValue: 'A栋', newValue: 'B栋' }
        ]
      })
    };

    // Emit WebSocket event
    await context.emit('audit.asset.updated', newAuditEvent);

    // Assert: Verify new entry appears without refresh
    const newEntry = page.locator('[data-testid="audit-log-entry-new"]');
    await expect(newEntry).toBeVisible({ timeout: 5000 });
    
    // Verify entry content
    await expect(newEntry.locator('[data-testid="operation-type"]')).toContainText('UPDATE');
    await expect(newEntry.locator('[data-testid="operator"]')).toContainText('realtime@example.com');
  });

  /**
   * TC-051-06: AuditService API Error Handling
   * 
   * Validates that API errors are handled gracefully with
   * proper error UI and retry functionality.
   * 
   * @remarks
   * - GIVEN AuditService returns 503 error
   * - WHEN asset detail page loads audit logs
   * - THEN should display error banner (not blank page)
   * - AND should provide "重试" button
   */
  test('TC-051-06: Retry Button on API Error', async ({ page }) => {
    // Arrange: Simulate service unavailable
    await page.route('**/api/audit/asset/asset-uuid-12345**', (route) => {
      setupAuditLogErrorMock(route, 503);
    });

    // Act: Navigate to asset detail page
    await navigateToAssetDetail(page);

    // Assert: Verify error banner is visible
    const errorBanner = page.locator('[data-testid="error-banner"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText(/错误|error|失败/i);

    // Verify retry button exists and is enabled
    const retryButton = page.locator('[data-testid="retry-btn"]');
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toBeEnabled();

    // Verify page content is not blank
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);

    // Act: Click retry button
    // Setup successful response for retry
    const successfulLogs = [
      createMockAuditLogEntry({
        eventId: 'evt-after-retry',
        operation: 'CREATE',
        operator: 'user@example.com',
        timestamp: new Date().toISOString(),
        changedFields: []
      })
    ];

    await page.route('**/api/audit/asset/asset-uuid-12345**', (route) => {
      setupAuditLogMock(route, successfulLogs);
    });

    await retryButton.click();

    // Assert: Verify retry succeeded
    await expect(page.locator('[data-testid="audit-log-panel"]')).toBeVisible();
    await expect(errorBanner).not.toBeVisible();
  });

  /**
   * TC-051-07: Pagination Support for Audit Logs
   * 
   * Validates that audit log pagination works correctly
   * with proper page navigation controls.
   */
  test('TC-051-07: Audit Log Pagination', async ({ page }) => {
    // Arrange: Create paginated response
    const totalLogs = 45;
    const pageSize = 20;
    const mockLogs = Array.from({ length: pageSize }, (_, i) => 
      createMockAuditLogEntry({
        eventId: `evt-page1-${i}`,
        timestamp: `2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
        changedFields: []
      })
    );

    await page.route('**/api/audit/asset/asset-uuid-12345**', (route) => {
      const url = route.request().url();
      if (url.includes('page=2')) {
        // Return second page
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: Array.from({ length: 20 }, (_, i) => 
              createMockAuditLogEntry({
                eventId: `evt-page2-${i}`,
                timestamp: `2024-02-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
                changedFields: []
              })
            ),
            pagination: { page: 2, pageSize, total: totalLogs }
          })
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: mockLogs,
            pagination: { page: 1, pageSize, total: totalLogs }
          })
        });
      }
    });

    // Act: Navigate to page
    await navigateToAssetDetail(page);

    // Assert: Verify pagination controls
    const nextButton = page.locator('[data-testid="pagination-next"]');
    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeEnabled();

    // Click next page
    await nextButton.click();

    // Verify page 2 logs are displayed
    const logEntries = page.locator('[data-testid="audit-log-entry"]');
    await expect(logEntries).toHaveCount(20);
  });

  /**
   * TC-051-08: Operation Type Filter
   * 
   * Validates that audit logs can be filtered by operation type
   * (CREATE, UPDATE, DELETE).
   */
  test('TC-051-08: Operation Type Filter Works', async ({ page }) => {
    // Arrange: Create logs with different operations
    const mockLogs = [
      createMockAuditLogEntry({ eventId: 'evt-001', operation: 'CREATE', changedFields: [] }),
      createMockAuditLogEntry({ eventId: 'evt-002', operation: 'UPDATE', changedFields: [] }),
      createMockAuditLogEntry({ eventId: 'evt-003', operation: 'UPDATE', changedFields: [] }),
      createMockAuditLogEntry({ eventId: 'evt-004', operation: 'DELETE', changedFields: [] })
    ];

    let capturedRequest: Request | null = null;

    await page.route('**/api/audit/asset/asset-uuid-12345**', (route) => {
      capturedRequest = route.request();
      setupAuditLogMock(route, mockLogs);
    });

    // Act: Navigate and filter by UPDATE
    await navigateToAssetDetail(page);

    // Select UPDATE operation filter
    const operationSelect = page.locator('[data-testid="operation-filter"]');
    await operationSelect.selectOption('UPDATE');

    // Apply filter
    await page.locator('[data-testid="apply-filter-btn"]').click();

    // Assert: Verify API request includes filter parameter
    if (capturedRequest) {
      const url = capturedRequest.url();
      expect(url).toContain('operation=UPDATE');
    }

    // Verify only UPDATE logs are displayed
    const updateLogs = page.locator('[data-testid="audit-log-entry"]');
    const count = await updateLogs.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // All displayed logs should be UPDATE operations
    for (let i = 0; i < count; i++) {
      const operationType = await updateLogs.nth(i).locator('[data-testid="operation-type"]').textContent();
      expect(operationType).toContain('UPDATE');
    }
  });

  /**
   * TC-051-09: Audit Log Loading State
   * 
   * Validates that loading state is displayed while fetching audit logs.
   */
  test('TC-051-09: Loading State Displayed During Fetch', async ({ page }) => {
    // Arrange: Slow response
    await page.route('**/api/audit/asset/asset-uuid-12345**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setupAuditLogMock(route, []);
    });

    // Act: Navigate to page
    const navigationPromise = page.goto('/asset/asset-uuid-12345');

    // Assert: Verify loading indicator appears
    const loadingIndicator = page.locator('[data-testid="audit-log-loading"]');
    await expect(loadingIndicator).toBeVisible({ timeout: 100 });

    // Wait for navigation to complete
    await navigationPromise;
  });

  /**
   * TC-051-10: Audit Log Empty State
   * 
   * Validates that empty state is displayed when no audit logs exist.
   */
  test('TC-051-10: Empty State When No Audit Logs', async ({ page }) => {
    // Arrange: Empty response
    await page.route('**/api/audit/asset/asset-uuid-12345**', (route) => {
      setupAuditLogMock(route, []);
    });

    // Act: Navigate to page
    await navigateToAssetDetail(page);

    // Assert: Verify empty state message
    const emptyState = page.locator('[data-testid="audit-log-empty"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText(/暂无|没有|empty/i);
  });
});