# SWARM-003 规格指导文档

## 仪表板数据看板 - 资产总览模块

**版本**: 1.0  
**创建日期**: 2024  
**状态**: 草稿

---

## 1. 需求与背景

### 1.1 业务背景

资产总览 Dashboard 是资产管理系统的信息枢纽，承担以下核心职能：

| 职能维度 | 具体描述 |
|---------|---------|
| **决策支撑** | 为管理层提供资产总量、价值分布、健康状态的实时视图 |
| **风险预警** | 主动识别维保到期、资产老化等风险项，提前介入处理 |
| **效率提升** | 整合分散在各模块的数据，消除信息孤岛，降低检索成本 |

### 1.2 技术背景

当前系统已完成基础数据模型的构建（资产主数据、维保记录、分类体系），但缺乏统一的可视化展示层。本次迭代需构建 Dashboard 基础设施，为后续 Phase 的深度分析功能奠定数据展示基础。

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 定位：Phase 1 - 仪表板基础层

```
┌─────────────────────────────────────────────────────────┐
│                    SWARM-003 Phase 1                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ 统计卡片  │  │ 分布图表  │  │ 预警卡片  │              │
│  │ (4 Metric Cards) │  │ (Pie/Bar) │  │ (Alert List) │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       └──────────────┼──────────────┘                   │
│                      ▼                                  │
│            ┌─────────────────┐                         │
│            │   数据服务层     │                         │
│            │ (Mock Data API) │                         │
│            └────────┬────────┘                         │
│                     ▼                                  │
│            ┌─────────────────┐                         │
│            │   数据模型层     │ (已就绪)               │
│            └─────────────────┘                         │
└─────────────────────────────────────────────────────────┘
```

### 2.2 实施范围

| 模块 | 交付物 | 优先级 |
|------|--------|--------|
| 资产总览统计组件 | 4 类关键指标卡片（总量/分类/状态/价值） | P0 |
| 分类分布图表 | 资产分类占比饼图 + 分类数量柱状图 | P0 |
| 维保到期预警卡片 | 7日内/30日内到期列表 + 紧急度标记 | P0 |

### 2.3 里程碑定义

| 里程碑 | 验收标准 | 目标日期 |
|--------|----------|----------|
| M1: 静态原型 | 三大组件 UI 渲染完成，数据使用 Mock | Week 1 |
| M2: API 集成 | 组件接入真实数据接口，响应时间 < 500ms | Week 2 |
| M3: 交互完善 | 卡片点击跳转、图表交互、响应式适配 | Week 2 |

---

## 3. 边界约束

### 3.1 技术边界

| 约束项 | 具体要求 |
|--------|----------|
| **前端框架** | 使用项目既定的技术栈（React 18+ / Vue 3+），禁止引入 jQuery/Zepto |
| **图表库** | ECharts 5.x 或 Ant Design Charts，禁止使用非企业级开源库 |
| **样式方案** | 使用项目既定的 CSS 方案（CSS Modules / Tailwind / Ant Design），保持风格统一 |
| **包管理** | 通过 npm/yarn/pnpm 管理依赖，禁止 CDN 直接引用（测试环境除外） |

### 3.2 数据边界

| 约束项 | 具体要求 |
|--------|----------|
| **数据范围** | 仅展示当前登录用户有权限访问的资产数据 |
| **时间范围** | 维保预警默认展示未来 90 天内的记录 |
| **分页策略** | 预警列表最多展示 20 条，超出部分提供"查看更多"跳转 |
| **数据格式** | API 返回统一使用 JSON，日期格式遵循 ISO 8601 |

### 3.3 性能边界

| 指标 | 阈值 | 测试方法 |
|------|------|----------|
| 首屏加载时间 | ≤ 2s (4G 网络) | Lighthouse Performance Score ≥ 80 |
| Dashboard 渲染时间 | ≤ 1s | Playwright `page.waitForSelector` 验证 |
| API 响应时间 | ≤ 500ms | Pytest 断言 `response.elapsed.total_seconds() < 0.5` |

