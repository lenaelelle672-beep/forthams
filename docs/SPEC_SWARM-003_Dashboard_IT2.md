# SWARM-003 仪表板数据看板 - 规格指导文档 v2.0

---

## 需求与背景

### 业务场景
企业资产管理系统需在首页提供实时数据看板，使资产管理员能够在单屏内掌握：
- 资产总量及状态分布
- 资产分类结构占比
- 即将到期维保资产的预警提示

### 核心诉求
| 维度 | 现状痛点 | 期望目标 |
|------|----------|----------|
| 信息密度 | 需跳转多页面获取资产信息 | 单页聚合展示 |
| 实时性 | 数据存在延迟同步 | 前端实时拉取/轮询 |
| 可操作性 | 仅展示无交互 | 卡片支持跳转详情 |

### 技术上下文
- 前端框架：Vue 3 + Composition API
- UI 组件库：Element Plus
- 图表库：ECharts
- 状态管理：Pinia
- HTTP 客户端：Axios
- 模拟数据源：MSW (Mock Service Worker)

---

## 当前 Phase 对应实施目标

### Phase 1: 数据层基础设施
**目标**：建立 Dashboard 所需的后端接口 mock 与前端数据层

| 任务项 | 交付物 | 验收标准 |
|--------|--------|----------|
| 1.1 定义数据模型 | `AssetStatistics` / `CategoryDistribution` / `MaintenanceAlert` TypeScript 接口 | 接口字段与后端 JSON 响应一致 |
| 1.2 搭建 MSW Mock Server | `src/mocks/handlers/dashboard.ts` | 拦截 `/api/dashboard/*` 请求 |
| 1.3 实现 Pinia Store | `src/stores/dashboard.ts` | 包含 `statistics` / `categories` / `alerts` 状态及对应 actions |

### Phase 2: 资产总览统计组件
**目标**：开发数值统计卡片组，展示核心资产 KPI

| 任务项 | 交付物 | 验收标准 |
|--------|--------|----------|
| 2.1 `OverviewCards.vue` 组件 | 单文件组件，含 4 张统计卡片 | 支持响应式布局 |
| 2.2 卡片内容 | 总资产数 / 在用 / 闲置 / 维保中 | 数值 + 同比变化趋势图标 |

### Phase 3: 分类分布图表
**目标**：开发环形图组件，展示资产分类占比

| 任务项 | 交付物 | 验收标准 |
|--------|--------|----------|
| 3.1 `CategoryChart.vue` 组件 | ECharts 环形图封装 | 支持图例点击筛选 |
| 3.2 交互增强 | 饼图扇区 hover 高亮 | tooltip 显示数量与占比 |
| 3.3 点击跳转 | 扇区点击跳转至分类筛选页 | 传递 `categoryId` query 参数 |

### Phase 4: 维保到期预警卡片
**目标**：开发列表卡片，展示即将到期维保资产

| 任务项 | 交付物 | 验收标准 |
|--------|--------|----------|
| 4.1 `MaintenanceAlertCard.vue` 组件 | 列表展示 + 筛选能力 | 最多显示 5 条预警 |
| 4.2 状态分级 | 紧急(<7天) / 警示(7-30天) / 正常(>30天) | 使用颜色区分严重程度 |
| 4.3 一键处理 | "标记已处理" 按钮 | 调用 PATCH `/api/assets/:id/maintenance` |

### Phase 5: Dashboard 页面集成
**目标**：组装所有组件为完整页面

| 任务项 | 交付物 | 验收标准 |
|--------|--------|----------|
| 5.1 `DashboardView.vue` | 完整页面布局 | 顶部统计 → 中部图表 → 底部预警 |
| 5.2 响应式适配 | 桌面端/平板端布局差异 | Breakpoint: 768px / 1200px |

---

## 边界约束

### 功能边界

```
允许范围内：
✅ 实时数据拉取 (轮询间隔: 60s)
✅ 多图表联动筛选
✅ 预警状态本地标记
✅ 导出统计数据 (CSV)

不允许：
❌ 直接修改后端数据
❌ 跨租户数据访问
❌ 离线缓存与同步
❌ WebSocket 实时推送 (Phase 3 范围外)
```

### 技术边界

| 约束项 | 具体限制 |
|--------|----------|
| 包体积 | Dashboard 模块 bundle < 150KB (gzip) |
| 首屏加载 | FCP < 1.5s (含骨架屏) |
| 图表渲染 | 数据点 < 1000 条 / 图 |
| API 超时 | 请求超时: 10s，超时显示 error 状态 |
| 浏览器兼容 | Chrome 90+ / Firefox 88+ / Safari 14+ |

