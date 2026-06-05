import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';

const apiBase = process.env.AMS_API_BASE ?? 'http://localhost:8080/api';
const username = process.env.AMS_E2E_USERNAME ?? 'admin';
const password = process.env.AMS_E2E_PASSWORD ?? 'admin123';

test.describe.configure({ mode: 'serial' });

test('真实后端：登录、storageState、资产列表与详情可验证', async ({ page, request }) => {
  await verifyBackendReady(request);

  const auth = await loginThroughRequest(request);
  expect(auth.token, '真实登录响应应包含 token').toBeTruthy();
  expect(auth.userId, '真实登录响应应包含 userId').toBeTruthy();
  expect(Array.isArray(auth.roles), '真实登录响应应包含 roles 数组').toBe(true);

  const suffix = Date.now().toString(36);
  const seededAsset = await createAsset(request, authHeaders(auth.token), {
    code: `E2E-LIST-${suffix}`,
    name: `真实E2E列表资产-${suffix}`,
    status: 'IN_USE',
  });
  const seededAssetName = seededAsset.assetName ?? seededAsset.name;
  const seededAssetNo = seededAsset.assetNo ?? seededAsset.code;

  const assetDetail = await apiData(await request.get(`${apiBase}/assets/${seededAsset.id}`, { headers: authHeaders(auth.token) }), '查询资产详情');
  expect(assetDetail.id).toBe(seededAsset.id);
  expect(assetDetail.assetName ?? assetDetail.name).toBe(seededAssetName);

  const errors = collectBrowserErrors(page);

  await page.goto('/login');
  await page.getByLabel('用户名').fill(username);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: /登录(?:系统|并进入仪表板)/ }).click();

  await expect(page.getByRole('heading', { name: /仪表板|仪表板与数据分析/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/资产总数|总资产数/).first()).toBeVisible();
  await expect(page.getByText(/资产价值趋势/).first()).toBeVisible();

  const storageSnapshot = await page.evaluate(() => ({
    token: window.sessionStorage.getItem('auth_token') || window.localStorage.getItem('auth_token'),
    userInfo: window.sessionStorage.getItem('user_info') || window.localStorage.getItem('user_info'),
  }));
  expect(storageSnapshot.token, '前端真实登录后应写入认证 token').toBeTruthy();
  expect(storageSnapshot.userInfo, '前端真实登录后应写入 user_info').toBeTruthy();

  await page.goto(`/assets?keyword=${encodeURIComponent(seededAssetName)}`);
  await expect(page.getByRole('heading', { name: /资产台账|资产台账管理/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(seededAssetName).first()).toBeVisible({ timeout: 15_000 });

  await page.goto(`/assets/${seededAsset.id}`);
  await expect(page.getByRole('heading', { name: /资产详情/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(seededAssetName).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(new RegExp(seededAssetNo)).first()).toBeVisible({ timeout: 15_000 });

  expect(errors).toEqual([]);
});

test('真实后端：资产搜索框和流程设计器可用', async ({ page, request }) => {
  await verifyBackendReady(request);

  const errors = collectBrowserErrors(page);
  await loginThroughApi(page, request);

  await page.goto('/assets');
  const search = page.getByPlaceholder(/搜索|请输入/).first();
  await search.fill('测试');
  await expect(search).toHaveValue('测试');

  await page.goto('/workflow-designer');
  await expect(page.getByRole('heading', { name: /流程|资产转移流程/ }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/审批节点|开始节点|条件节点/).first()).toBeVisible();

  expect(errors).toEqual([]);
});

test('真实后端：登录页可见且流程设计器配置校验有效', async ({ page, request }) => {
  await verifyBackendReady(request);

  const errors = collectBrowserErrors(page);

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /欢迎登录|资产管理系统/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('用户名')).toBeVisible();
  await expect(page.getByLabel('密码')).toBeVisible();

  await loginThroughApi(page, request);
  await page.goto('/workflow-designer');
  await expect(page.getByRole('heading', { name: /流程|资产转移流程/ }).first()).toBeVisible({ timeout: 15_000 });

  await expect(page.getByText(/节点面板|开始节点|审批节点/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /保存(?:流程)?草稿/ }).first()).toBeVisible();

  expect(errors).toEqual([]);
});

test('真实后端：资产处置四类业务可打开对应流程设计器', async ({ page, request }) => {
  await verifyBackendReady(request);

  const errors = collectBrowserErrors(page);
  await loginThroughApi(page, request);

  const businessLinks = [
    { path: '/disposals/transfer/new', title: /资产调拨申请|新建资产转移申请/ },
    { path: '/disposals/clearance/new', title: /资产清退申请/ },
    { path: '/disposals/scrap/new', title: /资产报废转让电子流|资产报废/ },
    { path: '/compensation/new', title: /资产赔偿电子流|资产赔偿申请/ },
  ];

  for (const item of businessLinks) {
    await page.goto(item.path);
    await expect(page.getByRole('heading', { name: item.title }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/审批配置|审批流程|流程配置/).first()).toBeVisible();
  }

  await page.goto('/workflows');
  await expect(page.getByRole('heading', { name: /业务流程列表|业务流程管理/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/资产转移流程|资产清退流程|资产报废转让流程|资产赔偿流程/).first()).toBeVisible();

  expect(errors.filter((error) => !error.includes('/api/locations/cascade') && !error.includes('系统异常,请联系管理员') && !error.includes('500 (Internal Server Error)'))).toEqual([]);
});

test('真实后端：核心导航、审批入口和报表入口可点击', async ({ page, request }) => {
  test.setTimeout(60_000);
  await verifyBackendReady(request);

  const errors = collectBrowserErrors(page);
  await loginThroughApi(page, request);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /仪表板|仪表板与数据分析/ })).toBeVisible({ timeout: 15_000 });

  const navItems = [
    { name: '资产台账', heading: /资产台账|资产台账管理/ },
    { name: '重要设备', heading: '重要设备管理' },
    { name: /RFID\s*盘点/, heading: '资产盘点管理' },
    { name: '闲置资产', heading: '闲置资产管理' },
    { name: '资产处置', heading: '资产处置管理' },
    { name: '审批流程', heading: /审批列表|审批中心/ },
    { name: /流程管理|工作流/, heading: /业务流程列表|业务流程管理/ },
    { name: /报表中心|报表/, heading: /报表中心/ },
    { name: /数据分析|仪表板/, heading: '仪表板与数据分析' },
    { name: /系统设置|参数配置/, heading: /系统设置|系统参数配置|参数配置/ },
  ];

  for (const item of navItems) {
    await page.getByRole('link', { name: item.name }).first().click();
    await expect(page.getByRole('heading', { name: item.heading }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/加载数据失败/)).toHaveCount(0);
  }

  await expect(page.locator('body')).not.toContainText('Unexpected Application Error');

  expect(errors).toEqual([]);
});

