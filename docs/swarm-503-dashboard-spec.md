# SWARM-503 仪表板数据看板 规格指导文档

## 版本与迭代

| 字段 | 内容 |
|------|------|
| 任务编号 | SWARM-503 |
| 任务名称 | 仪表板数据看板 |
| 迭代序号 | Iteration 1 |
| 状态 | 进行中 |
| 适用前端框架 | Vue 3 + TypeScript |
| UI 组件库 | Element Plus |
| 图表库 | ECharts 5.x |
| 状态管理 | Pinia |
| HTTP 客户端 | Axios |

---

## 1. 需求与背景

### 1.1 业务背景

资产管理平台需要为用户提供统一的业务入口视图。当前平台缺少集中展示资产全貌的首页，导致用户无法快速获取关键信息。仪表板作为「控制塔」角色，需承载以下核心价值：

- **效率提升**：减少用户进入各子模块检索数据的时间成本
- **风险可见**：将即将到期的维保/报废资产主动推送到用户视野
- **趋势洞察**：通过数据可视化辅助资产管理的决策分析

### 1.2 功能范围

本次迭代仅覆盖首页仪表板的基础视图层，具体包括：

| 功能模块 | 子功能 | 优先级 |
|----------|--------|--------|
| 资产总览 | 资产总数卡片 | P0 |
| 资产总览 | 资产分类统计卡片组 | P0 |
| 到期预警 | 维保到期预警列表 | P0 |
| 到期预警 | 报废到期预警列表 | P0 |
| 趋势图表 | 资产新增趋势折线图 | P1 |

### 1.3 非功能约束

- 首屏加载时间 ≤ 2s（网络正常条件下）
- 卡片数据需支持手动刷新
- 预警面板默认展示未来 30 天内即将到期的资产

### 1.4 类型定义规范

本模块的类型定义遵循以下规范：

```typescript
// 统一使用 TypeScript Interface
// 可选字段使用 ?: 标记
// 枚举类型使用 const enum 或 as const
// 避免使用 any 类型
```

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 映射

参照项目 `plan.md` 中的 Phase 拆解，本迭代对应：

```
Phase 1: 仪表板基础框架搭建
├── 1.1 仪表板布局框架
├── 1.2 资产统计卡片组件
├── 1.3 到期预警面板
└── 1.4 趋势图表集成
```

### 2.2 本次迭代交付边界

**纳入本次迭代 (In Scope)**

- [ ] 资产总数卡片（含今日新增统计）
- [ ] 资产分类饼图卡片（设备/软件/家具等维度）
- [ ] 维保到期预警列表（最多展示 10 条）
- [ ] 报废到期预警列表（最多展示 10 条）
- [ ] 近 6 个月资产新增趋势折线图

**排除本次迭代 (Out of Scope)**

- 用户自定义仪表板布局
- 预警规则的个性化配置
- 资产统计的 Drill-Down 跳转
- 导出/打印功能
- 国际化 (i18n)

---

## 3. 边界约束

### 3.1 技术约束

| 约束项 | 具体要求 |
|--------|----------|
| Vue 版本 | ≥ 3.4 |
| TypeScript 版本 | ≥ 4.9 |
| ECharts 版本 | 5.4.x（禁止使用 6.x 预览版） |
| API 响应时间 | 单次请求 ≤ 500ms |
| 浏览器支持 | Chrome 90+、Firefox 88+、Safari 14+ |
| 屏幕适配 | 最小支持宽度 1280px |

### 3.2 数据约束

| 约束项 | 具体要求 |
|--------|----------|
| 预警数据范围 | 仅包含状态为「在用」的资产 |
| 时间计算基准 | 服务端北京时间（UTC+8） |
| 空数据展示 | 列表为空时显示「暂无预警」占位图 |
| 数据精度 | 数量取整数，百分比保留 1 位小数 |

### 3.3 接口约束

| 接口端点 | 方法 | 说明 |
|----------|------|------|
| `/api/v1/dashboard/summary` | GET | 获取资产统计数据 |
| `/api/v1/dashboard/warnings` | GET | 获取预警列表 |
| `/api/v1/dashboard/trend` | GET | 获取趋势数据 |

**接口查询参数约定**：

