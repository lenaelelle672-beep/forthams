# SWARM-003 资产统计仪表板数据看板页面 — E2E 测试规格

## 1. 需求与背景

### 1.1 业务需求

构建企业级资产统计仪表板数据看板页面，为运营团队提供资产数据的可视化展示与实时监控能力。E2E 测试需覆盖仪表板核心交互链路，验证用户从导航到数据展示、筛选、导出全流程的正确性。

### 1.2 技术栈

| 层级 | 技术选型 |
|------|----------|
| 测试框架 | Playwright (`@playwright/test` ^1.40) |
| 前端框架 | React 18 + TypeScript |
| 路由 | React Router v6 |
| UI 组件库 | Ant Design v5 |
| 图表库 | ECharts 5.5 + echarts-for-react |
| 状态管理 | Zustand |
| 构建工具 | Vite 5 |

### 1.3 目标文件

```
frontend/tests/e2e/dashboard.spec.ts  ← 本规格聚焦文件
```

### 1.4 关联文件

| 文件路径 | 相关度 | 用途 |
|----------|--------|------|
| `frontend/src/app/hooks/useDepreciation.ts` | 3 | 折旧计算 Hook，仪表板需调用 |
| `frontend/src/app/utils/permissionHooks.ts` | 2 | 权限校验，仪表板数据可见性 |
| `frontend/src/app/components/AssetDetailModal.tsx` | 2 | 资产详情弹窗，仪表板跳转入口 |
| `frontend/tests/e2e/depreciation.spec.ts` | 3 | 折旧模块测试，仪表板集成了折旧数据 |
| `frontend/tests/e2e/approval.spec.ts` | 2 | 审批模块测试，仪表板展示待审批数量 |

---

## 2. 当前 Phase 对应实施目标

### Phase 1：骨架与布局

| 目标 | 测试覆盖 |
|------|----------|
| 仪表板路由正确加载 | 验证 `/dashboard` 路由跳转，页面 title 包含"资产统计" |
| 布局结构完整 | 顶栏、侧边栏、主内容区均渲染 |
| 导航菜单激活 | 当前菜单高亮，URL 与激活态一致 |

### Phase 2：核心指标卡片

| 目标 | 测试覆盖 |
|------|----------|
| 资产总量卡片 | 数值正确渲染，格式化（千分位）正确 |
| 本月新增卡片 | 数据与后端一致 |
| 异常资产卡片 | 告警样式正确（红色高亮） |
| 卡片数据加载状态 | Loading skeleton 显示，最终数据正确 |

### Phase 3：图表组件

| 目标 | 测试覆盖 |
|------|----------|
| 资产分类饼图 | 图例可见，数据点与图例数量一致 |
| 状态分布环形图 | 各状态百分比合计 = 100% |
| 趋势折线图 | 近 6 个月数据点渲染，X 轴标签正确 |
| 图表响应式 | 窗口 resize 后图表自适应 |

### Phase 4：交互增强

| 目标 | 测试覆盖 |
|------|----------|
| 时间筛选器 | 日/周/月/季/年维度切换生效 |
| 数据刷新 | 手动刷新按钮点击后数据更新 |
| 导出 Excel | 下载触发，文件名含 `.xlsx` |
| 导出 CSV | 下载触发，文件内容与表格一致 |
| 资产卡片跳转 | 点击卡片跳转至资产详情 Modal |

---

## 3. 边界约束

### 3.1 测试范围界定

**✅ 包含**
- 仪表板页面完整 E2E 链路测试
- 路由守卫（未登录跳转登录页）
- 数据加载、筛选、导出核心功能
- 与 `depreciation.spec.ts`、`approval.spec.ts` 的交叉覆盖点
- 响应式布局（桌面 1440px / 平板 768px）

**❌ 不包含**
- 单元测试（由 `useDepreciation.test.ts` 覆盖）
- 性能基准测试（由 Lighthouse CI 单独执行）
- 生产环境 API 联调（使用 MSW Mock）
- 移动端原生交互（手势、长按等）

### 3.2 测试数据约束

