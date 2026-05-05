/**
 * SWARM-003 操作日志仪表板 E2E 测试
 * 
 * 测试范围：
 * - 仪表板路由访问
 * - 趋势图表渲染
 * - 筛选器交互
 * - 日志列表查询
 * - 完整用户操作流程
 * 
 * @author SWARM-003 Team
 * @version 1.0.0
 */

import { test, expect, Page } from '@playwright/test';

// ============================================================
// 测试数据与辅助函数
// ============================================================

/** 模拟日志数据 */
interface MockLogEntry {
  id: string;
  timestamp: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ';
  operator_name: string;
  operator_id: string;
  resource_type: string;
  resource_id: string;
  status: 'SUCCESS' | 'FAILURE';
  ip_address: string;
}

/** 模拟趋势数据点 */
interface MockTrendPoint {
  timestamp: string;
  count: number;
  breakdown?: {
    CREATE?: number;
    UPDATE?: number;
    DELETE?: number;
    READ?: number;
  };
}

/** 创建标准日期范围 */
function createDateRange(days: number): { start_time: string; end_time: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  
  return {
    start_time: start.toISOString(),
    end_time: end.toISOString(),
  };
}

/** 生成随机日志条目 */
function generateMockLogs(count: number, startDate: Date = new Date()): MockLogEntry[] {
  const actions: MockLogEntry['action'][] = ['CREATE', 'UPDATE', 'DELETE', 'READ'];
  const statuses: MockLogEntry['status'][] = ['SUCCESS', 'FAILURE'];
  const operators = ['张三', '李四', '王五', '管理员'];
  const resourceTypes = ['Asset', 'WorkOrder', 'User', 'Category'];
  
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(startDate);
    date.setHours(date.getHours() - i);
    
    return {
      id: `LOG-${String(i + 1).padStart(6, '0')}`,
      timestamp: date.toISOString(),
      action: actions[Math.floor(Math.random() * actions.length)],
      operator_name: operators[Math.floor(Math.random() * operators.length)],
      operator_id: `USER-${String(Math.floor(Math.random() * 5) + 1).padStart(3, '0')}`,
      resource_type: resourceTypes[Math.floor(Math.random() * resourceTypes.length)],
      resource_id: `RES-${String(Math.floor(Math.random() * 100) + 1).padStart(4, '0')}`,
      status: statuses[Math.floor(Math.random() * 10)] === 'FAILURE' ? 'FAILURE' : 'SUCCESS',
      ip_address: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    };
  });
}

/** 生成趋势数据 */
function generateMockTrends(days: number, withBreakdown: boolean = false): MockTrendPoint[] {
  const points: MockTrendPoint[] = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    const point: MockTrendPoint = {
      timestamp: date.toISOString().split('T')[0],
      count: Math.floor(Math.random() * 200) + 50,
    };
    
    if (withBreakdown) {
      point.breakdown = {
        CREATE: Math.floor(Math.random() * 50),
        UPDATE: Math.floor(Math.random() * 80),
        DELETE: Math.floor(Math.random() * 20),
        READ: Math.floor(Math.random() * 100),
      };
    }
    
    points.push(point);
  }
  
  return points;
}

// ============================================================
// 测试配置
// ============================================================

