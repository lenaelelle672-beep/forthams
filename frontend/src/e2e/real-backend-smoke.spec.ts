import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';

const apiBase = process.env.AMS_API_BASE ?? 'http://localhost:8080/api';
const username = process.env.AMS_E2E_USERNAME ?? 'admin';
const password = process.env.AMS_E2E_PASSWORD ?? 'admin123';
const httpErrorPageText = /Unexpected Application Error|HTTP[\s:：-]*(?:401|403|500)|\b401\b[\s:：-]*(?:Unauthorized|未授权)|\b403\b[\s:：-]*(?:Forbidden|禁止)|\b500\b[\s:：-]*(?:Internal Server Error|服务器错误)/i;

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
  await page.getByRole('textbox', { name: '用户名' }).fill(username);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: /登录(?:系统|并进入仪表板)/ }).click();

  await expect(page.getByRole('heading', { name: /仪表板|仪表板与数据分析|运营首页/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /资产健康/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /资产价值/ }).first()).toBeVisible();

  const storageSnapshot = await page.evaluate(() => ({
    token: window.sessionStorage.getItem('auth_token') || window.localStorage.getItem('auth_token'),
    userInfo: window.sessionStorage.getItem('user_info') || window.localStorage.getItem('user_info'),
  }));
  expect(storageSnapshot.token, '前端真实登录后应写入认证 token').toBeTruthy();
  expect(storageSnapshot.userInfo, '前端真实登录后应写入 user_info').toBeTruthy();

  await page.goto(`/assets?keyword=${encodeURIComponent(seededAssetName)}`);
  await expect(page.getByRole('heading', { name: '资产台账', exact: true })).toBeVisible({ timeout: 15_000 });
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
  await expect(page.getByRole('heading', { name: /欢迎登录|欢迎回来|资产管理系统/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('textbox', { name: '用户名' })).toBeVisible();
  await expect(page.getByLabel('密码', { exact: true })).toBeVisible();

  await loginThroughApi(page, request);
  await page.goto('/workflow-designer');
  await expect(page.getByRole('heading', { name: /流程|资产转移流程/ }).first()).toBeVisible({ timeout: 15_000 });

  await expect(page.getByText(/节点面板|开始节点|审批节点/).first()).toBeVisible();
  const saveDraft = page.getByRole('button', { name: /保存(?:流程)?草稿/ }).first();
  await expect(saveDraft).toBeVisible();
  await saveDraft.click();
  await expect(page.getByText(/已保存草稿/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/仅保存为本地草稿/)).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('真实后端：托管流程发布回读节点表单并发起审批', async ({ page, request }) => {
  await verifyBackendReady(request);

  const auth = await loginThroughRequest(request);
  const headers = authHeaders(auth.token);
  const suffix = Date.now().toString(36).toUpperCase();
  const businessType = 'ASSET_TRANSFER';
  const initialFormSource = '<form><label>旧申请事由</label><input name="reason" /><label>旧申请金额</label><input name="amount" type="number" /></form>';
  const uiStartFormSource = `<form data-e2e="start-${suffix}"><label>申请事由-${suffix}</label><input name="reason" /><label>申请金额-${suffix}</label><input name="amount" type="number" /></form>`;
  const approvalSectionName = `审批意见-${suffix}`;
  const approvalSummaryFields = 'approvalComment,approvalResult';
  const approvalFormSource = '<form><label>审批意见</label><textarea name="approvalComment"></textarea><label>审批结论</label><input name="approvalResult" /></form>';
  const originalWorkflow = await apiData(await request.get(`${apiBase}/workflows/${businessType}`, { headers }), '备份资产转移流程定义');
  let approvalId: number | string | undefined;

  try {
    const definition = customPublishDefinition(businessType, initialFormSource);
    await apiData(await request.put(`${apiBase}/workflows/${businessType}/draft`, {
      headers,
      data: {
        name: `E2E资产转移发布流程-${suffix}`,
        description: '真实后端E2E托管流程发布节点表单回读',
        definition,
      },
    }), '保存资产转移流程草稿');

    await loginThroughApi(page, request);
    await page.goto(`/workflow-designer?businessType=${businessType}`);
    await expect(page.getByText('流程中心 / 设计器').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '资产转移流程' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('select').first()).toHaveValue(businessType);
    await expect(page.getByText('节点属性').first()).toBeVisible();

    await page.getByRole('button', { name: /表单源码/ }).click();
    const formSourcePanel = page.getByText('自定义表单 HTML（保存草稿后生效）').locator('xpath=ancestor::div[contains(@class, "flex-col")][1]');
    await expect(formSourcePanel).toBeVisible();
    await formSourcePanel.locator('textarea').fill(uiStartFormSource);

    await page.getByRole('button', { name: '节点属性', exact: true }).click();
    const nodeFormPanel = page.getByText('环节子表单/区段').locator('xpath=ancestor::div[contains(@class, "space-y-3")][1]');
    await expect(nodeFormPanel).toBeVisible();
    await nodeFormPanel.locator('input').nth(0).fill(approvalSectionName);
    await nodeFormPanel.locator('input').nth(1).fill(approvalSummaryFields);
    await nodeFormPanel.locator('textarea').fill(approvalFormSource);

    await page.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByText(/已保存草稿/).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: '发布流程', exact: true }).click();
    await expect(page.getByText(/已发布为 v/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/已发布 v\d+/).first()).toBeVisible({ timeout: 15_000 });
    const assigneePreviewPanel = page.getByLabel('处理人预览面板');
    await expect(assigneePreviewPanel.getByText(/已自动计算处理人|自动计算已运行|已解析处理人/).first()).toBeVisible({ timeout: 15_000 });

    let publishAuditLog: any;
    await expect.poll(async () => {
      const logs = pageRecords(await apiData(await request.get(`${apiBase}/audit-logs`, {
        headers,
        params: { keyword: businessType, page: 0, size: 10 },
      }), '查询资产转移流程发布审计日志'));
      publishAuditLog = logs.find((log) => isWorkflowPublishAuditLog(log, businessType));
      return Boolean(publishAuditLog);
    }, {
      message: '应能通过审计 API 回查到资产转移流程发布日志',
      timeout: 15_000,
    }).toBe(true);
    const publishAuditText = auditText(publishAuditLog);
    expect(publishAuditText).toContain('流程发布');
    expect(publishAuditText).toMatch(new RegExp(`${businessType}|/workflows/.*/publish|workflows.*publish`, 'i'));

    await assigneePreviewPanel.getByRole('button', { name: /重新计算|计算处理人/ }).click();
    await expect(assigneePreviewPanel.getByText(/已解析处理人/).first()).toBeVisible({ timeout: 15_000 });
    await expect(assigneePreviewPanel.getByText(/已解析 \d+ 名候选处理人/).first()).toBeVisible({ timeout: 15_000 });
    await expect(assigneePreviewPanel.getByText('具体处理人名单已隐藏').first()).toBeVisible({ timeout: 15_000 });
    await expect(assigneePreviewPanel).not.toContainText('SUPER_ADMIN');
    await expect(assigneePreviewPanel).not.toContainText(/assignees:/i);

    const published = await apiData(await request.get(`${apiBase}/workflows/${businessType}`, { headers }), 'GET回读已发布流程');
    expect(published.status).toBe('PUBLISHED');
    expect(published.version).toBeGreaterThan(0);
    const startNode = published.definition.nodes.find((node: any) => node.id === 'start-1');
    expect(startNode.data.formSource).toBe(uiStartFormSource);
    expect(startNode.data.formSectionName).toBe('申请信息');
    const approvalNode = published.definition.nodes.find((node: any) => node.id === 'approval-1');
    expect(approvalNode.data.formSectionName).toBe(approvalSectionName);
    expect(approvalNode.data.formSummaryFields).toBe(approvalSummaryFields);
    expect(approvalNode.data.formSource).toBe(approvalFormSource);

    const startAvailability = await apiData(
      await request.get(`${apiBase}/workflow-runtime/${businessType}/start-availability`, { headers }),
      '查询资产转移流程发起可用性',
    );
    expect(startAvailability.canStart).toBe(true);
    expect(startAvailability.status).toBe('PUBLISHED');
    expect(startAvailability.version).toBeGreaterThan(0);
    expect(startAvailability.entryUrl).toBeTruthy();

    const startAvailabilityRoutePattern = `**/workflow-runtime/${businessType}/start-availability`;
    const assertBlockedMyAssetsTransferEntry = async (expectedText: RegExp) => {
      await page.goto('/fixed-assets/workbench?menu=my-assets');
      const blockedTransferEntry = page.getByLabel('我的资产快捷入口').getByRole('button', { name: /资产调拨/ });
      await expect(blockedTransferEntry).toBeVisible({ timeout: 15_000 });
      await expect(blockedTransferEntry).toBeDisabled({ timeout: 15_000 });
      await expect(blockedTransferEntry).toContainText(expectedText, { timeout: 15_000 });
    };

    await page.goto('/fixed-assets/workbench?menu=my-assets');
    const myAssetsQuickEntries = page.getByLabel('我的资产快捷入口');
    await expect(myAssetsQuickEntries).toBeVisible({ timeout: 15_000 });
    const transferEntry = myAssetsQuickEntries.getByRole('button', { name: /资产调拨/ });
    await expect(transferEntry).toBeVisible({ timeout: 15_000 });
    await expect(transferEntry).toBeEnabled({ timeout: 15_000 });
    await transferEntry.click();
    const transferPreview = page.getByRole('dialog', { name: /资产调拨/ });
    await expect(transferPreview).toBeVisible({ timeout: 15_000 });
    const previewRouteTarget = transferPreview.locator('.workspace-action-route strong');
    await expect(previewRouteTarget).toContainText(/\/disposals\/transfer\/new\?.*source=workbench.*menu=my-assets/, { timeout: 15_000 });
    await expect(previewRouteTarget).not.toContainText('/assets/transfer');
    await transferPreview.getByRole('button', { name: /去调拨/ }).click();
    await expect(page).toHaveURL(/\/disposals\/transfer\/new\?.*source=workbench.*menu=my-assets/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /资产调拨申请|新建资产转移申请/ }).first()).toBeVisible({ timeout: 15_000 });

    await page.route(startAvailabilityRoutePattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          data: {
            businessType,
            canStart: false,
            status: 'DRAFT',
            version: 0,
            definitionId: published.id ?? null,
            entryUrl: '/disposals/transfer/new',
            blockReason: '流程未发布',
          },
        }),
      });
    });
    await assertBlockedMyAssetsTransferEntry(/未发布|草稿|不可发起/);
    await page.unroute(startAvailabilityRoutePattern);

    const disabledWorkflow = await apiData(await request.post(`${apiBase}/workflows/${businessType}/status`, {
      headers,
      data: { status: 'DISABLED' },
    }), '停用资产转移流程');
    expect(workflowStatus(disabledWorkflow)).toBe('DISABLED');
    await assertBlockedMyAssetsTransferEntry(/停用|阻断|不可发起|未发布|未配置|权限/);

    await apiData(await request.delete(`${apiBase}/workflows/${businessType}`, { headers }), '删除资产转移流程定义形成未配置状态');
    const unconfiguredAvailability = await apiData(
      await request.get(`${apiBase}/workflow-runtime/${businessType}/start-availability`, { headers }),
      '删除后查询资产转移流程发起可用性',
    );
    expect(unconfiguredAvailability.canStart).toBe(false);
    expect(unconfiguredAvailability.status).toBe('UNCONFIGURED');
    await assertBlockedMyAssetsTransferEntry(/请先发布|未配置|未发布|不可发起/);

    await page.route(startAvailabilityRoutePattern, async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 403,
          message: '无审批发起权限，无法发起资产调拨流程',
        }),
      });
    });
    await assertBlockedMyAssetsTransferEntry(/无审批发起权限|权限/);
    await page.unroute(startAvailabilityRoutePattern);

    await saveWorkflowDraftSnapshot(request, headers, businessType, published);
    const republishedWorkflow = await apiData(await request.post(`${apiBase}/workflows/${businessType}/publish`, { headers }), '未配置后重新发布资产转移流程');
    expect(workflowStatus(republishedWorkflow)).toBe('PUBLISHED');
    const restoredAvailability = await apiData(
      await request.get(`${apiBase}/workflow-runtime/${businessType}/start-availability`, { headers }),
      '重新发布后查询资产转移流程发起可用性',
    );
    expect(restoredAvailability.canStart).toBe(true);
    expect(restoredAvailability.status).toBe('PUBLISHED');
    expect(restoredAvailability.version).toBeGreaterThan(0);

    const approval = await apiData(await request.post(`${apiBase}/approvals`, {
      headers,
      data: {
        processType: businessType,
        businessType,
        businessId: 0,
        applicantId: auth.userId,
        title: `E2E资产转移审批-${suffix}`,
        description: JSON.stringify({ reason: '真实后端发布闭环', amount: '12', targetDeptId: 1 }),
        businessData: JSON.stringify({ reason: '真实后端发布闭环', amount: '12', targetDeptId: 1 }),
      },
    }), '发起资产转移流程审批');
    expect(approval.id).toBeTruthy();
    approvalId = approval.id;

    const detail = await apiData(await request.get(`${apiBase}/approvals/${approval.id}`, { headers }), '回读资产转移流程审批详情');
    expect(detail.process.id).toBe(approval.id);
    expect(detail.process.status).toBe('PENDING');
    expect(detail.process.currentStep).toBe(1);
    const runtimeApprovalNode = detail.workflowRuntimePath.find((node: any) => node.nodeId === 'approval-1');
    expect(runtimeApprovalNode).toBeTruthy();
    expect(runtimeApprovalNode.label).toBe('审批处理');
    expect(runtimeApprovalNode.approverRole).toBe('SUPER_ADMIN');

    await page.goto(`/approvals/${approval.id}`);
    await expect(page.locator('body')).not.toContainText(httpErrorPageText);
    await expect(page.getByText('运行态流程图').first()).toBeVisible({ timeout: 15_000 });
    const runtimeFlowChart = page.locator('section[aria-label="运行态流程图"]').first();
    await expect(runtimeFlowChart).toBeVisible({ timeout: 15_000 });
    await expect(runtimeFlowChart.getByText(/当前处理|待处理\/未到达/).first()).toBeVisible({ timeout: 15_000 });
    await expect(runtimeFlowChart.getByText(/审批处理|SUPER_ADMIN/).first()).toBeVisible({ timeout: 15_000 });
    const detailAssigneePreviewCard = page.getByLabel('运行页处理人计算/预览');
    await expect(detailAssigneePreviewCard).toBeVisible({ timeout: 15_000 });
    await expect(detailAssigneePreviewCard.getByRole('button', { name: /重新计算|计算处理人/ })).toBeVisible({ timeout: 15_000 });
    await expect(detailAssigneePreviewCard.getByText(/已解析 \d+ 名候选处理人|具体处理人名单已隐藏|处理人暂不可计算|处理人计算服务暂不可用|当前节点暂未返回可计算处理人/).first()).toBeVisible({ timeout: 15_000 });
    await expect(detailAssigneePreviewCard).not.toContainText(/assignees:/i);
    await expect(page.getByText('环节区段').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('申请信息').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(approvalSectionName).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('已完成').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('当前环节').first()).toBeVisible({ timeout: 15_000 });
    const currentWorkflowSection = page.getByText(approvalSectionName).locator('xpath=ancestor::details[1]');
    await expect(currentWorkflowSection.getByText('环节表单')).toBeVisible({ timeout: 15_000 });
    await expect(currentWorkflowSection.getByText('等待当前处理人处理')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).toContainText('真实后端发布闭环', { timeout: 15_000 });
    await expect(page.locator('body')).toContainText('12', { timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText(httpErrorPageText);

    await assertLocalApprovalFlowNodeState(page, {
      id: 910001,
      processStatus: 'REJECTED',
      expectedTestId: 'approval-flow-node-state-rejected-step-1',
      expectedStatusText: /异常\/驳回/,
    });
    await assertLocalApprovalFlowNodeState(page, {
      id: 910002,
      processStatus: 'CANCELLED',
      expectedTestId: 'approval-flow-node-state-cancelled-step-1',
      expectedStatusText: /已结束\/已取消/,
    });
    await assertLocalApprovalFlowNodeState(page, {
      id: 910003,
      processStatus: 'COMPLETED',
      expectedTestId: 'approval-flow-node-state-ended-step-1',
      expectedStatusText: /已结束/,
    });

    await page.goto('/audit');
    await expect(page.getByRole('heading', { name: /审计日志/ }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText(httpErrorPageText);
    await page.getByPlaceholder('搜索操作记录...').fill('流程发布');
    await expect(page.locator('table tbody').first()).toContainText('流程发布', { timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText(httpErrorPageText);

    await apiData(await request.put(`${apiBase}/workflows/${businessType}/draft`, {
      headers,
      data: {
        name: `E2E条件预览流程-${suffix}`,
        description: '真实后端E2E缺字段页面预览',
        definition: conditionPreviewDefinition(businessType, uiStartFormSource),
      },
    }), '保存缺少条件字段预览流程草稿');
    await page.goto(`/workflow-designer?businessType=${businessType}`);
    const missingPreviewPanel = page.getByLabel('处理人预览面板');
    await expect(missingPreviewPanel).toBeVisible({ timeout: 15_000 });
    await missingPreviewPanel.getByLabel('业务数据 JSON').fill(JSON.stringify({ reason: '缺少条件字段' }, null, 2));
    await missingPreviewPanel.getByRole('button', { name: /重新计算|计算处理人/ }).click();
    await expect(missingPreviewPanel.getByText('不可计算')).toBeVisible({ timeout: 15_000 });
    await expect(missingPreviewPanel.getByText(/缺少字段：.*申请金额|申请金额/).first()).toBeVisible({ timeout: 15_000 });
    await expect(missingPreviewPanel.getByText(/处理人名单已隐藏|补全条件字段/).first()).toBeVisible({ timeout: 15_000 });
    await expect(missingPreviewPanel).not.toContainText('SUPER_ADMIN');
    await expect(missingPreviewPanel).not.toContainText(/：\d+(?:、\d+)*/);

    let previewAuditLog: any;
    await expect.poll(async () => {
      const logs = pageRecords(await apiData(await request.get(`${apiBase}/audit-logs`, {
        headers,
        params: { keyword: '处理人预览', page: 0, size: 10 },
      }), '查询处理人预览审计日志'));
      previewAuditLog = logs.find((log) => auditText(log).includes('处理人预览'));
      return Boolean(previewAuditLog);
    }, {
      message: '应能通过审计 API 回查到处理人预览日志',
      timeout: 15_000,
    }).toBe(true);
  } finally {
    if (approvalId) {
      await request.post(`${apiBase}/approvals/${approvalId}/cancel`, { headers }).catch(() => undefined);
    }
    await restoreWorkflowDefinition(request, headers, businessType, originalWorkflow);
  }
});

test('真实后端：流程中心可回读版本历史并回滚发布快照', async ({ page, request }) => {
  await verifyBackendReady(request);

  const auth = await loginThroughRequest(request);
  const headers = authHeaders(auth.token);
  const suffix = Date.now().toString(36).toUpperCase();
  const businessType = 'ASSET_TRANSFER';
  const v1FormSource = `<form data-e2e="rollback-v1-${suffix}"><label>回滚前申请事由-${suffix}</label><input name="reason" /><label>回滚前申请金额-${suffix}</label><input name="amount" type="number" /></form>`;
  const v2FormSource = `<form data-e2e="rollback-v2-${suffix}"><label>变更后申请事由-${suffix}</label><input name="reason" /><label>变更后申请金额-${suffix}</label><input name="amount" type="number" /></form>`;
  const originalWorkflow = await apiData(await request.get(`${apiBase}/workflows/${businessType}`, { headers }), '备份资产转移流程定义');

  try {
    await apiData(await request.put(`${apiBase}/workflows/${businessType}/draft`, {
      headers,
      data: {
        name: `E2E流程中心回滚-${suffix}-v1`,
        description: '真实后端E2E流程中心版本历史回滚源版本',
        definition: customPublishDefinition(businessType, v1FormSource),
      },
    }), '保存流程中心回滚 v1 草稿');
    const publishedV1 = await apiData(await request.post(`${apiBase}/workflows/${businessType}/publish`, {
      headers,
      data: {
        publishNote: `E2E-v1发布说明-${suffix}`,
        impactScope: `E2E-v1影响范围-${suffix}`,
        rollbackPlan: `E2E-v1回滚预案-${suffix}`,
      },
    }), '发布流程中心回滚 v1');
    expect(workflowStatus(publishedV1)).toBe('PUBLISHED');
    const v1Version = Number(publishedV1.version);
    expect(v1Version).toBeGreaterThan(0);

    await apiData(await request.put(`${apiBase}/workflows/${businessType}/draft`, {
      headers,
      data: {
        name: `E2E流程中心回滚-${suffix}-v2`,
        description: '真实后端E2E流程中心版本历史回滚目标前置版本',
        definition: customPublishDefinition(businessType, v2FormSource),
      },
    }), '保存流程中心回滚 v2 草稿');
    const publishedV2 = await apiData(await request.post(`${apiBase}/workflows/${businessType}/publish`, {
      headers,
      data: {
        publishNote: `E2E-v2发布说明-${suffix}`,
        impactScope: `E2E-v2影响范围-${suffix}`,
        rollbackPlan: `E2E-v2回滚预案-${suffix}`,
      },
    }), '发布流程中心回滚 v2');
    expect(workflowStatus(publishedV2)).toBe('PUBLISHED');
    const v2Version = Number(publishedV2.version);
    expect(v2Version).toBeGreaterThan(v1Version);

    const versionsBefore = await apiData(await request.get(`${apiBase}/workflows/${businessType}/versions`, { headers }), '查询回滚前流程版本历史');
    expect(versionsBefore.some((version: any) => Number(version.version) === v1Version && version.actionType === 'PUBLISH')).toBe(true);
    expect(versionsBefore.some((version: any) => Number(version.version) === v2Version && version.actionType === 'PUBLISH')).toBe(true);

    const errors = collectBrowserErrors(page);
    await loginThroughApi(page, request);
    await page.goto('/workflows');
    await expect(page.getByRole('heading', { name: /业务流程列表|业务流程管理/ })).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder('搜索流程名称、编码、说明或业务对象').fill(businessType);
    await expect(page.getByRole('heading', { name: '资产转移流程' }).first()).toBeVisible({ timeout: 15_000 });

    const versionPanel = page.getByLabel('流程版本历史与回滚');
    await expect(versionPanel).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('发布快照').first()).toBeVisible({ timeout: 15_000 });
    await expect(versionPanel.getByRole('button', { name: `查看版本 v${v2Version} 正式发布` })).toBeVisible({ timeout: 15_000 });
    await expect(versionPanel.getByText(`E2E-v2发布说明-${suffix}`)).toBeVisible({ timeout: 15_000 });
    await versionPanel.getByRole('button', { name: `查看版本 v${v1Version} 正式发布` }).click();
    await expect(versionPanel.getByText('完整快照已回读，可核对节点模型。')).toBeVisible({ timeout: 15_000 });
    await expect(versionPanel.getByText(`E2E-v1发布说明-${suffix}`)).toBeVisible({ timeout: 15_000 });
    await expect(versionPanel.getByText(`E2E-v1影响范围-${suffix}`)).toBeVisible({ timeout: 15_000 });
    await expect(versionPanel.getByText(`E2E-v1回滚预案-${suffix}`)).toBeVisible({ timeout: 15_000 });

    await versionPanel.getByRole('button', { name: `回滚到版本 v${v1Version}` }).first().click();
    const rollbackDialog = page.getByRole('dialog', { name: '回滚流程版本' });
    await expect(rollbackDialog).toBeVisible({ timeout: 15_000 });
    await rollbackDialog.getByLabel('回滚原因').fill(`恢复v1-${suffix}`);
    await rollbackDialog.getByLabel('回滚后预案').fill(`回滚后观察-${suffix}`);
    await rollbackDialog.getByRole('button', { name: '确认回滚' }).click();
    await expect(page.getByText(/已回滚，当前版本 v/).first()).toBeVisible({ timeout: 15_000 });

    const currentAfterRollback = await apiData(await request.get(`${apiBase}/workflows/${businessType}`, { headers }), '回读流程中心回滚后定义');
    expect(workflowStatus(currentAfterRollback)).toBe('PUBLISHED');
    const rollbackVersion = Number(currentAfterRollback.version);
    expect(rollbackVersion).toBeGreaterThan(v2Version);
    const rollbackStartNode = currentAfterRollback.definition.nodes.find((node: any) => node.id === 'start-1');
    expect(rollbackStartNode.data.formSource).toBe(v1FormSource);

    const versionsAfter = await apiData(await request.get(`${apiBase}/workflows/${businessType}/versions`, { headers }), '查询回滚后流程版本历史');
    const rollbackSnapshot = versionsAfter.find((version: any) => (
      version.actionType === 'ROLLBACK'
      && Number(version.version) === rollbackVersion
      && Number(version.rollbackSourceVersion) === v1Version
    ));
    expect(rollbackSnapshot).toBeTruthy();
    expect(rollbackSnapshot.publishNote).toContain(`恢复v1-${suffix}`);
    expect(rollbackSnapshot.rollbackPlan).toContain(`回滚后观察-${suffix}`);

    await expect(versionPanel.getByText(`v${rollbackVersion} · 回滚发布`).first()).toBeVisible({ timeout: 15_000 });
    await expect(versionPanel.getByText(`源 v${v1Version}`).first()).toBeVisible({ timeout: 15_000 });

    await expect.poll(async () => {
      const logs = pageRecords(await apiData(await request.get(`${apiBase}/audit-logs`, {
        headers,
        params: { keyword: '流程回滚', page: 0, size: 10 },
      }), '查询流程回滚审计日志'));
      return logs.some((log) => isWorkflowRollbackAuditLog(log, businessType, v1Version));
    }, {
      message: '应能通过审计 API 回查到流程回滚日志和版本回滚 URI',
      timeout: 15_000,
    }).toBe(true);

    expect(errors).toEqual([]);
  } finally {
    await restoreWorkflowDefinition(request, headers, businessType, originalWorkflow);
  }
});

test('真实后端：资产转移四审批节点停在第 3 步可回看历史表单、意见和未来环节', async ({ page, request }) => {
  await verifyBackendReady(request);

  const auth = await loginThroughRequest(request);
  const headers = authHeaders(auth.token);
  const suffix = Date.now().toString(36).toUpperCase();
  const businessType = 'ASSET_TRANSFER';
  const formSource = `<form data-e2e="four-step-start-${suffix}"><label>四环节申请事由-${suffix}</label><input name="reason" /><label>四环节申请金额-${suffix}</label><input name="amount" type="number" /></form>`;
  const firstSectionName = `一级审批-${suffix}`;
  const secondSectionName = `二级审批-${suffix}`;
  const thirdSectionName = `三级审批-${suffix}`;
  const fourthSectionName = `四级审批-${suffix}`;
  const firstFieldLabel = `一级审批意见-${suffix}`;
  const secondFieldLabel = `二级审批意见-${suffix}`;
  const thirdFieldLabel = `三级审批意见-${suffix}`;
  const fourthFieldLabel = `四级审批意见-${suffix}`;
  const firstOpinion = `一级审批通过-${suffix}`;
  const secondOpinion = `二级审批通过-${suffix}`;
  const originalWorkflow = await apiData(await request.get(`${apiBase}/workflows/${businessType}`, { headers }), '备份资产转移流程定义');
  let approvalId: number | string | undefined;

  try {
    await apiData(await request.put(`${apiBase}/workflows/${businessType}/draft`, {
      headers,
      data: {
        name: `E2E资产转移四审批节点流程-${suffix}`,
        description: '真实后端E2E四审批节点停第三步运行态快照',
        definition: fourStepRuntimeDefinition(businessType, formSource, suffix),
      },
    }), '保存资产转移四审批节点流程草稿');
    const published = await apiData(await request.post(`${apiBase}/workflows/${businessType}/publish`, { headers }), '发布资产转移四审批节点流程');
    expect(workflowStatus(published)).toBe('PUBLISHED');

    const approval = await apiData(await request.post(`${apiBase}/approvals`, {
      headers,
      data: {
        processType: businessType,
        businessType,
        businessId: 0,
        applicantId: auth.userId,
        title: `E2E资产转移四审批节点审批-${suffix}`,
        description: JSON.stringify({ reason: `四环节运行态-${suffix}`, amount: '3300', targetDeptId: 1 }),
        businessData: JSON.stringify({ reason: `四环节运行态-${suffix}`, amount: '3300', targetDeptId: 1 }),
      },
    }), '发起资产转移四审批节点审批');
    expect(approval.id).toBeTruthy();
    approvalId = approval.id;

    const firstApproval = await apiData(await request.post(`${apiBase}/approvals/${approval.id}/approve`, {
      headers,
      data: { result: 'APPROVED', opinion: firstOpinion },
    }), '通过资产转移四审批节点第 1 步');
    expect(firstApproval.currentStep).toBe(2);
    const secondApproval = await apiData(await request.post(`${apiBase}/approvals/${approval.id}/approve`, {
      headers,
      data: { result: 'APPROVED', opinion: secondOpinion },
    }), '通过资产转移四审批节点第 2 步');
    expect(secondApproval.currentStep).toBe(3);
    expect(secondApproval.status).toBe('PENDING');

    await expect.poll(async () => {
      const logs = pageRecords(await apiData(await request.get(`${apiBase}/audit-logs`, {
        headers,
        params: { keyword: '审批通过', page: 0, size: 10 },
      }), '查询资产转移审批通过审计日志'));
      return logs.filter((log) => {
        const text = auditText(log);
        return text.includes('审批通过') && text.includes(`/approvals/${approval.id}/approve`);
      }).length;
    }, {
      message: '应能通过审计 API 回查到两次审批通过日志和请求 URI',
      timeout: 15_000,
    }).toBeGreaterThanOrEqual(2);

    const detail = await apiData(await request.get(`${apiBase}/approvals/${approval.id}`, { headers }), '回读资产转移四审批节点审批详情');
    expect(detail.process.currentStep).toBe(3);
    expect(detail.process.status).toBe('PENDING');
    expect(Array.isArray(detail.workflowRuntimePath)).toBe(true);
    expect(detail.workflowRuntimePath.filter((node: any) => String(node.nodeId).startsWith('approval-')).length).toBeGreaterThanOrEqual(4);
    expect(detail.workflowRuntimePath.map((node: any) => node.nodeId)).toEqual(expect.arrayContaining(['approval-1', 'approval-2', 'approval-3', 'approval-4']));
    expect(detail.records.map((record: any) => record.stepNo)).toEqual(expect.arrayContaining([1, 2]));
    expect(detail.records.some((record: any) => record.stepNo === 1 && record.approveOpinion === firstOpinion)).toBe(true);
    expect(detail.records.some((record: any) => record.stepNo === 2 && record.approveOpinion === secondOpinion)).toBe(true);

    await loginThroughApi(page, request);
    await page.goto(`/approvals/${approval.id}`);
    await expect(page.locator('body')).not.toContainText(httpErrorPageText);
    await expect(page.getByText('环节区段').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('运行态流程图').first()).toBeVisible({ timeout: 15_000 });
    const runtimeFlowChart = page.locator('section[aria-label="运行态流程图"]').first();
    await expect(runtimeFlowChart).toBeVisible({ timeout: 15_000 });
    await expect(runtimeFlowChart.getByTestId('approval-flow-node-state-completed-step-1')).toBeVisible({ timeout: 15_000 });
    await expect(runtimeFlowChart.getByTestId('approval-flow-node-state-completed-step-2')).toBeVisible({ timeout: 15_000 });
    await expect(runtimeFlowChart.getByTestId('approval-flow-node-state-current-step-3')).toBeVisible({ timeout: 15_000 });
    await expect(runtimeFlowChart.getByTestId('approval-flow-node-state-upcoming-step-4')).toBeVisible({ timeout: 15_000 });
    await runtimeFlowChart.getByTestId('approval-flow-node-state-current-step-3').click();
    const runtimeSummaryPanel = runtimeFlowChart.getByTestId('approval-flow-step-summary');
    await expect(runtimeSummaryPanel).toContainText('三级审批', { timeout: 15_000 });
    await expect(runtimeSummaryPanel).toContainText('当前处理');
    await expect(runtimeSummaryPanel).toContainText('第 3 步');
    await expect(runtimeSummaryPanel.locator('a[href="#workflow-section-approval-3"]')).toContainText('三级审批');
    await runtimeFlowChart.getByTestId('approval-flow-node-state-upcoming-step-4').click();
    await expect(runtimeSummaryPanel).toContainText('四级审批', { timeout: 15_000 });
    await expect(runtimeSummaryPanel).toContainText('待处理/未到达');
    await expect(runtimeSummaryPanel).toContainText('待流转后确认');
    await expect(runtimeSummaryPanel.locator('a[href="#workflow-section-approval-4"]')).toContainText('四级审批');
    await expect(runtimeSummaryPanel).not.toContainText('指定用户 #');

    const firstSection = page.getByText(firstSectionName).locator('xpath=ancestor::details[1]');
    const secondSection = page.getByText(secondSectionName).locator('xpath=ancestor::details[1]');
    const thirdSection = page.getByText(thirdSectionName).locator('xpath=ancestor::details[1]');
    const fourthSection = page.getByText(fourthSectionName).locator('xpath=ancestor::details[1]');

    await expect(firstSection.getByText('已完成')).toBeVisible({ timeout: 15_000 });
    await expect(secondSection.getByText('已完成')).toBeVisible({ timeout: 15_000 });
    await expect(firstSection.getByText(firstFieldLabel)).not.toBeVisible();
    await expect(secondSection.getByText(secondFieldLabel)).not.toBeVisible();
    await firstSection.locator('summary').click();
    await expect(firstSection.getByText(firstFieldLabel)).toBeVisible({ timeout: 15_000 });
    await expect(firstSection.getByText(firstOpinion).first()).toBeVisible({ timeout: 15_000 });
    await secondSection.locator('summary').click();
    await expect(secondSection.getByText(secondFieldLabel)).toBeVisible({ timeout: 15_000 });
    await expect(secondSection.getByText(secondOpinion).first()).toBeVisible({ timeout: 15_000 });

    await expect(thirdSection.getByText('当前环节')).toBeVisible({ timeout: 15_000 });
    await expect(thirdSection.getByText(thirdFieldLabel)).toBeVisible({ timeout: 15_000 });
    await expect(thirdSection.getByText('等待当前处理人处理')).toBeVisible({ timeout: 15_000 });
    const fourthSummary = fourthSection.locator('summary');
    await expect(fourthSummary).toContainText('待流转', { timeout: 15_000 });
    await expect(fourthSummary).toContainText('未到达', { timeout: 15_000 });
    await expect(fourthSection.getByText(fourthFieldLabel)).not.toBeVisible();
    await fourthSection.locator('summary').click();
    await expect(fourthSection.getByText('到达该环节后加载')).toBeVisible({ timeout: 15_000 });
    await expect(fourthSection.getByText('尚未生成审批记录')).toBeVisible({ timeout: 15_000 });
    await expect(fourthSection.getByText(fourthFieldLabel)).not.toBeVisible();
    await expect(page.locator('body')).not.toContainText(httpErrorPageText);
  } finally {
    if (approvalId) {
      await request.post(`${apiBase}/approvals/${approvalId}/cancel`, { headers }).catch(() => undefined);
    }
    await restoreWorkflowDefinition(request, headers, businessType, originalWorkflow);
  }
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
  await expect(page.getByRole('heading', { name: /仪表板|仪表板与数据分析|运营首页/ })).toBeVisible({ timeout: 15_000 });

  const legacyAssetNav = page.getByRole('link', { name: '资产台账' }).first();
  if (await legacyAssetNav.count() === 0) {
    const menu = page.getByLabel('工作台菜单');
    await expect(menu).toBeVisible({ timeout: 15_000 });

    const workbenchItems = [
      { name: '资产总览', heading: '资产总览', region: '资产总览产品页主体' },
      { name: '流程待办', heading: '流程待办', region: '流程待办产品页主体' },
      { name: '报表分析', heading: '报表分析', region: '报表分析产品页主体' },
    ];

    for (const item of workbenchItems) {
      await menu.getByRole('button', { name: item.name, exact: true }).click();
      await expect(page.getByRole('heading', { name: item.heading }).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByLabel(item.region)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/加载数据失败/)).toHaveCount(0);
    }

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
    return;
  }

  const navItems = [
    { name: '资产台账', heading: /资产台账|资产台账管理/ },
    { name: '重要设备', heading: '重要设备管理' },
    { name: /RFID\s*盘点/, heading: /资产盘点管理|盘点管理/ },
    { name: '闲置资产', heading: '闲置资产管理' },
    { name: '资产处置', heading: '资产处置管理' },
    { name: '审批流程', heading: /审批列表|审批中心/ },
    { name: /流程管理|工作流/, heading: /业务流程列表|业务流程管理/ },
    { name: /报表中心|报表/, heading: /报表中心/ },
    { name: /数据分析|仪表板/, heading: /数据分析|仪表板与数据分析|运营首页/ },
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

test('真实后端：工单审批金线 DRAFT 到 APPROVED 可跑通', async ({ page, request }) => {
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
  expect(workOrderDetail.status).toBe('DRAFT');
  expect(workOrderDetail.assetId).toBe(workOrderAsset.id);

  const submittedWorkOrder = await apiData(await request.post(`${apiBase}/workorders/${workOrder.id}/submit`, { headers }), '提交维修工单');
  expect(submittedWorkOrder.status).toBe('PENDING');
  const approvedWorkOrder = await apiData(await request.post(`${apiBase}/workorders/${workOrder.id}/approve`, {
    headers,
    data: { comment: '真实E2E审批通过' },
  }), '审批维修工单');
  expect(approvedWorkOrder.status).toBe('APPROVED');
  const finalWorkOrderDetail = await apiData(await request.get(`${apiBase}/workorders/${workOrder.id}`, { headers }), '回读审批后工单详情');
  expect(finalWorkOrderDetail.id).toBe(workOrder.id);
  expect(finalWorkOrderDetail.status).toBe('APPROVED');

  await expect.poll(async () => {
    const logs = pageRecords(await apiData(await request.get(`${apiBase}/audit-logs`, {
      headers,
      params: { keyword: '工单提交', page: 0, size: 10 },
    }), '查询工单提交审计日志'));
    return logs.some((log) => {
      const text = auditText(log);
      return text.includes('工单提交') && text.includes(`/workorders/${workOrder.id}/submit`);
    });
  }, {
    message: '应能通过审计 API 回查到工单提交日志和请求 URI',
    timeout: 15_000,
  }).toBe(true);

  await expect.poll(async () => {
    const logs = pageRecords(await apiData(await request.get(`${apiBase}/audit-logs`, {
      headers,
      params: { keyword: '工单审批通过', page: 0, size: 10 },
    }), '查询工单审批通过审计日志'));
    return logs.some((log) => {
      const text = auditText(log);
      return text.includes('工单审批通过') && text.includes(`/workorders/${workOrder.id}/approve`);
    });
  }, {
    message: '应能通过审计 API 回查到工单审批通过日志和请求 URI',
    timeout: 15_000,
  }).toBe(true);

  const errors = collectBrowserErrors(page);
  await loginThroughApi(page, request);
  await page.goto(`/workorders/${workOrder.id}`);
  await expect(page.locator('body')).not.toContainText(httpErrorPageText);
  await expect(page.getByText(workOrder.title).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/已批准|APPROVED/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('真实后端API闭环测试自动创建').first()).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
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
  await expect(page.locator('body')).not.toContainText(httpErrorPageText);

  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: /报表中心/ }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('body')).not.toContainText(httpErrorPageText);

  expect(errors).toEqual([]);
});

test('真实后端：折旧计算与审计查询 API 和页面可用', async ({ page, request }) => {
  await verifyBackendReady(request);

  const auth = await loginThroughRequest(request);
  const headers = authHeaders(auth.token);
  const suffix = Date.now().toString(36);

  const depreciationAsset = await createAsset(request, headers, {
    code: `E2E-DEP-${suffix}`,
    name: `真实E2E折旧资产-${suffix}`,
    status: 'IN_USE',
    originalValue: 1200,
    currentValue: 1200,
    depreciationRate: 0.12,
    depreciationMethod: 'STRAIGHT_LINE',
  });
  const depreciationAssetNo = depreciationAsset.assetNo ?? depreciationAsset.code;

  const methods = await apiData(await request.get(`${apiBase}/depreciation/methods`, { headers }), '查询折旧方法');
  expect(methods.some((method) => method.code === 'STRAIGHT_LINE')).toBe(true);

  const schedulePage = await apiData(await request.get(`${apiBase}/depreciation/schedules`, {
    headers,
    params: { assetNo: depreciationAssetNo, page: 1, size: 10 },
  }), '查询折旧计划');
  expect(schedulePage.data.some((item) => item.assetId === depreciationAsset.id)).toBe(true);

  const calculation = await apiData(await request.post(`${apiBase}/depreciation/calculate`, {
    headers,
    data: { assetIds: [depreciationAsset.id] },
  }), '执行折旧计算');
  expect(calculation.processedCount).toBe(1);

  const records = await apiData(await request.get(`${apiBase}/depreciation/records`, {
    headers,
    params: { assetId: depreciationAsset.id, page: 1, size: 10 },
  }), '查询折旧记录');
  const depreciationRecords = pageRecords(records);
  expect(depreciationRecords.some((record) => record.assetId === depreciationAsset.id && Number(record.depreciationAmount) > 0)).toBe(true);

  const assetAfterDepreciation = await apiData(await request.get(`${apiBase}/assets/${depreciationAsset.id}`, { headers }), '查询折旧后资产详情');
  expect(Number(assetAfterDepreciation.currentValue)).toBeLessThan(Number(depreciationAsset.currentValue ?? 1200));

  const auditLogs = await apiData(await request.get(`${apiBase}/audit-logs`, {
    headers,
    params: { page: 0, size: 5 },
  }), '查询审计日志列表');
  expect(Array.isArray(pageRecords(auditLogs)), '审计日志应返回分页记录或数组').toBe(true);
  const assetCreateLogs = pageRecords(await apiData(await request.get(`${apiBase}/audit-logs`, {
    headers,
    params: { keyword: '资产新增', page: 0, size: 10 },
  }), '查询资产新增操作日志'));
  expect(assetCreateLogs.some((log) => log.action === '资产新增' && log.operationType === 'INSERT')).toBe(true);
  const depreciationCalculateLogs = pageRecords(await apiData(await request.get(`${apiBase}/audit-logs`, {
    headers,
    params: { keyword: '折旧计算', page: 0, size: 10 },
  }), '查询折旧计算操作日志'));
  expect(depreciationCalculateLogs.some((log) => log.action === '折旧计算' && log.operationType === 'UPDATE')).toBe(true);
  const auditStats = await apiData(await request.get(`${apiBase}/audit-logs/stats`, { headers }), '查询审计统计');
  expect(Array.isArray(auditStats.trendData), '审计统计应返回趋势数组').toBe(true);

  const errors = collectBrowserErrors(page);
  await loginThroughApi(page, request);

  await page.goto('/depreciation');
  await expect(page.getByRole('heading', { name: /折旧管理/ }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('body')).not.toContainText(httpErrorPageText);

  await page.goto('/audit');
  await expect(page.getByRole('heading', { name: /审计日志/ }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('body')).not.toContainText(httpErrorPageText);

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

async function assertLocalApprovalFlowNodeState(
  page: Page,
  options: {
    id: number;
    processStatus: string;
    expectedTestId: string;
    expectedStatusText: RegExp;
  },
) {
  const routePattern = `**/api/approvals/${options.id}`;
  await page.route(routePattern, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        data: {
          process: {
            id: options.id,
            processNo: `LOCAL-${options.processStatus}-${options.id}`,
            processType: 'ASSET_TRANSFER',
            businessType: 'ASSET_TRANSFER',
            businessId: 0,
            businessData: JSON.stringify({ reason: '局部流程图状态断言', amount: 12 }),
            applicantId: 1,
            status: options.processStatus,
            currentStep: 1,
            createTime: '2026-06-28T00:00:00',
          },
          records: [],
          workflowRuntimePath: [
            {
              stepNo: 1,
              nodeId: 'approval-local-1',
              nodeCode: 'APP_LOCAL_1',
              label: '局部审批节点',
              approverType: 'role',
              approverRole: 'SUPER_ADMIN',
              approvalMode: 'sequence',
            },
            {
              stepNo: 2,
              nodeId: 'approval-local-2',
              nodeCode: 'APP_LOCAL_2',
              label: '局部后续节点',
              approverType: 'role',
              approverRole: 'SUPER_ADMIN',
              approvalMode: 'sequence',
            },
          ],
        },
      }),
    });
  });

  try {
    await page.goto(`/approvals/${options.id}`);
    await expect(page.locator('body')).not.toContainText(httpErrorPageText);
    const flowChart = page.locator('section[aria-label="运行态流程图"]').first();
    await expect(flowChart).toBeVisible({ timeout: 15_000 });
    await expect(flowChart.getByTestId(options.expectedTestId)).toBeVisible({ timeout: 15_000 });
    await flowChart.getByTestId(options.expectedTestId).click();
    await expect(flowChart.getByTestId('approval-flow-summary-state')).toContainText(options.expectedStatusText, { timeout: 15_000 });
  } finally {
    await page.unroute(routePattern);
  }
}

async function createAsset(request: APIRequestContext, headers: Record<string, string>, asset: {
  code: string;
  name: string;
  status: string;
  originalValue?: number;
  currentValue?: number;
  depreciationRate?: number;
  depreciationMethod?: string;
}) {
  return apiData(await request.post(`${apiBase}/assets`, {
    headers,
    data: {
      code: asset.code,
      name: asset.name,
      categoryId: 1,
      deptId: 1,
      originalValue: asset.originalValue ?? 1000,
      currentValue: asset.currentValue ?? 1000,
      purchaseDate: '2026-01-01',
      location: 'E2E测试库位',
      status: asset.status,
      depreciationRate: asset.depreciationRate,
      depreciationMethod: asset.depreciationMethod,
    },
  }), `创建真实资产 ${asset.code}`);
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function restoreWorkflowDefinition(
  request: APIRequestContext,
  headers: Record<string, string>,
  businessType: string,
  originalWorkflow: any,
) {
  const originalStatus = workflowStatus(originalWorkflow);

  if (originalStatus === 'UNCONFIGURED') {
    await request.post(`${apiBase}/workflows/${businessType}/status`, { headers, data: { status: 'DISABLED' } }).catch(() => undefined);
    await request.delete(`${apiBase}/workflows/${businessType}`, { headers }).catch(() => undefined);
    return;
  }

  await saveWorkflowDraftSnapshot(request, headers, businessType, originalWorkflow);

  if (originalStatus === 'PUBLISHED') {
    await apiData(await request.post(`${apiBase}/workflows/${businessType}/publish`, { headers }), '恢复发布前资产转移流程');
    return;
  }

  if (originalStatus === 'DISABLED') {
    await apiData(await request.post(`${apiBase}/workflows/${businessType}/publish`, { headers }), '恢复禁用前资产转移流程发布态')
      .catch(() => undefined);
    await apiData(await request.post(`${apiBase}/workflows/${businessType}/status`, {
      headers,
      data: { status: 'DISABLED' },
    }), '恢复资产转移流程禁用状态');
  }
}

async function saveWorkflowDraftSnapshot(
  request: APIRequestContext,
  headers: Record<string, string>,
  businessType: string,
  workflow: any,
) {
  await apiData(await request.put(`${apiBase}/workflows/${businessType}/draft`, {
    headers,
    data: {
      name: workflow.name,
      description: workflow.description ?? '',
      definition: restoreableWorkflowDefinition(workflow, businessType),
    },
  }), '恢复资产转移流程草稿');
}

function workflowStatus(workflow: any): string {
  return String(workflow?.status ?? '').toUpperCase();
}

function restoreableWorkflowDefinition(workflow: any, businessType: string) {
  const definition = workflow.definition ?? {};
  return {
    ...definition,
    businessType: definition.businessType ?? businessType,
    nodes: Array.isArray(definition.nodes) ? definition.nodes.map((node: any) => {
      if (node?.type !== 'start' && node?.type !== 'approval') {
        return node;
      }
      const data = node.data ?? {};
      return {
        ...node,
        data: {
          ...data,
          formSource: restoreableFormSource(data.formSource),
          formSectionName: typeof data.formSectionName === 'string' ? data.formSectionName : '',
          formSummaryFields: typeof data.formSummaryFields === 'string' ? data.formSummaryFields : '',
        },
      };
    }) : [],
    edges: Array.isArray(definition.edges) ? definition.edges : [],
  };
}

function restoreableFormSource(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return '<form></form>';
}

function customPublishDefinition(businessType: string, formSource: string) {
  return {
    id: `WF-${businessType}`,
    name: 'E2E发布流程',
    description: '真实后端E2E发布节点表单回读',
    businessType,
    formSource,
    nodes: [
      workflowNode('start-1', 'start', 320, 40, {
        label: '提交申请',
        description: '业务表单提交后进入审批流程',
        nodeCode: 'START_1',
        triggerType: '表单提交',
        formSource,
        formSectionName: '申请信息',
        formSummaryFields: 'reason,amount',
      }),
      workflowNode('approval-1', 'approval', 320, 190, {
        label: '审批处理',
        description: '由超级管理员审批',
        nodeCode: 'APPROVAL_1',
        approverType: 'role',
        approverRole: 'SUPER_ADMIN',
        approvalMode: 'sequence',
        formSource: '<form><label>审批意见</label><textarea name="approvalComment"></textarea></form>',
        formSectionName: '审批意见',
        formSummaryFields: 'approvalComment,approvalResult',
      }),
      workflowNode('end-1', 'end', 320, 340, {
        label: '流程结束',
        description: '审批通过后归档',
        nodeCode: 'END_1',
        resultAction: '审批完成并同步业务状态',
      }),
    ],
    edges: [
      workflowEdge('edge-start-approval', 'start-1', 'approval-1'),
      workflowEdge('edge-approval-end', 'approval-1', 'end-1'),
    ],
  };
}

function fourStepRuntimeDefinition(businessType: string, formSource: string, suffix: string) {
  return {
    id: `WF-${businessType}`,
    name: 'E2E四审批节点运行态流程',
    description: '真实后端E2E四审批节点停第三步运行态快照',
    businessType,
    formSource,
    nodes: [
      workflowNode('start-1', 'start', 320, 40, {
        label: '提交申请',
        description: '业务表单提交后进入审批流程',
        nodeCode: 'START_1',
        triggerType: '表单提交',
        formSource,
        formSectionName: '申请信息',
        formSummaryFields: 'reason,amount',
      }),
      workflowNode('approval-1', 'approval', 200, 190, runtimeApprovalNodeData(1, suffix)),
      workflowNode('approval-2', 'approval', 320, 340, runtimeApprovalNodeData(2, suffix)),
      workflowNode('approval-3', 'approval', 440, 490, runtimeApprovalNodeData(3, suffix)),
      workflowNode('approval-4', 'approval', 560, 640, runtimeApprovalNodeData(4, suffix)),
      workflowNode('end-1', 'end', 560, 790, {
        label: '流程结束',
        description: '审批通过后归档',
        nodeCode: 'END_1',
        resultAction: '审批完成并同步业务状态',
      }),
    ],
    edges: [
      workflowEdge('edge-start-approval-1', 'start-1', 'approval-1'),
      workflowEdge('edge-approval-1-approval-2', 'approval-1', 'approval-2'),
      workflowEdge('edge-approval-2-approval-3', 'approval-2', 'approval-3'),
      workflowEdge('edge-approval-3-approval-4', 'approval-3', 'approval-4'),
      workflowEdge('edge-approval-4-end', 'approval-4', 'end-1'),
    ],
  };
}

function runtimeApprovalNodeData(step: number, suffix: string) {
  const labels: Record<number, string> = { 1: '一级', 2: '二级', 3: '三级', 4: '四级' };
  const label = labels[step] ?? `第${step}级`;
  return {
    label: `${label}审批`,
    description: `${label}审批由超级管理员审批`,
    nodeCode: `APPROVAL_${step}`,
    approverType: 'role',
    approverRole: 'SUPER_ADMIN',
    approvalMode: 'sequence',
    formSource: `<form data-e2e="approval-${step}-${suffix}"><label>${label}审批意见-${suffix}</label><textarea name="approvalComment"></textarea><label>${label}审批结论-${suffix}</label><input name="approvalResult" /></form>`,
    formSectionName: `${label}审批-${suffix}`,
    formSummaryFields: 'approvalComment,approvalResult',
  };
}

function conditionPreviewDefinition(businessType: string, formSource: string) {
  return {
    id: `WF-${businessType}`,
    name: 'E2E条件预览流程',
    description: '缺少业务字段时不得展示处理人',
    businessType,
    formSource,
    nodes: [
      workflowNode('start-1', 'start', 320, 40, {
        label: '提交申请',
        description: '业务表单提交后进入审批流程',
        nodeCode: 'START_1',
        triggerType: '表单提交',
        formSource,
        formSectionName: '申请信息',
        formSummaryFields: 'reason,amount',
      }),
      workflowNode('condition-1', 'condition', 320, 190, {
        label: '金额判断',
        description: '申请金额决定审批路径',
        nodeCode: 'COND_AMOUNT',
        conditionExpression: '申请金额 >= 5000',
        trueLabel: '大额',
        falseLabel: '常规',
      }),
      workflowNode('approval-1', 'approval', 220, 340, {
        label: '高额审批',
        description: '由超级管理员审批',
        nodeCode: 'APPROVAL_1',
        approverType: 'role',
        approverRole: 'SUPER_ADMIN',
        approvalMode: 'sequence',
        formSource: '<form><label>审批意见</label><textarea name="approvalComment"></textarea></form>',
        formSectionName: '审批意见',
        formSummaryFields: 'approvalComment,approvalResult',
      }),
      workflowNode('end-1', 'end', 420, 340, {
        label: '流程结束',
        description: '审批完成后归档',
        nodeCode: 'END_1',
        resultAction: '审批完成并同步业务状态',
      }),
    ],
    edges: [
      workflowEdge('edge-start-condition', 'start-1', 'condition-1'),
      workflowConditionEdge('edge-condition-true', 'condition-1', 'approval-1', 'condition-true', '大额'),
      workflowConditionEdge('edge-condition-false', 'condition-1', 'end-1', 'condition-false', '常规'),
      workflowEdge('edge-approval-end', 'approval-1', 'end-1'),
    ],
  };
}

function workflowNode(id: string, type: string, x: number, y: number, patch: Record<string, unknown>) {
  return {
    id,
    type,
    position: { x, y },
    data: {
      type,
      label: '',
      description: '',
      nodeCode: '',
      triggerType: '',
      approverType: type === 'approval' ? 'role' : '',
      approverRole: '',
      approverRoleName: '',
      approverId: '',
      approvalMode: 'sequence',
      conditionExpression: '',
      trueLabel: '',
      falseLabel: '',
      resultAction: '',
      formSource: '',
      formSectionName: '',
      formSummaryFields: '',
      ...patch,
    },
  };
}

function workflowEdge(id: string, source: string, target: string) {
  return {
    id,
    source,
    target,
    sourceHandle: null,
    targetHandle: null,
    type: 'smoothstep',
    animated: true,
    label: null,
    markerEnd: { type: 'arrowclosed', color: 'var(--color-primary)' },
    style: { stroke: 'var(--color-primary)', strokeWidth: 2 },
    labelStyle: { fill: 'var(--color-foreground)', fontSize: 12, fontWeight: 600 },
    labelBgStyle: { fill: 'var(--workflow-surface)', fillOpacity: 1 },
  };
}

function workflowConditionEdge(id: string, source: string, target: string, sourceHandle: string, label: string) {
  return {
    ...workflowEdge(id, source, target),
    sourceHandle,
    targetHandle: 'target-main',
    animated: false,
    label,
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

function auditText(log: any): string {
  return [
    log?.requestUri,
    log?.resourceId,
    log?.detail,
    log?.details,
    log?.description,
    log?.action,
    log?.operationType,
    log?.resourceType,
    log?.raw,
  ]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
    .join('\n');
}

function isWorkflowPublishAuditLog(log: any, businessType: string): boolean {
  const text = auditText(log);
  return text.includes('流程发布') && new RegExp(`${businessType}|/workflows/.*/publish|workflows.*publish`, 'i').test(text);
}

function isWorkflowRollbackAuditLog(log: any, businessType: string, targetVersion: number): boolean {
  const text = auditText(log);
  return text.includes('流程回滚')
    && new RegExp(`${businessType}|/workflows/.*/versions/${targetVersion}/rollback|workflows.*versions.*rollback`, 'i').test(text);
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