```
GET /api/v1/dashboard/warnings?type=maintenance|scrap&days=30&limit=10
```

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| type | string | 是 | - | 预警类型：maintenance/scrap |
| days | number | 否 | 30 | 预警天数范围 |
| limit | number | 否 | 10 | 返回条数 |

### 3.4 组件约束

| 组件名 | 约束 |
|--------|------|
| `DashboardLayout` | 固定两列布局（左侧统计区 60%，右侧预警区 40%） |
| `StatCard` | 尺寸固定 280px × 120px，间距 16px |
| `WarningPanel` | 高度固定 320px，超出部分滚动 |
| `TrendChart` | 高度固定 280px，响应式宽度 |

---

## 4. 验收测试基准 (ATB)

### 4.1 单元测试 (Vitest)

#### 4.1.1 类型定义测试

```typescript
// tests/unit/types/dashboard.spec.ts
import {
  DashboardSummary,
  WarningItem,
  TrendData,
  WarningLevel,
  WarningType
} from '@/types/dashboard'

describe('Dashboard Types', () => {
  describe('WarningLevel', () => {
    it('should have correct enum values', () => {
      expect(WarningLevel.CRITICAL).toBe('critical')
      expect(WarningLevel.WARNING).toBe('warning')
      expect(WarningLevel.NORMAL).toBe('normal')
    })
  })

  describe('WarningType', () => {
    it('should have correct enum values', () => {
      expect(WarningType.MAINTENANCE).toBe('maintenance')
      expect(WarningType.SCRAP).toBe('scrap')
    })
  })

  describe('DashboardSummary', () => {
    it('should accept valid summary object', () => {
      const summary: DashboardSummary = {
        total: 1234,
        todayNew: 5,
        byCategory: [
          { name: '电子设备', value: 456 },
          { name: '办公家具', value: 234 }
        ]
      }
      expect(summary.total).toBe(1234)
      expect(summary.byCategory).toHaveLength(2)
    })

    it('should allow optional trend field', () => {
      const summary: DashboardSummary = {
        total: 1000,
        todayNew: 3,
        trend: { value: 15, isUp: true }
      }
      expect(summary.trend?.value).toBe(15)
    })
  })

  describe('WarningItem', () => {
    it('should validate daysLeft calculation', () => {
      const item: WarningItem = {
        id: 'AST-001',
        name: '服务器 A-01',
        expireDate: '2024-02-15',
        daysLeft: 8,
        type: WarningType.MAINTENANCE,
        level: WarningLevel.WARNING
      }
      expect(item.daysLeft).toBeLessThanOrEqual(30)
    })

    it('should auto-calculate warning level based on daysLeft', () => {
      const getWarningLevel = (daysLeft: number): WarningLevel => {
        if (daysLeft <= 7) return WarningLevel.CRITICAL
        if (daysLeft <= 30) return WarningLevel.WARNING
        return WarningLevel.NORMAL
      }

      expect(getWarningLevel(5)).toBe(WarningLevel.CRITICAL)
      expect(getWarningLevel(15)).toBe(WarningLevel.WARNING)
      expect(getWarningLevel(60)).toBe(WarningLevel.NORMAL)
    })
  })

  describe('TrendData', () => {
    it('should have matching labels and values length', () => {
      const trend: TrendData = {
        labels: ['9月', '10月', '11月', '12月', '1月', '2月'],
        values: [45, 62, 38, 71, 55, 60]
      }
      expect(trend.labels.length).toBe(trend.values.length)
    })

    it('should only contain last 6 months data', () => {
      const trend: TrendData = {
        labels: ['9月', '10月', '11月', '12月', '1月', '2月'],
        values: [45, 62, 38, 71, 55, 60]
      }
      expect(trend.labels.length).toBeLessThanOrEqual(6)
    })
  })
})
```

#### 4.1.2 StatCard 组件测试

