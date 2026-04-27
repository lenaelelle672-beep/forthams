/**
 * SWARM-2026-Q2-002: 资产报废退役流程与审批链集成
 * E2E 测试: 完整报废审批流程
 * 
 * 本测试覆盖 ATB-5 验收测试基准:
 * 1. 报废申请提交与状态锁定
 * 2. 多级审批链顺序执行
 * 3. 越级审批验证 (禁止越级)
 * 4. 驳回后修改重提
 * 5. 生命周期历史查询
 */

import { test, expect } from '@playwright/test';

test.describe('资产报废退役流程 E2E', () => {
  const TEST_ASSET_ID = 'AST-001';
  
  test.beforeEach(async ({ page }) => {
    // 登录为申请人
    await page.goto('/login');
    await page.fill('#username', 'applicant@test.com');
    await page.fill('#password', 'password123');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');
  });

  test('ATB-5: 完整报废审批流程 E2E', async ({ page }) => {
    // === 步骤1: 申请人提交报废申请 ===
    await page.goto(`/assets/${TEST_ASSET_ID}/retire`);
    
    // 填写报废申请表单
    await page.fill('#reason', '设备老化无法使用，需进行报废处理');
    await page.fill('#estimated_residual_value', '500');
    await page.click('button[type=submit]');
    
    // 验证提交成功
    await page.waitForSelector('.toast-success');
    await expect(page.locator('.application-status')).toHaveText('审批中');
    
    // 验证资产状态已锁定
    const assetStatus = page.locator('.asset-status');
    await expect(assetStatus).toHaveText('审批中');
    
    // === 步骤2: 第一级审批人审批 ===
    // 切换到第一级审批人账号
    await page.click('.user-menu button');
    await page.click('text=退出登录');
    await page.goto('/login');
    await page.fill('#username', 'dept_manager@test.com');
    await page.fill('#password', 'password123');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');
    
    // 进入待审批列表
    await page.goto('/approvals/pending');
    await page.click(`[data-asset-id="${TEST_ASSET_ID}"] button[data-action=approve]`);
    await page.waitForSelector('.status-approved');
    
    // 验证当前级别显示
    await expect(page.locator('.current-level')).toHaveText('第 2 级');
    
    // === 步骤3: 第二级审批人审批 ===
    // 切换到第二级审批人账号
    await page.click('.user-menu button');
    await page.click('text=退出登录');
    await page.goto('/login');
    await page.fill('#username', 'asset_admin@test.com');
    await page.fill('#password', 'password123');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');
    
    await page.goto('/approvals/pending');
    await page.click(`[data-asset-id="${TEST_ASSET_ID}"] button[data-action=approve]`);
    await page.waitForSelector('.status-approved');
    
    // === 步骤4: 第三级审批人审批 ===
    // 切换到第三级审批人账号
    await page.click('.user-menu button');
    await page.click('text=退出登录');
    await page.goto('/login');
    await page.fill('#username', 'finance@test.com');
    await page.fill('#password', 'password123');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');
    
    await page.goto('/approvals/pending');
    await page.click(`[data-asset-id="${TEST_ASSET_ID}"] button[data-action=approve]`);
    await page.waitForSelector('.status-approved');
    
    // === 步骤5: 验证状态变更 ===
    await page.goto(`/assets/${TEST_ASSET_ID}`);
    await page.waitForSelector('.lifecycle-timeline');
    
    // 验证时间轴包含报废审批节点
    const timelineItems = page.locator('.timeline-item');
    await expect(timelineItems).toHaveCount(5);
    await expect(timelineItems.first()).toContainText('报废审批已完成');
  });

  test('ATB-2: 审批链层级顺序验证', async ({ page }) => {
    // 前提: 提交报废申请 (使用申请人账号)
    await page.goto(`/assets/${TEST_ASSET_ID}/retire`);
    await page.fill('#reason', '设备老化无法使用');
    await page.fill('#estimated_residual_value', '500');
    await page.click('button[type=submit]');
    await page.waitForSelector('.toast-success');
    
    // 切换到第一级审批人
    await page.goto('/login');
    await page.fill('#username', 'dept_manager@test.com');
    await page.fill('#password', 'password123');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');
    
    await page.goto('/approvals/pending');
    const firstApprovalTask = page.locator(`[data-asset-id="${TEST_ASSET_ID}"]`).first();
    await firstApprovalTask.locator('button[data-action=approve]').click();
    await page.waitForSelector('.status-approved');
    
    // 验证第二级任务已生成
    await page.goto('/approvals/pending');
    const secondLevelTask = page.locator(`[data-asset-id="${TEST_ASSET_ID}"][data-level="2"]`);
    await expect(secondLevelTask).toBeVisible();
    
    // === 越级审批测试 ===
    // 尝试跳过第二级直接用第一级审批人审批
    await page.goto('/approvals/pending');
    const skipLevelButton = page.locator(`[data-asset-id="${TEST_ASSET_ID}"][data-level="3"] button[data-action=approve]`);
    
    // 验证越级操作被拒绝 (403 或按钮不可用)
    await expect(skipLevelButton).toBeDisabled();
  });

  test('ATB-3: 驳回后修改重提流程', async ({ page }) => {
    // 提交报废申请
    await page.goto(`/assets/${TEST_ASSET_ID}/retire`);
    await page.fill('#reason', '设备老化');
    await page.fill('#estimated_residual_value', '500');
    await page.click('button[type=submit]');
    await page.waitForSelector('.toast-success');
    
    // 切换到审批人账号进行驳回
    await page.click('.user-menu button');
    await page.click('text=退出登录');
    await page.goto('/login');
    await page.fill('#username', 'dept_manager@test.com');
    await page.fill('#password', 'password123');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');
    
    await page.goto('/approvals/pending');
    await page.click(`[data-asset-id="${TEST_ASSET_ID}"] button[data-action=reject]`);
    await page.fill('#rejection-reason', '报废理由不充分，需补充详细说明');
    await page.click('button[type=submit]');
    await page.waitForSelector('.toast-success');
    
    // 切回申请人账号
    await page.click('.user-menu button');
    await page.click('text=退出登录');
    await page.goto('/login');
    await page.fill('#username', 'applicant@test.com');
    await page.fill('#password', 'password123');
    await page.click('button[type=submit]');
    await page.waitForURL('/dashboard');
    
    // 验证状态已恢复
    await page.goto(`/assets/${TEST_ASSET_ID}`);
    await expect(page.locator('.asset-status')).toHaveText('可用');
    
    // 修改后重新提交
    await page.goto(`/assets/${TEST_ASSET_ID}/retire`);
    await page.fill('#reason', '设备已无法修复，维修费用超过残值');
    await page.fill('#estimated_residual_value', '200');
    await page.click('button[type=submit]');
    await page.waitForSelector('.toast-success');
    
    // 验证新审批链启动
    await expect(page.locator('.application-status')).toHaveText('审批中');
    await expect(page.locator('.current-level')).toHaveText('第 1 级');
  });

  test('ATB-4: 生命周期历史查询', async ({ page }) => {
    // 先完成一次完整的报废审批流程
    // (此处简化，实际应在后台准备数据或通过 API 创建)
    
    // 查询生命周期历史
    await page.goto(`/assets/${TEST_ASSET_ID}/lifecycle`);
    await page.waitForSelector('.lifecycle-timeline');
    
    // 验证时间轴顺序 (倒序)
    const timelineItems = page.locator('.timeline-item');
    await expect(timelineItems.first()).toContainText('报废审批已完成');
    await expect(timelineItems.nth(1)).toContainText('报废申请');
    
    // 验证历史记录只读 - 尝试修改
    const firstEventId = await timelineItems.first().getAttribute('data-event-id');
    await page.goto(`/assets/${TEST_ASSET_ID}/lifecycle/${firstEventId}/edit`);
    
    // 应返回 405 Method Not Allowed
    await expect(page.locator('h1')).toContainText('Method Not Allowed');
    
    // 验证时间排序切换
    await page.goto(`/assets/${TEST_ASSET_ID}/lifecycle?order=asc`);
    await page.waitForSelector('.lifecycle-timeline');
    const ascendingFirst = page.locator('.timeline-item').first();
    await expect(ascendingFirst).toContainText('采购入库');
  });

  test('TP-1.4: 重复提交同一资产', async ({ page }) => {
    // 提交报废申请
    await page.goto(`/assets/${TEST_ASSET_ID}/retire`);
    await page.fill('#reason', '设备老化无法使用');
    await page.fill('#estimated_residual_value', '500');
    await page.click('button[type=submit]');
    await page.waitForSelector('.toast-success');
    
    // 尝试再次提交
    await page.goto(`/assets/${TEST_ASSET_ID}/retire`);
    await page.fill('#reason', '再次申请报废');
    await page.fill('#estimated_residual_value', '300');
    await page.click('button[type=submit]');
    
    // 应返回 409 Conflict
    await page.waitForSelector('.toast-error');
    await expect(page.locator('.error-message')).toContainText('Conflict');
  });

  test('TP-2.3: 最后一审批完成后状态变更', async ({ page }) => {
    // 提交报废申请
    await page.goto(`/assets/${TEST_ASSET_ID}/retire`);
    await page.fill('#reason', '设备老化无法使用');
    await page.fill('#estimated_residual_value', '500');
    await page.click('button[type=submit]');
    await page.waitForSelector('.toast-success');
    
    // 完成所有审批
    const approvers = ['dept_manager@test.com', 'asset_admin@test.com', 'finance@test.com'];
    
    for (const approver of approvers) {
      await page.click('.user-menu button');
      await page.click('text=退出登录');
      await page.goto('/login');
      await page.fill('#username', approver);
      await page.fill('#password', 'password123');
      await page.click('button[type=submit]');
      await page.waitForURL('/dashboard');
      
      await page.goto('/approvals/pending');
      const task = page.locator(`[data-asset-id="${TEST_ASSET_ID}"] button[data-action=approve]`);
      if (await task.isVisible()) {
        await task.click();
        await page.waitForSelector('.status-approved');
      }
    }
    
    // 验证资产状态变更为"已报废"
    await page.goto(`/assets/${TEST_ASSET_ID}`);
    await expect(page.locator('.asset-status')).toHaveText('已报废');
  });
});