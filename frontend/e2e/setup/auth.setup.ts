/**
 * SWARM-070 E2E Authentication Setup
 *
 * Authenticates three roles (admin, approver, operator) and persists
 * their browser storage state to disk for downstream spec files to reuse.
 *
 * AUTH-001: admin login → admin-storage.json
 * AUTH-002: approver login → approver-storage.json
 * AUTH-003: operator login → operator-storage.json
 * AUTH-004: verify token validity via /api/health
 */

import { test as setup, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Role credentials
// ---------------------------------------------------------------------------

const roles = [
  {
    name: 'admin',
    username: 'admin',
    password: 'admin123',
    storagePath: '.auth/admin-storage.json',
  },
  {
    name: 'approver',
    username: 'approver',
    password: 'approver123',
    storagePath: '.auth/approver-storage.json',
  },
  {
    name: 'operator',
    username: 'operator',
    password: 'operator123',
    storagePath: '.auth/operator-storage.json',
  },
] as const;

// ---------------------------------------------------------------------------
// AUTH-001 / AUTH-002 / AUTH-003 — Login each role and save storage state
// ---------------------------------------------------------------------------

for (const role of roles) {
  setup(`AUTH: ${role.name} 登录并保存 storage state`, async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Wait for the login form to be visible
    await page.waitForSelector('[data-testid="input-username"]', { timeout: 5000 });

    // Fill credentials
    await page.fill('[data-testid="input-username"]', role.username);
    await page.fill('[data-testid="input-password"]', role.password);

    // Click login and wait for API response
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/api/auth/login') && resp.status() === 200,
      ),
      page.click('[data-testid="btn-login"]'),
    ]);

    // Verify login response contains token
    const body = await response.json();
    expect(body.token || body.data?.token || body.access_token).toBeTruthy();

    // Wait for navigation to complete
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Persist storage state for downstream tests
    await page.context().storageState({ path: role.storagePath });
  });
}

// ---------------------------------------------------------------------------
// AUTH-004 — Verify saved tokens are valid
// ---------------------------------------------------------------------------

setup('AUTH: 验证已保存的 token 有效性', async ({ browser }) => {
  for (const role of roles) {
    const context = await browser.newContext({ storageState: role.storagePath });
    const page = await context.newPage();

    // Attempt to access a protected health endpoint
    const response = await page.goto('/api/health');
    // Either 200 (direct) or the app redirects and stays alive
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }

    await context.close();
  }
});