### 数据边界

| 数据范围 | 限制 |
|----------|------|
| 资产统计 | 仅返回当前企业租户数据 |
| 维保预警 | 仅包含未来 90 天内到期项 |
| 历史趋势 | 最多展示近 12 个月同比数据 |

---

## 验收测试基准 (ATB)

### ATB-1: 数据层单元测试

```typescript
// tests/unit/dashboard/store.test.ts
import { setActivePinia, createPinia } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import { httpClient } from '@/api/httpClient'

vi.mock('@/api/httpClient')

describe('DashboardStore', () => {
  beforeEach(() => { setActivePinia(createPinia()) })
  
  describe('fetchStatistics', () => {
    it('应正确解析总资产数、在用数、闲置数、维保中数', async () => {
      const mockData = {
        total: 1250,
        inUse: 980,
        idle: 180,
        underMaintenance: 90
      }
      httpClient.get.mockResolvedValue({ data: mockData })
      
      const store = useDashboardStore()
      await store.fetchStatistics()
      
      expect(store.statistics).toEqual(mockData)
    })
    
    it('API 失败时应抛出异常且不污染状态', async () => {
      httpClient.get.mockRejectedValue(new Error('Network Error'))
      
      const store = useDashboardStore()
      await expect(store.fetchStatistics()).rejects.toThrow('Network Error')
      expect(store.statistics).toBeNull()
    })
  })
  
  describe('fetchCategoryDistribution', () => {
    it('应返回按数量降序排列的分类列表', async () => {
      const mockData = [
        { categoryId: 'C1', categoryName: '电子设备', count: 500 },
        { categoryId: 'C2', categoryName: '办公家具', count: 300 }
      ]
      httpClient.get.mockResolvedValue({ data: mockData })
      
      const store = useDashboardStore()
      await store.fetchCategoryDistribution()
      
      expect(store.categories[0].count).toBeGreaterThanOrEqual(store.categories[1].count)
    })
  })
  
  describe('fetchMaintenanceAlerts', () => {
    it('应过滤仅返回未来90天内到期项', async () => {
      const today = new Date()
      const mockData = [
        { assetId: 'A1', dueDate: new Date(today.getTime() + 5 * 86400000).toISOString() },
        { assetId: 'A2', dueDate: new Date(today.getTime() + 100 * 86400000).toISOString() }
      ]
      httpClient.get.mockResolvedValue({ data: mockData })
      
      const store = useDashboardStore()
      await store.fetchMaintenanceAlerts()
      
      expect(store.alerts).toHaveLength(1)
      expect(store.alerts[0].assetId).toBe('A1')
    })
  })
})
```

### ATB-2: 组件集成测试 (Playwright)

```typescript
// tests/e2e/dashboard/dashboard.spec.ts
import { test, expect } from '@playwright/test'

test.describe('仪表板数据看板', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-container"]')
  })
  
  test('ATB-2.1: 资产总览统计卡片应正确展示', async ({ page }) => {
    const totalCard = page.locator('[data-testid="stat-card-total"]')
    await expect(totalCard).toBeVisible()
    await expect(totalCard.locator('.stat-value')).not.toHaveText('—')
  })
  
  test('ATB-2.2: 分类环形图应可点击跳转', async ({ page }) => {
    const chart = page.locator('[data-testid="category-chart"]')
    await expect(chart).toBeVisible()
    
    await chart.locator('.echarts-tooltip').click()
    
    await expect(page).toHaveURL(/\?categoryId=/)
  })
  
  test('ATB-2.3: 维保预警列表应按紧急程度排序', async ({ page }) => {
    const alertList = page.locator('[data-testid="maintenance-alerts"]')
    const items = alertList.locator('[data-testid="alert-item"]')
    
    const count = await items.count()
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThanOrEqual(5)
    
    const firstItemSeverity = await items.first().getAttribute('data-severity')
    expect(firstItemSeverity).toBe('critical')
  })
  
  test('ATB-2.4: 标记处理应更新 UI 状态', async ({ page }) => {
    const firstAlert = page.locator('[data-testid="alert-item"]').first()
    const handleBtn = firstAlert.locator('button:has-text("标记已处理")')
    
    await handleBtn.click()
    await page.waitForResponse('PATCH', /\/api\/assets\/\w+\/maintenance/)
    
    await expect(firstAlert).not.toBeVisible()
  })
  
  test('ATB-2.5: API 超时应显示错误状态', async ({ page }) => {
    await page.route('**/api/dashboard/statistics', route => {
      route.abort('timeout')
    })
    
    await page.reload()
    
    const errorState = page.locator('[data-testid="error-state"]')
    await expect(errorState).toBeVisible({ timeout: 15000 })
  })
})
```