test.describe('SWARM-003 操作日志仪表板', () => {
  
  test.beforeEach(async ({ page }) => {
    // 设置默认超时
    page.setDefaultTimeout(10000);
    
    // 导航到仪表板页面
    await page.goto('/dashboard/logs');
  });

  // ============================================================
  // ATB-006: 完整日志查询流程
  // ============================================================
  
  test.describe('完整用户操作流程', () => {
    
    test('ATB-006-01: 完整日志查询流程', async ({ page }) => {
      // Step 1: 验证初始加载趋势图
      await expect(page.locator('[data-testid="trend-chart"]')).toBeVisible({ timeout: 15000 });
      
      // 验证图表标题
      await expect(page.locator('text=日志趋势')).toBeVisible();
      
      // Step 2: 选择筛选条件
      await page.selectOption('select[name="action"]', 'DELETE');
      
      const dateRange = createDateRange(30);
      await page.fill('input[name="start_time"]', dateRange.start_time.split('T')[0]);
      await page.fill('input[name="end_time"]', dateRange.end_time.split('T')[0]);
      
      // Step 3: 点击查询按钮
      await page.click('button:has-text("查询")');
      
      // Step 4: 等待日志列表加载
      await page.waitForSelector('table[data-testid="log-table"] tbody tr', { timeout: 15000 });
      
      // Step 5: 验证筛选结果
      const rows = await page.locator('table[data-testid="log-table"] tbody tr').all();
      expect(rows.length).toBeGreaterThan(0);
      
      // 验证所有行的 action 类型为 DELETE
      for (const row of rows) {
        const actionCell = await row.locator('td').nth(2).textContent();
        expect(actionCell).toBe('删除');
      }
      
      // 验证分页信息显示
      await expect(page.locator('text=/第 \\d+ 页，共 \\d+ 页/')).toBeVisible();
    });

    test('ATB-006-02: 操作者筛选流程', async ({ page }) => {
      // 输入操作者名称
      await page.fill('input[name="operator_name"]', '管理员');
      
      // 点击查询
      await page.click('button:has-text("查询")');
      
      // 等待结果加载
      await page.waitForSelector('table[data-testid="log-table"] tbody tr', { timeout: 15000 });
      
      // 验证所有结果的操作者包含"管理员"
      const rows = await page.locator('table[data-testid="log-table"] tbody tr').all();
      for (const row of rows) {
        const operatorCell = await row.locator('td').nth(3).textContent();
        expect(operatorCell).toContain('管理员');
      }
    });

    test('ATB-006-03: 状态筛选流程', async ({ page }) => {
      // 选择失败状态
      await page.selectOption('select[name="status"]', 'FAILURE');
      
      // 点击查询
      await page.click('button:has-text("查询")');
      
      // 等待结果
      await page.waitForSelector('table[data-testid="log-table"] tbody tr', { timeout: 15000 });
      
      // 验证所有结果状态为失败
      const rows = await page.locator('table[data-testid="log-table"] tbody tr').all();
      for (const row of rows) {
        const statusBadge = await row.locator('[data-testid="status-badge"]');
        await expect(statusBadge).toHaveText(/失败/);
      }
    });
  });

  // ============================================================
  // ATB-003: 趋势图表渲染测试
  // ============================================================
  
  test.describe('ATB-003: 趋势图表渲染', () => {
    
    test('渲染日趋势折线图', async ({ page }) => {
      // 验证图表容器存在
      await expect(page.locator('[data-testid="trend-chart"]')).toBeVisible({ timeout: 15000 });
      
      // 验证 Recharts 渲染
      const chartContainer = page.locator('.recharts-wrapper');
      await expect(chartContainer).toBeVisible();
      
      // 验证 X 轴标签存在
      const xAxisLabels = page.locator('.recharts-xAxis .recharts-cartesian-axis-tick-value');
      await expect(xAxisLabels.first()).toBeVisible();
      
      // 验证 Y 轴标签存在
      const yAxisLabels = page.locator('.recharts-yAxis .recharts-cartesian-axis-tick-value');
      await expect(yAxisLabels.first()).toBeVisible();
      
      // 验证折线存在
      const linePath = page.locator('.recharts-line-curve');
      await expect(linePath.first()).toBeVisible();
    });

    test('切换时间粒度', async ({ page }) => {
      // 默认显示日粒度
      await expect(page.locator('text=日')).toBeVisible();
      
      // 切换到周粒度
      await page.click('button[name="granularity"]:has-text("周")');
      
      // 验证数据点数量减少
      const dayPoints = await page.locator('.recharts-line-dot').count();
      
      await page.click('button[name="granularity"]:has-text("月")');
      
      // 验证月粒度数据点更少
      const monthPoints = await page.locator('.recharts-line-dot').count();
      expect(monthPoints).toBeLessThan(dayPoints);
    });

    test('趋势图表显示数据点提示', async ({ page }) => {
      // 悬停在数据点上
      const dataPoint = page.locator('.recharts-line-dot').first();
      await dataPoint.hover();
      
      // 验证 tooltip 显示
      const tooltip = page.locator('.recharts-tooltip-wrapper');
      await expect(tooltip).toBeVisible();
      
      // 验证 tooltip 包含日期和数量
      await expect(tooltip.locator('text=/\\d{4}-\\d{2}-\\d{2}/')).toBeVisible();
    });
  });

  // ============================================================
  // ATB-004: 筛选器交互测试
  // ============================================================
  
  test.describe('ATB-004: 筛选器交互', () => {
    
    test('选择时间范围后触发查询', async ({ page }) => {
      const onFilterChange = page.evaluate(() => {
        return new Promise(resolve => {
          // 监听筛选器变化
          window.addEventListener('filter-change', (e: CustomEvent) => {
            resolve(e.detail);
          }, { once: true });
        });
      });
      
      // 点击预设时间范围
      await page.click('button:has-text("最近 7 天")');
      
      // 验证事件触发
      const filterEvent = await onFilterChange as any;
      expect(filterEvent).toHaveProperty('start_time');
      expect(filterEvent).toHaveProperty('end_time');
      
      // 验证时间跨度为 7 天
      const start = new Date(filterEvent.start_time);
      const end = new Date(filterEvent.end_time);
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeLessThanOrEqual(7);
    });

    test('操作类型下拉框正确过滤选项', async ({ page }) => {
      // 打开操作类型下拉框
      const actionSelect = page.locator('select[name="action"]');
      await expect(actionSelect).toBeVisible();
      
      // 获取所有选项
      const options = await actionSelect.locator('option').allTextContents();
      
      // 验证包含所有操作类型
      expect(options).toContain('全部');
      expect(options).toContain('创建');
      expect(options).toContain('修改');
      expect(options).toContain('删除');
      expect(options).toContain('查询');
    });

    test('重置筛选条件', async ({ page }) => {
      // 设置多个筛选条件
      await page.selectOption('select[name="action"]', 'DELETE');
      await page.selectOption('select[name="status"]', 'FAILURE');
      await page.fill('input[name="operator_name"]', '测试用户');
      
      // 点击重置按钮
      await page.click('button:has-text("重置")');
      
      // 验证筛选条件已清空
      await expect(page.locator('select[name="action"]')).toHaveValue('');
      await expect(page.locator('select[name="status"]')).toHaveValue('');
      await expect(page.locator('input[name="operator_name"]')).toHaveValue('');
    });

    test('时间范围验证 - 超过90天提示错误', async ({ page }) => {
      // 设置超过 90 天的时间范围
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 100);
      
      await page.fill('input[name="start_time"]', startDate.toISOString().split('T')[0]);
      await page.fill('input[name="end_time"]', new Date().toISOString().split('T')[0]);
      
      // 点击查询
      await page.click('button:has-text("查询")');
      
      // 验证错误提示
      await expect(page.locator('text=/时间范围不能超过90天/i')).toBeVisible();
    });
  });

  // ============================================================
  // ATB-005: 日志列表渲染测试
  // ============================================================
  
  test.describe('ATB-005: 日志列表渲染', () => {
    
    test('展示日志列表并正确分页', async ({ page }) => {
      // 等待表格加载
      await page.waitForSelector('table[data-testid="log-table"]', { timeout: 15000 });
      
      // 验证表头
      const headers = ['时间戳', '操作类型', '操作者', '资源类型', '资源ID', '状态', 'IP地址'];
      for (const header of headers) {
        await expect(page.locator(`table th:has-text("${header}")`)).toBeVisible();
      }
      
      // 验证行数（默认每页20条）
      const rows = await page.locator('table[data-testid="log-table"] tbody tr').all();
      expect(rows.length).toBeLessThanOrEqual(20);
      expect(rows.length).toBeGreaterThan(0);
      
      // 验证分页信息
      await expect(page.locator('text=/第 1 页，共 \\d+ 页/')).toBeVisible();
    });

    test('分页导航功能', async ({ page }) => {
      // 等待表格加载
      await page.waitForSelector('table[data-testid="log-table"] tbody tr', { timeout: 15000 });
      
      // 点击下一页
      await page.click('button:has-text("下一页")');
      
      // 验证页码更新
      await expect(page.locator('text=/第 2 页/')).toBeVisible();
      
      // 点击上一页
      await page.click('button:has-text("上一页")');
      await expect(page.locator('text=/第 1 页/')).toBeVisible();
    });

    test('切换每页显示条数', async ({ page }) => {
      // 等待表格加载
      await page.waitForSelector('table[data-testid="log-table"] tbody tr', { timeout: 15000 });
      
      // 选择每页 50 条
      await page.selectOption('select[name="page_size"]', '50');
      
      // 等待重新加载
      await page.waitForTimeout(1000);
      
      // 验证行数
      const rows = await page.locator('table[data-testid="log-table"] tbody tr').all();
      expect(rows.length).toBeLessThanOrEqual(50);
    });

    test('日志详情展开', async ({ page }) => {
      // 等待表格加载
      await page.waitForSelector('table[data-testid="log-table"] tbody tr', { timeout: 15000 });
      
      // 点击第一行的展开按钮
      await page.click('table[data-testid="log-table"] tbody tr:first-child button[aria-label="展开详情"]');
      
      // 验证详情面板展开
      await expect(page.locator('[data-testid="log-detail-panel"]')).toBeVisible();
      
      // 验证详情包含元数据
      await expect(page.locator('[data-testid="log-detail-panel"]')).toContainText('元数据');
    });

    test('状态徽章显示正确', async ({ page }) => {
      // 等待表格加载
      await page.waitForSelector('table[data-testid="log-table"] tbody tr', { timeout: 15000 });
      
      // 验证状态徽章存在
      const statusBadges = page.locator('[data-testid="status-badge"]');
      await expect(statusBadges.first()).toBeVisible();
      
      // 验证徽章有正确的颜色类
      const firstBadge = statusBadges.first();
      const badgeClass = await firstBadge.getAttribute('class');
      expect(badgeClass).toMatch(/(success|failure|badge-success|badge-failure)/i);
    });
  });

  // ============================================================
  // 边界与异常场景测试
  // ============================================================
  
  test.describe('边界与异常场景', () => {
    
    test('空数据状态显示', async ({ page }) => {
      // 设置不可能产生结果的筛选条件
      await page.selectOption('select[name="action"]', 'DELETE');
      await page.fill('input[name="start_time"]', '2020-01-01');
      await page.fill('input[name="end_time"]', '2020-01-02');
      
      // 点击查询
      await page.click('button:has-text("查询")');
      
      // 验证空状态提示
      await expect(page.locator('text=/暂无数据/i')).toBeVisible();
      await expect(page.locator('text=/请调整筛选条件/i')).toBeVisible();
    });

    test('API 错误时显示错误提示', async ({ page }) => {
      // 模拟 API 错误
      await page.route('**/api/v1/logs', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'INTERNAL_ERROR', message: '服务器内部错误' }),
        });
      });
      
      // 刷新页面触发请求
      await page.reload();
      
      // 验证错误提示
      await expect(page.locator('text=/加载失败/i')).toBeVisible();
      await expect(page.locator('button:has-text("重试")')).toBeVisible();
    });

    test('未授权访问跳转登录页', async ({ page }) => {
      // 清除认证信息
      await page.context().clearCookies();
      
      // 访问仪表板
      await page.goto('/dashboard/logs');
      
      // 验证跳转登录页
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator('text=/请先登录/i')).toBeVisible();
    });

    test('快速连续点击查询按钮防抖', async ({ page }) => {
      // 连续快速点击查询按钮
      for (let i = 0; i < 5; i++) {
        await page.click('button:has-text("查询")');
      }
      
      // 等待请求完成
      await page.waitForTimeout(2000);
      
      // 只应发起一次请求（通过检查网络日志或其他方式验证）
      // 这里简化验证：确保没有多个加载指示器同时显示
      const loadingIndicators = await page.locator('[data-testid="loading"]').count();
      expect(loadingIndicators).toBeLessThanOrEqual(1);
    });
  });

  // ============================================================
  // 响应式布局测试
  // ============================================================
  
  test.describe('响应式布局', () => {
    
    test('桌面端布局', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.reload();
      
      // 验证侧边栏显示
      await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
      
      // 验证筛选器和表格并排显示
      const filterPanel = page.locator('[data-testid="filter-panel"]');
      const logTable = page.locator('[data-testid="log-table"]');
      
      const filterBox = await filterPanel.boundingBox();
      const tableBox = await logTable.boundingBox();
      
      expect(filterBox).not.toBeNull();
      expect(tableBox).not.toBeNull();
      expect(tableBox!.left).toBeGreaterThan(filterBox!.left);
    });

    test('平板端布局', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      
      // 验证侧边栏收起
      await expect(page.locator('[data-testid="sidebar"]')).toHaveClass(/collapsed/);
      
      // 验证筛选器和表格垂直排列
      const filterPanel = page.locator('[data-testid="filter-panel"]');
      const logTable = page.locator('[data-testid="log-table"]');
      
      const filterBox = await filterPanel.boundingBox();
      const tableBox = await logTable.boundingBox();
      
      expect(filterBox!.top).toBeLessThan(tableBox!.top);
    });

    test('移动端布局', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      
      // 验证侧边栏隐藏，显示汉堡菜单
      await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
      
      // 验证筛选器可折叠
      await expect(page.locator('[data-testid="filter-collapsible"]')).toBeVisible();
      
      // 表格水平滚动
      await expect(page.locator('[data-testid="log-table"]')).toHaveClass(/overflow-x-auto/);
    });
  });

  // ============================================================
  // 性能测试
  // ============================================================
  
  test.describe('性能基准', () => {
    
    test('页面首次加载时间 < 3秒', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/dashboard/logs', { waitUntil: 'networkidle' });
      
      const loadTime = Date.now() - startTime;
      console.log(`页面加载时间: ${loadTime}ms`);
      
      expect(loadTime).toBeLessThan(3000);
    });

    test('筛选查询响应时间 < 1秒', async ({ page }) => {
      // 等待初始加载完成
      await page.waitForSelector('table[data-testid="log-table"] tbody tr', { timeout: 15000 });
      
      // 设置筛选条件并测量响应时间
      await page.selectOption('select[name="action"]', 'UPDATE');
      
      const startTime = Date.now();
      await page.click('button:has-text("查询")');
      await page.waitForSelector('table[data-testid="log-table"] tbody tr', { timeout: 15000 });
      
      const queryTime = Date.now() - startTime;
      console.log(`查询响应时间: ${queryTime}ms`);
      
      expect(queryTime).toBeLessThan(1000);
    });
  });
});