import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';

const apiBase = process.env.AMS_API_BASE ?? 'http://localhost:8080/api';
const username = process.env.AMS_E2E_USERNAME ?? 'admin';
const password = process.env.AMS_E2E_PASSWORD ?? 'admin123';
const approverRoleCode = 'SUPER_ADMIN';

test.describe.configure({ mode: 'serial' });

test('真实后端：登录后可打开仪表板和资产台账', async ({ page, request }) => {
  const health = await request.get(`${apiBase}/health`);
  test.skip(!health.ok(), `后端不可用：${apiBase}`);

  const auth = await loginThroughRequest(request);
  const suffix = Date.now().toString(36);
  const seededAsset = await createAsset(request, authHeaders(auth.token), {
    code: `E2E-LIST-${suffix}`,
    name: `真实E2E列表资产-${suffix}`,
    status: 'IN_USE',
  });
  const seededAssetName = seededAsset.assetName ?? seededAsset.name;

  const errors = collectBrowserErrors(page);

  await page.goto('/login');
  await page.getByLabel('用户名').fill(username);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: /登录并进入仪表板/ }).click();

  await expect(page.getByRole('heading', { name: '仪表板' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('资产总数')).toBeVisible();
  await expect(page.getByText('资产价值趋势')).toBeVisible();

  await page.goto(`/assets?keyword=${encodeURIComponent(seededAssetName)}`);
  await expect(page.getByRole('heading', { name: '资产台账管理' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(seededAssetName).first()).toBeVisible({ timeout: 15_000 });

  expect(errors).toEqual([]);
});

test('真实后端：资产搜索框和流程设计器可用', async ({ page, request }) => {
  const health = await request.get(`${apiBase}/health`);
  test.skip(!health.ok(), `后端不可用：${apiBase}`);

  const errors = collectBrowserErrors(page);
  await loginThroughApi(page, request);

  await page.goto('/assets');
  const search = page.getByPlaceholder(/搜索|请输入/).first();
  await search.fill('测试');
  await expect(search).toHaveValue('测试');

  await page.goto('/workflow-designer');
  await expect(page.getByText('审批流程可视化设计器')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/审批节点|开始节点|条件节点/).first()).toBeVisible();

  expect(errors).toEqual([]);
});

test('真实后端：登录页可见且流程设计器配置校验有效', async ({ page, request }) => {
  const health = await request.get(`${apiBase}/health`);
  test.skip(!health.ok(), `后端不可用：${apiBase}`);

  const errors = collectBrowserErrors(page);

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '欢迎登录' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('用户名')).toBeVisible();
  await expect(page.getByLabel('密码')).toBeVisible();

  await loginThroughApi(page, request);
  await page.goto('/workflow-designer');
  await expect(page.getByRole('heading', { name: '审批流程可视化设计器' })).toBeVisible({ timeout: 15_000 });

  const approverRole = page.getByLabel('审批角色');
  await expect(approverRole).toBeVisible();
  await page.getByLabel('指定用户').check();
  await page.getByLabel('按角色审批').check();
  await expect(page.getByText(/审批节点approval-1审批角色不能为空/)).toBeVisible();

  await approverRole.selectOption(approverRoleCode);
  await page.getByRole('button', { name: /保存流程草稿/ }).click();
  await expect(page.getByText(/资产转移流程已保存到后端流程定义草稿/)).toBeVisible();
  await expect(page.evaluate(() => window.localStorage.getItem('forthAMS.workflowDesigner.draft.ASSET_TRANSFER'))).resolves.toContain(approverRoleCode);

  expect(errors).toEqual([]);
});