| 约束项 | 值 |
|--------|-----|
| Mock 数据延迟 | `route.handle().delay = 200ms` |
| 测试超时 | `test.setTimeout(30_000)` |
| 并发窗口 | 最多 3 个（防止资源竞争） |
| 断言重试 | Playwright 默认 3 次，`soft: true` 降级 |

### 3.3 环境约束

```
NODE_ENV = test
VITE_API_MOCKING = enabled
VITE_USE_MOCK = true
```

---

## 4. 验收测试基准 (ATB)

### ATB 索引

| ID | 描述 | 测试类型 | 优先级 | 状态 |
|----|------|----------|--------|------|
| ATB-D-001 | 页面骨架渲染 | E2E | P0 | pending |
| ATB-D-002 | 指标卡片数据正确性 | E2E | P0 | pending |
| ATB-D-003 | 图表渲染与交互 | E2E | P0 | pending |
| ATB-D-004 | 时间筛选器功能 | E2E | P1 | pending |
| ATB-D-005 | 数据导出功能 | E2E | P1 | pending |
| ATB-D-006 | 权限控制（未登录） | E2E | P0 | pending |
| ATB-D-007 | 响应式布局 | E2E | P2 | pending |
| ATB-D-008 | 错误边界与空数据 | E2E | P1 | pending |

---

### ATB-D-001：页面骨架渲染

**测试目标**：验证仪表板页面完整骨架结构正确加载

```typescript
// frontend/tests/e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('页面骨架正确渲染', async ({ page }) => {
    // 验证顶栏
    await expect(page.locator('.dashboard-header')).toBeVisible();
    await expect(page.locator('.dashboard-header .logo')).toBeVisible();
    await expect(page.locator('.dashboard-header .user-info')).toBeVisible();
    
    // 验证侧边栏
    await expect(page.locator('.dashboard-sidebar')).toBeVisible();
    await expect(page.locator('.sidebar-menu')).toBeVisible();
    
    // 验证主内容区
    await expect(page.locator('.dashboard-content')).toBeVisible();
    
    // 验证面包屑
    await expect(page.locator('.breadcrumb')).toContainText('资产统计');
  });

  test('页面标题正确', async ({ page }) => {
    await expect(page).toHaveTitle(/资产统计/);
  });

  test('导航菜单激活态正确', async ({ page }) => {
    const activeMenuItem = page.locator('.sidebar-menu .menu-item.active');
    await expect(activeMenuItem).toContainText('数据看板');
  });
});
```

**物理测试期待**：
- `.dashboard-header` 可见
- `.dashboard-sidebar` 可见
- `.dashboard-content` 可见
- Page title 包含"资产统计"
- 激活菜单项文本为"数据看板"

---

### ATB-D-002：指标卡片数据正确性

**测试目标**：验证 4 个核心指标卡片数据正确渲染

```typescript
test.describe('Metrics Cards', () => {
  test('资产总量卡片数据正确', async ({ page }) => {
    const totalCard = page.locator('.metric-card').filter({ hasText: '资产总量' });
    await expect(totalCard).toBeVisible();
    
    // 验证数值格式化（千分位）
    const valueText = await totalCard.locator('.metric-value').textContent();
    expect(valueText).toMatch(/^\d{1,3}(,\d{3})*$/);
    
    // 验证数值 > 0
    const numericValue = parseInt(valueText!.replace(/,/g, ''));
    expect(numericValue).toBeGreaterThan(0);
  });

  test('本月新增卡片数据正确', async ({ page }) => {
    const newCard = page.locator('.metric-card').filter({ hasText: '本月新增' });
    await expect(newCard).toBeVisible();
    
    // 验证对比值存在（环比）
    await expect(newCard.locator('.metric-compare')).toBeVisible();
  });

  test('异常资产卡片告警样式', async ({ page }) => {
    const abnormalCard = page.locator('.metric-card').filter({ hasText: '异常资产' });
    await expect(abnormalCard).toBeVisible();
    
    // 验证告警样式（红色边框）
    const cardClass = await abnormalCard.getAttribute('class');
    expect(cardClass).toMatch(/warning|danger|alert/);
  });

  test('卡片 Loading 状态正确', async ({ page }) => {
    // 设置慢速网络模拟
    await page.route('**/api/dashboard/stats', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.continue();
    });

    await page.reload();
    
    // 验证 skeleton 显示
    await expect(page.locator('.metric-card .skeleton')).toBeVisible();
    
    // 等待数据加载完成
    await page.waitForSelector('.metric-card .metric-value', { state: 'visible' });
    await expect(page.locator('.metric-card .skeleton')).not.toBeVisible();
  });
});
```

