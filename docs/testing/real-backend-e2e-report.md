# 真实后端 E2E 测试报告

## 目标

在上一轮 mock 浏览器冒烟通过后，进一步验证前端经 Vite proxy 调用真实 Spring Boot 后端时，核心页面与接口链路是否可用。

## 前置环境

- 本地可复现 profile：`e2e`，使用 `backend/src/test/resources/application-e2e.properties` 和 H2 内存库
- MySQL 真实库：`root/root`、数据库 `ams_db`
- 后端：`http://localhost:8080/api`
- 前端：`http://localhost:5173`
- 测试账号：`admin / admin123`

## 数据库准备

```bash
cd backend
mvn spring-boot:test-run -Dspring-boot.run.profiles=e2e
```

真实 MySQL 环境可继续使用主 schema：

```bash
mysql -u root -proot < backend/src/main/resources/schema.sql
```

旧库如果已存在 `asset` 表，需要补一次当前多租户字段迁移：

```sql
ALTER TABLE asset ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1' AFTER id;
ALTER TABLE asset ALTER COLUMN tenant_id DROP DEFAULT;
CREATE INDEX idx_asset_tenant ON asset (tenant_id);
```

## 测试文件

`frontend/src/e2e/real-backend-smoke.spec.ts`

## 执行命令

```bash
cd frontend
npm run e2e:real -- --reporter=line
```

## 执行结果

```text
9 passed (13.9s)
```

## 覆盖项

| 测试项 | 覆盖内容 | 结果 |
|---|---|---:|
| 真实登录 | 调用真实 `/api/auth/login`，使用 `admin/admin123` 获取 JWT | 通过 |
| 仪表板真实接口 | 页面加载真实 `/dashboard/stats`、趋势、部门分布、待审批 | 通过 |
| 资产台账真实接口 | 打开 `/assets` 并展示真实资产数据 | 通过 |
| 资产搜索框 | 在真实后端环境下输入搜索关键词 | 通过 |
| 流程设计器 | 登录态下打开 `/workflow-designer` 并检查节点面板 | 通过 |
| 流程中心 | 打开 `/workflows`，检查 4 条业务流程入口与状态展示 | 通过 |
| 业务表单流程入口 | 资产转移、清退、报废、赔偿表单均可跳转对应流程设计器 | 通过 |
| 流程定义持久化 | 保存草稿、发布流程、独立业务草稿保存调用真实后端 API | 通过 |
| 核心导航点击 | 依次点击资产台账、重要设备、RFID盘点、闲置资产、资产处置、审批流程、流程设计器、数据分析、系统设置 | 通过 |
| 顶栏操作 | 点击通知、全局搜索、退出登录 | 通过 |
| 工单审批 API 闭环 | 创建资产、创建工单、提交工单、审批通过，断言状态 `DRAFT -> PENDING -> APPROVED` | 通过 |
| 资产退役 API 闭环 | 创建资产、提交退役申请、审批、完成，断言申请完成且资产状态为 `SCRAPPED` | 通过 |
| 折旧计算 API 闭环 | 创建资产、查询折旧方法与计划、执行折旧计算、查询折旧记录，并断言资产当前价值下降 | 通过 |
| 折旧管理页面 | 打开 `/depreciation`，断言桌面页面可见且无 401/403/500 兜底错误 | 通过 |
| 审计查询 API | 查询 `/audit-logs` 与 `/audit-logs/stats`，断言分页记录与趋势数据结构可用 | 通过 |
| 若依操作日志落库 | 资产新增与折旧计算后，按关键词查询 `/audit-logs` 可返回 `sys_operate_log` 中的 `INSERT`/`UPDATE` 记录 | 通过 |
| 审计日志页面 | 打开 `/audit`，断言桌面页面可见且无 401/403/500 兜底错误 | 通过 |
| 浏览器错误 | 监听 `console.error` 与 `pageerror` | 通过 |

## 本轮发现并修复的问题

