import { expect, test } from '@playwright/test';

const variants: Array<{ path: string; heading?: string | RegExp; landmark?: string }> = [
  { path: '/login2', heading: 'UNIVIEW 固定资产' },
  { path: '/login3', heading: '登录您的管理账户' },
  { path: '/login4', heading: /固定资产智能运维中枢|UNIVIEW 固定资产/ },
  { path: '/login5', landmark: 'UNIVIEW 固定资产平台登录' },
];

test.describe('登录变体页 smoke', () => {
  for (const route of variants) {
    test(`${route.path} 渲染登录页`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('domcontentloaded');
      if (route.heading) {
        await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible({ timeout: 15_000 });
      }
      if (route.landmark) {
        await expect(page.getByRole('region', { name: route.landmark }).first()).toBeVisible({ timeout: 15_000 });
      }
    });
  }
});
