# GAI PRD 实现覆盖审计

## 审计结论

根目录 `prd.md` 的多租户隔离需求已经完成了认证上下文、资产域强制过滤、缺失 tenant 拒绝和跨租户审计日志的核心链路，但尚未达到“所有数据访问强制租户隔离”的 PRD 完成标准。

当前状态应判定为：核心安全链路已打通，Asset 与 Retirement 具备较强隔离，其他业务域仍存在行级隔离缺口。

## PRD 条目状态

| PRD 项 | 要求 | 当前状态 | 证据 | 缺口 |
| --- | --- | --- | --- | --- |
| F1 TenantContext 构建 | JWT 解析 `tenant_id` 并注入 ThreadLocal | 已实现 | `JwtAuthenticationFilter`、`TenantContext`、`JwtUtil` | 需关注异步任务/后台任务上下文传播策略 |
| F2 AssetController 强制拦截 | 资源租户不匹配直接拒绝 | 已实现于主要业务资源关键路径 | `AssetService`、`RetirementApplicationService`、`AssetLifecycleService`、`WorkOrderService`、`ApprovalService`、`InventoryService`、`CompensationService`、`IdleAssetService`、`MaintenanceService` | 仍建议后续引入统一 MyBatis tenant interceptor 防漏 |
| F3 数据库隔离查询 | 所有数据访问带 tenant 条件 | 主要业务域已实现 | 资产、退役、工单、审批、盘点、赔偿、闲置、维护均使用 tenant 条件 | 全局字典/系统表仍需明确哪些按租户隔离、哪些全局共享 |
| F4 缺失 TenantID 回退保护 | 缺 tenant 默认拒绝 | 请求层已实现 | `JwtAuthenticationFilter#isTenantProtectedRequest`、`TenantContext#requireTenantId` | Service 若未调用 `requireTenantId`，仍可能执行非 tenant 查询 |
| F5 操作审计日志增强 | 记录跨租户尝试 | 已实现于手动校验路径 | `TenantSecurityAudit#logCrossTenantAttempt` | 没有统一拦截器级别审计，未覆盖无 tenant 字段业务表 |

## 数据模型覆盖

当前以下实体有 `tenantId`：

- `Asset`
- `RetirementApplication`
- `WorkOrder`
- `ApprovalProcess`
- `ApprovalRecord`
- `InventoryTask`
- `InventoryDetail`
- `AssetCompensation`
- `IdleAssetNotice`
- `MaintenanceRecord`

当前 `schema.sql` 已为上述主要业务表声明 `tenant_id` 及相关索引/唯一约束。

以下实体未发现 `tenantId` 字段，需要产品/架构确认是全局共享表还是租户表：

- `AssetChangeLog`
- `AssetCategory`
- `Dept`
- `User`
- `Role`
- `Vendor`
- `Location`
- `SysAttachment`

## 高风险代码证据

| 位置 | 现象 | 风险 |
| --- | --- | --- |
| `DashboardService#getStats` | `assetMapper.selectList(null)` | Dashboard 可统计全租户资产 |
| `DashboardService#getValueTrends` | 循环内 `assetMapper.selectList(null)` | 趋势数据可混入全租户资产，且重复全表查询 |
| `DashboardService#getDeptDistribution` | `assetMapper.selectList(null)` | 部门分布跨租户泄漏 |
| `DashboardService#getMaintenanceStats` | `maintenanceRecordMapper.selectCount(null)` | 维护统计跨租户泄漏 |
| `AssetChangeLog` | 当前通过 `asset_id` 间接关联资产，表本身无 `tenant_id` | 后续若做独立变更日志查询，建议补 tenant 或强制 join asset |
| `AssetCategory`、`Dept`、`Role`、`Vendor`、`Location` | 当前未区分全局共享还是租户私有 | 需产品决策后再改 DDL，避免破坏公共基础数据 |

## 可选优化方案

| 方案 | 内容 | 优点 | 缺点 | 建议 |
| --- | --- | --- | --- | --- |
| A：逐 Service 补 tenant 字段和条件 | 给业务表逐个加 `tenant_id`，Service 手写 `.eq(tenant_id)` | 改动直观，低框架风险 | 容易漏，长期维护成本高 | 适合作为短期修复 |
| B：MyBatis-Plus TenantLineInnerInterceptor | 建立统一 tenant 拦截器，自动给租户表注入 tenant 条件 | 最贴近 PRD“不可绕过” | 需要设计忽略表、迁移历史数据、修测试 | 推荐作为中期目标 |
| C：混合方案 | 先对高风险业务表补字段和测试，再引入统一拦截器 | 风险可控，能分批落地 | 需要维护过渡期边界 | 推荐采用 |

## 推荐实施切片

### 切片 1：Dashboard / Asset 统计隔离

优先级：P0。

状态：已完成最小修复。

原因：当前存在明确 `selectList(null)` 全表读取，风险高且修复范围较小。

建议范围：

- `DashboardService`
- `DashboardController` 相关测试
- `TenantIsolationIntegrationTest` 增加 Dashboard 断言

已落地：