```typescript
// tests/unit/components/StatCard.spec.ts
import { mount } from '@vue/test-utils'
import StatCard from '@/components/StatCard/index.vue'

describe('StatCard', () => {
  const createWrapper = (props = {}) => {
    return mount(StatCard, {
      props: {
        title: '资产总数',
        value: 1234,
        ...props
      }
    })
  }

  it('should render title and value correctly', () => {
    const wrapper = createWrapper({ title: '资产总数', value: 1234 })
    expect(wrapper.find('.stat-card__title').text()).toBe('资产总数')
    expect(wrapper.find('.stat-card__value').text()).toBe('1,234')
  })

  it('should format number with thousand separator', () => {
    const wrapper = createWrapper({ value: 10000 })
    expect(wrapper.find('.stat-card__value').text()).toBe('10,000')
  })

  it('should display loading skeleton when loading prop is true', () => {
    const wrapper = createWrapper({ loading: true })
    expect(wrapper.find('.el-skeleton').exists()).toBe(true)
  })

  it('should display trend indicator when trend prop is provided', () => {
    const wrapper = createWrapper({ trend: { value: 15, isUp: true } })
    expect(wrapper.find('.stat-card__trend').exists()).toBe(true)
    expect(wrapper.find('.stat-card__trend--up').exists()).toBe(true)
  })

  it('should display down trend indicator correctly', () => {
    const wrapper = createWrapper({ trend: { value: 10, isUp: false } })
    expect(wrapper.find('.stat-card__trend--down').exists()).toBe(true)
  })
})
```

#### 4.1.3 WarningPanel 组件测试

```typescript
// tests/unit/components/WarningPanel.spec.ts
import { mount } from '@vue/test-utils'
import WarningPanel from '@/components/WarningPanel/index.vue'
import { WarningLevel } from '@/types/dashboard'

describe('WarningPanel', () => {
  const mockList = [
    {
      id: 'AST-001',
      name: '服务器 A-01',
      expireDate: '2024-02-01',
      daysLeft: 5,
      type: 'maintenance' as const,
      level: WarningLevel.CRITICAL
    }
  ]

  const createWrapper = (props = {}) => {
    return mount(WarningPanel, {
      props: {
        title: '维保到期预警',
        list: [],
        ...props
      }
    })
  }

  it('should render warning list items', async () => {
    const wrapper = createWrapper({ list: mockList })
    expect(wrapper.findAll('.warning-item')).toHaveLength(1)
    expect(wrapper.find('.warning-item__name').text()).toBe('服务器 A-01')
  })

  it('should display empty state when list is empty', () => {
    const wrapper = createWrapper({ list: [] })
    expect(wrapper.find('.warning-empty').isVisible()).toBe(true)
    expect(wrapper.find('.warning-empty__text').text()).toBe('暂无预警')
  })

  it('should apply warning level class based on daysLeft', () => {
    const wrapper = createWrapper({ list: mockList })
    expect(wrapper.find('.warning-item--critical').exists()).toBe(true)
  })

  it('should display warning badge with count', () => {
    const wrapper = createWrapper({ list: mockList })
    expect(wrapper.find('.warning-badge').text()).toBe('1')
  })

  it('should show loading state', () => {
    const wrapper = createWrapper({ loading: true })
    expect(wrapper.find('.el-skeleton').exists()).toBe(true)
  })
})
```

#### 4.1.4 Dashboard Store 测试

```typescript
// tests/unit/stores/dashboard.spec.ts
import { setActivePinia, createPinia } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import * as api from '@/api/dashboard'

vi.mock('@/api/dashboard')

describe('useDashboardStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('fetchSummary', () => {
    it('should fetch summary data and update state', async () => {
      const mockSummary = {
        total: 500,
        todayNew: 3,
        byCategory: []
      }
      vi.spyOn(api, 'getSummary').mockResolvedValue(mockSummary)

      const store = useDashboardStore()
      await store.fetchSummary()

      expect(store.summary.total).toBe(500)
      expect(store.summary.todayNew).toBe(3)
      expect(store.loading.summary).toBe(false)
    })

    it('should handle API error', async () => {
      vi.spyOn(api, 'getSummary').mockRejectedValue(new Error('API Error'))

      const store = useDashboardStore()
      await store.fetchSummary()

      expect(store.error.summary).toBe('API Error')
    })
  })

  describe('fetchWarnings', () => {
    it('should filter warnings by type correctly', async () => {
      const mockWarnings = [
        { id: '1', type: 'maintenance' },
        { id: '2', type: 'scrap' }
      ]
      vi.spyOn(api, 'getWarnings').mockResolvedValue(mockWarnings)

      const store = useDashboardStore()
      await store.fetchWarnings('maintenance')

      expect(store.maintenanceWarnings).toHaveLength(1)
      expect(store.maintenanceWarnings[0].type).toBe('maintenance')
    })
  })

  describe('fetchTrend', () => {
    it('should fetch and parse trend data correctly', async () => {
      const mockTrend = {
        labels: ['9月', '10月'],
        values: [45, 62]
      }
      vi.spyOn(api, 'getTrend').mockResolvedValue(mockTrend)

      const store = useDashboardStore()
      await store.fetchTrend()

      expect(store.trend.labels).toHaveLength(2)
      expect(store.trend.values).toHaveLength(2)
    })
  })
})
```

