# Future Settings OS · 信息架构主文档（IA Single Source of Truth）

日期：2026-06-30
状态：活文档，随模块推进更新
配套：`docs/specs/future-settings-os-non-flow-pages-plan.md`（规划）、`docs/superpowers/specs/2026-06-30-future-settings-os-non-flow-pages-implementation-audit.md`（深度矩阵）、各模块 `PRD/PLAN/PHASE.md`

> 本文档是 system-hub 信息架构的权威定义。**架构优先于页面**：任何新页面/菜单/导航变更，先更新本文档，再动代码。

---

## 1. 顶层信息架构

```
系统设置中心（Future Settings OS）
├── 顶栏：UNIVIEW | 系统设置中心 · 6 分组横向导航 · 返回业务工作台 · 用户头像
├── 左栏：当前分组的子菜单（互链，当前项高亮 border-l-4 border-primary）
├── 中栏：沉浸式 H1 + KPI/Stats + 主数据视图（表格/矩阵/树/拓扑）
└── 右栏：contextual Inspector（选中行/节点后的详情/配置/影响分析）
```

**导航契约**：
- 菜单切换**不卸载 shell**（经 `SystemPageHost` + `systemRealPageRegistry`，URL `?menu=` 同步）
- 已登记真组件的菜单 → workbench 内渲染真组件；未登记的 → iframe 兜底设计稿（渐进迁移）
- 老后台 AppLayout 路由保留作过渡，可回退

---

## 2. 菜单注册表（44 项 · 6 组）

> 代码源：`WorkspacePreviewPage.tsx:483` `systemMenuItems` · 派生：`systemMenuGroups`(`:823`) · 判定 `isSystemMenuId`(`:836`)
> 渲染分流：`systemRealPageRegistry`(真组件) / `systemSubpageHtmlByMenuId`(HTML) / `systemNativeRouteByMenuId`(跳走，渐进废弃)

| 分组 | 项数 | 菜单 ID |
|------|:---:|---------|
| 流程平台 | 9 | flow-definition(导航控制台), settings-command-center(流程控制台), flow-designer(流程设计器)★, runtime-monitor, form-config, form-storage, approval-rules, todo-fields, sla-config |
| 组织权限 | 8 | user-management★, role-permissions★, menu-permissions★, dept-org★, post-management★, data-permissions, handover, tenant-management |
| 基础资料 | 6 | asset-category, numbering-rules, location-management, vendor-management, custom-fields, custom-field-sets |
| 集成配置 | 5 | external-systems, interfaces, field-mapping, sync-rules, webhook-config |
| 消息与通知 | 8 | mail-gateway, workflow-mail, mail-templates, mail-logs, notification-templates, notification-channels, notification-preferences, workflow-notification-switch |
| 系统参数 | 8 | base-params, security-policy, file-storage, import-export, cache-management, audit-log, doc-center, tech-support |

★ = 已迁移真组件（workbench 内渲染）。其余 = iframe 设计稿兜底 或 跳走老后台。

**非流程后台菜单 = 35 项**（44 − 流程平台 9）。这是本任务的总范围。

---

## 3. 五条业务关系链（IA 灵魂，非流程页之间必须可读可配可查）

> 来自审计报告 §3。每条链的断点必须打通，否则 IA 不完整。

### 链 1 · 权限链（组织权限组，完整）
```
User ──FK(deptId)──> Dept
User ──M:N(sys_user_role)──> Role ──M:N(sys_role_menu)──> SysMenu [菜单/按钮权限]
                                Role ──M:N(sys_role_dept)──> Dept [数据范围]
                                Role.dataScope(1全部/2自定义/3本部门/4本部门及子/5仅本人)
User ──M:N(sys_user_post)──> SysPost
@DataScope ──aspect──> AmsDataPermissionHandler ──拼SQL──> dept_id/user_id 行级过滤
JWT ──> TenantContext(ThreadLocal) ──> TenantLineInnerInterceptor 行级隔离
Handover(★新建) ──聚合──> 资产/工单/审批待办（离职移交）
```
**模块 1（组织权限）负责**。断点：data-permissions 无可配规则（Phase 5 造）、handover 无后端（Phase 6 造）。

