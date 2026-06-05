/**
 * SWARM-070 E2E 认证初始化
 *
 * 登录三类角色（admin、approver、operator），并把浏览器 storage state
 * 保存到磁盘，供下游规格文件复用。
 *
 * AUTH-001: admin 登录 → admin-storage.json
 * AUTH-002: approver 登录 → approver-storage.json
 * AUTH-003: operator 登录 → operator-storage.json
 * AUTH-004: 验证 storageState 包含可复用的 localStorage 认证态
 */

import { test as setup, expect } from '@playwright/test';
import type { APIRequestContext, APIResponse, Page } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// 角色凭据
// ---------------------------------------------------------------------------

function e2eCredential(roleName: string, fieldName: 'USERNAME' | 'PASSWORD', fallback: string) {
  return process.env[`AMS_E2E_${roleName.toUpperCase()}_${fieldName}`] || fallback;
}

const roles = [
  {
    name: 'admin',
    username: e2eCredential('admin', 'USERNAME', 'admin'),
    password: e2eCredential('admin', 'PASSWORD', 'admin123'),
    defaultPassword: 'admin123',
    storagePath: '.auth/admin-storage.json',
  },
  {
    name: 'approver',
    username: e2eCredential('approver', 'USERNAME', 'approver'),
    password: e2eCredential('approver', 'PASSWORD', 'approver123'),
    defaultPassword: 'approver123',
    storagePath: '.auth/approver-storage.json',
  },
  {
    name: 'operator',
    username: e2eCredential('operator', 'USERNAME', 'operator'),
    password: e2eCredential('operator', 'PASSWORD', 'operator123'),
    defaultPassword: 'operator123',
    storagePath: '.auth/operator-storage.json',
  },
] as const;

const storageOrigin = new URL(process.env.E2E_BASE_URL || 'http://127.0.0.1:5173').origin;
const storageRoot = resolve(process.cwd(), '.auth');