### 4.2 集成测试 (Playwright)

#### 4.2.1 仪表板页面加载流程

```typescript
// tests/e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
  })

  test('should load all dashboard components', async ({ page }) => {
    // Step 1: 验证页面标题
    await expect(page).toHaveTitle(/资产总览/)

    // Step 2: 验证统计卡片加载完成
    await expect(page.locator('.stat-card')).toHaveCount(4)

    // Step 3: 验证预警面板存在
    await expect(page.locator('.warning-panel')).toHaveCount(2)

    // Step 4: 验证图表渲染
    await expect(page.locator('.trend-chart canvas')).toBeVisible()

    // Step 5: 验证无控制台 Error 级别日志
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    expect(consoleErrors).toHaveLength(0)
  })

  test('should display real-time warning count badge', async ({ page }) => {
    // Step 1: 获取维保预警徽章数值
    const maintenanceBadge = page.locator(
      '.warning-panel--maintenance .badge'
    )
    const badgeText = await maintenanceBadge.textContent()

    // Step 2: 验证徽章显示为数字
    expect(parseInt(badgeText!)).toBeGreaterThanOrEqual(0)
  })

  test('should handle API error gracefully', async ({ page }) => {
    // Step 1: Mock API 500 错误
    await page.route('**/api/v1/dashboard/**', route => {
      route.fulfill({ status: 500, body: 'Internal Server Error' })
    })

    // Step 2: 刷新页面触发请求
    await page.reload()

    // Step 3: 验证错误提示出现
    await expect(page.locator('.el-message--error')).toBeVisible()

    // Step 4: 验证组件显示骨架屏或错误状态
    await expect(page.locator('.stat-card .el-skeleton')).toBeVisible()
  })

  test('should refresh data on manual refresh button click', async ({
    page
  }) => {
    // Step 1: 等待初始数据加载
    await expect(page.locator('.stat-card').first()).toBeVisible()

    // Step 2: 点击刷新按钮
    await page.click('.dashboard-toolbar__refresh-btn')

    // Step 3: 等待请求完成
    await page.waitForResponse(resp => resp.url().includes('/dashboard'))

    // Step 4: 验证组件重新渲染
    await expect(page.locator('.stat-card')).toHaveCount(4)
  })
})
```

#### 4.2.2 图表交互测试

```typescript
test('should display tooltip on chart hover', async ({ page }) => {
  // Step 1: 访问首页
  await page.goto('/dashboard')

  // Step 2: 等待图表渲染
  await page.waitForSelector('.trend-chart canvas')

  // Step 3: 悬停图表数据点
  const chart = page.locator('.trend-chart')
  await chart.hover()

  // Step 4: 验证 Tooltip 显示
  await expect(page.locator('.el-tooltip__popper')).toBeVisible()
})

test('should support chart legend toggle', async ({ page }) => {
  // Step 1: 访问首页
  await page.goto('/dashboard')

  // Step 2: 获取图例项
  const legend = page.locator('.trend-chart__legend-item').first()

  // Step 3: 点击图例切换
  await legend.click()

  // Step 4: 验证图表系列切换
  // 可通过截图对比或 DOM 变化验证
})
```

### 4.3 视觉回归测试 (Playwright + Percy)

```typescript
// tests/visual/dashboard.spec.ts
import { test } from '@playwright/test'
import percySnapshot from '@percy/playwright'

test('dashboard visual regression', async ({ page }) => {
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')

  // 基准截图对比
  await percySnapshot(page, 'dashboard-default-state')
})

test('dashboard with warning data visual', async ({ page }) => {
  // Mock 有预警数据的场景
  await page.route('**/api/v1/dashboard/warnings**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: '1', name: '测试资产', daysLeft: 5 },
        { id: '2', name: '测试资产2', daysLeft: 15 }
      ])
    })
  })

  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')

  await percySnapshot(page, 'dashboard-with-warnings')
})
```

### 4.4 性能基准测试

