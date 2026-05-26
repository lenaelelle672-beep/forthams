# 大屏管理员数据需求记录

记录日期：2026-05-24

## 决策

- 大屏不是公开展示页，必须登录后访问。
- 大屏面向管理员使用，但当前阶段先不做管理员角色/细粒度权限控制。
- 大屏数据口径不是当前租户视角，而是系统整体视角。
- 大屏数据必须来自真实后端数据，不能长期依赖 mock、静态数字或前端 fallback。

## 当前处理

- `/bigscreen` 和 `/bigscreen-3d` 前端路由放入 `ProtectedRoute` 下，未登录访问会跳转登录页。
- `/dashboard/**` 保持租户保护，避免破坏现有租户隔离测试。
- 后端不再对 `/bigscreen/**` 做 `permitAll` 预留，大屏 API 默认需要认证。
- 已新增 `GET /bigscreen/stats`，返回系统整体聚合统计，不按当前租户过滤。
- `/bigscreen/stats` 当前只校验登录态，不做管理员角色/细粒度权限控制，也不强制 JWT 携带 `tenant_id`。
- 前端 `BigScreenPage` 和 `BigScreen3DPage` 已切换到 `/bigscreen/stats`。

## 接口字段

- `totalAssets`：系统资产总数。
- `inUseAssets`、`idleAssets`、`maintenanceAssets`、`scrapAssets`：按资产状态聚合数量。
- `utilizationRate`：在用资产占比。
- `totalValue`、`netValue`：资产原值与净值聚合。
- `pendingApprovals`：系统待审批流程数量。
- `pendingWorkOrders`：待处理工单数量。
- `inventoryProgress`：盘点任务总体扫描进度。
- `criticalAlerts`：重要维修资产与高优先级未关闭工单聚合告警数量。
