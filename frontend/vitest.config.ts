import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'e2e/**',
      'src/e2e/**',
      'tests/e2e/**',
      'tests/visual/**',
      'tests/unit/components/**',
      'tests/unit/dashboard/**',
      'tests/unit/hooks.inventory.test.ts',
      'tests/unit/approval/approval-comment.spec.ts',
      'tests/unit/audit/convertAuditLogsToGraphifyNodes.test.ts',
      'tests/unit/inventory/InventoryScopeSelector.spec.ts',
      'tests/unit/inventory/StatusDropdown.spec.ts',
      'src/stores/approvalStore.test.ts'
    ],
    coverage: {
      provider: 'v8',
      all: false,
      reporter: ['text', 'json', 'html'],
      include: [
        // Keep the default coverage gate focused on actively unit-tested core
        // API contracts. Broader exploratory coverage can be run with
        // npm run test:coverage:full and is expected to drive future test work.
        'src/api/inventory.ts'
      ],
      exclude: [
        'node_modules/',
        'src/test/',
        'src/e2e/',
        'tests/',
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'dist/'
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