test('真实后端：资产处置四类业务可打开对应流程设计器', async ({ page, request }) => {
  const health = await request.get(`${apiBase}/health`);
  test.skip(!health.ok(), `后端不可用：${apiBase}`);

  const errors = collectBrowserErrors(page);
  await loginThroughApi(page, request);

  const businessLinks = [
    { path: '/disposals/transfer/new', title: '新建资产转移申请', businessType: 'ASSET_TRANSFER', flowName: '资产转移流程' },
    { path: '/disposals/clearance/new', title: '资产清退申请', businessType: 'ASSET_CLEARANCE', flowName: '资产清退流程' },
    { path: '/disposals/scrap/new', title: '资产报废转让电子流', businessType: 'ASSET_SCRAP', flowName: '资产报废转让流程' },
    { path: '/disposals/compensation/new', title: '资产赔偿电子流', businessType: 'ASSET_COMPENSATION', flowName: '资产赔偿流程' },
  ];

  for (const item of businessLinks) {
    await page.goto(item.path);
    await expect(page.getByRole('heading', { name: item.title })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /配置流程/ }).click();
    await expect(page).toHaveURL(new RegExp(`/workflow-designer\\?businessType=${item.businessType}$`));
    await expect(page.getByRole('heading', { name: '审批流程可视化设计器' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(item.flowName).first()).toBeVisible();
    await expect(page.locator('select').first()).toHaveValue(item.businessType);
    await expect(page.getByText(`forthAMS.workflowDesigner.draft.${item.businessType}`)).toBeVisible();
  }

  await page.goto('/workflows');
  await expect(page.getByRole('heading', { name: '业务流程列表' })).toBeVisible({ timeout: 15_000 });
  for (const item of businessLinks) {
    await expect(page.getByText(item.flowName).first()).toBeVisible();
  }
  await page.getByRole('button', { name: /打开设计器/ }).first().click();
  await expect(page).toHaveURL(/\/workflow-designer\?businessType=ASSET_TRANSFER$/);
  await page.getByRole('button', { name: /返回流程列表/ }).click();
  await expect(page).toHaveURL(/\/workflows$/);
  await expect(page.getByRole('heading', { name: '业务流程列表' })).toBeVisible({ timeout: 15_000 });

  await page.goto('/workflow-designer?businessType=ASSET_TRANSFER');
  await page.getByLabel('审批角色').selectOption(approverRoleCode);
  await page.getByRole('button', { name: /保存流程草稿/ }).click();
  await expect(page.getByText(/资产转移流程已保存到后端流程定义草稿/)).toBeVisible();

  await page.goto('/workflows');
  await page.getByRole('button', { name: /发布流程/ }).first().click();
  await expect(page.getByText(/资产转移流程已发布/)).toBeVisible({ timeout: 15_000 });

  await page.goto('/workflow-designer?businessType=ASSET_TRANSFER');
  await page.locator('select').first().selectOption('ASSET_CLEARANCE');
  await expect(page).toHaveURL(/businessType=ASSET_CLEARANCE/);
  await page.getByLabel('审批角色').selectOption(approverRoleCode);
  await page.getByRole('button', { name: /保存流程草稿/ }).click();
  await expect(page.getByText(/资产清退流程已保存到后端流程定义草稿/)).toBeVisible();

  const drafts = await page.evaluate(() => ({
    transfer: window.localStorage.getItem('forthAMS.workflowDesigner.draft.ASSET_TRANSFER'),
    clearance: window.localStorage.getItem('forthAMS.workflowDesigner.draft.ASSET_CLEARANCE'),
  }));
  expect(drafts.transfer).toContain('"businessType":"ASSET_TRANSFER"');
  expect(drafts.transfer).toContain(approverRoleCode);
  expect(drafts.clearance).toContain('"businessType":"ASSET_CLEARANCE"');
  expect(drafts.clearance).toContain(approverRoleCode);

  expect(errors).toEqual([]);
});

test('真实后端：核心导航和顶栏操作可点击', async ({ page, request }) => {
  const health = await request.get(`${apiBase}/health`);
  test.skip(!health.ok(), `后端不可用：${apiBase}`);

  const errors = collectBrowserErrors(page);
  await loginThroughApi(page, request);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '仪表板' })).toBeVisible({ timeout: 15_000 });

  const navItems = [
    { name: '资产台账', heading: '资产台账管理' },
    { name: '重要设备', heading: '重要设备管理' },
    { name: 'RFID盘点', heading: 'RFID资产盘点' },
    { name: '闲置资产', heading: '闲置资产管理' },
    { name: '资产处置', heading: '资产处置管理' },
    { name: '审批流程', heading: '审批列表' },
    { name: '流程管理', heading: '业务流程列表' },
    { name: '数据分析', heading: '数据统计分析' },
    { name: '系统设置', heading: '系统设置' },
  ];

  for (const item of navItems) {
    await page.getByRole('link', { name: item.name }).click();
    await expect(page.getByRole('heading', { name: item.heading }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/加载数据失败/)).toHaveCount(0);
  }

  await page.getByLabel('查看通知').click();
  await expect(page.getByText(/通知中心|暂无新的待办通知/).first()).toBeVisible();

  await page.getByPlaceholder('搜索资产...').fill('测试资产');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/assets\?keyword=/);
  await expect(page.getByRole('heading', { name: '资产台账管理' })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /退出/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: '欢迎登录' })).toBeVisible({ timeout: 15_000 });

  expect(errors).toEqual([]);
});

