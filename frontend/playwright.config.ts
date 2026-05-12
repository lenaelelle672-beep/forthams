import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 30000,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'e2e-setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
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
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