**物理测试期待**：
- 4 个 `.metric-card` 元素可见
- 资产总量数值格式：`12,345`（千分位）
- 异常资产卡片包含 `warning`/`danger`/`alert` 类名
- 慢速网络下 skeleton 显示，加载完成后消失

---

### ATB-D-003：图表渲染与交互

**测试目标**：验证 ECharts 图表正确渲染与交互

```typescript
test.describe('Dashboard Charts', () => {
  test('资产分类饼图正确渲染', async ({ page }) => {
    const pieChart = page.locator('.chart-type-distribution');
    await expect(pieChart).toBeVisible();
    
    // 等待 Canvas 渲染
    await page.waitForSelector('.chart-type-distribution canvas', { state: 'visible' });
    
    // 验证图例可见
    const legends = pieChart.locator('.echarts-legend .legend-item');
    const legendCount = await legends.count();
    expect(legendCount).toBeGreaterThanOrEqual(3); // 至少 3 种类别
    
    // 验证数据点数量
    const dataPoints = pieChart.locator('canvas').first();
    await expect(dataPoints).toBeVisible();
  });

  test('状态分布环形图正确渲染', async ({ page }) => {
    const ringChart = page.locator('.chart-status-distribution');
    await expect(ringChart).toBeVisible();
    
    // 验证 3 种状态（正常/维修/报废）
    await expect(ringChart.getByText('正常')).toBeVisible();
    await expect(ringChart.getByText('维修')).toBeVisible();
    await expect(ringChart.getByText('报废')).toBeVisible();
  });

  test('趋势折线图数据点正确', async ({ page }) => {
    const lineChart = page.locator('.chart-trend');
    await expect(lineChart).toBeVisible();
    
    // 验证 X 轴标签（6 个月）
    const xLabels = lineChart.locator('.echarts-xAxis .axis-label');
    const labelCount = await xLabels.count();
    expect(labelCount).toBeGreaterThanOrEqual(6);
  });

  test('图表 Tooltip 交互', async ({ page }) => {
    const lineChart = page.locator('.chart-trend');
    
    // 悬停图表区域
    const chartCanvas = lineChart.locator('canvas').first();
    await chartCanvas.hover({ position: { x: 200, y: 100 } });
    
    // 验证 tooltip 显示
    await expect(page.locator('.echarts-tooltip')).toBeVisible();
  });

  test('图表响应式自适应', async ({ page }) => {
    const lineChart = page.locator('.chart-trend');
    const initialWidth = await lineChart.boundingBox().then(b => b?.width);
    
    // 模拟窗口 resize
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(300); // 等待 resize 事件处理
    
    const resizedWidth = await lineChart.boundingBox().then(b => b?.width);
    expect(resizedWidth).toBeLessThan(initialWidth!);
  });
});
```

**物理测试期待**：
- `.chart-type-distribution canvas` 可见
- 图例数量 >= 3
- 状态分布包含"正常"、"维修"、"报废"文本
- X 轴标签数量 >= 6
- 悬停后 `.echarts-tooltip` 可见
- Resize 后图表宽度减小

---

### ATB-D-004：时间筛选器功能

**测试目标**：验证时间维度筛选正确触发数据刷新