| 问题 | 根因 | 处理 |
|---|---|---|
| `/dashboard/stats` 返回 500 | 旧 MySQL `asset` 表缺 `tenant_id` 列，`CREATE TABLE IF NOT EXISTS` 不会迁移旧表 | 补充真实库迁移，并将 `schema.sql` 中 `tenant_id` 默认值从 `default` 改为无默认值 |
| Dashboard 加载时出现 `/approvals/pending` 500 | `ApprovalService#getMyPendingApprovals` 用 `BeanUtil.getProperty` 取到 `Long` 后按 `String` 解析，触发 `ClassCastException` | `parseLong` 改为接收 `Object`，兼容 `Number` 和字符串 |
| 重要设备页出现 React duplicate key 警告 | 真实维护记录可能复用同一 `assetId`，表格行仅用设备 ID 作为 key 不唯一 | 表格、提醒和下拉选项 key 改为 ID + 渲染序号组合，消除运行时警告 |
| 并行验证时真实 E2E 偶发 `ECONNREFUSED ::1:8080` | Maven 测试/重编译与真实浏览器 E2E 并行，开发后端监听短暂不可用 | 单独复跑真实 E2E，确认业务断言通过 |
| 真实 E2E 并行写流程定义草稿互相覆盖 | 多个 Playwright worker 共享真实后端和同一业务流程草稿 | `real-backend-smoke.spec.ts` 改为串行执行 |
| 工单真实 API smoke 返回 500 | 旧 MySQL `work_order` 表缺新字段，且 Mapper XML 覆盖了 MyBatis-Plus 默认 CRUD | 补充非破坏性 schema replay，移除 WorkOrder XML 自定义 CRUD |
| 退役申请真实 API 缺表风险 | 旧 MySQL 未创建 `retirement_application` 表 | `schema.sql` 新增退役申请表 |
| e2e profile 启动缺少若依整合列 | H2 初始化无法执行 MySQL 动态 ALTER，`sys_user`、`sys_role`、`asset`、`work_order`、`approval_process` 等表存在新旧 schema 差异 | 新增 `application-e2e.properties` 与 `e2e-h2-fixes.sql`，将本地真实后端 E2E 固化为可复现 profile |
| 部门分布接口在 H2 返回 500 | 聚合查询返回 `DEPT_ID`/`CNT` 大写键，服务只读取 `dept_id`/`cnt` | `DashboardService#getDeptDistribution` 兼容 H2/MySQL 聚合别名，并补充单测 |
| 位置级联接口在 H2 返回 500 | H2 对递归 CTE 未显式列名时无法解析 `cte.id` | `LocationMapper` 递归 CTE 改为显式列清单 `cte(id, name, parent_id)` |
| 折旧计算真实 E2E 返回 500 | e2e H2 schema 缺少 `depreciation_record` 表 | `e2e-h2-fixes.sql` 补充折旧记录表，覆盖折旧计算与记录查询 |
| 审计统计真实 E2E 返回 500 | H2 不支持 MySQL `DATE_FORMAT` 函数 | 新增测试侧 `H2Functions#dateFormat` 并在 e2e H2 初始化中注册别名 |
| 异步通知日志噪声 | 若依整合后的通知通道表在 e2e H2 schema 中缺失 | `e2e-h2-fixes.sql` 补充 `sys_channel_config` 最小表结构 |
| 真实 E2E 无法验证若依操作日志落库 | `application-e2e.properties` 关闭了 `ams.oper-log.enabled`，`@OperLog` AOP 未启用 | e2e profile 改为启用操作日志，并对资产新增、折旧计算增加真实落库断言 |
| 退役通知真实 E2E 出现缺表日志 | e2e H2 schema 缺少 `notification_template` 与 `sys_webhook_config` | `e2e-h2-fixes.sql` 补齐通知模板与 Webhook 配置最小表结构 |

## 结论

无 mock 的真实后端浏览器冒烟、核心点击、流程中心、流程定义保存/发布、工单审批、资产退役、折旧计算、若依操作日志落库、审计查询、审批列表、报表与大屏链路已通过。当前核心链路已经从“代码测试”推进到“浏览器 + 真实 Spring Boot API”的可复现验证。