### 链 2 · 主数据链（基础资料组，部分）
```
AssetCategory ──FK(fieldsetId)──> CustomFieldset ──M:N──> CustomField
Asset ──FK(categoryId)──> AssetCategory
Asset ──FK(locationId)──> Location
Asset ──FK(deptId)──> Dept
Contract/PO/Intake/Maintenance/SparePart ──FK(vendorId)──> Vendor  [Asset 无 vendorId]
NumberingRuleService.generate() ──(零调用 ✗断链)──> Asset 创建
```
**模块 2（基础资料）负责**。断点：编号规则未接入资产生成。

### 链 3 · 通知链（消息与通知组，部分）
```
NotificationService ──> NotificationTemplate [渲染] + List<NotificationChannel> [分发]
NotificationChannel(DingTalk) ──> ChannelConfig (真实POST)
BpmMailConfigService.renderAndSend ──(零业务调用 ✗)──> approval/workflow 节点
EmailServiceImpl ──> Thymeleaf (非 MailTemplate ✗)
MailLogRetryScheduler ──每5分钟──> 重试 FAILED
NotificationBizSwitch.isEnabled / NotificationPreferenceService.isEnabled ──(零调用 ✗✗)
```
**模块 4（消息与通知）负责**。断点：4 处（流程邮件/开关/偏好/MailTemplate）。

### 链 4 · 集成链（集成配置组，仅 mock）
```
WebhookService.fireEvent ──(零调用 ✗孤岛)──> Asset/Approval 业务事件
external-systems/interfaces/field-mapping/sync-rules ──(无后端 ✗纯前端)
```
**模块 3（集成配置）负责**。断点：整条链除 webhook 配置 CRUD 外无真实集成。

### 链 5 · 系统参数链（系统参数组，完整偏弱）
```
@OperLog ──aspect──> OperLogAspect ──> sys_operate_log [真实审计,强]
SystemConfigService ──> SystemConfig(SYSTEM/SECURITY 分组)
SystemConfigService.refreshCache ──(空实现 ✗)
FileController ──> 本地 ./uploads
```
**模块 5（系统参数）负责**。断点：缓存空实现、安全策略无独立实体。

---

## 4. 导航层级契约

### 4.1 分组 ↔ 子菜单
- 分组是**第一级导航**（顶栏 6 个 tab），子菜单是**第二级**（左栏）。
- 切换分组 → 左栏子菜单整体替换；切换子菜单 → 中栏+右栏内容替换，shell 不动。
- 当前分组自动展开，其它折叠（`expandedSystemGroups` state）。

### 4.2 状态层级（每页通用）
| 状态 | 触发 | 表现 |
|------|------|------|
| loading | chunk 加载 / API pending | 骨架屏（SystemPageSkeleton，三栏 shimmer） |
| empty | 列表空 / 未选中行 | 空态插画 + 引导操作 |
| error | API 失败 / chunk 失败 | ErrorState + 重试；chunk 失败 → LazyErrorBoundary |
| success | 数据就绪 | 主视图 |
| selected | 选中行/节点 | 右 Inspector 激活 |

### 4.3 跨页关系（IA 必须可读）
- 用户管理选中用户 → Inspector 显示其角色/部门/岗位（链 1 横切）
- 角色权限选中角色 → Inspector 显示其菜单权限 + 数据范围 + 成员（链 1 核心）
- 部门组织选中部门 → Inspector 显示成员 + 数据权限影响（链 1 × 链 5）
- 数据权限规则 → Inspector 显示"规则影响分析"（哪些角色/表受影响）

---

## 5. 实现深度 × 渲染形态矩阵（44 项）

> 来自审计报告 §1-2。决定每页的重构动作。

**深度**：3完整 / 2基础CRUD / 1仅底层 / 0无后端
**形态**：3真组件(embedded) / 2半实装 / 1 iframe设计稿 / 0无

