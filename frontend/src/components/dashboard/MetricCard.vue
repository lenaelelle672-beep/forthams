# SWARM-003 资产统计仪表板数据看板页面 - 规格指导文档

## 需求与背景

### 业务需求
构建企业级资产统计仪表板数据看板页面，为资产运营团队提供核心业务指标的实时可视化展示，支持多维度数据聚合分析、趋势洞察与导出能力。

### 技术背景
- **前端框架**: React 18 + TypeScript + Vite
- **UI 组件库**: Ant Design 5.x
- **图表库**: ECharts 5.5 + vue-echarts 6.6
- **HTTP 客户端**: Axios + composables 封装
- **状态管理**: Pinia store
- **路由**: React Router v6
- **测试**: Vitest + Playwright

### 用户角色
| 角色 | 权限范围 |
|------|----------|
| 资产管理员 | 全部指标卡片 + 导出功能 |
| 财务人员 | 资产价值卡片 + 折旧趋势 |
| 访客 | 只读仪表板（无操作权限） |

### 业务价值
1. 提升资产数据透明度，降低人工统计成本
2. 支持管理层快速决策，提供实时数据支撑
3. 异常指标告警，提前发现资产风险

---

## 当前 Phase 对应实施目标

### Phase 1: 核心指标卡片组件开发

| 目标项 | 描述 | 优先级 |
|--------|------|--------|
| MetricCard 组件 | 可复用的指标卡片组件，支持数值动画 | P0 |
| 资产总量卡片 | 展示资产总数量，支持图标 + 数值 + 趋势 |
| 本月新增卡片 | 展示本月新增资产数量及环比 |
| 异常资产卡片 | 展示异常/告警资产数量，支持告警高亮 |
| 资产增长率卡片 | 展示同比/环比增长率趋势 |

### Phase 2: 图表组件集成

| 目标项 | 描述 | 优先级 |
|--------|------|--------|
| 资产分类饼图 | 资产类型分布（固定资产/无形资产/流动资产） | P0 |
| 资产状态环形图 | 正常/维修/报废/闲置状态占比 | P0 |
| 资产趋势折线图 | 近 6 个月资产数量/价值变化趋势 | P0 |
| TOP 10 资产排行 | 资产价值最高的 10 项资产列表 | P1 |

### Phase 3: 数据表格与筛选

| 目标项 | 描述 | 优先级 |
|--------|------|--------|
| 资产分类明细表 | 支持排序、分页、筛选的资产列表 | P0 |
| 时间维度筛选 | 日/周/月/季/年维度切换 | P1 |
| 导出功能 | Excel/CSV 格式导出 | P2 |

### Phase 4: 交互增强与优化

| 目标项 | 描述 | 优先级 |
|--------|------|--------|
| 手动刷新 | 按钮触发数据重新请求 | P1 |
| 自动轮询 | 每 30s 自动刷新数据（可开关） | P2 |
| Loading 骨架屏 | 数据加载中显示骨架占位 | P1 |
| 空数据兜底 | 无数据时显示友好提示 | P1 |

---

## 边界约束

### 范围界定

#### ✅ 包含
- 资产统计仪表板单页组件开发
- MetricCard 组件（可复用设计）
- 响应式布局（桌面端 >= 1200px，平板端 768-1199px）
- ECharts 图表渲染与交互
- Mock 数据模拟（开发阶段）
- TypeScript 类型安全
- Vitest 单元测试

#### ❌ 不包含
- 资产新增/编辑/删除表单页面
- 权限控制系统接入（计划 Phase 2）
- 移动端原生 App（H5 适配除外）
- 国际化（i18n）多语言支持
- WebSocket 实时推送（暂定轮询方案）
- 多租户数据隔离

### 技术约束

| 约束项 | 限制条件 | 备注 |
|--------|----------|------|
| 浏览器兼容 | Chrome/Firefox/Safari/Edge 最新 2 个版本 | IE 11 不支持 |
| 首屏加载 | 白屏时间 <= 2s | Lighthouse CI |
| 打包体积 | 压缩后资源 <= 500KB | Tree-shaking 优化 |
| 图表数据点 | 单图数据点 <= 10000 条 | 大数据需分页 |
| API 超时 | 单次请求超时 10s | 重试机制 |
| 卡片动画 | 数值滚动动画 <= 500ms | 禁用reduce-motion |