| 测试场景 | 指标 | 阈值 |
|----------|------|------|
| 首屏完整渲染 | FCP (First Contentful Paint) | ≤ 1.5s |
| 仪表板数据加载 | DCL (DOM Content Loaded) | ≤ 2.0s |
| API 请求耗时 | 接口平均响应时间 | ≤ 500ms |
| 图表渲染 | ECharts init 时间 | ≤ 100ms |
| 内存占用 | 页面稳定后 JS Heap | ≤ 150MB |

---

## 5. 开发切入层级序列

### 5.1 依赖关系图

```
Layer 0: 基础设施层
├── types/dashboard.ts              [类型定义] ← 首个交付物
├── types/asset.types.ts            [资产类型]
├── api/modules/dashboard.ts        [API 封装]
└── constants/index.ts              [常量枚举]

Layer 1: 状态管理层
└── stores/dashboard.ts             [Pinia Store]

Layer 2: 基础组件层
├── components/StatCard/            [统计卡片组件]
├── components/WarningPanel/        [预警面板组件]
├── components/TrendChart/           [趋势图表组件] ← ECharts 折线图
└── components/LoadingSkeleton/      [骨架屏组件]

Layer 3: 页面编排层
└── pages/Dashboard/index.vue        [仪表板主页面]

Layer 4: 路由与入口
└── router/index.ts                  [路由配置]
```

### 5.2 开发顺序与交接点

| 序号 | 开发任务 | 交付物 | 交接给 |
|------|----------|--------|--------|
| 1 | 定义 Dashboard 相关 TypeScript 类型 | `types/dashboard.ts` | 全团队 |
| 2 | 封装 Dashboard API 模块 | `api/modules/dashboard.ts` | 前端开发 |
| 3 | 实现 Pinia Store | `stores/dashboard.ts` | 前端开发 |
| 4 | 开发 StatCard 组件 | `components/StatCard/index.vue` | 前端开发 |
| 5 | 开发 WarningPanel 组件 | `components/WarningPanel/index.vue` | 前端开发 |
| 6 | 开发 TrendChart 组件 | `components/TrendChart/index.vue` | 前端开发 |
| 7 | 组装 Dashboard 主页面 | `pages/Dashboard/index.vue` | 前端开发 |
| 8 | 配置路由守卫 | `router/index.ts` | 前端开发 |
| 9 | 编写单元测试 | `tests/unit/**` | QA |
| 10 | 执行 E2E 集成测试 | `tests/e2e/**` | QA |
| 11 | 执行视觉回归测试 | `tests/visual/**` | QA |

### 5.3 关键技术点

#### 5.3.1 ECharts 集成要点

```typescript
// TrendChart 组件核心逻辑
import * as echarts from 'echarts'

const chartOptions = computed<echarts.EChartsOption>(() => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'cross' },
    confine: true
  },
  legend: {
    data: ['新增资产'],
    bottom: 0
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '15%',
    top: '10%',
    containLabel: true
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: trendData.value.labels // 近6个月月份
  },
  yAxis: {
    type: 'value',
    minInterval: 1
  },
  series: [
    {
      name: '新增资产',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      data: trendData.value.values,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(64, 158, 255, 0.4)' },
          { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
        ])
      },
      lineStyle: {
        width: 3,
        color: '#409EFF'
      },
      itemStyle: {
        color: '#409EFF'
      }
    }
  ]
}))
```

#### 5.3.2 预警等级判定规则

```typescript
import { WarningLevel } from '@/types/dashboard'

function getWarningLevel(daysLeft: number): WarningLevel {
  if (daysLeft <= 7) return WarningLevel.CRITICAL   // ≤7天：紧急
  if (daysLeft <= 30) return WarningLevel.WARNING    // ≤30天：预警
  return WarningLevel.NORMAL                         // >30天：正常
}
```

#### 5.3.3 响应式断点

| 断点 | 宽度范围 | 布局调整 |
|------|----------|----------|
| Desktop XL | ≥ 1920px | 四列统计卡片 |
| Desktop | 1280px - 1919px | 三列统计卡片 |
| Laptop | 1024px - 1279px | 两列统计卡片，预警面板下移 |
| Tablet | < 1024px | 单列布局（最小支持宽度边缘） |

#### 5.3.4 缓存策略