```typescript
test.describe('Time Filter', () => {
  test('默认选中"近一月"', async ({ page }) => {
    const defaultOption = page.locator('.time-filter .ant-radio-checked');
    await expect(defaultOption).toContainText('近一月');
  });

  test('切换至"近一周"生效', async ({ page }) => {
    await page.click('.time-filter button:has-text("近一周")');
    
    // 等待数据刷新
    await page.waitForResponse(response => 
      response.url().includes('/api/dashboard/stats') && 
      response.status() === 200
    );
    
    // 验证筛选激活态
    const activeButton = page.locator('.time-filter .ant-radio-checked');
    await expect(activeButton).toContainText('近一周');
  });

  test('切换至"近一季"生效', async ({ page }) => {
    await page.click('.time-filter button:has-text("近一季")');
    
    const responsePromise = page.waitForResponse('**/api/dashboard/stats**');
    await page.click('.time-filter button:has-text("近一季")');
    const response = await responsePromise;
    
    // 验证请求参数包含季度筛选
    const requestUrl = response.url();
    expect(requestUrl).toMatch(/period=quarter/);
  });

  test('自定义日期范围选择', async ({ page }) => {
    // 点击自定义
    await page.click('.time-filter button:has-text("自定义")');
    
    // 弹出日期选择器
    await expect(page.locator('.ant-picker')).toBeVisible();
    
    // 选择日期范围
    await page.click('.ant-picker-input input').first();
    await page.click('.ant-picker-cell:first-child');
    await page.click('.ant-picker-cell:last-child');
    await page.click('.ant-picker-footer .ant-picker-ok');
    
    // 验证日期范围显示
    const rangeText = await page.locator('.time-filter .range-display').textContent();
    expect(rangeText).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
```

**物理测试期待**：
- 默认激活项文本为"近一月"
- 切换后 API 请求成功（200 状态码）
- 请求 URL 包含 `period` 参数
- 日期选择器弹窗可见

---

### ATB-D-005：数据导出功能

**测试目标**：验证 Excel/CSV 导出功能正确触发

```typescript
test.describe('Export Functionality', () => {
  test('导出 Excel 按钮可见', async ({ page }) => {
    await expect(page.locator('button:has-text("导出")')).toBeVisible();
  });

  test('Excel 导出下载成功', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    
    await page.click('button:has-text("导出")');
    await page.click('.export-dropdown .dropdown-item:has-text("Excel")');
    
    const download = await downloadPromise;
    
    // 验证文件名
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    expect(download.suggestedFilename()).toContain('资产统计');
  });

  test('CSV 导出下载成功', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    
    await page.click('button:has-text("导出")');
    await page.click('.export-dropdown .dropdown-item:has-text("CSV")');
    
    const download = await downloadPromise;
    
    // 验证文件名
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });

  test('导出时 Loading 状态', async ({ page }) => {
    // 模拟导出接口慢响应
    await page.route('**/api/dashboard/export**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({ status: 200, body: 'mock' });
    });

    await page.click('button:has-text("导出")');
    await page.click('.export-dropdown .dropdown-item:has-text("Excel")');
    
    // 验证 Loading 状态
    await expect(page.locator('.export-dropdown .ant-btn-loading')).toBeVisible();
  });
});
```

**物理测试期待**：
- 下载文件名匹配 `/\.xlsx$/` 或 `/\.csv$/`
- 文件名包含"资产统计"
- 导出过程中 Loading 按钮可见

---

### ATB-D-006：权限控制（未登录）

**测试目标**：验证路由守卫正确拦截未登录用户

```typescript
test.describe('Authentication Guard', () => {
  test('未登录跳转至登录页', async ({ page, context }) => {
    // 清除登录状态
    await context.clearCookies();
    await context.clearPermissions();
    
    await page.goto('/dashboard');
    
    // 验证跳转至登录页
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('.login-form')).toBeVisible();
  });

  test('登录后访问仪表板成功', async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // 验证跳转至仪表板
    await page.waitForURL('**/dashboard');
    await expect(page.locator('.dashboard-content')).toBeVisible();
  });
});
```

**物理测试期待**：
- 未登录访问 `/dashboard` 后 URL 变为 `/login`
- 登录成功后 URL 变为 `/dashboard`

---

### ATB-D-007：响应式布局

**测试目标**：验证不同视口下布局自适应

