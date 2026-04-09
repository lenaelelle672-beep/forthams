import { test, expect } from '@playwright/test';

test.describe('Xxx Feature E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('textbox', { name: /用户名/i }).fill('admin');
    await page.getByRole('textbox', { name: /密码/i }).fill('admin123');
    await page.getByRole('button', { name: /登录/i }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should complete full workflow from creation to deletion', async ({ page }) => {
    await page.getByRole('link', { name: /xxx管理/i }).click();
    
    await page.getByRole('button', { name: /新建/i }).click();
    await page.getByLabel(/名称/i).fill('E2E Test Item');
    await page.getByRole('button', { name: /保存/i }).click();
    
    await expect(page.getByText('创建成功')).toBeVisible();
    await expect(page.getByText('E2E Test Item')).toBeVisible();
    
    await page.getByRole('button', { name: /删除/i }).first().click();
    await page.getByRole('button', { name: /确认/i }).click();
    
    await expect(page.getByText('删除成功')).toBeVisible();
  });

  test('should filter results using search box', async ({ page }) => {
    await page.getByRole('link', { name: /xxx管理/i }).click();
    
    await page.getByPlaceholder(/搜索/i).fill('test query');
    await page.getByRole('button', { name: /搜索/i }).click();
    
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('should validate required fields in form', async ({ page }) => {
    await page.getByRole('link', { name: /xxx管理/i }).click();
    
    await page.getByRole('button', { name: /新建/i }).click();
    await page.getByRole('button', { name: /保存/i }).click();
    
    await expect(page.getByText(/不能为空/i)).toBeVisible();
  });

  test('should navigate through pagination', async ({ page }) => {
    await page.getByRole('link', { name: /xxx管理/i }).click();
    
    const nextButton = page.getByRole('button', { name: /下一页/i });
    if (await nextButton.isEnabled()) {
      await nextButton.click();
      await expect(page.getByRole('table')).toBeVisible();
    }
  });
});