### 设计约束

| 约束项 | 规范 |
|--------|------|
| 主题 | 支持亮/暗模式，CSS 变量驱动 |
| 配色 | 主色 #1890ff，成功 #52c41a，告警 #faad14，危险 #ff4d4f |
| 字体 | 标题 16-20px，正文 14px，辅助文字 12px |
| 卡片间距 | 24px 统一间距，gutter 24px |
| 阴影 | sm: 0 1px 2px rgba(0,0,0,0.05)，md: 0 4px 12px rgba(0,0,0,0.08) |

---

## 验收测试基准 (ATB)

### ATB 概览

| 验收标准 ID | 描述 | 验证方式 | 状态 |
|-------------|------|----------|------|
| ATB-P1-001 | MetricCard 组件渲染正常 | Playwright E2E | pending |
| ATB-P1-002 | 数值动画正确执行 | Vitest Unit | pending |
| ATB-P1-003 | 卡片响应式布局 | Playwright E2E | pending |
| ATB-P1-004 | 告警状态高亮正确 | Playwright E2E | pending |
| ATB-P1-005 | 无障碍访问支持 | axe-core | pending |

### Phase 1 详细测试用例

```typescript
// frontend/tests/unit/MetricCard.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MetricCard from '@/components/dashboard/MetricCard';

describe('MetricCard 组件测试', () => {
  
  it('ATB-P1-001: 渲染基础指标卡片', () => {
    render(
      <MetricCard 
        title="资产总量"
        value={10000}
        icon={<DollarOutlined />}
        trend={{ value: 12.5, direction: 'up' }}
      />
    );
    
    expect(screen.getByText('资产总量')).toBeInTheDocument();
    expect(screen.getByText('10,000')).toBeInTheDocument(); // 数字格式化
    expect(screen.getByTestId('metric-trend-up')).toBeInTheDocument();
  });

  it('ATB-P1-001: 渲染告警状态卡片', () => {
    render(
      <MetricCard 
        title="异常资产"
        value={50}
        status="warning"
        suffix="项"
      />
    );
    
    const card = screen.getByTestId('metric-card');
    expect(card).toHaveClass('metric-card--warning');
  });

  it('ATB-P1-002: 数值动画执行', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    
    render(
      <MetricCard 
        title="资产总量"
        value={5000}
        animate={true}
        onAnimationComplete={onComplete}
      />
    );
    
    await waitForAnimationFrames(30); // 等待动画帧
    expect(onComplete).toHaveBeenCalled();
  });

  it('ATB-P1-003: 响应式尺寸适配', () => {
    const { container } = render(<MetricCard title="测试" value={100} size="large" />);
    const card = container.querySelector('.metric-card');
    expect(card).toHaveClass('metric-card--large');
  });

  it('ATB-P1-004: 下降趋势显示正确', () => {
    render(
      <MetricCard 
        title="本月新增"
        value={80}
        trend={{ value: -5.2, direction: 'down' }}
      />
    );
    
    expect(screen.getByTestId('metric-trend-down')).toBeInTheDocument();
    expect(screen.getByText('-5.2%')).toBeInTheDocument();
  });
});
```

```typescript
// frontend/tests/e2e/dashboard-metric-cards.spec.ts
import { test, expect } from '@playwright/test';

test.describe('仪表板指标卡片 E2E 测试', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('.metric-card');
  });

  test('ATB-P1-001: 所有指标卡片可见', async ({ page }) => {
    const cards = page.locator('.metric-card');
    await expect(cards).toHaveCount(4); // 4 个核心指标卡片
    
    await expect(page.getByText('资产总量')).toBeVisible();
    await expect(page.getByText('本月新增')).toBeVisible();
    await expect(page.getByText('异常资产')).toBeVisible();
    await expect(page.getByText('资产增长率')).toBeVisible();
  });

  test('ATB-P1-004: 异常资产告警高亮', async ({ page }) => {
    const alertCard = page.locator('.metric-card--warning');
    await expect(alertCard).toBeVisible();
    
    // 验证警告图标显示
    const warningIcon = alertCard.locator('.anticon-warning');
    await expect(warningIcon).toBeVisible();
  });

  test('ATB-P1-005: 键盘导航支持', async ({ page }) => {
    const firstCard = page.locator('.metric-card').first();
    await firstCard.focus();
    
    await expect(firstCard).toHaveFocus();
    await page.keyboard.press('Tab');
    
    const secondCard = page.locator('.metric-card').nth(1);
    await expect(secondCard).toHaveFocus();
  });
});
```

