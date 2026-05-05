/**
 * SWARM-002 资产报废退役流程 E2E 测试
 * 
 * 测试覆盖范围：
 * - 用户完整流程：发起申请 → 逐级审批 → 最终退役
 * - 审批驳回后状态回退
 * - 并发约束：同一资产同一时间仅允许一个有效申请
 * - 历史记录查看与追溯
 * 
 * @see {@link https://specs.example.com/swarm-002} SWARM-002 规格文档
 */

import { test, expect, Page } from '@playwright/test';

// 测试配置常量
const TEST_ASSET_ID = 'A005';
const TEST_TIMEOUT = 30000;
const MAX_APPROVAL_LEVELS = 5;

// 页面元素选择器
const SELECTORS = {
  retireBtn: '[data-testid="retire-btn"]',
  retireReason: '[data-testid="retire-reason"]',
  attachment: '[data-testid="attachment"]',
  submitBtn: '[data-testid="submit-btn"]',
  statusBadge: '[data-testid="status-badge"]',
  approveBtn: (assetId: string) => `[data-testid="approve-${assetId}-btn"]`,
  approveBtnWithLevel: (assetId: string, level: number) => `[data-testid="approve-${assetId}-level-${level}-btn"]`,
  comment: '[data-testid="comment"]',
  confirmApproval: '[data-testid="confirm-approval"]',
  currentLevel: '[data-testid="current-level"]',
  viewHistory: '[data-testid="view-history"]',
  historyTimeline: '[data-testid="history-timeline"]',
  pendingApprovals: '/approval/pending',
  assetDetail: (assetId: string) => `/assets/${assetId}`,
};

// 辅助函数：执行某一级审批
async function approveAtLevel(page: Page, assetId: string, level: number): Promise<void> {
  await page.goto(SELECTORS.pendingApprovals);
  await page.click(SELECTORS.approveBtnWithLevel(assetId, level));
  await page.click(SELECTORS.confirmApproval);
}

// 辅助函数：等待状态更新
async function waitForStatus(page: Page, expectedStatus: string, timeout: number = 5000): Promise<void> {
  await expect(page.locator(SELECTORS.statusBadge)).toHaveText(expectedStatus, { timeout });
}

/**
 * 测试用例 1：用户完整流程 - 发起申请 → 逐级审批 → 最终退役
 * 
 * 验收标准：
 * - 完整流程端到端测试通过率 = 100%
 * - 页面加载时间 ≤ 3s
 * - 无 console error / API 500
 */
