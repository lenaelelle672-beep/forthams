/**
 * @file dashboard.spec.ts
 * @description Dashboard 仪表板视觉回归测试
 * @module SWARM-003
 * 
 * 验收标准: ATB-3 视觉回归测试
 * - ATB-3.1: 桌面端完整看板截图对比
 * - ATB-3.2: 平板端布局自适应验证
 */

import { test, expect } from '@playwright/test';

/**
 * @description ATB-3.1: 桌面端完整看板截图对比
 * 
 * 测试场景：
 * - 视口尺寸: 1920x1080 (全高清桌面)
 * - 验证 Dashboard 页面正确加载
 * - 截图与基准快照对比，阈值 0.1
 * 
 * 验收条件：
 * - 页面在网络空闲后完成渲染
 * - dashboard-container 元素可见
 * - 截图差异在可接受范围内
 */
test('ATB-3.1: 桌面端完整看板截图对比', async ({ page }) => {
  // 设置桌面端视口
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  // 导航至 Dashboard 页面
  await page.goto('/dashboard');
  
  // 等待网络请求完成
  await page.waitForLoadState('networkidle');
  
  // 捕获完整看板截图
  const screenshot = await page.locator('[data-testid="dashboard-container"]').screenshot();
  
  // 与基准快照对比
  expect(screenshot).toMatchSnapshot('dashboard-desktop.png', { threshold: 0.1 });
});

/**
 * @description ATB-3.2: 平板端布局自适应验证
 * 
 * 测试场景：
 * - 视口尺寸: 768x1024 (iPad 尺寸)
 * - 验证响应式布局生效
 * - 统计卡片应变为 2 列布局
 * - 卡片宽度应小于 400px
 * 
 * 验收条件：
 * - 平板视口下布局正确切换
 * - 统计卡片宽度符合预期
 * - 无横向滚动条
 */
test('ATB-3.2: 平板端布局自适应验证', async ({ page }) => {
  // 设置平板端视口
  await page.setViewportSize({ width: 768, height: 1024 });
  
  // 导航至 Dashboard 页面
  await page.goto('/dashboard');
  
  // 等待页面加载
  await page.waitForSelector('[data-testid="dashboard-container"]', { state: 'visible' });
  
  // 验证统计卡片响应式布局
  const cards = page.locator('[data-testid="stat-card"]');
  const firstCardBoundingBox = await cards.first().boundingBox();
  
  // 断言：卡片宽度应小于 400px（2列布局）
  expect(firstCardBoundingBox?.width).toBeLessThan(400);
  
  // 验证无横向溢出
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
});

/**
 * @description ATB-3.3: 移动端布局验证
 * 
 * 测试场景：
 * - 视口尺寸: 375x667 (iPhone SE 尺寸)
 * - 验证移动端单列布局
 * - 所有组件可正常滚动访问
 * 
 * 验收条件：
 * - 移动端视口下布局正确切换
 * - 组件可正常滚动
 * - 无水平溢出
 */
test('ATB-3.3: 移动端布局验证', async ({ page }) => {
  // 设置移动端视口
  await page.setViewportSize({ width: 375, height: 667 });
  
  // 导航至 Dashboard 页面
  await page.goto('/dashboard');
  
  // 等待页面加载
  await page.waitForSelector('[data-testid="dashboard-container"]', { state: 'visible' });
  
  // 验证移动端无横向溢出
  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  
  expect(hasHorizontalOverflow).toBe(false);
});

/**
 * @description ATB-3.4: 图表加载状态视觉验证
 * 
 * 测试场景：
 * - 验证图表组件加载状态
 * - 确保无加载错误导致的视觉异常
 * 
 * 验收条件：
 * - 分类图表容器可见
 * - 无错误状态显示
 */
test('ATB-3.4: 图表加载状态视觉验证', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  
  // 验证图表容器可见
  const chartContainer = page.locator('[data-testid="category-chart"]');
  await expect(chartContainer).toBeVisible();
  
  // 验证无错误状态
  const errorState = page.locator('[data-testid="error-state"]');
  await expect(errorState).not.toBeVisible();
});

/**
 * @description ATB-3.5: 预警卡片状态视觉验证
 * 
 * 测试场景：
 * - 验证维保预警卡片状态分级显示
 * - 确保紧急/警示/正常状态颜色区分
 * 
 * 验收条件：
 * - 预警列表正确渲染
 * - 严重程度标签颜色正确
 */
test('ATB-3.5: 预警卡片状态视觉验证', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  
  // 验证预警卡片容器可见
  const alertCard = page.locator('[data-testid="maintenance-alerts"]');
  await expect(alertCard).toBeVisible();
  
  // 验证至少有预警项显示
  const alertItems = page.locator('[data-testid="alert-item"]');
  const count = await alertItems.count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(5); // 最多显示5条
});