### 3.4 兼容性边界

| 环境 | 要求 |
|------|------|
| Chrome 90+ / Edge 90+ / Firefox 88+ / Safari 14+ | 完全兼容 |
| 移动端（iOS Safari / Android Chrome） | 基础可用，图表可横向滚动 |
| 最小分辨率 | 1280 × 720 |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 资产总览统计组件

| 测试用例 | 测试方法 | 预期结果 |
|---------|----------|----------|
| TC-1.1: 卡片渲染完整性 | Playwright: `expect(page.locator('.stat-card')).toHaveCount(4)` | 页面加载后存在 4 个统计卡片 |
| TC-1.2: 指标数值展示 | Pytest API Mock + E2E: 获取 `asset_count` 接口后验证卡片文本包含对应数字 | 卡片显示的数值与 API 返回一致 |
| TC-1.3: 数字格式化 | 数值超过 10000 时展示为 "1.2万" 格式 | Playwright 截图对比，验证格式正确 |
| TC-1.4: 加载态处理 | API 响应延迟 > 2s 时 | 显示骨架屏（Skeleton），不显示死数据 |
| TC-1.5: 错误态处理 | API 返回 500 错误时 | 卡片显示错误提示图标，点击可重试 |
| TC-1.6: 无数据态处理 | 资产总数为 0 时 | 卡片显示 "暂无数据"，不显示 "0" |

### 4.2 ATB-2: 分类分布图表

| 测试用例 | 测试方法 | 预期结果 |
|---------|----------|----------|
| TC-2.1: 饼图渲染验证 | Playwright: `expect(page.locator('.pie-chart canvas')).toBeVisible()` | 饼图正确渲染，无空白或错误 |
| TC-2.2: 柱状图渲染验证 | Playwright: `expect(page.locator('.bar-chart canvas')).toBeVisible()` | 柱状图正确渲染，X/Y 轴标签可读 |
| TC-2.3: 数据一致性 | 对比饼图扇区占比与实际数据比例 | 误差 ≤ 1%，允许舍入差异 |
| TC-2.4: 图例交互 | Playwright: 点击图例项隐藏对应扇区，再次点击恢复 | 图例点击切换功能正常 |
| TC-2.5: 图表响应式 | 窗口宽度从 1920px 缩至 768px | 图表自动缩放，标签不重叠 |
| TC-2.6: 图表无数据态 | API 返回空数组 `[]` | 显示空状态插图，提示"暂无分类数据" |

### 4.3 ATB-3: 维保到期预警卡片

| 测试用例 | 测试方法 | 预期结果 |
|---------|----------|----------|
| TC-3.1: 预警列表渲染 | Playwright: `expect(page.locator('.alert-item')).toHaveCount(n)` | 列表项数量等于接口返回数量（上限 20） |
| TC-3.2: 紧急度标记 | 验证数据中存在已到期项、7日内项、30日内项 | 颜色标记正确：红色（已到期）、橙色（7日内）、黄色（30日内） |
| TC-3.3: 剩余天数计算 | Mock 当前日期为 2024-01-15，验证到期日为 2024-01-22 的项显示"剩余 7 天" | 计算逻辑正确，包含边界情况（已过期显示"已过期 X 天"） |
| TC-3.4: 点击跳转 | Playwright: 点击预警项 | 跳转到资产详情页（URL 包含 `asset_id` 参数） |
| TC-3.5: 排序验证 | 默认排序应为"紧急度 DESC → 到期日 ASC" | 第一条记录为最紧急项 |
| TC-3.6: 分页/查看更多 | 预警数量 > 20 时 | 显示"查看更多"按钮，点击跳转至完整预警列表页 |
| TC-3.7: 空预警态 | 无维保到期记录时 | 显示插图 + "暂无维保预警，资产状态良好" |