test('真实后端：工单审批和资产退役 API 闭环可跑通', async ({ request }) => {
  const health = await request.get(`${apiBase}/health`);
  test.skip(!health.ok(), `后端不可用：${apiBase}`);

  const auth = await loginThroughRequest(request);
  const headers = authHeaders(auth.token);
  const suffix = Date.now().toString(36);

  const workOrderAsset = await createAsset(request, headers, {
    code: `E2E-WO-${suffix}`,
    name: `真实E2E工单资产-${suffix}`,
    status: 'IN_USE',
  });
  const workOrder = await apiData(await request.post(`${apiBase}/workorders`, {
    headers,
    data: {
      title: `真实E2E维修工单-${suffix}`,
      description: '真实后端API闭环测试自动创建',
      priority: 'NORMAL',
      assetId: workOrderAsset.id,
      assetName: workOrderAsset.assetName,
      assetCode: workOrderAsset.assetNo,
      reporterId: auth.userId,
      reporterName: auth.realName,
      deptId: 1,
      deptName: '总公司',
    },
  }));

  expect(workOrder.status).toBe('DRAFT');
  const submittedWorkOrder = await apiData(await request.post(`${apiBase}/workorders/${workOrder.id}/submit`, { headers }));
  expect(submittedWorkOrder.status).toBe('PENDING');
  const approvedWorkOrder = await apiData(await request.post(`${apiBase}/workorders/${workOrder.id}/approve`, {
    headers,
    data: { comment: '真实E2E审批通过' },
  }));
  expect(approvedWorkOrder.status).toBe('APPROVED');

  const retirementAsset = await createAsset(request, headers, {
    code: `E2E-RET-${suffix}`,
    name: `真实E2E退役资产-${suffix}`,
    status: 'IN_USE',
  });
  const retirement = await apiData(await request.post(`${apiBase}/retirement/apply`, {
    headers,
    data: {
      asset_id: retirementAsset.id,
      reason: '真实后端E2E退役闭环验证',
      estimated_residual_value: 10,
      retirement_type: 'SCRAP',
    },
  }));
  expect(retirement.status).toBe('PENDING');

  const approvedRetirement = await apiData(await request.post(`${apiBase}/retirement/${retirement.id}/approve`, { headers }));
  expect(approvedRetirement.status).toBe('APPROVED');
  const completedRetirement = await apiData(await request.post(`${apiBase}/retirement/${retirement.id}/complete`, { headers }));
  expect(completedRetirement.status).toBe('COMPLETED');

  const retiredAsset = await apiData(await request.get(`${apiBase}/assets/${retirementAsset.id}`, { headers }));
  expect(retiredAsset.status).toBe('SCRAPPED');
});

test('真实后端：赔偿页面可用', async ({ page, request }) => {
  const health = await request.get(`${apiBase}/health`);
  test.skip(!health.ok(), `后端不可用：${apiBase}`);

  const errors = collectBrowserErrors(page);
  await loginThroughApi(page, request);

  await page.goto('/compensation');
  await expect(page.getByText('资产赔偿申请').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('body')).not.toContainText('Unexpected Application Error');

  expect(errors).toEqual([]);
});

test('真实后端：大屏页面可访问', async ({ page, request }) => {
  const health = await request.get(`${apiBase}/health`);
  test.skip(!health.ok(), `后端不可用：${apiBase}`);

  const errors = collectBrowserErrors(page);
  await loginThroughApi(page, request);

  await page.goto('/bigscreen-3d');
  await page.waitForLoadState('networkidle');

  // 无论是否支持 WebGL，页面不应崩溃
  await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
  expect(errors.filter(e => !e.includes('WebGL') && !e.includes('webgl'))).toEqual([]);
});

async function loginThroughApi(page: Page, request: APIRequestContext) {
  const data = await loginThroughRequest(request);

  await page.addInitScript(({ token, user }) => {
    window.localStorage.setItem('ams_auth_token', token);
    window.localStorage.setItem('ams_auth_user', JSON.stringify(user));
  }, {
    token: data.token,
    user: {
      userId: data.userId,
      username: data.username,
      realName: data.realName,
    },
  });
}

async function loginThroughRequest(request: APIRequestContext) {
  return apiData(await request.post(`${apiBase}/auth/login`, {
    data: { username, password },
  }));
}

async function createAsset(request: APIRequestContext, headers: Record<string, string>, asset: {
  code: string;
  name: string;
  status: string;
}) {
  return apiData(await request.post(`${apiBase}/assets`, {
    headers,
    data: {
      code: asset.code,
      name: asset.name,
      categoryId: 1,
      deptId: 1,
      originalValue: 1000,
      currentValue: 1000,
      purchaseDate: '2026-01-01',
      location: 'E2E测试库位',
      status: asset.status,
    },
  }));
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function apiData(response: APIResponse) {
  const bodyText = await response.text();
  expect(response.ok(), bodyText).toBeTruthy();
  const body = bodyText ? JSON.parse(bodyText) : {};
  expect(body.code, bodyText).toBe(200);
  return body.data;
}

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];

  page.on('response', (response) => {
    if (response.status() >= 500) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  return errors;
}