```typescript
// Dashboard 数据缓存配置
const CACHE_CONFIG = {
  // 统计摘要缓存 5 分钟
  summary: {
    ttl: 5 * 60 * 1000,
    key: 'dashboard:summary'
  },
  // 预警数据缓存 1 分钟（实时性要求高）
  warnings: {
    ttl: 1 * 60 * 1000,
    key: 'dashboard:warnings'
  },
  // 趋势数据缓存 30 分钟
  trend: {
    ttl: 30 * 60 * 1000,
    key: 'dashboard:trend'
  }
}
```

---

## 6. 类型定义参考

### 6.1 核心类型

```typescript
// frontend/src/types/dashboard.ts

/**
 * 预警等级枚举
 * - critical: 紧急（≤7天到期）
 * - warning: 预警（≤30天到期）
 * - normal: 正常（>30天到期）
 */
export const enum WarningLevel {
  CRITICAL = 'critical',
  WARNING = 'warning',
  NORMAL = 'normal'
}

/**
 * 预警类型枚举
 * - maintenance: 维保到期预警
 * - scrap: 报废到期预警
 */
export const enum WarningType {
  MAINTENANCE = 'maintenance',
  SCRAP = 'scrap'
}

/**
 * 资产分类统计项
 */
export interface CategoryStat {
  /** 分类名称 */
  name: string
  /** 资产数量 */
  value: number
}

/**
 * 仪表板统计摘要
 */
export interface DashboardSummary {
  /** 资产总数 */
  total: number
  /** 今日新增 */
  todayNew: number
  /** 分类统计数据 */
  byCategory: CategoryStat[]
  /** 可选：增长趋势 */
  trend?: {
    value: number
    isUp: boolean
  }
}

/**
 * 预警项
 */
export interface WarningItem {
  /** 资产ID */
  id: string
  /** 资产名称 */
  name: string
  /** 到期日期 */
  expireDate: string
  /** 剩余天数 */
  daysLeft: number
  /** 预警类型 */
  type: WarningType
  /** 预警等级 */
  level: WarningLevel
}

/**
 * 趋势数据
 */
export interface TrendData {
  /** 时间标签 */
  labels: string[]
  /** 数值数据 */
  values: number[]
}

/**
 * 预警面板配置
 */
export interface WarningPanelConfig {
  /** 面板标题 */
  title: string
  /** 预警类型 */
  type: WarningType
  /** 预警天数范围 */
  days?: number
  /** 最大显示条数 */
  limit?: number
}

/**
 * 统计卡片配置
 */
export interface StatCardConfig {
  /** 卡片标题 */
  title: string
  /** 数据键名 */
  dataKey: keyof DashboardSummary
  /** 图标 */
  icon?: string
  /** 颜色主题 */
  theme?: 'primary' | 'success' | 'warning' | 'danger'
}
```

### 6.2 Mock 数据约定

```typescript
// mock 数据用于开发测试
export const mockSummary: DashboardSummary = {
  total: 1234,
  todayNew: 5,
  byCategory: [
    { name: '电子设备', value: 456 },
    { name: '办公家具', value: 234 },
    { name: '软件资产', value: 321 },
    { name: '其他', value: 223 }
  ],
  trend: { value: 12, isUp: true }
}

export const mockMaintenanceWarnings: WarningItem[] = [
  {
    id: 'AST-001',
    name: '服务器 A-01',
    expireDate: '2024-02-15',
    daysLeft: 8,
    type: WarningType.MAINTENANCE,
    level: WarningLevel.WARNING
  },
  {
    id: 'AST-002',
    name: '网络设备 B-02',
    expireDate: '2024-02-08',
    daysLeft: 1,
    type: WarningType.MAINTENANCE,
    level: WarningLevel.CRITICAL
  }
]

export const mockTrend: TrendData = {
  labels: ['9月', '10月', '11月', '12月', '1月', '2月'],
  values: [45, 62, 38, 71, 55, 60]
}
```

---

## 7. 附录

### 7.1 相关文档

| 文档 | 路径 |
|------|------|
| 项目计划 | `docs/plan.md` |
| API 接口文档 | `docs/api/dashboard.md` |
| UI 设计稿 | `docs/figma/` |
| 测试模板 | `docs/testing/templates/` |

### 7.2 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| 1.0.0 | 2024-01-15 | - | 初始版本 |

---

**文档结束**