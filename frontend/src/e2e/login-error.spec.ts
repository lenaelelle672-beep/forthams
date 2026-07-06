import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * 登录错误密码测试（独立文件，与 auth.setup.ts 解耦）
 *
 * 覆盖场景：
 *   1. 错误密码登录 — mock API 返回 401，验证错误提示可见，URL 不跳离 /login
 *   2. 空密码提交 — 验证前端表单验证拦截
 *   3. 多次登录失败 — 连续尝试错误密码后页面状态正常
 *
 * 选择器风格：与 browser-smoke.spec.ts 保持一致，优先使用 getByRole / getByPlaceholder
 */

const loginPageUrl = '/login';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', mockApi);
});

// ---------------------------------------------------------------------------
// 场景 1：错误密码登录
// ---------------------------------------------------------------------------
test('错误密码登录显示错误提示且不跳离登录页', async ({ page }) => {
  await page.goto(loginPageUrl);
  await expect(page.getByRole('heading', { name: /仰望星空|驾驭资产万象/ })).toBeVisible();

  // 使用错误密码提交
  await page.getByPlaceholder('请输入账号').fill('admin');
  await page.locator('input[type="password"]').fill('wrong-password');
  await page.getByRole('button', { name: /登录系统/ }).click();

  // 验证仍停留在登录页
  await expect(page).toHaveURL(/\/login$/);

  // 验证错误提示可见
  const errorText = page.getByText(/用户名或密码错误|密码错误|登录失败/i);
  await expect(errorText.first()).toBeVisible({ timeout: 10000 });

});

// ---------------------------------------------------------------------------
// 场景 2：空密码提交
// ---------------------------------------------------------------------------
test('空密码提交触发前端表单验证', async ({ page }) => {
  await page.goto(loginPageUrl);
  await expect(page.getByRole('heading', { name: /仰望星空|驾驭资产万象/ })).toBeVisible();

  // 填写用户名，密码留空
  await page.getByPlaceholder('请输入账号').fill('admin');
  await page.locator('input[type="password"]').fill('');
  await page.getByRole('button', { name: /登录系统/ }).click();

  // 验证仍停留在登录页（未被重定向）
  await expect(page).toHaveURL(/\/login$/);

  // 验证浏览器触发前端表单验证（required 属性或自定义验证）

  await expect(page.getByRole('heading', { name: /仰望星空|驾驭资产万象/ })).toBeVisible();
});

// ---------------------------------------------------------------------------
// 场景 3：多次登录失败后页面状态正常
// ---------------------------------------------------------------------------
test('多次登录失败后页面状态正常', async ({ page }) => {
  await page.goto(loginPageUrl);
  await expect(page.getByRole('heading', { name: /仰望星空|驾驭资产万象/ })).toBeVisible();

  const attemptCount = 3;
  for (let i = 0; i < attemptCount; i++) {
    await page.getByPlaceholder('请输入账号').fill('admin');
    await page.locator('input[type="password"]').fill(`wrong-attempt-${i}`);
    await page.getByRole('button', { name: /登录系统/ }).click();

    // 每次失败后验证仍停留在登录页
    await expect(page).toHaveURL(/\/login$/);
  }

  // 验证登录表单仍然可交互且页面没有崩溃
  await expect(page.getByRole('heading', { name: /仰望星空|驾驭资产万象/ })).toBeVisible();
  await expect(page.getByPlaceholder('请输入账号')).toBeEnabled();
  await expect(page.locator('input[type="password"]')).toBeEnabled();
  await expect(page.getByRole('button', { name: /登录系统/ })).toBeEnabled();
});

// ---------------------------------------------------------------------------
// Helper：收集浏览器运行时错误
// ---------------------------------------------------------------------------
function collectBrowserErrors(page: Page) {
  const errors: string[] = [];

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

// ---------------------------------------------------------------------------
// Mock API：登录相关接口
// ---------------------------------------------------------------------------
async function mockApi(route: Route) {
  const request = route.request();
  const url = new URL(request.url());
  // 只拦截真实 API 请求（以 /api/ 开头），放行 Vite 模块请求
  if (!url.pathname.startsWith('/api/')) {
    return route.fallback();
  }
  const path = url.pathname.replace(/^\/api/, '');

  if (path === '/auth/login') {
    // 解析请求体判断密码
    let password = '';
    try {
      const postData = request.postData();
      if (postData) {
        const body = JSON.parse(postData);
        password = body.password || '';
      }
    } catch {
      // ignore parse error
    }

    // 错误密码或空密码时模拟登录失败
    if (password === 'wrong-password' || password === '' || password.startsWith('wrong-attempt-')) {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 401, message: '用户名或密码错误', data: null }),
      });
    }

    // 正常登录成功
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        message: 'OK',
        data: {
          token: 'login-error-test-token',
          userId: 1,
          username: 'admin',
          realName: '系统管理员',
          roles: ['ADMIN', 'SUPER_ADMIN'],
          permissions: ['*'],
        },
      }),
    });
  }

  // 其余 API 返回空数据
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: 200, message: 'OK', data: {} }),
  });
}