### ATB-3: 视觉回归测试

```typescript
// tests/visual/dashboard.spec.ts
import { test } from '@playwright/test'

test('ATB-3.1: 桌面端完整看板截图对比', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')
  
  const screenshot = await page.locator('[data-testid="dashboard-container"]').screenshot()
  expect(screenshot).toMatchSnapshot('dashboard-desktop.png', { threshold: 0.1 })
})

test('ATB-3.2: 平板端布局自适应验证', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/dashboard')
  
  const cards = page.locator('[data-testid="stat-card"]')
  const boundingBox = await cards.first().boundingBox()
  expect(boundingBox?.width).toBeLessThan(400)
})
```

---

## 开发切入层级序列

```
┌─────────────────────────────────────────────────────────────────┐
│                         层级 0: 基础设施                         │
├─────────────────────────────────────────────────────────────────┤
│  0.1 配置 TypeScript 接口定义 (src/types/dashboard.ts)           │
│  0.2 引入 ECharts 并注册全局组件 (src/plugins/echarts.ts)        │
│  0.3 配置 MSW handlers (src/mocks/handlers/dashboard.ts)        │
│  0.4 编写 mock 数据 fixtures (src/mocks/fixtures/dashboard.json)│
│  → 依赖方: 无                                                    │
│  → 被依赖方: 全部                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         层级 1: 数据层                           │
├─────────────────────────────────────────────────────────────────┤
│  1.1 实现 Pinia Store (src/stores/dashboard.ts)                 │
│  1.2 编写 Store 单元测试 (tests/unit/dashboard/store.test.ts)   │
│  → 前置: 层级 0                                                  │
│  → 被依赖方: 层级 2+                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      层级 2: 原子组件                           │
├─────────────────────────────────────────────────────────────────┤
│  2.1 StatCard.vue (单个统计值卡片)                              │
│  2.2 SeverityBadge.vue (紧急程度标签)                           │
│  2.3 AlertListItem.vue (预警列表项)                              │
│  → 前置: 层级 0                                                  │
│  → 被依赖方: 层级 3                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      层级 3: 复合组件                           │
├─────────────────────────────────────────────────────────────────┤
│  3.1 OverviewCards.vue (整合 4 张 StatCard)                     │
│  3.2 CategoryChart.vue (封装 ECharts 环形图)                    │
│  3.3 MaintenanceAlertCard.vue (整合列表 + 状态筛选)             │
│  → 前置: 层级 1, 2                                               │
│  → 被依赖方: 层级 4                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      层级 4: 页面组装                           │
├─────────────────────────────────────────────────────────────────┤
│  4.1 DashboardView.vue (布局 + 状态调度)                        │
│  4.2 路由注册 (src/router/index.ts)                             │
│  4.3 响应式布局适配                                              │
│  → 前置: 层级 3                                                  │
│  → 被依赖方: E2E 测试                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      层级 5: 集成验证                           │
├─────────────────────────────────────────────────────────────────┤
│  5.1 E2E 测试编写 (tests/e2e/dashboard/)                        │
│  5.2 视觉回归测试 (tests/visual/)                               │
│  5.3 Lighthouse 性能审计 (bundle / FCP)                         │
│  → 前置: 层级 4                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 并行开发建议

| 团队成员 | 负责层级 | 前置完成 |
|----------|----------|----------|
| 前端 A | 0, 1 | — |
| 前端 B | 2, 3 | 0 |
| 前端 C | 4, 5 | 1, 2, 3 |

---

## 附录：关键文件清单

```
src/
├── types/
│   └── dashboard.ts              # TypeScript 接口
├── api/
│   └── dashboard.ts              # API 调用封装
├── stores/
│   └── dashboard.ts              # Pinia Store
├── components/
│   └── dashboard/
│       ├── OverviewCards.vue
│       ├── CategoryChart.vue
│       ├── MaintenanceAlertCard.vue
│       ├── StatCard.vue
│       ├── SeverityBadge.vue
│       └── AlertListItem.vue
├── views/
│   └── DashboardView.vue
├── mocks/
│   ├── handlers/
│   │   └── dashboard.ts
│   └── fixtures/
│       └── dashboard.json
└── router/
    └── index.ts

tests/
├── unit/dashboard/
│   └── store.test.ts
├── e2e/dashboard/
│   └── dashboard.spec.ts
└── visual/
    └── dashboard.spec.ts
```

---

**文档版本**: v2.0  
**关联迭代**: SWARM-003 Iteration 2  
**状态**: 草稿，待评审