test.describe('SWARM-002 资产报废退役完整流程', () => {
  test.beforeEach(async ({ page }) => {
    // 设置 API 响应延迟监控
    await page.route('**/api/**', async (route) => {
      const start = Date.now();
      await route.continue();
      const duration = Date.now() - start;
      if (duration > 3000) {
        console.warn(`API response time exceeded 3s: ${route.request().url()}`);
      }
    });
  });

  test('complete_retire_flow_from_submission_to_completion', async ({ page }) => {
    // Step 1: 发起报废申请
    await page.goto(SELECTORS.assetDetail(TEST_ASSET_ID));
    await page.click(SELECTORS.retireBtn);
    await page.fill(SELECTORS.retireReason, '设备老化，维修成本过高');
    
    // 附件上传验证（单次上传 ≤ 20MB）
    const filePath = 'tests/fixtures/valuation_report.pdf';
    await page.locator(SELECTORS.attachment).setInputFiles(filePath);
    
    await page.click(SELECTORS.submitBtn);
    
    // 验证状态变为"审批中"
    await waitForStatus(page, '审批中');
    await expect(page.locator(SELECTORS.statusBadge)).toHaveText('审批中');

    // Step 2: 一级审批通过
    await page.goto(SELECTORS.pendingApprovals);
    await page.click(SELECTORS.approveBtn(TEST_ASSET_ID));
    await page.fill(SELECTORS.comment, '同意报废');
    await page.click(SELECTORS.confirmApproval);
    
    // 验证当前审批级别
    await expect(page.locator(SELECTORS.currentLevel)).toHaveText('2/5');

    // Step 3-4: 中间级别审批通过 (2, 3, 4级)
    for (let level = 2; level <= 4; level++) {
      await approveAtLevel(page, TEST_ASSET_ID, level);
    }

    // Step 5: 最后一级审批完成
    await approveAtLevel(page, TEST_ASSET_ID, 5);

    // 验证资产状态最终变为"已退役"
    await page.goto(SELECTORS.assetDetail(TEST_ASSET_ID));
    await waitForStatus(page, '已退役');
    await expect(page.locator(SELECTORS.statusBadge)).toHaveText('已退役');

    // 验证历史记录可查看
    await page.click(SELECTORS.viewHistory);
    await expect(page.locator(SELECTORS.historyTimeline)).toBeVisible();
  });

  test('approval_rejection_returns_asset_to_active', async ({ page }) => {
    // 发起报废申请
    await page.goto(SELECTORS.assetDetail(TEST_ASSET_ID));
    await page.click(SELECTORS.retireBtn);
    await page.fill(SELECTORS.retireReason, '测试驳回流程');
    await page.click(SELECTORS.submitBtn);
    
    await waitForStatus(page, '审批中');

    // 一级审批通过
    await page.goto(SELECTORS.pendingApprovals);
    await page.click(SELECTORS.approveBtn(TEST_ASSET_ID));
    await page.click(SELECTORS.confirmApproval);

    // 二级审批驳回
    await page.goto(SELECTORS.pendingApprovals);
    await page.click(SELECTORS.approveBtnWithLevel(TEST_ASSET_ID, 2));
    await page.fill(SELECTORS.comment, '需补充报废估值报告');
    await page.locator('[data-testid="reject-btn"]').click();
    await page.click('[data-testid="confirm-rejection"]');

    // 验证状态回退为"活跃"
    await page.goto(SELECTORS.assetDetail(TEST_ASSET_ID));
    await waitForStatus(page, '活跃');
  });

  test('concurrent_retirement_request_blocked', async ({ page, context }) => {
    // 第一个用户发起报废申请
    await page.goto(SELECTORS.assetDetail(TEST_ASSET_ID));
    await page.click(SELECTORS.retireBtn);
    await page.fill(SELECTORS.retireReason, '第一次报废申请');
    await page.click(SELECTORS.submitBtn);
    await waitForStatus(page, '审批中');

    // 第二个用户尝试发起第二个申请（应该被阻止）
    const page2 = await context.newPage();
    await page2.goto(SELECTORS.assetDetail(TEST_ASSET_ID));
    await page2.click(SELECTORS.retireBtn);
    
    // 验证系统阻止重复申请
    await expect(page2.locator('[data-testid="error-message"]')).toContainText('该资产已存在进行中的报废申请');
    
    await page2.close();
  });

  test('retirement_history_traceability', async ({ page }) => {
    // 发起并完成报废申请
    await page.goto(SELECTORS.assetDetail(TEST_ASSET_ID));
    await page.click(SELECTORS.retireBtn);
    await page.fill(SELECTORS.retireReason, '设备老化');
    await page.click(SELECTORS.submitBtn);
    await waitForStatus(page, '审批中');

    // 完成所有审批级别
    for (let level = 1; level <= MAX_APPROVAL_LEVELS; level++) {
      await approveAtLevel(page, TEST_ASSET_ID, level);
    }

    // 查看历史记录
    await page.goto(SELECTORS.assetDetail(TEST_ASSET_ID));
    await page.click(SELECTORS.viewHistory);

    // 验证时间线包含所有状态变更
    const timelineItems = page.locator('[data-testid="history-item"]');
    const count = await timelineItems.count();
    expect(count).toBeGreaterThanOrEqual(MAX_APPROVAL_LEVELS + 1); // 申请 + 各级审批

    // 验证状态变更的完整追溯
    const statusChanges = page.locator('[data-testid="status-change"]');
    await expect(statusChanges.first()).toContainText('ACTIVE');
    await expect(statusChanges.last()).toContainText('RETIRED');
  });

  test('retired_asset_cannot_be_reactivated', async ({ page }) => {
    // 完成报废流程
    await page.goto(SELECTORS.assetDetail(TEST_ASSET_ID));
    await page.click(SELECTORS.retireBtn);
    await page.fill(SELECTORS.retireReason, '设备老化');
    await page.click(SELECTORS.submitBtn);

    for (let level = 1; level <= MAX_APPROVAL_LEVELS; level++) {
      await approveAtLevel(page, TEST_ASSET_ID, level);
    }

    // 尝试重新激活已退役资产
    await page.goto(SELECTORS.assetDetail(TEST_ASSET_ID));
    
    // 验证"重新激活"按钮不存在或被禁用
    const reactivateBtn = page.locator('[data-testid="reactivate-btn"]');
    if (await reactivateBtn.isVisible()) {
      await reactivateBtn.click();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('已退役资产不可重新激活');
    }
  });
});

/**
 * 测试用例 2：权限边界验证
 * 
 * 验收标准：
 * - 仅 asset_manager / admin 角色可发起报废申请
 * - 各审批节点仅限指定角色处理
 */
test.describe('SWARM-002 权限边界验证', () => {
  test('non_asset_manager_cannot_submit_retirement', async ({ page }) => {
    // 使用非资产管理员角色登录
    await page.goto('/login');
    await page.fill('[data-testid="username"]', 'regular_user');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-btn"]');

    // 尝试访问资产页面
    await page.goto(SELECTORS.assetDetail(TEST_ASSET_ID));

    // 验证"报废"按钮不存在或被禁用
    const retireBtn = page.locator(SELECTORS.retireBtn);
    if (await retireBtn.isVisible()) {
      await retireBtn.click();
      await expect(page.locator('[data-testid="permission-error"]')).toBeVisible();
    }
  });

  test('unauthorized_approver_cannot_approve', async ({ page }) => {
    // 使用无审批权限的角色登录
    await page.goto('/login');
    await page.fill('[data-testid="username"]', 'viewer_user');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-btn"]');

    // 尝试访问待审批列表
    await page.goto(SELECTORS.pendingApprovals);
    
    // 验证无审批权限
    await expect(page.locator('[data-testid="no-permission-message"]')).toBeVisible();
  });
});

/**
 * 测试用例 3：性能验证
 * 
 * 验收标准：
 * - 状态查询响应时间 ≤ 200ms（P99）
 * - 历史记录查询响应时间 ≤ 500ms（P99）
 */
test.describe('SWARM-002 性能验证', () => {
  test('status_query_response_time', async ({ page }) => {
    const responseTimes: number[] = [];
    
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      await page.goto(SELECTORS.assetDetail(TEST_ASSET_ID));
      await page.waitForLoadState('networkidle');
      responseTimes.push(Date.now() - start);
    }

    // 计算 P99
    responseTimes.sort((a, b) => a - b);
    const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];
    
    expect(p99).toBeLessThanOrEqual(200);
  });

  test('history_query_response_time', async ({ page }) => {
    await page.goto(SELECTORS.assetDetail(TEST_ASSET_ID));
    await page.click(SELECTORS.viewHistory);

    const start = Date.now();
    await page.waitForLoadState('networkidle');
    const responseTime = Date.now() - start;

    expect(responseTime).toBeLessThanOrEqual(500);
  });
});