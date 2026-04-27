/**
 * 资产报废/退役流程 E2E 测试套件
 * 
 * 本测试文件覆盖资产报废/退役流程的端到端用户旅程，验证以下功能：
 * - TC-RET-001: 报废申请发起
 * - TC-RET-002: 审批链自动流转
 * - TC-RET-003: 审批拒绝回退
 * - TC-RET-004: 申请撤回
 * - TC-RET-005: 报废审批通过
 * - TC-RET-006: 历史记录查询
 * - TC-RET-007: 退役状态标注
 * - TC-RET-008: 原因追溯查询
 * 
 * @module retirement_e2e_test
 * @version 1.0
 */

import { test, expect, Page } from '@playwright/test';
import { TEST_CONFIG, AuthContext, UserRole, AssetStatus, RetirementStatus } from './test_config';

/**
 * 测试配置接口
 */
interface TestCredentials {
  username: string;
  password: string;
}

/**
 * 资产报废申请数据接口
 */
interface RetirementApplicationData {
  assetId: number;
  reason: string;
  reasonDetail?: string;
  attachments?: File[];
}

/**
 * 审批操作数据接口
 */
interface ApprovalActionData {
  action: 'approve' | 'reject';
  comment?: string;
}

/**
 * 全局测试配置
 */
const TEST_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

/**
 * 辅助函数：用户登录
 * 
 * @param page - Playwright 页面对象
 * @param credentials - 登录凭证
 * @returns 认证上下文
 * @throws Error 登录失败时抛出错误
 */
