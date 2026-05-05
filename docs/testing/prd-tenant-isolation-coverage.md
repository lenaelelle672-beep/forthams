# PRD覆盖文档：多租户隔离强制校验机制

## PRD来源

文件：`prd.md`

## 功能项逐项印证

| 编号 | 功能项 | 实现状态 | 代码证据 | 测试证据 |
|---|---:|---|---|---|
| F1 | TenantContext 构建 | 已完成 | `TenantContext`、`JwtAuthenticationFilter`、`JwtUtil#getTenantIdFromToken`、`AuthService#resolveTenantId` | `TenantIsolationIntegrationTest#tenantContextIsClearedAfterRequest`、`JwtUtilTest#generateTokenUsesProvidedTenantId` |
| F2 | AssetController 强制拦截 | 已完成 | `AssetService#queryAssets/getAssetById/updateAsset/deleteAsset` 强制 `tenantId` 条件 | `tenantCannotGetUpdateOrDeleteAnotherTenantAsset` |
| F3 | 多租户数据库隔离模拟查询 | 已完成 | `AssetService`、`RetirementApplicationService`、`WorkOrderService`、`ApprovalService` 使用 tenant 条件 | `tenantAssetListOnlyReturnsCurrentTenantAssets`、`tenantWorkOrderListOnlyReturnsCurrentTenantWorkOrders` |
| F4 | TenantID 安全上下文回退保护 | 已完成 | `TenantContext.requireTenantId`、`JwtAuthenticationFilter#isTenantProtectedRequest` 保护所有认证业务接口，Dashboard 资产统计按当前租户查询 | `missingTenantIdentifierIsRejectedForAssetRequests`、`missingTenantIdentifierIsRejectedForNonAssetBusinessRequests`、`dashboardStatsOnlyCountsCurrentTenantAssets` |
| F5 | 操作审计日志增强 | 已完成 | `TenantSecurityAudit#logCrossTenantAttempt` | 测试执行日志出现 `tenant_cross_tenant_attempt` |

## 执行命令

```bash
cd backend && mvn -q -Dtest=JwtUtilTest,TenantIsolationIntegrationTest test
cd backend && mvn test
```

## 结果

通过。

本轮查缺补漏已处理：
- `JwtUtil` 不再硬编码 `tenant_id="default"`。
- 登录/注册令牌的 `tenant_id` 由用户部门派生为 `dept:{deptId}`；未绑定部门的用户拒绝生成租户令牌。
- `JwtAuthenticationFilter` 的租户保护范围从 `/assets` 扩展到所有认证业务接口，排除 `/auth/**`、`/public/**`、静态、错误与预检请求。
- `DashboardService` 的资产统计、资产趋势、部门分布与维护统计不再做资产全表读取，改为按当前租户资产过滤。
- `WorkOrder`、`ApprovalProcess`、`ApprovalRecord` 已补充 `tenantId`，工单和审批查询按当前租户过滤。
- `InventoryTask`、`InventoryDetail`、`AssetCompensation`、`IdleAssetNotice`、`MaintenanceRecord` 已补充 `tenantId`，盘点、赔偿、闲置、维护查询按当前租户过滤。
- 新增 `tenantInventoryTaskListOnlyReturnsCurrentTenantTasks` 验证盘点任务列表不会泄露其他租户数据。

残留风险：主要业务表已具备查询级租户过滤；`AssetCategory`、`Dept`、`Role`、`Vendor`、`Location` 等基础/系统表仍需确认是全局共享还是租户私有。长期建议引入 MyBatis-Plus tenant interceptor 防止后续新增查询漏加 tenant 条件。