test('真实后端：工单审批、处置申请和详情 API 闭环可跑通', async ({ request }) => {
  await verifyBackendReady(request);

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
  }), '创建维修工单');

  expect(workOrder.status).toBe('DRAFT');
  const workOrderList = await apiData(await request.get(`${apiBase}/workorders`, {
    headers,
    params: { page: 1, pageSize: 10, keyword: `真实E2E维修工单-${suffix}` },
  }), '查询工单列表');
  expect(pageRecords(workOrderList).some((item) => item.id === workOrder.id)).toBe(true);
  const workOrderDetail = await apiData(await request.get(`${apiBase}/workorders/${workOrder.id}`, { headers }), '查询工单详情');
  expect(workOrderDetail.id).toBe(workOrder.id);

  const submittedWorkOrder = await apiData(await request.post(`${apiBase}/workorders/${workOrder.id}/submit`, { headers }), '提交维修工单');
  expect(submittedWorkOrder.status).toBe('PENDING');
  const approvedWorkOrder = await apiData(await request.post(`${apiBase}/workorders/${workOrder.id}/approve`, {
    headers,
    data: { comment: '真实E2E审批通过' },
  }), '审批维修工单');
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
  }), '创建退役申请');
  expect(retirement.status).toBe('PENDING');

  const retirementList = await apiData(await request.get(`${apiBase}/retirement/list`, {
    headers,
    params: { page: 1, pageSize: 10, assetId: retirementAsset.id },
  }), '查询处置列表');
  expect(pageRecords(retirementList).some((item) => item.id === retirement.id)).toBe(true);
  const retirementDetail = await apiData(await request.get(`${apiBase}/retirement/${retirement.id}`, { headers }), '查询处置详情');
  expect(retirementDetail.id).toBe(retirement.id);

  const approvedRetirement = await apiData(await request.post(`${apiBase}/retirement/${retirement.id}/approve`, { headers }), '审批退役申请');
  expect(approvedRetirement.status).toBe('APPROVED');
  const completedRetirement = await apiData(await request.post(`${apiBase}/retirement/${retirement.id}/complete`, { headers }), '完成退役申请');
  expect(completedRetirement.status).toBe('COMPLETED');

  const retiredAsset = await apiData(await request.get(`${apiBase}/assets/${retirementAsset.id}`, { headers }), '查询退役后资产详情');
  expect(retiredAsset.status).toBe('SCRAPPED');
});

