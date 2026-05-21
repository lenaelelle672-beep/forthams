# RFID 盘点 - 智能报告页面

## Stitch 设计稿信息

| 字段 | 值 |
|------|----|
| **Stitch 项目名称** | forthAMS - RFID智能报告 |
| **Stitch Project ID** | `2014907722451863252` |
| **Stitch 项目全路径** | `projects/2014907722451863252` |
| **屏幕 ID** | `fc51ef74f0854b369d3b6a74b2ba8dfd` |
| **生成时间** | 2026-05-21 |
| **设计模式** | Desktop (1280x1024px) |
| **模型** | GEMINI_3_1_PRO |

## 截图预览

截图 URL:
```
https://lh3.googleusercontent.com/aida/ADBb0uisZARCyQFdud66UphPg5O-7rvJBQy3wRUkucmDgkTNvOd1PETHfelEA8mH47BkbbjRvtl4tbboQoJLB7rwLZ0bF4g4B1tFEiOasTYV053HG15TltmuhA8yb7jcnx8F7t9zmSHPgo3M6i8CmFhq2zwjFgTg3J7A9n3XMd3d_WUBGSws8DloN6N5XscboAlk9HstAlx7KGTZiskfVl_vJ6WIS0cvdOtexrAerQ2FRf-QOwMdm2Zc9RPDK90
```

## 本地文件

- `stitch-design.html` — Stitch 生成的完整 HTML 设计稿（可直接浏览器打开预览）

## 页面结构

### 布局
- 左侧深色侧边栏（`#0a1628`），240px，RFID盘点激活高亮
- 顶部白色 header，64px，面包屑 + 返回按钮
- 主内容区浅灰背景（`#f8fafc`），24px 内边距

### 组件区块

| 区块 | 内容 |
|------|------|
| 标题区 | 智能盘点报告 + Q2徽章 + 导出报告按钮 |
| KPI 行 | 4卡片：总资产数/完成率/差异数/准确率（含趋势标签） |
| 图表行（7:5） | 折线面积图（近6次趋势）+ 圆环图（差异分布） |
| 详情行（5:7） | 部门完成率横条图 + 差异资产明细表格 |
| AI 洞察卡 | 蓝色渐变全宽卡片，3条洞察 + A+评分 + 整改建议按钮 |

## 设计规范（forthAMS Design System）

| 属性 | 值 |
|------|----|
| 主色 | `#0a1628` (Navy) / `#2563eb` (Action Blue) |
| 成功色 | `#10b981` |
| 危险色 | `#ef4444` |
| 警告色 | `#f59e0b` |
| 字体 | Inter (UI) + JetBrains Mono (Asset IDs) |
| 圆角 | 8px (ROUND_EIGHT) |
| 卡片 | `bg-white border border-[#e2e8f0] rounded-xl` |

## 后续开发指引

### 对应路由
建议路由：`/inventory/smart-report/:taskId`

### 接入数据 API 参考
```typescript
interface SmartReportData {
  taskId: string;
  taskName: string;
  completedAt: string;
  totalAssets: number;
  scannedCount: number;
  completionRate: number;  // 96.8
  discrepancyCount: number;  // 40
  deficitCount: number;       // 28
  surplusCount: number;       // 12
  accuracy: number;           // 96.8
  accuracyTrend: number;      // +12.5%
  departmentStats: DeptStat[];
  discrepancyItems: DiscrepancyItem[];
  trendData: TrendPoint[];    // 近6次
  aiInsights: AIInsight[];
}
```

### 开发步骤
1. 参考 `stitch-design.html` 视觉稿转为 React 组件
2. 创建 `SmartReportPage.tsx`（参考 `InventoryDetailPage.tsx` 布局模式）
3. 在 `InventoryTasksPage.tsx:306` 的「查看智能报告」按钮添加路由跳转
4. 添加路由到 `src/router/index.tsx`