### 4.4 ATB-4: 整体交互

| 测试用例 | 测试方法 | 预期结果 |
|---------|----------|----------|
| TC-4.1: 页面刷新数据更新 | 前端轮询间隔 60s，验证数据更新后 UI 同步 | 数据变化时卡片数值平滑过渡更新 |
| TC-4.2: 权限隔离 | 使用无资产权限的用户账号登录 | Dashboard 不显示任何数据，显示"暂无访问权限" |
| TC-4.3: 性能指标 | Lighthouse CLI 测量 Dashboard 页面 | Performance Score ≥ 80，LCP ≤ 2.5s |

---

## 5. 开发切入层级序列

### 5.1 层级依赖关系图

```
Level 0: 基础设施层 (无依赖，可最先开发)
    │
    ▼
Level 1: 数据模型层 (依赖 Level 0)
    │
    ▼
Level 2: Mock API 层 (依赖 Level 1)
    │
    ▼
Level 3: 基础组件层 (依赖 Level 2)
    │
    ▼
Level 4: 业务组件层 (依赖 Level 3)
    │
    ▼
Level 5: 页面集成层 (依赖 Level 4)
```

### 5.2 详细开发序列

#### Level 0: 基础设施配置

| 任务 | 产出物 | 验收标准 |
|------|--------|----------|
| L0-1: 目录结构创建 | `src/pages/Dashboard/` 目录 | 包含 `components/`、`hooks/`、`services/`、`types/` 子目录 |
| L0-2: 图表库安装 | ECharts + React/Vue 封装包 | `package.json` 更新，`npm install` 成功 |
| L0-3: TypeScript 类型定义 | `types/dashboard.ts` | 包含 `StatCardData`、`ChartDataPoint`、`AlertItem` 接口 |

#### Level 1: 数据模型与类型

| 任务 | 产出物 | 验收标准 |
|------|--------|----------|
| L1-1: 定义统计数据接口 | `StatCardData` 类型 | 包含 `label`、`value`、`change`、`changeRate` 字段 |
| L1-2: 定义图表数据结构 | `ChartDataPoint` 类型 | 包含 `name`、`value`、`color` 可选字段 |
| L1-3: 定义预警数据接口 | `AlertItem` 类型 | 包含 `id`、`assetName`、`expireDate`、`urgencyLevel`、`daysRemaining` |

#### Level 2: Mock API 服务

| 任务 | 产出物 | 验收标准 |
|------|--------|----------|
| L2-1: 开发统计数据 Mock API | `services/mock/statApi.ts` | 返回 4 类统计数据，模拟 500ms 延迟 |
| L2-2: 开发分类分布 Mock API | `services/mock/distributionApi.ts` | 返回分类占比数据，模拟 300ms 延迟 |
| L2-3: 开发预警列表 Mock API | `services/mock/alertApi.ts` | 返回预警列表，按紧急度排序 |
| L2-4: Mock 数据切换机制 | 环境变量 `USE_MOCK_API=true/false` | 切换时无需修改业务代码 |

#### Level 3: 基础 UI 组件

| 任务 | 产出物 | 验收标准 |
|------|--------|----------|
| L3-1: 统计卡片组件 | `StatCard/index.tsx` | 支持数值、标签、变化率、加载态、错误态 |
| L3-2: 图表容器组件 | `ChartContainer/index.tsx` | 提供加载态、骨架屏、错误边界封装 |
| L3-3: 预警列表项组件 | `AlertItem/index.tsx` | 支持紧急度颜色标记、点击跳转 |

#### Level 4: 业务组件（数据绑定）

| 任务 | 产出物 | 验收标准 |
|------|--------|----------|
| L4-1: 资产总览统计组件 | `AssetStatsPanel/` | 调用 statApi，绑定 4 个 StatCard |
| L4-2: 分类分布图表组件 | `DistributionChart/` | 调用 distributionApi，渲染 Pie + Bar |
| L4-3: 维保预警卡片组件 | `MaintenanceAlertCard/` | 调用 alertApi，渲染预警列表 |

