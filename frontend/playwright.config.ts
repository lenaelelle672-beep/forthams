import { defineConfig, devices } from '@playwright/test';

const includeLegacyFlows = process.env.AMS_E2E_INCLUDE_LEGACY_FLOWS === 'true';
const includeSerialLegacyFlows = process.env.AMS_E2E_INCLUDE_SERIAL_FLOWS === 'true';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 30000,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'real-backend-smoke',
      testDir: './src/e2e',
      testMatch: /real-backend-smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'browser-regression-smoke',
      testDir: './src/e2e',
      testMatch: /browser-regression-smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'e2e-setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // 旧版真实后端 flows 依赖已过期 data-testid、固定数据和跨用例状态。
    // 默认 npm run e2e 只保留稳定 smoke 与登录 storageState 验证；
    // 需要专项排查旧 flows 时显式设置 AMS_E2E_INCLUDE_LEGACY_FLOWS=true。
    ...(includeLegacyFlows ? [
      {
        name: 'e2e-admin',
        testDir: './e2e/flows',
        testMatch: /.*\.spec\.ts/,
        use: {
          ...devices['Desktop Chrome'],
          storageState: '.auth/admin-storage.json',
        },
        dependencies: ['e2e-setup'],
      },
      {
        name: 'e2e-approver',
        testDir: './e2e/flows',
        testMatch: /work-order-approval\.spec\.ts/,
        use: {
          ...devices['Desktop Chrome'],
          storageState: '.auth/approver-storage.json',
        },
        dependencies: ['e2e-setup'],
      },
      {
        name: 'e2e-operator',
        testDir: './e2e/flows',
        testMatch: /work-order-approval\.spec\.ts/,
        use: {
          ...devices['Desktop Chrome'],
          storageState: '.auth/operator-storage.json',
        },
        dependencies: ['e2e-setup'],
      },
      ...(includeSerialLegacyFlows ? [
        {
          name: 'e2e-serial',
          testDir: './e2e/flows',
          testMatch: /.*\.spec\.ts/,
          use: {
            ...devices['Desktop Chrome'],
            storageState: '.auth/admin-storage.json',
          },
          dependencies: ['e2e-setup'],
        },
      ] : []),
    ] : []),
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