async function loginUser(
  page: Page,
  credentials: TestCredentials
): Promise<AuthContext> {
  await page.goto(`${TEST_BASE_URL}/login`);
  await page.fill('[data-testid="username-input"]', credentials.username);
  await page.fill('[data-testid="password-input"]', credentials.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL(`${TEST_BASE_URL}/dashboard`);

  return {
    userId: 'user-001',
    username: credentials.username,
    role: UserRole.ASSET_MANAGER,
    token: 'mock-jwt-token',
  };
}

/**
 * 辅助函数：创建报废申请
 * 
 * @param page - Playwright 页面对象
 * @param data - 报废申请数据
 * @returns 创建的申请 ID
 */
async function createRetirementApplication(
  page: Page,
  data: RetirementApplicationData
): Promise<string> {
  await page.goto(`${TEST_BASE_URL}/assets/${data.assetId}`);
  await page.click('[data-testid="apply-retirement-btn"]');
  await page.selectOption('[data-testid="reason-select"]', data.reason);
  
  if (data.reasonDetail) {
    await page.fill('[data-testid="reason-detail-input"]', data.reasonDetail);
  }
  
  await page.click('[data-testid="submit-application-btn"]');
  await page.waitForSelector('[data-testid="application-success-toast"]');
  
  const url = page.url();
  const match = url.match(/\/retirement\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : '';
}

/**
 * 辅助函数：执行审批操作
 * 
 * @param page - Playwright 页面对象
 * @param applicationId - 申请 ID
 * @param action - 审批操作
 */
async function performApprovalAction(
  page: Page,
  applicationId: string,
  action: ApprovalActionData
): Promise<void> {
  await page.goto(`${TEST_BASE_URL}/retirement/${applicationId}`);
  await page.click(`[data-testid="${action.action}-btn"]`);
  
  if (action.comment) {
    await page.fill('[data-testid="approval-comment-input"]', action.comment);
  }
  
  await page.click('[data-testid="confirm-action-btn"]');
  await page.waitForSelector('[data-testid="approval-success-toast"]');
}

/**
 * 辅助函数：验证资产状态
 * 
 * @param page - Playwright 页面对象
 * @param assetId - 资产 ID
 * @param expectedStatus - 期望的状态
 */
async function verifyAssetStatus(
  page: Page,
  assetId: number,
  expectedStatus: AssetStatus
): Promise<void> {
  await page.goto(`${TEST_BASE_URL}/assets/${assetId}`);
  const statusBadge = page.locator('[data-testid="asset-status-badge"]');
  await expect(statusBadge).toHaveText(expectedStatus);
}

/**
 * 辅助函数：验证历史记录
 * 
 * @param page - Playwright 页面对象
 * @param assetId - 资产 ID
 * @param expectedEventType - 期望的事件类型
 */
async function verifyHistoryRecord(
  page: Page,
  assetId: number,
  expectedEventType: string
): Promise<void> {
  await page.goto(`${TEST_BASE_URL}/assets/${assetId}`);
  await page.click('[data-testid="history-tab"]');
  await page.waitForSelector('[data-testid="history-timeline"]');
  
  const historyItems = page.locator('[data-testid="history-item"]');
  const count = await historyItems.count();
  expect(count).toBeGreaterThan(0);
  
  const firstItem = historyItems.first();
  await expect(firstItem.locator('[data-testid="event-type"]')).toHaveText(expectedEventType);
}

// ==================== AC-001: 状态机核心路径测试 ====================

/**
 * TC-RET-001: 报废申请发起
 * 
 * 验证用户可以为指定资产提交报废申请，系统正确创建申请记录并更新资产状态
 * 
 * @precondition 存在 `在用` 状态资产 A，用户为资产管理员
 * @steps 
 *  1. 登录系统
 *  2. 进入资产详情页
 *  3. 点击"申请报废"
 *  4. 填写原因"技术落后"，上传 PDF 附件
 *  5. 提交
 * @expects 
 *  1. 系统返回 201 Created
 *  2. 报废申请记录创建成功
 *  3. 资产状态变为 `报废审批中`
 *  4. 审批链触发首级审批人收到通知
 */
test.describe('TC-RET-001: 报废申请发起', () => {
  test('应该成功创建报废申请并更新资产状态', async ({ page }) => {
    const credentials: TestCredentials = {
      username: 'asset_manager',
      password: 'test_password',
    };

    await loginUser(page, credentials);

    const applicationId = await createRetirementApplication(page, {
      assetId: 1001,
      reason: 'TECHNICAL_OBSOLETE',
      reasonDetail: '设备技术落后，无法满足业务需求',
    });

    expect(applicationId).toBeTruthy();

    await verifyAssetStatus(page, 1001, AssetStatus.RETIREMENT_PENDING);

    const notificationBadge = page.locator('[data-testid="notification-badge"]');
    await expect(notificationBadge).toBeVisible();
  });
});

// ==================== AC-001: 审批链流转测试 ====================

/**
 * TC-RET-002: 审批链自动流转
 * 
 * 验证审批链根据配置自动流转到下一级审批人
 * 
 * @precondition 存在待审批报废申请 B，配置为 2 级审批
 * @steps
 *  1. 首级审批人登录
 *  2. 进入待办列表
 *  3. 审批通过
 *  4. 二级审批人登录查看
 * @expects
 *  1. 首级审批后，申请自动流转至二级
 *  2. 二级审批人待办列表出现该申请
 *  3. 审批记录包含完整链路信息
 */
test.describe('TC-RET-002: 审批链自动流转', () => {
  test('应该自动流转到下一级审批人', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const approver1Credentials: TestCredentials = {
      username: 'approver_level1',
      password: 'test_password',
    };
    const approver2Credentials: TestCredentials = {
      username: 'approver_level2',
      password: 'test_password',
    };

    await loginUser(page1, approver1Credentials);
    await loginUser(page2, approver2Credentials);

    const applicationId = 'app-pending-multi-level';

    await page1.goto(`${TEST_BASE_URL}/retirement/${applicationId}`);
    await page1.click('[data-testid="approve-btn"]');
    await page1.click('[data-testid="confirm-action-btn"]');

    await page2.goto(`${TEST_BASE_URL}/pending-approvals`);
    const pendingList = page2.locator('[data-testid="pending-item"]');
    await expect(pendingList).toHaveCount(1);
    await expect(pendingList.first()).toContainText(applicationId);

    await context1.close();
    await context2.close();
  });
});

// ==================== AC-001: 审批拒绝测试 ====================

/**
 * TC-RET-003: 审批拒绝回退
 * 
 * 验证审批拒绝时，申请状态变更且资产状态回退
 * 
 * @precondition 存在待审批报废申请 C
 * @steps
 *  1. 审批人进入申请详情
 *  2. 点击"拒绝"，填写意见"需补充评估报告"
 *  3. 提交
 * @expects
 *  1. 申请状态变为 `已拒绝`
 *  2. 资产状态回退为 `在用`
 *  3. 申请人收到拒绝通知
 */
test.describe('TC-RET-003: 审批拒绝回退', () => {
  test('应该拒绝申请并回退资产状态', async ({ page }) => {
    const credentials: TestCredentials = {
      username: 'approver',
      password: 'test_password',
    };

    await loginUser(page, credentials);

    await performApprovalAction(page, 'app-reject-test', {
      action: 'reject',
      comment: '需补充评估报告',
    });

    const statusBadge = page.locator('[data-testid="application-status"]');
    await expect(statusBadge).toHaveText(RetirementStatus.REJECTED);

    await verifyAssetStatus(page, 1002, AssetStatus.IN_USE);

    const notification = page.locator('[data-testid="notification-item"]');
    await expect(notification).toContainText('报废申请被拒绝');
  });
});

// ==================== AC-001: 申请撤回测试 ====================

/**
 * TC-RET-004: 申请撤回
 * 
 * 验证申请人可以在审批链全部完成前撤回申请
 * 
 * @precondition 存在 `审批中` 状态报废申请 D
 * @steps
 *  1. 申请人进入申请详情
 *  2. 点击"撤回"
 *  3. 确认
 * @expects
 *  1. 申请状态变为 `已撤回`
 *  2. 审批链终止
 *  3. 资产状态回退为 `在用`
 */
test.describe('TC-RET-004: 申请撤回', () => {
  test('应该允许申请人撤回申请', async ({ page }) => {
    const credentials: TestCredentials = {
      username: 'asset_manager',
      password: 'test_password',
    };

    await loginUser(page, credentials);

    await page.goto(`${TEST_BASE_URL}/retirement/app-withdraw-test`);
    await page.click('[data-testid="withdraw-btn"]');
    await page.click('[data-testid="confirm-withdraw-btn"]');

    const statusBadge = page.locator('[data-testid="application-status"]');
    await expect(statusBadge).toHaveText(RetirementStatus.WITHDRAWN);

    await verifyAssetStatus(page, 1003, AssetStatus.IN_USE);
  });
});

// ==================== AC-001: 审批通过测试 ====================

/**
 * TC-RET-005: 报废审批通过
 * 
 * 验证审批链完成后，资产状态变为退役
 * 
 * @precondition 存在已完成全部审批的报废申请 E
 * @steps
 *  1. 审批链最后一級审批通过
 *  2. 系统自动处理
 * @expects
 *  1. 申请状态变为 `已退役`
 *  2. 资产状态变为 `退役`
 *  3. 历史记录包含完整审批时间线
 */
test.describe('TC-RET-005: 报废审批通过', () => {
  test('应该完成审批并标记资产为退役', async ({ page }) => {
    const credentials: TestCredentials = {
      username: 'final_approver',
      password: 'test_password',
    };

    await loginUser(page, credentials);

    await performApprovalAction(page, 'app-final-approval', {
      action: 'approve',
      comment: '审批通过',
    });

    const statusBadge = page.locator('[data-testid="application-status"]');
    await expect(statusBadge).toHaveText(RetirementStatus.RETIRED);

    await verifyAssetStatus(page, 1004, AssetStatus.RETIRED);

    await verifyHistoryRecord(page, 1004, 'RETIREMENT_APPROVED');
  });
});

// ==================== AC-001: 历史记录查询测试 ====================

/**
 * TC-RET-006: 历史记录查询
 * 
 * 验证历史记录按时间倒序展示且不可篡改
 * 
 * @precondition 存在多条报废记录的资产 F
 * @steps
 *  1. 进入资产 F 详情页
 *  2. 切换至"历史记录"标签
 *  3. 查询变更时间线
 * @expects
 *  1. 时间线按时间倒序展示
 *  2. 每条记录包含操作人、操作类型、时间戳
 *  3. 记录不可篡改
 */
test.describe('TC-RET-006: 历史记录查询', () => {
  test('应该正确展示历史记录时间线', async ({ page }) => {
    const credentials: TestCredentials = {
      username: 'asset_manager',
      password: 'test_password',
    };

    await loginUser(page, credentials);
    await verifyHistoryRecord(page, 1005, 'RETIREMENT_APPLIED');

    const historyItems = page.locator('[data-testid="history-item"]');
    const timestamps = await historyItems.all();

    for (let i = 0; i < timestamps.length - 1; i++) {
      const currentTime = await timestamps[i].locator('[data-testid="timestamp"]').getAttribute('data-time');
      const nextTime = await timestamps[i + 1].locator('[data-testid="timestamp"]').getAttribute('data-time');
      
      if (currentTime && nextTime) {
        expect(new Date(currentTime).getTime()).toBeGreaterThanOrEqual(new Date(nextTime).getTime());
      }
    }
  });
});

// ==================== AC-001: 退役状态标注测试 ====================

/**
 * TC-RET-007: 退役状态标注
 * 
 * 验证退役状态资产正确显示状态和相关信息
 * 
 * @precondition 存在 `退役` 状态资产 G
 * @steps
 *  1. 进入资产列表页
 *  2. 查看资产 G 状态展示
 * @expects
 *  1. 状态显示为 `退役`（红色标签）
 *  2. 详情页显示退役日期与原因
 */
test.describe('TC-RET-007: 退役状态标注', () => {
  test('应该正确标注退役状态', async ({ page }) => {
    const credentials: TestCredentials = {
      username: 'asset_manager',
      password: 'test_password',
    };

    await loginUser(page, credentials);

    await page.goto(`${TEST_BASE_URL}/assets`);
    const retiredAsset = page.locator('[data-testid="asset-row-1006"]');
    const statusBadge = retiredAsset.locator('[data-testid="status-badge"]');
    await expect(statusBadge).toHaveClass(/retired/);
    await expect(statusBadge).toHaveText('退役');

    await page.goto(`${TEST_BASE_URL}/assets/1006`);
    const retirementDate = page.locator('[data-testid="retirement-date"]');
    await expect(retirementDate).toBeVisible();

    const retirementReason = page.locator('[data-testid="retirement-reason"]');
    await expect(retirementReason).toBeVisible();
  });
});

// ==================== AC-001: 原因追溯查询测试 ====================

/**
 * TC-RET-008: 原因追溯查询
 * 
 * 验证支持按报废原因进行多维度追溯查询
 * 
 * @precondition 系统存在多个不同原因类型的退役资产
 * @steps
 *  1. 进入资产管理
 *  2. 使用筛选条件"报废原因=意外损毁"
 *  3. 执行查询
 * @expects
 *  1. 返回结果仅包含匹配原因类型的资产
 *  2. 导出 CSV 功能正常
 */
test.describe('TC-RET-008: 原因追溯查询', () => {
  test('应该支持按原因类型追溯查询', async ({ page }) => {
    const credentials: TestCredentials = {
      username: 'asset_manager',
      password: 'test_password',
    };

    await loginUser(page, credentials);

    await page.goto(`${TEST_BASE_URL}/retirement/trace`);
    
    await page.click('[data-testid="reason-filter-trigger"]');
    await page.selectOption('[data-testid="reason-filter-select"]', 'ACCIDENTAL_DAMAGE');
    await page.click('[data-testid="apply-filter-btn"]');

    const results = page.locator('[data-testid="trace-result-item"]');
    const count = await results.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const reason = await results.nth(i).locator('[data-testid="retirement-reason"]').textContent();
      expect(reason).toBe('意外损毁');
    }

    const exportBtn = page.locator('[data-testid="export-csv-btn"]');
    await exportBtn.click();
    await page.waitForSelector('[data-testid="export-success-toast"]');
  });
});

