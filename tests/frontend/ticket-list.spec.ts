import { test, expect, Page } from '@playwright/test';

/**
 * 工单审批流程 E2E 测试套件
 * 覆盖工单提交、审批历史查看、审批操作执行等核心场景
 * @see {@link https://example.com/swarm-001} SWARM-001 规格文档
 */
describe('工单审批流程 E2E 测试', () => {
  // 测试数据
  const testWorkOrder = {
    title: '设备采购申请-测试-' + Date.now(),
    description: '采购5台Dell显示器用于研发部',
    priority: 'normal' as const,
    category: 'procurement'
  };

  // 登录辅助函数
  async function loginAs(page: Page, role: 'submitter' | 'approver' | 'admin') {
    const credentials = {
      submitter: { username: 'test_user', password: 'Test123!' },
      approver: { username: 'approver_admin', password: 'Approver123!' },
      admin: { username: 'system_admin', password: 'Admin123!' }
    };
    
    await page.goto('/login');
    await page.fill('[data-testid="username"]', credentials[role].username);
    await page.fill('[data-testid="password"]', credentials[role].password);
    await page.click('[data-testid="login-btn"]');
    await expect(page).toHaveURL(/\/dashboard/);
  }

  // 创建工单辅助函数
  async function createWorkOrder(page: Page) {
    await page.goto('/workorders/new');
    await page.fill('[data-testid="title"]', testWorkOrder.title);
    await page.fill('[data-testid="description"]', testWorkOrder.description);
    await page.selectOption('[data-testid="priority"]', testWorkOrder.priority);
    await page.selectOption('[data-testid="category"]', testWorkOrder.category);
    await page.click('[data-testid="submit-btn"]');
    await page.waitForURL(/\/workorders\/WO-\d+/);
    return page.url().match(/WO-\d+/)?.[0] || '';
  }

  /**
   * AC-001: 用户提交工单后可以在前端查看待审批状态
   * 验证用户可以通过前端界面提交工单并看到状态变更
   */
  test('AC-001: 用户提交工单后页面显示待审批状态', async ({ page }) => {
    await loginAs(page, 'submitter');
    
    // 导航到工单创建页面
    await page.goto('/workorders/new');
    
    // 填写工单表单
    await page.fill('[data-testid="title"]', testWorkOrder.title);
    await page.fill('[data-testid="description"]', testWorkOrder.description);
    await page.selectOption('[data-testid="priority"]', testWorkOrder.priority);
    
    // 提交工单
    await page.click('[data-testid="submit-btn"]');
    
    // 验证页面跳转到工单详情页
    await expect(page).toHaveURL(/\/workorders\/WO-\d+/);
    
    // 验证状态显示为待审批
    const statusBadge = page.locator('[data-testid="status-badge"]');
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toHaveText('待审批');
    
    // 验证状态徽章包含正确的样式类
    await expect(statusBadge).toHaveClass(/pending/);
  });

  /**
   * AC-001: 用户可以查看工单审批历史
   * 验证用户可以访问审批历史页面并看到完整记录
   */
  test('AC-001: 审批历史页面展示完整操作记录', async ({ page }) => {
    await loginAs(page, 'submitter');
    
    // 先创建工单
    const workOrderId = await createWorkOrder(page);
    
    // 导航到审批历史页面
    await page.goto(`/workorders/${workOrderId}/history`);
    
    // 验证历史记录列表可见
    const historyList = page.locator('[data-testid="history-list"]');
    await expect(historyList).toBeVisible();
    
    // 验证至少有提交记录
    const historyItems = page.locator('[data-testid="history-item"]');
    await expect(historyItems.first()).toBeVisible();
    
    // 验证历史记录包含必要字段
    await expect(historyItems.first()).toContainText('提交人');
    await expect(historyItems.first()).toContainText('提交时间');
    await expect(historyItems.first()).toContainText('操作类型');
  });

  /**
   * AC-001: 审批人可以执行通过/拒绝/转交操作
   * 验证审批人可以通过前端界面执行审批操作
   */
  test('AC-001: 审批人点击通过按钮后状态更新为已通过', async ({ page }) => {
    await loginAs(page, 'submitter');
    const workOrderId = await createWorkOrder(page);
    
    // 登出并以审批人身份登录
    await page.click('[data-testid="logout-btn"]');
    await loginAs(page, 'approver');
    
    // 导航到工单详情页
    await page.goto(`/workorders/${workOrderId}`);
    
    // 验证审批操作按钮可见
    const approveButton = page.locator('[data-testid="btn-approve"]');
    await expect(approveButton).toBeVisible();
    
    // 填写审批意见
    const commentInput = page.locator('[data-testid="approval-comment"]');
    await commentInput.fill('同意采购，预算在范围内');
    
    // 点击通过按钮
    await approveButton.click();
    
    // 验证状态更新
    await page.waitForSelector('[data-testid="status-badge"]');
    const statusBadge = page.locator('[data-testid="status-badge"]');
    await expect(statusBadge).toHaveText('已通过');
    await expect(statusBadge).toHaveClass(/approved/);
    
    // 验证历史记录已更新
    await page.goto(`/workorders/${workOrderId}/history`);
    const approveRecords = page.locator('[data-testid="history-item"]', { hasText: '通过' });
    await expect(approveRecords.first()).toBeVisible();
  });

  /**
   * AC-001: 审批人拒绝工单后状态正确更新
   */
  test('AC-001: 审批人拒绝工单后页面显示已拒绝状态', async ({ page }) => {
    await loginAs(page, 'submitter');
    const workOrderId = await createWorkOrder(page);
    
    await page.click('[data-testid="logout-btn"]');
    await loginAs(page, 'approver');
    
    await page.goto(`/workorders/${workOrderId}`);
    
    // 填写拒绝意见
    await page.fill('[data-testid="approval-comment"]', '预算超支，需重新评估');
    
    // 点击拒绝按钮
    await page.click('[data-testid="btn-reject"]');
    
    // 验证状态更新为已拒绝
    const statusBadge = page.locator('[data-testid="status-badge"]');
    await expect(statusBadge).toHaveText('已拒绝');
    await expect(statusBadge).toHaveClass(/rejected/);
  });

  /**
   * AC-001: 审批人可以将工单转交给其他审批人
   */
  test('AC-001: 审批人转交工单后状态更新为已转交', async ({ page }) => {
    await loginAs(page, 'submitter');
    const workOrderId = await createWorkOrder(page);
    
    await page.click('[data-testid="logout-btn"]');
    await loginAs(page, 'approver');
    
    await page.goto(`/workorders/${workOrderId}`);
    
    // 点击转交按钮
    await page.click('[data-testid="btn-transfer"]');
    
    // 选择转交对象
    await page.selectOption('[data-testid="transfer-to"]', 'user-002');
    await page.fill('[data-testid="transfer-comment"]', '请李四审批');
    
    // 确认转交
    await page.click('[data-testid="confirm-transfer"]');
    
    // 验证状态更新
    const statusBadge = page.locator('[data-testid="status-badge"]');
    await expect(statusBadge).toHaveText('已转交');
    
    // 验证历史记录
    await page.goto(`/workorders/${workOrderId}/history`);
    const transferRecords = page.locator('[data-testid="history-item"]', { hasText: '转交' });
    await expect(transferRecords.first()).toBeVisible();
  });

  /**
   * AC-001: 工单列表页面显示正确的工单状态
   */
  test('AC-001: 工单列表页面按状态筛选功能正常', async ({ page }) => {
    await loginAs(page, 'submitter');
    
    // 创建多个不同状态的工单
    await page.goto('/workorders/new');
    await page.fill('[data-testid="title"]', '待审批工单');
    await page.fill('[data-testid="description"]', '测试');
    await page.click('[data-testid="submit-btn"]');
    
    await page.goto('/workorders');
    
    // 验证筛选器存在
    const statusFilter = page.locator('[data-testid="status-filter"]');
    await expect(statusFilter).toBeVisible();
    
    // 筛选待审批状态
    await statusFilter.selectOption('PENDING');
    
    // 验证筛选结果
    const pendingBadges = page.locator('[data-testid="status-badge"]', { hasText: '待审批' });
    await expect(pendingBadges.first()).toBeVisible();
  });

  /**
   * AC-002: 无语法错误 - 页面加载无控制台错误
   */
  test('AC-002: 工单相关页面加载无 JavaScript 错误', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await loginAs(page, 'submitter');
    
    // 访问工单列表页
    await page.goto('/workorders');
    await page.waitForLoadState('networkidle');
    
    // 访问工单详情页
    await page.goto('/workorders/WO-2024-001');
    await page.waitForLoadState('networkidle');
    
    // 访问审批历史页
    await page.goto('/workorders/WO-2024-001/history');
    await page.waitForLoadState('networkidle');
    
    // 验证无错误
    expect(consoleErrors).toHaveLength(0);
  });

  /**
   * AC-003: 工单详情页面关键组件有正确的 aria-label
   */
  test('AC-003: 工单表单所有字段有可访问性标识', async ({ page }) => {
    await loginAs(page, 'submitter');
    await page.goto('/workorders/new');
    
    // 验证表单字段有正确的 aria-label
    await expect(page.locator('[aria-label="工单标题"]')).toBeVisible();
    await expect(page.locator('[aria-label="工单描述"]')).toBeVisible();
    await expect(page.locator('[aria-label="优先级"]')).toBeVisible();
    await expect(page.locator('[aria-label="提交工单"]')).toBeVisible();
  });

  /**
   * AC-004: 模块可被正常导入
   * 验证路由配置正确
   */
  test('AC-004: 工单相关路由配置正确', async ({ page }) => {
    await loginAs(page, 'submitter');
    
    // 验证工单列表路由
    await page.goto('/workorders');
    await expect(page.locator('h1')).toContainText('工单列表');
    
    // 验证新建工单路由
    await page.goto('/workorders/new');
    await expect(page.locator('h1')).toContainText('新建工单');
  });

  /**
   * 边界测试: 提交人不能审批自己的工单
   */
  test('边界测试: 提交人不能对自己的工单执行审批操作', async ({ page }) => {
    await loginAs(page, 'submitter');
    const workOrderId = await createWorkOrder(page);
    
    // 尝试直接访问审批操作
    await page.goto(`/workorders/${workOrderId}`);
    
    // 验证审批按钮不存在或被禁用
    const approveButton = page.locator('[data-testid="btn-approve"]');
    await expect(approveButton).toHaveCount(0);
  });

  /**
   * 边界测试: 已通过的工单不能再审批
   */
  test('边界测试: 已通过的工单不显示审批操作按钮', async ({ page }) => {
    await loginAs(page, 'submitter');
    const workOrderId = await createWorkOrder(page);
    
    // 以审批人身份通过工单
    await page.click('[data-testid="logout-btn"]');
    await loginAs(page, 'approver');
    
    await page.goto(`/workorders/${workOrderId}`);
    await page.fill('[data-testid="approval-comment"]', '通过');
    await page.click('[data-testid="btn-approve"]');
    
    // 以提交人身份查看
    await page.click('[data-testid="logout-btn"]');
    await loginAs(page, 'submitter');
    
    await page.goto(`/workorders/${workOrderId}`);
    
    // 验证审批按钮不存在
    await expect(page.locator('[data-testid="btn-approve"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="btn-reject"]')).toHaveCount(0);
  });

  /**
   * 审批历史时间线组件测试
   */
  test('审批历史按时间倒序显示', async ({ page }) => {
    await loginAs(page, 'submitter');
    const workOrderId = await createWorkOrder(page);
    
    await page.click('[data-testid="logout-btn"]');
    await loginAs(page, 'approver');
    
    await page.goto(`/workorders/${workOrderId}`);
    await page.fill('[data-testid="approval-comment"]', '第一次审批');
    await page.click('[data-testid="btn-reject"]');
    
    // 重新提交
    await page.click('[data-testid="logout-btn"]');
    await loginAs(page, 'submitter');
    await page.goto(`/workorders/${workOrderId}`);
    await page.click('[data-testid="btn-resubmit"]');
    
    // 审批通过
    await page.click('[data-testid="logout-btn"]');
    await loginAs(page, 'approver');
    await page.goto(`/workorders/${workOrderId}`);
    await page.fill('[data-testid="approval-comment"]', '第二次审批通过');
    await page.click('[data-testid="btn-approve"]');
    
    // 查看历史
    await page.goto(`/workorders/${workOrderId}/history`);
    
    // 验证历史记录倒序
    const timestamps = await page.locator('[data-testid="history-timestamp"]').allTextContents();
    for (let i = 0; i < timestamps.length - 1; i++) {
      expect(new Date(timestamps[i]).getTime()).toBeGreaterThanOrEqual(
        new Date(timestamps[i + 1]).getTime()
      );
    }
  });
});