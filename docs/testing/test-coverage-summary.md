# 测试覆盖汇总

## 执行结果

| 类型 | 命令 | 结果 |
|---|---|---:|
| 前端单元测试 | `cd frontend && npm test -- --run` | 14 个测试文件，634 个测试通过 |
| 前端构建 | `cd frontend && npm run build` | 通过 |
| 浏览器冒烟测试 | `cd frontend && npm run e2e -- --reporter=line` | 15 个测试通过 |
| 真实后端 E2E | `cd frontend && npm run e2e:real -- --reporter=line` | 8 个测试通过，含核心导航、顶栏点击、流程中心、流程定义保存/发布、工单审批、资产退役 API 闭环、赔偿页面与大屏页面 |
| 后端测试 | `cd backend && mvn test` | 98 个测试通过 |
| 流程定义服务测试 | `cd backend && mvn -q -Dtest=WorkflowDefinitionServiceTest test` | 6 个测试通过，覆盖默认列表、保存草稿、发布、启停、未发布拦截 |
| 赔偿流程发布与估值 | `cd backend && mvn -q -Dtest=CompensationServiceTest,WorkflowDefinitionServiceTest test` | 通过，赔偿提交必须存在已发布 `ASSET_COMPENSATION` 流程；缺金额时按资产当前价值/原值自动估值 |
| WorkOrder/Retirement 闭环 | `cd backend && mvn -q -Dtest=WorkOrderServiceTest,WorkOrderControllerTest,ApprovalServiceTest,RetirementApplicationServiceTest,RetirementControllerTest,AssetLifecycleServiceTest test` | 通过 |
| 后端编译 | `cd backend && mvn -q -DskipTests compile` | 通过 |
| PRD多租户测试 | `cd backend && mvn -q -Dtest=TenantIsolationIntegrationTest test` | 通过 |
| WorkOrder/Approval 租户隔离 | `cd backend && mvn -q -Dtest=WorkOrderServiceTest,ApprovalServiceTest,TenantIsolationIntegrationTest test` | 通过 |
| 主业务租户隔离扩展 | `cd backend && mvn -q -Dtest=CompensationServiceTest,TenantIsolationIntegrationTest test` | 通过 |
| 前端覆盖率门禁 | `cd frontend && npm run test:coverage -- --run` | 14 个测试文件，634 个测试通过，行覆盖率 100% |
| 前端安全审计 | `cd frontend && npm audit --audit-level=high` | 0 vulnerabilities |
| Node 版本 | `cd frontend && node -v` | `v22.22.2`，满足 `.nvmrc`、`frontend/package.json engines.node` 和 `happy-dom@20.9.0` 的 Node `>=20` 要求 |

## 保留项

| 范围 | 命令 | 当前结果 |
|---|---|---|
| Node 版本一致性 | `cd frontend && node -v` | 本机为 `v22.22.2`；CI/部署需保持 Node `>=20` |
| 折旧生产链路 | 待补 Java Controller/Service/API 测试 | 当前仅有资产折旧字段与自包含算法测试，未形成 Spring Boot API 闭环 |
| 审计/操作日志生产链路 | 待补 Java Controller/Service/schema/API 测试 | 当前后端审计组件仍是 marker/占位实现，前端页面未挂主路由 |

## 模块文档清单

| 模块 | 文档 |
|---|---|
| 资产台账管理 | `docs/testing/module-01-asset-registry.md` |
| 重要设备管理 | `docs/testing/module-02-important-equipment.md` |
| RFID资产盘点 | `docs/testing/module-03-rfid-inventory.md` |
| 闲置资产管理 | `docs/testing/module-04-idle-assets.md` |
| 资产赔偿管理 | `docs/testing/module-05-compensation.md` |
| 审批流程管理 | `docs/testing/module-06-approval-workflow.md` |
| 数据统计分析 | `docs/testing/module-07-analytics-dashboard.md` |
| 系统设置 | `docs/testing/module-08-system-settings.md` |
| 多租户PRD | `docs/testing/prd-tenant-isolation-coverage.md` |
| 浏览器冒烟 | `docs/testing/browser-smoke-report.md` |
| 真实后端 E2E | `docs/testing/real-backend-e2e-report.md` |
| WorkOrder/Retirement 闭环 | `docs/testing/workorder-retirement-closure.md` |

## 覆盖结论

核心模块的按钮、搜索、提交、保存、删除、审批、扫描等交互均已在文档中标注对应代码路径和验证命令。当前自动化测试以服务/控制器/状态/API 层为主，真实浏览器端逐按钮 E2E 可在 Playwright 场景中继续扩展。

本轮新增流程定义服务覆盖：默认 4 条业务流程列表、按租户保存草稿、发布版本递增、空节点发布拦截、启用/停用状态切换、未发布流程提交拦截。

本轮关闭赔偿流程残留风险：`CompensationService#createCompensation` 已接入 `WorkflowDefinitionService#requirePublishedDefinition("ASSET_COMPENSATION")`，并新增未发布流程拦截测试。

本轮新增赔偿估值最小闭环：后端新增 `POST /compensations/valuation`，创建赔偿单时如果未传赔偿金额，会按资产当前价值估算，当前价值缺失时使用资产原值；前端新增“系统估值”按钮并允许人工覆盖。

本轮关闭前端依赖安全风险：`happy-dom` 与 `vite` 已升级，`npm audit --audit-level=high` 返回 0 vulnerabilities；当前 Node `v22.22.2` 满足新依赖运行要求。仓库已新增 `.nvmrc` 并在 `frontend/package.json` 声明 `engines.node >=20`，CI 配置和关键文档已同步到 Node 20+。

本轮新增认证闭环浏览器覆盖：未登录访问受保护页面会跳转登录页；退出登录会清理本地会话并返回登录页。该测试曾发现退出后 URL 已到 `/login` 但旧布局仍渲染的问题，已通过 `AuthContext#logout` 改为由 auth state 驱动路由跳转修复。