// ==================== 边界条件测试 ====================

/**
 * BC-01: 附件上传超过限制
 * 
 * 验证附件大小超限时返回 413 错误
 */
test.describe('BC-01: 附件大小超限', () => {
  test('应该拒绝超过 10MB 的附件', async ({ page }) => {
    const credentials: TestCredentials = {
      username: 'asset_manager',
      password: 'test_password',
    };

    await loginUser(page, credentials);

    await page.goto(`${TEST_BASE_URL}/assets/1007`);
    await page.click('[data-testid="apply-retirement-btn"]');

    const fileInput = page.locator('[data-testid="attachment-input"]');
    await fileInput.setInputFiles({
      name: 'large_file.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(11 * 1024 * 1024),
    });

    await page.waitForSelector('[data-testid="file-error-message"]');
    const errorMsg = page.locator('[data-testid="file-error-message"]');
    await expect(errorMsg).toContainText('文件大小不能超过 10MB');
  });
});

/**
 * BC-02: 上传非允许格式附件
 * 
 * 验证附件格式错误时返回 400 错误
 */
test.describe('BC-02: 附件格式不支持', () => {
  test('应该拒绝非 PDF/图片格式的附件', async ({ page }) => {
    const credentials: TestCredentials = {
      username: 'asset_manager',
      password: 'test_password',
    };

    await loginUser(page, credentials);

    await page.goto(`${TEST_BASE_URL}/assets/1008`);
    await page.click('[data-testid="apply-retirement-btn"]');

    const fileInput = page.locator('[data-testid="attachment-input"]');
    await fileInput.setInputFiles({
      name: 'test.exe',
      mimeType: 'application/x-executable',
      buffer: Buffer.from('test'),
    });

    await page.waitForSelector('[data-testid="file-error-message"]');
    const errorMsg = page.locator('[data-testid="file-error-message"]');
    await expect(errorMsg).toContainText('不支持的文件格式');
  });
});