| 组 | 深度3 | 深度2 | 深度1(造后端) | 深度0(从0造) |
|----|-------|-------|---------------|--------------|
| 组织权限 | user,role,menu,tenant | dept,post | **data-permissions** | **handover** |
| 基础资料 | asset-category,location,custom-fieldsets | vendor,custom-fields | **numbering-rules** | — |
| 集成配置 | — | webhook | — | **external-systems,interfaces,field-mapping,sync-rules** |
| 消息通知 | workflow-mail,notif-channels,notif-pref | mail-templates,mail-logs,notif-templates,notif-switch | **mail-gateway** | — |
| 系统参数 | base-params,audit-log | security-policy,import-export | **file-storage,cache-management** | **doc-center,tech-support** |

**重构动作汇总**：
- 挂载即激活（P0）：tenant-management, workflow-mail（僵尸页挂路由）
- 接入断链（P1）：numbering→Asset, workflow-mail/switch/pref→发送决策, webhook→业务事件
- 造后端 CRUD（P2）：data-permissions, mail-gateway, file-storage, cache-management
- 从 0 造（P3）：handover, external-systems/interfaces/field-mapping/sync-rules, doc-center, tech-support
- 增强现有（P4）：12 完整 + 10 Tab 的功能元素做全做精

---

## 6. 设计稿映射（44 张 future-settings-os-*.html）

> 代码源：`WorkspacePreviewPage.tsx:559` `systemSubpageHtmlByMenuId`。所有设计稿在 `frontend/public/mock/workspace-preview/asset-kit-v8/system-hub/subpages/`。

每个菜单 id → `future-settings-os-<id>.html`。设计稿是"100 分目标态"的视觉基准（三栏 shell + KPI + 主视图 + Inspector + Material 图标 + 语义色 pill）。**重构 = 用真组件逐页替换 iframe**。

---

## 7. 技术架构分层（IA 落地的代码骨架）

```
router/index.tsx
  └─ /fixed-assets/workbench → WorkspacePreviewPage (单 Shell，不套 AppLayout)
       └─ dispatch(:43045)
            ├─ isSystemHtmlMode → WorkbenchSystemHtmlFrame (iframe 兜底)
            ├─ isSystemWorkflowCommandCenterMode → 控制台真组件
            ├─ isSystemNativeFlowDesignerMode → 流程设计器真组件
            ├─ isSystemRealPageMode → WorkbenchSystemNativeFlowPlatformShell + SystemPageHost (★新)
            │     ├─ shell: 顶栏+左菜单+中内容+右Inspector(inspector?槽)
            │     └─ SystemPageHost: Suspense(骨架屏) + RealPage(embeddedInWorkbench)
            └─ else → 业务菜单布局
```

**system-hub 模块**（`frontend/src/pages/workspace-preview/system-hub/`）：
- `systemRealPageRegistry.ts` — 菜单id→懒加载真组件（IA 数据：哪些页已迁移）
- `SystemPageHost.tsx` — 通用嵌入包装器（Suspense + embedded 透传）
- `SystemPageSkeleton.tsx` — 三栏骨架屏
- `queryKeys.ts` — 8 资源集中 react-query key（防碎片化污染）
- `components/SystemInspector.tsx` — 右栏 chrome wrapper
- `components/StatsBar.tsx` — KPI 卡通用组件

**模块文档**：`docs/specs/system-hub/<group>/PRD|PLAN|PHASE.md`

---

## 8. IA 完整性检查清单（每模块验收前过一遍）

- [ ] 菜单 id 在 `systemMenuItems` 注册（44 项无缺）
- [ ] 菜单 id 在 `systemSubpageHtmlByMenuId` 有设计稿映射（iframe 兜底）或在 `systemRealPageRegistry` 已登记真组件
- [ ] 左栏导航可从菜单访问（不依赖设计稿内部链接）
- [ ] 分组归属正确（链路内页面同组）
- [ ] 跨页关系链可读（Inspector 横切显示关联实体）
- [ ] loading/empty/error/selected 五态完整
- [ ] 老后台路由保留可回退（除非该页已 100 分）

---

## 9. 变更日志

| 日期 | 变更 | 证据 |
|------|------|------|
| 2026-06-30 | IA 补齐：systemMenuItems 从 37→44 项（+handover/+集成4/+系统参数2），与 plan.md 对齐 | tsc 0 错 + build 通过 |
| 2026-06-30 | 建立本 IA 主文档 | 本文件 |