function storageFilePath(storagePath: string) {
  return resolve(storageRoot, storagePath.replace(/^\.auth\//, ''));
}

type RoleConfig = (typeof roles)[number];
type RoleName = RoleConfig['name'];

type UserInfo = {
  userId: unknown;
  username: unknown;
  realName: unknown;
  roles: unknown;
  permissions: unknown;
};

type StorageEntry = { name: string; value: string };
type StorageOriginState = { origin: string; localStorage?: StorageEntry[] };
type StorageState = { origins?: StorageOriginState[] };

type JsonObject = Record<string, any>;

function summarizeApiFailure(context: string, response: APIResponse, body: JsonObject, text: string) {
  const code = body.code ?? '无';
  const message = body.message ?? body.msg ?? '无';
  return `${context} 失败：HTTP ${response.status()}，业务码 ${code}，消息 ${message}，响应片段：${redactAuthText(text).slice(0, 800)}`;
}

async function readApiJson(response: APIResponse, context: string) {
  const text = await response.text();
  let body: JsonObject;

  try {
    body = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`${context} 失败：响应不是合法 JSON。HTTP ${response.status()}，响应体：${redactAuthText(text)}，原始错误：${String(error)}`);
  }

  expect(response.ok(), summarizeApiFailure(context, response, body, text)).toBe(true);
  expect(body.code ?? 200, summarizeApiFailure(context, response, body, text)).toBe(200);

  return body.data ?? body;
}

async function loginByRequest(request: APIRequestContext, username: string, password: string, context: string) {
  const response = await request.post('/api/auth/login', {
    data: { username, password },
  });
  return readApiJson(response, context);
}

function e2eRoleProfile(role: RoleConfig) {
  return {
    realName: role.name === 'approver' ? 'E2E审批员' : 'E2E执行员',
    email: `${role.username}@e2e.local`,
    phone: role.name === 'approver' ? '13800138002' : '13800138003',
    deptId: 1,
    status: 1,
    roleIds: [1],
  };
}

function normalizeRoleIds(detail: JsonObject) {
  if (Array.isArray(detail?.roleIds)) {
    return detail.roleIds.map((item) => Number(item));
  }

  if (Array.isArray(detail?.roles)) {
    return detail.roles.map((item: JsonObject) => Number(item?.id)).filter((id: number) => Number.isFinite(id));
  }

  return [];
}

async function ensureE2eRoleUser(request: APIRequestContext, role: RoleConfig) {
  if (role.name === 'admin') {
    return role.password;
  }

  // 使用真实管理接口准备测试账号，避免在 e2e-setup 中伪造 storageState 或复用 admin 身份。
  const adminRole = roles.find((item) => item.name === 'admin');
  const adminLogin = await loginByRequest(
    request,
    adminRole?.username ?? 'admin',
    adminRole?.password ?? 'admin123',
    `准备角色 ${role.name} 前的 admin 登录`,
  );
  const adminToken = pickToken(adminLogin, adminLogin, adminLogin);
  expect(adminToken, `准备角色 ${role.name} 失败：admin 登录响应缺少 token`).toBeTruthy();

  const headers = { Authorization: `Bearer ${adminToken}` };
  const listData = await readApiJson(
    await request.get('/api/user-management/list', {
      headers,
      params: { page: 1, pageSize: 10, keyword: role.username },
    }),
    `查询角色 ${role.name} 测试账号 username=${role.username}`,
  );
  const records = Array.isArray(listData?.records) ? listData.records : [];
  const existing = records.find((item: JsonObject) => item?.username === role.username);
  const profile = e2eRoleProfile(role);

  if (existing?.id) {
    const detail = await readApiJson(
      await request.get(`/api/user-management/${existing.id}/detail`, { headers }),
      `读取角色 ${role.name} 测试账号详情 userId=${existing.id}`,
    );
    const roleIds = normalizeRoleIds(detail);
    const needsRepair = Number(detail?.deptId ?? existing?.deptId) !== profile.deptId
      || Number(detail?.status ?? existing?.status) !== profile.status
      || !roleIds.includes(1);

    if (needsRepair) {
      await readApiJson(
        await request.put(`/api/user-management/${existing.id}`, {
          headers,
          data: {
            realName: detail?.realName ?? existing?.realName ?? profile.realName,
            email: detail?.email ?? existing?.email ?? profile.email,
            phone: detail?.phone ?? existing?.phone ?? profile.phone,
            deptId: profile.deptId,
            status: profile.status,
            roleIds: profile.roleIds,
          },
        }),
        `修复角色 ${role.name} 测试账号资料 userId=${existing.id} deptId/status/roleIds`,
      );
    }

    if (role.password === role.defaultPassword) {
      await readApiJson(
        await request.put(`/api/user-management/${existing.id}/reset-password`, { headers }),
        `重置角色 ${role.name} 测试账号密码 userId=${existing.id}`,
      );
      return '123456';
    }

    return role.password;
  }

  await readApiJson(
    await request.post('/api/user-management', {
      headers,
      data: {
        username: role.username,
        password: role.password,
        ...profile,
      },
    }),
    `创建角色 ${role.name} 测试账号 username=${role.username}`,
  );

  return role.password;
}

async function fillLoginField(
  page: Page,
  label: string,
  fallbackSelector: string,
  value: string,
  roleName: string,
  fieldName: string,
) {
  const byLabel = page.getByLabel(label);

  try {
    await byLabel.waitFor({ state: 'visible', timeout: 3000 });
    await byLabel.fill(value);
    return;
  } catch {
    const fallback = page.locator(fallbackSelector);

    try {
      await fallback.waitFor({ state: 'visible', timeout: 2000 });
      await fallback.fill(value);
    } catch (error) {
      throw new Error(
        `角色 ${roleName} 登录失败：未找到${fieldName}输入框（label=${label}, fallback=${fallbackSelector}）。原始错误：${String(error)}`,
      );
    }
  }
}

function redactAuthText(text: string) {
  return text
    .replace(/(\"?(?:token|access_token|accessToken)\"?\s*:\s*\")([^\"]+)(\")/gi, '$1[REDACTED]$3')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, '$1[REDACTED]');
}

function readJson(text: string, roleName: RoleName) {
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`角色 ${roleName} 登录失败：认证响应不是合法 JSON。原始错误：${String(error)}`);
  }
}

function pickToken(body: any, data: any, user: any) {
  return user?.token
    ?? user?.access_token
    ?? user?.accessToken
    ?? data?.token
    ?? data?.access_token
    ?? data?.accessToken
    ?? body?.token
    ?? body?.access_token
    ?? body?.accessToken;
}

function normalizeUserInfo(body: any, roleName: RoleName, fallbackUsername: string, responseText: string): UserInfo {
  const data = body?.data ?? body ?? {};
  const user = data?.user ?? data;
  const userInfo: UserInfo = {
    userId: user?.userId ?? user?.user_id ?? user?.id ?? data?.userId ?? data?.user_id ?? data?.id,
    username: user?.username ?? data?.username ?? fallbackUsername,
    realName: user?.realName ?? user?.real_name ?? data?.realName ?? data?.real_name ?? user?.username ?? fallbackUsername,
    roles: user?.roles ?? data?.roles,
    permissions: user?.permissions ?? data?.permissions,
  };

  const safeResponseText = redactAuthText(responseText);

  expect(userInfo.userId, `角色 ${roleName} 登录失败：响应缺少 userId/id，响应体：${safeResponseText}`).toBeTruthy();
  expect(userInfo.username, `角色 ${roleName} 登录失败：响应缺少 username，响应体：${safeResponseText}`).toBeTruthy();
  expect(Array.isArray(userInfo.roles), `角色 ${roleName} 登录失败：响应缺少 roles 数组，响应体：${safeResponseText}`).toBe(true);
  expect((userInfo.roles as unknown[]).length, `角色 ${roleName} 登录失败：roles 为空，响应体：${safeResponseText}`).toBeGreaterThan(0);
  expect(Array.isArray(userInfo.permissions), `角色 ${roleName} 登录失败：响应缺少 permissions 数组，响应体：${safeResponseText}`).toBe(true);

  return userInfo;
}

function assertStorageState(roleName: RoleName, storagePath: string) {
  const absoluteStoragePath = storageFilePath(storagePath);
  expect(existsSync(absoluteStoragePath), `角色 ${roleName} storage state 未生成：${storagePath}`).toBe(true);

  const state = JSON.parse(readFileSync(absoluteStoragePath, 'utf8')) as StorageState;
  const originState = state.origins?.find((item) => item.origin === storageOrigin);
  expect(originState, `角色 ${roleName} storage state 缺少 origin：${storageOrigin}`).toBeTruthy();

  const localStorage = originState?.localStorage ?? [];
  const entries = new Map(localStorage.map((item) => [item.name, item.value]));
  const authToken = entries.get('auth_token');
  const userInfoText = entries.get('user_info');

  expect(authToken, `角色 ${roleName} storage state localStorage 缺少 auth_token`).toBeTruthy();
  expect(userInfoText, `角色 ${roleName} storage state localStorage 缺少 user_info`).toBeTruthy();
  expect(entries.get('ams_auth_token'), `角色 ${roleName} storage state localStorage 缺少 ams_auth_token`).toBe(authToken);
  expect(entries.get('ams_auth_user'), `角色 ${roleName} storage state localStorage 缺少 ams_auth_user`).toBe(userInfoText);

  const storedUser = JSON.parse(userInfoText ?? '{}') as UserInfo;
  expect(storedUser.userId, `角色 ${roleName} storage state user_info 缺少 userId`).toBeTruthy();
  expect(storedUser.username, `角色 ${roleName} storage state user_info 缺少 username`).toBeTruthy();
  expect(Array.isArray(storedUser.roles), `角色 ${roleName} storage state user_info 缺少 roles 数组`).toBe(true);
  expect((storedUser.roles as unknown[]).length, `角色 ${roleName} storage state user_info roles 为空`).toBeGreaterThan(0);
  expect(Array.isArray(storedUser.permissions), `角色 ${roleName} storage state user_info 缺少 permissions 数组`).toBe(true);
}

// ---------------------------------------------------------------------------
// AUTH-001 / AUTH-002 / AUTH-003 — 登录各角色并保存 storage state
// ---------------------------------------------------------------------------

for (const role of roles) {
  setup(`AUTH: ${role.name} 登录并保存 storage state`, async ({ page, request }) => {
    const actualPassword = await ensureE2eRoleUser(request, role);

    // 访问真实登录页，保留登录 UI 基础覆盖。
    await page.goto('/login');

    // 当前 LoginPage 使用 label/htmlFor 暴露输入框；失败时降级到稳定 id。
    await fillLoginField(page, '用户名', '#username', role.username, role.name, '用户名');
    await fillLoginField(page, '密码', '#password', actualPassword, role.name, '密码');

    // 点击登录按钮并等待认证接口成功响应。
    const loginButton = page.getByRole('button', { name: /登录系统|登录/ });
    await expect(loginButton, `角色 ${role.name} 登录失败：未找到登录按钮`).toBeVisible({ timeout: 5000 });

    let response;
    try {
      [response] = await Promise.all([
        page.waitForResponse(
          (resp) => resp.url().includes('/api/auth/login'),
          { timeout: 10000 },
        ),
        loginButton.click(),
      ]);
    } catch (error) {
      throw new Error(`角色 ${role.name} 登录失败：10 秒内未收到 /api/auth/login 响应。原始错误：${String(error)}`);
    }

    const responseText = await response.text();
    const body = readJson(responseText, role.name);
    const loginCode = body?.code ?? '无';
    const loginMessage = body?.message ?? body?.msg ?? '无';
    expect(
      response.status(),
      `角色 ${role.name} 登录失败：/api/auth/login 返回 ${response.status()}，业务码 ${loginCode}，消息 ${loginMessage}，响应片段：${redactAuthText(responseText).slice(0, 800)}`,
    ).toBe(200);
    const data = body?.data ?? body ?? {};
    const user = data?.user ?? data;
    const token = pickToken(body, data, user);
    expect(token, `角色 ${role.name} 登录失败：响应缺少 token，响应体：${redactAuthText(responseText)}`).toBeTruthy();

    // 等待离开登录页，确认前端已写入认证态并完成跳转。
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    const userInfo = normalizeUserInfo(body, role.name, role.username, responseText);

    // Playwright storageState 不保存 sessionStorage；额外写入 localStorage 供下游项目复用。
    await page.evaluate(
      ({ authToken, authUser }) => {
        const userText = JSON.stringify(authUser);
        window.localStorage.setItem('auth_token', authToken);
        window.localStorage.setItem('user_info', userText);
        window.localStorage.setItem('ams_auth_token', authToken);
        window.localStorage.setItem('ams_auth_user', userText);
      },
      { authToken: token, authUser: userInfo },
    );

    const storedToken = await page.evaluate(() => window.localStorage.getItem('auth_token'));
    expect(storedToken, `角色 ${role.name} storage state 写入前 localStorage 缺少 token`).toBe(token);

    // Playwright 不保证自动创建父目录，写入前显式创建 .auth。
    const absoluteStoragePath = storageFilePath(role.storagePath);
    mkdirSync(dirname(absoluteStoragePath), { recursive: true });
    await page.context().storageState({ path: absoluteStoragePath });
    assertStorageState(role.name, role.storagePath);
  });
}

// ---------------------------------------------------------------------------
// AUTH-004 — 验证已保存 token 可用
// ---------------------------------------------------------------------------

setup('AUTH: 验证已保存的 token 有效性', async ({ browser }) => {
  for (const role of roles) {
    assertStorageState(role.name, role.storagePath);

    const context = await browser.newContext({ storageState: storageFilePath(role.storagePath) });
    const page = await context.newPage();

    // 不再用 /api/health 模糊判断后端状态，只验证前端上下文可读取落盘认证态。
    await page.goto('/');
    await expect(page.locator('body'), `角色 ${role.name} storageState 复用后应用不应崩溃`).not.toContainText('Unexpected Application Error');
    const localStorageSnapshot = await page.evaluate(() => ({
      authToken: window.localStorage.getItem('auth_token'),
      userInfo: window.localStorage.getItem('user_info'),
      amsAuthToken: window.localStorage.getItem('ams_auth_token'),
      amsAuthUser: window.localStorage.getItem('ams_auth_user'),
    }));
    expect(localStorageSnapshot.authToken, `角色 ${role.name} storageState 复用后缺少 auth_token`).toBeTruthy();
    expect(localStorageSnapshot.amsAuthToken, `角色 ${role.name} storageState 复用后缺少 ams_auth_token`).toBe(localStorageSnapshot.authToken);
    expect(localStorageSnapshot.userInfo, `角色 ${role.name} storageState 复用后缺少 user_info`).toBeTruthy();
    expect(localStorageSnapshot.amsAuthUser, `角色 ${role.name} storageState 复用后缺少 ams_auth_user`).toBe(localStorageSnapshot.userInfo);

    await context.close();
  }
});