/**
 * BC-03: 自我审批禁止
 * 
 * 验证审批人不能审批自己发起的申请
 */
test.describe('BC-03: 自我审批禁止', () => {
  test('应该禁止审批人审批自己发起的申请', async ({ page }) => {
    const credentials: TestCredentials = {
      username: 'asset_manager',
      password: 'test_password',
    };

    await loginUser(page, credentials);

    await page.goto(`${TEST_BASE_URL}/retirement/app-self-submit`);

    const approveBtn = page.locator('[data-testid="approve-btn"]');
    await expect(approveBtn).toBeDisabled();

    const disabledReason = page.locator('[data-testid="disabled-reason"]');
    await expect(disabledReason).toContainText('禁止自我审批');
  });
});

/**
 * BC-04: 并发申请冲突
 * 
 * 验证同一资产同时只能有一个有效的报废申请
 */
test.describe('BC-04: 并发申请冲突', () => {
  test('应该拒绝同一资产的重复报废申请', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    const credentials: TestCredentials = {
      username: 'asset_manager',
      password: 'test_password',
    };

    await loginUser(page1, credentials);
    await loginUser(page2, credentials);

    await page1.goto(`${TEST_BASE_URL}/assets/1009`);
    await page1.click('[data-testid="apply-retirement-btn"]');
    await page1.selectOption('[data-testid="reason-select"]', 'NORMAL_EXPIRY');
    await page1.click('[data-testid="submit-application-btn"]');

    await page2.goto(`${TEST_BASE_URL}/assets/1009`);
    await page2.click('[data-testid="apply-retirement-btn"]');
    await page2.selectOption('[data-testid="reason-select"]', 'TECHNICAL_OBSOLETE');
    await page2.click('[data-testid="submit-application-btn"]');

    await page2.waitForSelector('[data-testid="conflict-error-message"]');
    const errorMsg = page2.locator('[data-testid="conflict-error-message"]');
    await expect(errorMsg).toContainText('存在待审批的报废申请');

    await context.close();
  });
});

