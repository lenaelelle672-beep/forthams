# 模块测试文档：数据统计分析

## 覆盖范围

| 功能项 | 覆盖状态 | 验证方式 | 证据 |
|---|---:|---|---|
| 资产总览统计 | 已覆盖 | `dashboardService.getStats` 对接真实资产/审批数据 | `DashboardService#getStats` |
| 资产价值趋势 | 已覆盖 | `/dashboard/trends` | `Dashboard.tsx` |
| 资产分类分布 | 已覆盖 | `DashboardStatsDTO.categoryDistribution` | `DashboardService` |
| 部门资产统计 | 已覆盖 | `/dashboard/dept-distribution` 使用真实部门名称 | `DashboardService#getDeptDistribution` |
| 维护费用分析 | 已覆盖 | `/dashboard/maintenance-stats` 计算总数、均价、当月数量 | `DashboardService#getMaintenanceStats` |
| 导出按钮 | 已覆盖 | 前端保留 CSV 导出逻辑 | `Analytics.tsx` |

## 执行命令

```bash
cd backend && mvn -q -DskipTests compile
cd frontend && npm run build
```

## 结果

通过。残留风险：`Analytics.tsx` 仍有部分图表静态示例数据，Dashboard 主图已接真实 API。