```typescript
test.describe('Responsive Layout', () => {
  test('桌面端（1440px）布局正确', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard');
    
    // 侧边栏展开
    await expect(page.locator('.dashboard-sidebar')).toBeVisible();
    await expect(page.locator('.sidebar-menu .menu-item').first()).toBeVisible();
    
    // 指标卡片 4 列布局
    const cards = page.locator('.metric-card');
    await expect(cards).toHaveCount(4);
  });

  test('平板端（768px）布局正确', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');
    
    // 侧边栏收起
    await expect(page.locator('.sidebar-collapsed')).toBeVisible();
    
    // 汉堡菜单按钮可见
    await expect(page.locator('.hamburger-btn')).toBeVisible();
    
    // 指标卡片 2 列布局
    const cards = page.locator('.metric-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('平板端展开侧边栏', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');
    
    // 点击汉堡菜单
    await page.click('.hamburger-btn');
    
    // 验证侧边栏展开
    await expect(page.locator('.sidebar-overlay')).toBeVisible();
    await expect(page.locator('.sidebar-expanded')).toBeVisible();
  });
});
```

**物理测试期待**：
- 1440px：侧边栏展开，4 个指标卡片
- 768px：侧边栏收起，汉堡按钮可见
- 点击后侧边栏展开浮层显示

---

### ATB-D-008：错误边界与空数据

**测试目标**：验证异常场景下 UI 表现

```typescript
test.describe('Error & Empty States', () => {
  test('API 错误时显示错误提示', async ({ page }) => {
    await page.route('**/api/dashboard/**', route => {
      route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    await page.goto('/dashboard');
    
    // 验证错误提示
    await expect(page.locator('.error-alert')).toBeVisible();
    await expect(page.locator('.error-alert')).toContainText(/网络错误|服务器异常/);
  });

  test('数据为空时显示占位', async ({ page }) => {
    await page.route('**/api/dashboard/stats', route => {
      route.fulfill({ 
        status: 200, 
        contentType: 'application/json',
        body: JSON.stringify({ 
          total: 0, 
          newThisMonth: 0, 
          abnormal: 0, 
          growth: 0 
        }) 
      });
    });

    await page.goto('/dashboard');
    
    // 验证空数据占位
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.empty-state')).toContainText(/暂无数据/);
  });

  test('网络超时重试', async ({ page }) => {
    let requestCount = 0;
    await page.route('**/api/dashboard/**', route => {
      requestCount++;
      if (requestCount < 2) {
        route.abort('timeout');
      } else {
        route.fulfill({ status: 200, body: '{}' });
      }
    });

    await page.goto('/dashboard');
    
    // 验证重试后数据加载成功
    await expect(page.locator('.dashboard-content')).toBeVisible({ timeout: 15000 });
  });
});
```

**物理测试期待**：
- API 500 错误时 `.error-alert` 可见
- 空数据时 `.empty-state` 显示"暂无数据"
- 超时后自动重试，最终加载成功

---

## 5. 开发切入层级序列

### Level 0：测试文件结构

```typescript
// frontend/tests/e2e/dashboard.spec.ts
import { test, expect, Page, Locator } from '@playwright/test';

/**
 * SWARM-003 资产统计仪表板 E2E 测试
 * @description 覆盖仪表板核心交互链路
 */
test.describe('Asset Statistics Dashboard', () => {
  // 全局前置
  test.beforeAll(async ({ browser }) => {
    // Mock 所有 API
  });

  // 全局后置
  test.afterAll(async ({ browser }) => {
    // 清理
  });
});
```

### Level 1：路由与布局（对应 ATB-D-001）

```
开发顺序：
1. 路由守卫测试（ATB-D-006）
2. 骨架结构测试（ATB-D-001）
3. 响应式布局测试（ATB-D-007）
```

### Level 2：数据展示（对应 ATB-D-002, ATB-D-003）

```
开发顺序：
1. 指标卡片测试（ATB-D-002）
2. 图表渲染测试（ATB-D-003）
3. 空数据/错误态测试（ATB-D-008）
```

### Level 3：交互功能（对应 ATB-D-004, ATB-D-005）

```
开发顺序：
1. 时间筛选器测试（ATB-D-004）
2. 导出功能测试（ATB-D-005）
```

### Level 4：集成交叉（关联 depreciation.spec.ts, approval.spec.ts）

```
交叉覆盖点：
1. 仪表板"折旧数据"模块 ↔ depreciation.spec.ts
2. 仪表板"待审批数量" ↔ approval.spec.ts
3. 资产详情 Modal 跳转 ↔ AssetDetailModal.tsx
```

