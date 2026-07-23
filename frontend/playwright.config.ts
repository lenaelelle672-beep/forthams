import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // 同时覆盖 src/e2e（活跃）和 tests/e2e（此前因 testDir 单目录限制静默失效的 233 个测试）
  testDir: '.',
  testMatch: ['**/src/e2e/**/*.spec.ts', '**/tests/e2e/**/*.spec.ts'],
  testIgnore: process.env.AMS_E2E_REAL_BACKEND === 'true' ? [] : ['**/real-backend-smoke.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