- `DashboardService#getStats/getValueTrends/getDeptDistribution` 改为只读取当前 `TenantContext` 下的资产。
- `DashboardService#getMaintenanceStats` 通过当前租户资产 ID 过滤维护记录；若当前租户无资产，直接返回 0 统计。
- 新增 `TenantIsolationIntegrationTest#dashboardStatsOnlyCountsCurrentTenantAssets`，验证 Dashboard 统计不会计入其他租户资产。

仍保留的缺口：

- `DashboardService#getPendingApprovals` 暂未按租户过滤，因为 `approval_process` 当前没有 `tenant_id`。该问题归入切片 2。

验收：

```bash
cd backend
mvn -q -Dtest=TenantIsolationIntegrationTest test
mvn -q test
```

本轮已执行：

```bash
cd backend
mvn -q -DskipTests compile
mvn -q -Dtest=TenantIsolationIntegrationTest test
```

结果：通过。

### 切片 2：WorkOrder / Approval 租户隔离

优先级：P0。

状态：已完成最小修复。

原因：工单审批是核心业务流，当前状态查询、详情、审批队列均未按 tenant 过滤。

建议范围：

- `work_order` 增加 `tenant_id`
- `approval_process` 增加 `tenant_id`
- `approval_record` 可通过 process 继承隔离，或增加 `tenant_id` 便于审计
- `WorkOrderService`
- `ApprovalService`
- `WorkOrderServiceTest`、`ApprovalServiceTest`、`TenantIsolationIntegrationTest`

已落地：

- `WorkOrder`、`ApprovalProcess`、`ApprovalRecord` 增加 `tenantId` 字段。
- `schema.sql` 增加 `work_order` 表，并为 `work_order`、`approval_process`、`approval_record` 添加 `tenant_id`。
- `WorkOrderService` 的列表、详情、编号生成、审批流程创建/查询均按当前 tenant 过滤。
- `ApprovalService` 的列表、详情、创建、审批、待办、待办计数和审批记录均按当前 tenant 过滤。
- `RetirementApplicationService` 创建/更新审批流程时写入 `tenantId`，避免退役审批被新的审批租户过滤排除。
- `DashboardService#getPendingApprovals` 改为按当前 tenant 统计审批待办。
- 新增 `TenantIsolationIntegrationTest#tenantWorkOrderListOnlyReturnsCurrentTenantWorkOrders`。

验收：

```bash
cd backend
mvn -q -Dtest=WorkOrderServiceTest,ApprovalServiceTest,TenantIsolationIntegrationTest test
```

本轮已执行：

```bash
cd backend
mvn -q -DskipTests compile
mvn -q -Dtest=WorkOrderServiceTest,ApprovalServiceTest,TenantIsolationIntegrationTest test
mvn -q test
```

结果：通过。

### 切片 3：Inventory / Compensation / Idle / Maintenance 租户隔离

优先级：P1。

状态：已完成最小修复。

原因：这些模块均是业务数据，但可在核心审批链之后分批补齐。

建议范围：

- `inventory_task`
- `inventory_detail`
- `asset_compensation`
- `idle_asset_notice`
- `maintenance_record`
- 对应实体、Service、Controller 测试

已落地：

- `InventoryTask`、`InventoryDetail`、`AssetCompensation`、`IdleAssetNotice`、`MaintenanceRecord` 增加 `tenantId` 字段。
- `schema.sql` 为 `inventory_task`、`inventory_detail`、`asset_compensation`、`idle_asset_notice`、`maintenance_record` 添加 `tenant_id` 与索引。
- `InventoryService`、`CompensationService`、`IdleAssetService`、`MaintenanceService` 创建和查询均按当前租户过滤。
- `TenantIsolationIntegrationTest#tenantInventoryTaskListOnlyReturnsCurrentTenantTasks` 验证盘点任务列表跨租户不可见。
- `CompensationServiceTest` 补充 `TenantContext` 并断言创建记录写入 tenant。

本轮已执行：

```bash
cd backend
mvn -q -DskipTests compile
mvn -q -Dtest=TenantIsolationIntegrationTest test
mvn -q -Dtest=CompensationServiceTest,TenantIsolationIntegrationTest test
mvn -q test
```

结果：通过。

### 切片 4：统一 TenantLine 拦截器

优先级：P1。

原因：长期防漏，满足 PRD “所有数据访问必须携带 tenant” 的架构要求。

前置条件：

- 明确哪些表是全局字典表，例如 `sys_permission`、部分 `sys_role`、基础 category 是否全局共享。
- 为租户业务表完成历史数据补 tenant。
- 建立忽略表白名单和集成测试。

## 当前不建议做的事

- 不建议直接给所有表一次性加 `tenant_id` 并修改所有 Service，风险过大。
- 不建议仅依赖 `JwtAuthenticationFilter`，因为 Filter 只能保证请求有 tenant，不能保证 SQL 查询有 tenant 条件。
- 不建议把 DDL/config/业务逻辑/前端 E2E 混成一个提交。

## 下一步建议

先执行切片 1：修复 `DashboardService` 的资产统计全表读取。这一项风险最高、范围最小，并且能直接加强根 PRD 的验收标准。