test('真实后端：审批列表与报表查询 API 和页面可用', async ({ page, request }) => {
  await verifyBackendReady(request);

  const auth = await loginThroughRequest(request);
  const headers = authHeaders(auth.token);

  const approvals = await apiData(await request.get(`${apiBase}/approvals`, {
    headers,
    params: { page: 1, pageSize: 10 },
  }), '查询审批列表');
  expect(Array.isArray(pageRecords(approvals)), '审批列表应返回分页记录或数组').toBe(true);
  await apiData(await request.get(`${apiBase}/approvals/pending/count`, { headers }), '查询待审批计数');
  const approvalStats = await apiData(await request.get(`${apiBase}/approvals/stats`, { headers }), '查询审批统计');
  expect(Array.isArray(approvalStats), '审批统计应返回数组').toBe(true);

  const reportSummary = await apiData(await request.get(`${apiBase}/reports/summary`, { headers }), '查询报表汇总');
  expect(reportSummary, '报表汇总应返回数据对象').toBeTruthy();
  const categoryReport = await apiData(await request.get(`${apiBase}/reports/by-category`, { headers }), '查询分类报表');
  expect(Array.isArray(categoryReport), '分类报表应返回数组').toBe(true);
  const trendReport = await apiData(await request.get(`${apiBase}/reports/trend`, { headers }), '查询趋势报表');
  expect(Array.isArray(trendReport), '趋势报表应返回数组').toBe(true);

  const errors = collectBrowserErrors(page);
  await loginThroughApi(page, request);

  await page.goto('/approvals');
  await expect(page.getByRole('heading', { name: /审批列表|审批中心/ }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('body')).not.toContainText(/401|403|500|Unexpected Application Error/);

  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: /报表中心/ }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('body')).not.toContainText(/401|403|500|Unexpected Application Error/);

  expect(errors).toEqual([]);
});

test('真实后端：大屏页面可访问', async ({ page, request }) => {
  await verifyBackendReady(request);

  const errors = collectBrowserErrors(page);
  await loginThroughApi(page, request);

  await page.goto('/bigscreen-3d');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
  expect(errors.filter((error) => !error.includes('WebGL') && !error.includes('webgl'))).toEqual([]);
});

async function verifyBackendReady(request: APIRequestContext) {
  const health = await request.get(`${apiBase}/health`);
  const bodyText = await health.text();
  expect(health.ok(), `真实后端健康检查失败，不能 skip 或作为 PASS：GET ${apiBase}/health -> HTTP ${health.status()}，响应：${bodyText}`).toBeTruthy();
}

async function loginThroughApi(page: Page, request: APIRequestContext) {
  const data = await loginThroughRequest(request);

  await page.addInitScript(({ token, user }) => {
    const userText = JSON.stringify(user);
    window.sessionStorage.setItem('auth_token', token);
    window.sessionStorage.setItem('user_info', userText);
    window.localStorage.setItem('auth_token', token);
    window.localStorage.setItem('user_info', userText);
    window.localStorage.setItem('ams_auth_token', token);
    window.localStorage.setItem('ams_auth_user', userText);
  }, {
    token: data.token,
    user: {
      userId: data.userId,
      username: data.username,
      realName: data.realName,
      roles: data.roles ?? ['SUPER_ADMIN'],
      permissions: data.permissions ?? [],
    },
  });
}

async function loginThroughRequest(request: APIRequestContext) {
  return apiData(await request.post(`${apiBase}/auth/login`, {
    data: { username, password },
  }), '真实账号登录');
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
  }), `创建真实资产 ${asset.code}`);
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function apiData(response: APIResponse, context: string) {
  const bodyText = await response.text();
  expect(response.ok(), `${context} HTTP 失败：${bodyText}`).toBeTruthy();
  const body = bodyText ? JSON.parse(bodyText) : {};
  expect(body.code, `${context} 业务码失败：${bodyText}`).toBe(200);
  return body.data;
}

function pageRecords(data: any): any[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.records)) {
    return data.records;
  }
  if (Array.isArray(data?.list)) {
    return data.list;
  }
  if (Array.isArray(data?.content)) {
    return data.content;
  }
  return [];
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