---

## 6. 测试配置

### playwright.config.ts 关键配置

```typescript
// frontend/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // 防止资源竞争
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 3, // 最多 3 个并发
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
```

### Mock 数据处理

```typescript
// frontend/tests/e2e/dashboard.spec.ts

// Mock 路由配置
const mockDashboardData = {
  metrics: {
    total: 12345,
    newThisMonth: 234,
    abnormal: 56,
    growth: 8.5
  },
  categoryDistribution: [
    { name: '固定资产', value: 8000 },
    { name: '无形资产', value: 3000 },
    { name: '流动资产', value: 1345 }
  ],
  statusDistribution: [
    { name: '正常', value: 10000 },
    { name: '维修中', value: 2000 },
    { name: '已报废', value: 345 }
  ],
  trend: [
    { month: '2024-07', value: 10500 },
    { month: '2024-08', value: 10800 },
    { month: '2024-09', value: 11200 },
    { month: '2024-10', value: 11600 },
    { month: '2024-11', value: 11900 },
    { month: '2024-12', value: 12345 }
  ]
};

// 注册 Mock 路由
async function registerDashboardMocks(page: Page) {
  await page.route('**/api/dashboard/stats', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockDashboardData)
    });
  });

  await page.route('**/api/dashboard/export**', route => {
    const buffer = Buffer.from('mock excel content');
    route.fulfill({
      status: 200,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: buffer
    });
  });
}
```

---

## 7. 执行命令

```bash
# 本地运行
npx playwright test tests/e2e/dashboard.spec.ts

# 特定 ATB
npx playwright test tests/e2e/dashboard.spec.ts --grep "ATB-D-001"

# 移动端视口
npx playwright test tests/e2e/dashboard.spec.ts --project=mobile-chrome

# UI 模式调试
npx playwright test tests/e2e/dashboard.spec.ts --ui

# 生成报告
npx playwright show-report
```

---

## 8. 验收清单

| 检查项 | 标准 | 执行命令 |
|--------|------|----------|
| 测试文件语法正确 | `npx tsc --noEmit` 通过 | ✓ |
| 所有 ATB 通过 | 8/8 passed | `npx playwright test dashboard.spec.ts` |
| 覆盖率达标 | 行覆盖率 >= 80% | `npx playwright test --coverage` |
| 响应式测试通过 | Chromium + Mobile Chrome | `npx playwright test --project=chromium,mobile-chrome` |
| 无 Console Error | `page.console` 无 Error 级别 | 内置于测试断言 |
| 权限测试通过 | 未登录拦截 + 登录放行 | `npx playwright test --grep "Authentication"` |

---

## 附录 A：ATB 与测试用例映射

| ATB ID | Test Description | Spec File |
|--------|------------------|-----------|
| ATB-D-001 | 页面骨架渲染 | dashboard.spec.ts:15-40 |
| ATB-D-002 | 指标卡片数据正确性 | dashboard.spec.ts:50-90 |
| ATB-D-003 | 图表渲染与交互 | dashboard.spec.ts:100-160 |
| ATB-D-004 | 时间筛选器功能 | dashboard.spec.ts:170-220 |
| ATB-D-005 | 数据导出功能 | dashboard.spec.ts:230-280 |
| ATB-D-006 | 权限控制 | dashboard.spec.ts:290-320 |
| ATB-D-007 | 响应式布局 | dashboard.spec.ts:330-380 |
| ATB-D-008 | 错误边界与空数据 | dashboard.spec.ts:390-440 |

## 附录 B：相关文件关联

```
dashboard.spec.ts
├── 依赖 useDepreciation.ts (折旧数据)
│   └── 测试交叉点：仪表板展示折旧汇总
├── 依赖 permissionHooks.ts (权限)
│   └── 测试交叉点：数据可见性控制
├── 依赖 AssetDetailModal.tsx (详情弹窗)
│   └── 测试交叉点：点击卡片跳转 Modal
├── 关联 depreciation.spec.ts
│   └── 测试交叉点：折旧报告模块
└── 关联 approval.spec.ts
    └── 测试交叉点：待审批数量展示
```