### ATB 质量门禁

| 检查项 | 阈值 | 执行时机 |
|--------|------|----------|
| 单元测试覆盖率 | >= 80% | PR 创建时 |
| E2E 测试通过率 | 100% | CI Pipeline |
| Lighthouse Performance | >= 85 | 每次部署 |
| axe-core 无障碍 | 0 Violations | PR 创建时 |
| TypeScript 编译 | 0 Errors | 实时检查 |

---

## 开发切入层级序列

### 层级 0: 项目脚手架准备

```
1. 创建功能分支
   git checkout -b feat/dashboard-assets-stats
   
2. 安装核心依赖
   npm install echarts@^5.5.0 vue-echarts@^6.6.0 @vueuse/core@^10.7.0
   npm install -D @types/echarts
   
3. 配置路径别名
   // vite.config.ts
   resolve: {
     alias: {
       '@': '/src'
     }
   }
   
4. 创建目录结构
   frontend/src/components/dashboard/
   ├── MetricCard.vue        # ⭐ 核心组件
   ├── ChartPie.vue
   ├── ChartLine.vue
   ├── AssetTable.vue
   └── index.ts
```

### 层级 1: MetricCard 组件开发

```
文件: frontend/src/components/dashboard/MetricCard.vue

1. Props 接口定义
   - title: string          // 卡片标题
   - value: number          // 数值
   - suffix?: string        // 后缀（单位）
   - icon?: VNode           // 图标组件
   - trend?: { value: number, direction: 'up' | 'down' }
   - status?: 'default' | 'success' | 'warning' | 'danger'
   - size?: 'small' | 'medium' | 'large'
   - animate?: boolean      // 是否启用动画
   
2. 组件结构
   ┌─────────────────────────────────────┐
   │ [Icon]  卡片标题                    │
   │         10,000                      │
   │         +12.5% ↑                    │
   └─────────────────────────────────────┘
   
3. 核心功能实现
   - 数值格式化（千分位、货币格式）
   - 趋势计算与显示
   - 状态高亮（背景色、图标）
   - 数字滚动动画（countUp.js / requestAnimationFrame）
   
4. 响应式布局
   - small: 紧凑单列
   - medium: 标准卡片网格
   - large: 跨列展示
   
5. 无障碍支持
   - role="region" + aria-label
   - 趋势数值使用 aria-live
   - 颜色对比度 >= 4.5:1
```

### 层级 2: 类型与工具函数

```typescript
// frontend/src/components/dashboard/types.ts

export interface MetricCardProps {
  title: string;
  value: number;
  suffix?: string;
  icon?: VNode;
  trend?: TrendData;
  status?: CardStatus;
  size?: CardSize;
  animate?: boolean;
}

export interface TrendData {
  value: number;
  direction: 'up' | 'down' | 'flat';
  comparePeriod?: string; // "环比" | "同比"
}

export type CardStatus = 'default' | 'success' | 'warning' | 'danger';
export type CardSize = 'small' | 'medium' | 'large';

export interface DashboardMetrics {
  totalAssets: number;
  monthlyNewAssets: number;
  abnormalAssets: number;
  assetGrowthRate: number;
  lastUpdated: string;
}
```

```typescript
// frontend/src/components/dashboard/utils.ts

import { formatNumber, formatCurrency } from '@/utils/formatter';

/**
 * 格式化指标卡片数值
 * @param value 原始数值
 * @param options 格式化选项
 */
export function formatMetricValue(
  value: number,
  options: {
    decimals?: number;
    thousandSeparator?: boolean;
    suffix?: string;
  } = {}
): string {
  const { decimals = 0, thousandSeparator = true, suffix } = options;
  
  let formatted = thousandSeparator
    ? formatNumber(value, decimals)
    : value.toFixed(decimals);
    
  return suffix ? `${formatted}${suffix}` : formatted;
}

/**
 * 计算趋势方向
 */
export function getTrendDirection(value: number): 'up' | 'down' | 'flat' {
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}

/**
 * 获取状态对应的样式类
 */
export function getStatusClass(status: CardStatus): string {
  const classMap = {
    default: 'metric-card--default',
    success: 'metric-card--success',
    warning: 'metric-card--warning',
    danger: 'metric-card--danger',
  };
  return classMap[status] || classMap.default;
}
```