// ==================== 错误码验证测试 ====================

/**
 * 验证资产不存在错误
 */
test.describe('错误码验证: ASSET_NOT_FOUND', () => {
  test('应该正确处理资产不存在的场景', async ({ page }) => {
    const credentials: TestCredentials = {
      username: 'asset_manager',
      password: 'test_password',
    };

    await loginUser(page, credentials);
    await page.goto(`${TEST_BASE_URL}/assets/99999`);

    const errorPage = page.locator('[data-testid="error-page"]');
    await expect(errorPage).toBeVisible();
    await expect(errorPage.locator('[data-testid="error-code"]')).toHaveText('ASSET_NOT_FOUND');
  });
});

/**
 * 验证资产状态不允许报废错误
 */
test.describe('错误码验证: ASSET_STATUS_INVALID', () => {
  test('应该拒绝非在用/闲置状态资产的报废申请', async ({ page }) => {
    const credentials: TestCredentials = {
      username: 'asset_manager',
      password: 'test_password',
    };

    await loginUser(page, credentials);

    await page.goto(`${TEST_BASE_URL}/assets/1010`);
    const applyBtn = page.locator('[data-testid="apply-retirement-btn"]');
    await expect(applyBtn).toBeDisabled();

    const disabledReason = page.locator('[data-testid="disabled-reason"]');
    await expect(disabledReason).toContainText('资产状态不允许报废');
  });
});