#### Level 5: 页面集成

| 任务 | 产出物 | 验收标准 |
|------|--------|----------|
| L5-1: Dashboard 页面组装 | `DashboardPage.tsx` | 整合三大业务组件，添加页面标题与描述 |
| L5-2: 响应式布局适配 | Grid/Flex 布局配置 | 1280px/1024px/768px 三档断点验证 |
| L5-3: 路由配置 | `router.ts` 添加 `/dashboard` 路由 | 路径可访问，守卫逻辑正确 |

---

## 6. 后端数据接口规范

### 6.1 DashboardStatsDTO

```java
package com.ams.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 仪表板统计数据传输对象
 * 用于 Dashboard 页面的各类统计指标展示
 */
@Data
public class DashboardStatsDTO {
    
    /** 资产总数 */
    private Long totalAssets;
    
    /** 资产总价值 */
    private BigDecimal totalValue;
    
    /** 本月新增资产数 */
    private Long monthlyNewAssets;
    
    /** 环比增长率 */
    private BigDecimal monthOverMonthGrowth;
    
    /** 资产分类统计列表 */
    private List<CategoryStat> categoryStats;
    
    /** 资产状态分布 */
    private List<StatusStat> statusStats;
    
    /** 维保预警列表 */
    private List<MaintenanceAlert> maintenanceAlerts;
    
    /** 数据更新时间 */
    private LocalDateTime lastUpdated;
    
    @Data
    public static class CategoryStat {
        private String categoryName;
        private Long count;
        private BigDecimal percentage;
        private String color;
    }
    
    @Data
    public static class StatusStat {
        private String status;
        private String statusName;
        private Long count;
        private String colorCode;
    }
    
    @Data
    public static class MaintenanceAlert {
        private Long assetId;
        private String assetName;
        private String assetCode;
        private LocalDateTime expireDate;
        private Integer daysRemaining;
        private String urgencyLevel; // CRITICAL, WARNING, NORMAL
        private String maintenanceType;
    }
}
```

### 6.2 API 端点

| 端点 | 方法 | 描述 | 响应时间要求 |
|------|------|------|-------------|
| `/api/v1/dashboard/stats` | GET | 获取仪表板统计数据 | ≤ 500ms |
| `/api/v1/dashboard/categories` | GET | 获取分类分布数据 | ≤ 300ms |
| `/api/v1/dashboard/alerts` | GET | 获取维保预警列表 | ≤ 300ms |

---

## 7. 附录

### 7.1 关键质量指标卡

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 组件覆盖率 | ≥ 90% | Jest/Vitest coverage report |
| E2E 自动化率 | 100% (核心流程) | Playwright Test Runner |
| 类型错误数 | 0 | `tsc --noEmit` |
| ESLint 错误数 | 0 | `eslint src/pages/Dashboard/` |
| Lighthouse Performance | ≥ 80 | `npx lighthouse https://xxx/dashboard` |

### 7.2 紧急度等级定义

| 等级 | 代码 | 颜色 | 天数范围 | 说明 |
|------|------|------|----------|------|
| 紧急 | CRITICAL | #EF4444 (红色) | ≤ 0 | 已到期或当天到期 |
| 警告 | WARNING | #F59E0B (橙色) | 1-7 | 7天内到期 |
| 注意 | ALERT | #FBBF24 (黄色) | 8-30 | 30天内到期 |
| 正常 | NORMAL | #10B981 (绿色) | > 30 | 30天后到期 |

### 7.3 相关文档

- [资产管理系统总体设计文档](../architecture/README.md)
- [API 接口设计规范](../api/API-Specification.md)
- [前端组件库文档](../frontend/components/README.md)
- [测试策略文档](../testing/Strategy.md)