### 层级 3: Composable 封装

```typescript
// frontend/src/composables/useDashboardMetrics.ts

import { ref, computed } from 'vue';
import { useRequest } from '@vueuse/core';
import { fetchDashboardMetrics } from '@/services/dashboardService';
import type { DashboardMetrics } from '@/components/dashboard/types';

export function useDashboardMetrics() {
  const { data, loading, error, refresh } = useRequest(fetchDashboardMetrics);
  
  const metrics = computed(() => data.value ?? {
    totalAssets: 0,
    monthlyNewAssets: 0,
    abnormalAssets: 0,
    assetGrowthRate: 0,
  });

  const abnormalStatus = computed(() => 
    metrics.value.abnormalAssets > 0 ? 'warning' : 'success'
  );

  const growthStatus = computed(() => {
    const rate = metrics.value.assetGrowthRate;
    if (rate > 0) return 'success';
    if (rate < 0) return 'danger';
    return 'default';
  });

  return {
    metrics,
    loading,
    error,
    refresh,
    abnormalStatus,
    growthStatus,
  };
}
```

### 层级 4: 集成测试

```typescript
// frontend/tests/e2e/dashboard-integration.spec.ts

test('ATB-AC-001: 仪表板完整数据流', async ({ page }) => {
  await page.goto('/dashboard');
  
  // 1. 验证骨架屏加载
  await page.waitForSelector('.skeleton-metric-card', { state: 'visible' });
  
  // 2. 等待数据加载完成
  await page.waitForSelector('.metric-card--loaded', { timeout: 5000 });
  
  // 3. 验证指标卡片数值正确
  const totalAssets = await page.locator('[data-testid="total-assets-value"]').textContent();
  expect(totalAssets).toMatch(/^\d{1,3}(,\d{3})*$/); // 千分位格式
  
  // 4. 验证图表渲染
  await page.waitForSelector('.echarts canvas');
  
  // 5. 验证时间戳更新
  const lastUpdated = await page.locator('.last-updated').textContent();
  expect(lastUpdated).toContain(new Date().toLocaleDateString());
});
```

---

## 附录

### A. 依赖版本锁定

```json
{
  "dependencies": {
    "vue": "^3.4.0",
    "echarts": "^5.5.0",
    "vue-echarts": "^6.6.0",
    "@vueuse/core": "^10.7.0",
    "ant-design-vue": "^4.1.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "vitest": "^1.2.0",
    "@types/echarts": "^5.5.0",
    "axe-playwright": "^1.2.0"
  }
}
```

### B. 组件 Props 完整签名

```typescript
interface MetricCardProps {
  // 必需属性
  title: string;              // 卡片标题
  value: number;             // 数值
  
  // 可选属性
  suffix?: string;           // 单位后缀，如 "项"、"元"、"%"
  icon?: VNode | (() => VNode);  // 自定义图标
  trend?: TrendData;          // 趋势数据
  status?: CardStatus;       // 状态类型
  size?: CardSize;           // 尺寸规格
  animate?: boolean;          // 是否动画
  precision?: number;        // 数值精度
  loading?: boolean;          // 加载状态
  className?: string;         // 自定义类名
  
  // 事件
  onClick?: (event: MouseEvent) => void;  // 点击回调
  onRefresh?: () => void;      // 刷新回调
}
```

### C. 状态映射表

| Status | 背景色 | 边框色 | 图标 | 使用场景 |
|--------|--------|--------|------|----------|
| default | #fafafa | #d9d9d9 | InfoCircle | 正常状态 |
| success | #f6ffed | #b7eb8f | CheckCircle | 正向增长 |
| warning | #fffbe6 | #ffe58f | ExclamationCircle | 需要关注 |
| danger | #fff2f0 | #ffccc7 | CloseCircle | 严重告警 |