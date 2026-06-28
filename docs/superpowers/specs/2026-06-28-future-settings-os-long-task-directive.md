# Future Settings OS 长任务实施指令 + PLAN + PHASE

状态：GAI2 长任务指令  
日期：2026-06-28  
policy_state：CONTINUE  
适用范围：后台设置 OS 优先实施；业务前台仅允许 preview-only；`/dashboard` 受保护保留。  

## 1. Directive / Objective

将现有后台设置页从 tab/CRUD 聚合页升级为 **Future Settings OS**：以任务型设置中枢为第一阶段落地点，配套发布流水线门禁、影响说明、测试连接、审计记录和可回滚操作，让后台设置更易用、维护方便、适合真实人类操作，同时在视觉和交互上与老系统明显拉开差距。

后续 GAI2 goal 续跑时，应把本文档作为权威执行指令，而不是重新讨论目标。续跑目标是分阶段落地后台设置 OS，并在每次代码实施前按 GitNexus 规则做 impact 分析，提交前做 detect_changes。

## 2. Non-negotiable Constraints

1. 后台设置页面可大改、可替换、可重构，且应优先实施。
2. 不强行完全统一所有设置页面；目标是易用性高、维护方便、适合人类操作、足够新、交互友好、展示高级、可差异化。
3. 不以实现成本作为第一约束；体验目标强调科技感、未来感，并与老系统有明显区别。
4. 项目是前后端分离，代码也必须保持前后端分离：前端负责体验层、状态编排、交互和视觉，后端负责 REST/API 契约、权限、租户隔离、校验、审计、发布和回滚能力。
5. `http://localhost:5173/dashboard` 是旧版仪表板过渡保留入口，不得改动、替换或破坏。
6. 业务前台正式入口 `http://localhost:5173/fixed-assets/workbench?menu=home` 不得直接替换；可以后续生成新预览链接，但必须经用户确认后才能挂回正式入口。
7. 涉及页面级新模块时，可以优先用 Stitch 生成独立设计模块，再代码化落地并人工调整；若当前会话没有 Stitch MCP，只能保留 Stitch prompt/设计规格，不得伪造生成结果。
8. Stitch 生成或导出的页面模块默认只能进入 preview-only 或后台设置 allowlist；不得绕过用户确认直接挂回业务前台正式入口。
9. `frontend/src/pages/mobile/**` 冻结，除非用户明确重新开放移动端范围。
10. 工作树有其他用户/历史改动时，不得回滚、整理或清理无关 dirty files。
11. 后续改任何函数、类、方法或共享符号前，必须先运行 GitNexus `impact({target, direction: "upstream"})` 并报告直接调用方、受影响流程和风险等级；HIGH/CRITICAL 必须先警告用户。
12. 提交前必须运行 GitNexus `detect_changes()`；做回归范围审查时使用 `detect_changes({scope: "compare", base_ref: "main"})`。
13. 不得创建 `.omc` 或 Opencode runtime；GAI2 在 Codex 原生目标/线程里续跑。
14. 不得复制 secrets、API key、token、password；工具输出和文档都只记录 redaction 状态。

## 3. Current Truth vs Required Change

### Current Truth

- 当前路由：`/settings` 重定向到 `/settings/sysconfig`，`/settings/:tab` 由 `frontend/src/pages/settings/SettingsPage.tsx` 承载。
- 当前设置页包含 10 个 tab：系统参数、编号规则、SLA 配置、通知偏好、通知模板、通知渠道、流程通知开关、邮件模板、邮件日志、Webhook 配置。
- 自定义字段和字段集已经有独立页面/API：`/system/custom-fields`、`/system/custom-fieldsets`，但不在设置聚合页中。
- 租户已有 `/tenants` API 和 `TenantController`，但设置聚合页没有入口。
- 通知开关前端旧路径使用 `/notification-biz-switches`，后端实际控制器路径是 `/notification-switches`。
- 数据获取模式混用：部分设置页使用 TanStack Query，部分使用手写 `useState`/`useEffect`，部分直连 `http`；SLA 和 Webhook 后续需要统一到 API service + Query 模式。
- `/dashboard` 是旧版仪表板过渡保留入口；`/fixed-assets/workbench` 和 `/fixed-assets/workbench/:section` 是正式业务工作台入口，不能直接替换。
- 历史设计资料已明确后台设置先行、业务前台 preview-only、`/dashboard` 不动、移动端冻结。

### Required Change

- 第一阶段先落地“任务型设置中枢 + 发布流水线门禁”，不要强行完全统一，也不要只做静态智能舱。
- 首期优先页面：系统参数、编号规则、通知渠道、Webhook、邮件日志、SLA。
- 随后将租户、自定义字段/字段集、权限菜单等纳入设置应用卡片或系统管理区，形成可发现、可跳转、可维护的设置入口体系。
- Future OS 层要包含全局命令中心、设置应用卡片、右侧审计/影响 Inspector、发布前预览/测试连接/回滚记录、AI 配置助手、影响拓扑；每一项必须有真实数据来源或后端契约，不能只做装饰假能力。

## 4. Product Principle

- 任务型：每类设置按真实操作任务组织，而不是把所有能力压成同一种表格。
- 可解释：危险配置必须展示影响范围、关联对象、最近变更和发布前检查。
- 可回滚：高风险配置必须有草稿、发布、回滚记录和审计追踪。
- 人类操作优先：高频项支持搜索、过滤、内联快改、批量保存、测试连接、失败重试和明确错误文案。
- 可差异化：权限适合矩阵/树表，集成适合连接测试和健康状态，字段集适合影响拓扑，参数适合密集表格快改。
- 高级但可信：科技感和未来感必须服务于任务，不得用空洞动效替代真实状态、真实契约和真实校验。

## 5. Architecture Boundary

- 前端边界：继续优先基于现有 Vite + React 架构实现后台设置 OS；负责路由、布局、命令中心、应用卡片、Query 缓存、表单状态、视觉交互、Inspector、发布预览展示。
- 后端边界：负责设置资源 API、权限校验、租户隔离、测试连接、发布门禁、回滚记录、审计日志、影响数据和 AI 助手可解释输入。
- 后台设置范围：允许替换 `/settings/**` 的页面形态；允许新增后台设置预览路由或设置 OS 子路由，但必须先做 GitNexus impact。
- 业务前台边界：`/fixed-assets/workbench?menu=home` 与 `/fixed-assets/workbench/:section` 是正式入口；新体验只能先作为 preview-only 链路，用户确认后才可挂回。
- Stitch 页面边界：页面级新体验可以先由 Stitch 生成独立模块，再转换为前端代码并按本仓组件、API、测试和视觉规范调整；未拿到 Stitch 实际产物时只记录 prompt/设计规格，不得把提示词当成已生成页面。
- Dashboard 保护：`/dashboard` 继续作为旧版仪表板过渡保留，不进入本长任务改造范围。
- 移动端保护：`frontend/src/pages/mobile/**` 冻结，不作为 Future Settings OS 首期或后续默认范围。

## 6. PLAN 总览

- Phase 0：续跑启动、GAI2 workcard、GitNexus 与写入范围门禁。
- Phase 1：现状审计与契约盘点。
- Phase 2：信息架构与路由策略。
- Phase 3：设置 OS shell 与任务型中枢。
- Phase 4：首期核心设置页升级。
- Phase 5：发布流水线、Inspector、审计与回滚。
- Phase 6：二期设置应用卡片和系统管理区纳入。
- Phase 7：Future OS 增强能力。
- Phase 8：验收、截图、回归、detect_changes 与交付门禁。

## 7. Detailed PHASES

### Phase 0：续跑启动与门禁

目标：保证后续每次 GAI2 续跑都从同一指令、同一边界、同一验收模型开始。

范围：
- 读取本文档、AGENTS.md、相关设置页和 API 文件。
- 建立 GAI2 workcard：classification、phase、write_scope、allowed paths、acceptance checks、evidence to collect、gap_fingerprint。
- 确认 dirty worktree，仅识别与当前任务相关的文件，不回滚他人改动。

产物：
- 本轮 workcard。
- 写入范围声明。
- 若要改函数/类/方法/共享符号，先输出 GitNexus impact 结果。

验收：
- 已声明 `/dashboard`、业务前台正式入口、移动端冻结和 allowlist。
- 已记录 policy_state。

GitNexus/测试/视觉证据：
- 代码实施前：对目标符号运行 `impact({target, direction: "upstream"})`。
- 文档或只读审计可不运行 impact，除非实际改符号。

### Phase 1：现状审计与契约盘点

目标：建立当前设置域事实表，明确哪些能力可直接改造，哪些需要后端契约补齐。

范围：
- 审计 `frontend/src/router/index.tsx` 中 `/settings`、`/dashboard`、`/fixed-assets/workbench`、`/system/**`、`/m` 路由。
- 审计 `frontend/src/pages/settings/**` 中 10 个 tab 的数据模式、表单模式、错误处理和组件结构。
- 审计 `frontend/src/api/**` 中 systemConfig、customField、tenant、notification、webhook 等服务。
- 审计 `backend/src/main/java/com/ams/controller/**` 中相关 controller。

产物：
- 设置能力矩阵：页面、路由、API、数据模式、风险、缺口。
- API 对齐清单：例如通知开关 `/notification-biz-switches` vs `/notification-switches`。
- 数据获取模式清单：Query、手写状态、直连 http。

验收：
- 每个首期页面都有明确数据来源和缺口。
- SLA/Webhook 统一 API service + Query 的改造范围被标出。

GitNexus/测试/视觉证据：
- 改 API service 前对 service 函数和调用页做 GitNexus impact。
- 改 route 前对路由配置相关符号做 GitNexus impact。

### Phase 2：信息架构与路由策略

目标：设计后台设置 OS 的 IA 和迁移方式，同时保护正式业务入口。

范围：
- 规划 `/settings` 的新中枢入口和 `/settings/:tab` 的兼容策略。
- 明确是否新增 preview 路由，例如 `/settings-os-preview` 或 `/settings/future-os`，再逐步替换 `/settings`。
- 设计设置应用卡片：系统参数、编号规则、SLA、通知渠道、Webhook、邮件日志、租户、自定义字段、字段集、权限菜单。
- 设计右侧 Inspector 的统一数据契约：最近修改、影响范围、风险等级、测试结果、审计日志。

产物：
- IA 图或文档。
- 路由迁移表。
- 后端契约草案。

验收：
- `/dashboard` 不在迁移表中。
- `/fixed-assets/workbench?menu=home` 不被替换，只允许未来生成 preview-only 链路。
- 移动端路由不进入迁移范围。

GitNexus/测试/视觉证据：
- 路由改动前 impact。
- Playwright 访问 `/dashboard`、`/fixed-assets/workbench?menu=home`、`/settings`，确认保护入口未被破坏。

### Phase 3：设置 OS shell 与任务型中枢

目标：落地第一阶段推荐路线：“任务型设置中枢 + 发布流水线门禁”。

范围：
- 构建设置 OS shell：顶部全局命令中心、左侧/主区应用卡片、右侧 Inspector、底部/侧栏发布流水线入口。
- 首屏展示真实设置健康数据：未配置项、最近变更、失败连接、待发布草稿、风险配置数量。
- 命令中心必须能搜索真实设置项、路由和动作；不能只做静态输入框。
- 应用卡片必须链接真实页面或真实 preview，不得只做装饰。

产物：
- 新设置中枢页面。
- 搜索索引/配置注册表。
- Inspector 数据适配层。

验收：
- 用户可以从中枢进入首期六类设置。
- 卡片显示真实计数或明确空态。
- 无真实后端契约的能力必须展示为“待契约补齐”，不得伪造成功状态。

GitNexus/测试/视觉证据：
- impact：SettingsPage、路由、API service、共享 UI 组件。
- 单测：设置注册表、搜索过滤、卡片状态映射。
- Playwright：桌面宽屏、普通桌面、窄屏截图；确认无重叠、可点击、命令中心可用。

### Phase 4：首期核心设置页升级

目标：优先升级系统参数、编号规则、通知渠道、Webhook、邮件日志、SLA，形成可操作的后台设置 OS 首期体验。

范围：
- 系统参数：密集表格、分组筛选、内联快改、批量保存、刷新缓存、变更原因。
- 编号规则：规则试算、冲突检测、示例预览、发布前检查。
- 通知渠道：渠道健康、启停、限流/降级状态、测试发送。
- Webhook：连接测试、签名校验、事件订阅、失败重放、密钥脱敏显示。
- 邮件日志：失败原因、批次追踪、重试动作、筛选导出。
- SLA：优先级矩阵、响应/解决时限、预警比例、影响流程说明。

产物：
- 首期页面改造。
- API service + TanStack Query 统一封装。
- 错误和 loading 空态规范。

验收：
- 每个页面都有真实数据路径。
- SLA/Webhook 不再散落直连 `http`，统一到 service + Query 模式。
- 通知开关路径不一致问题被修复或显式排进阻塞清单。

GitNexus/测试/视觉证据：
- 每个被改函数/组件/服务前运行 impact。
- Vitest：API service 调用路径、Query key、状态映射。
- Playwright：新增/编辑/测试连接/保存/错误空态。
- 截图：首期六页至少各一张桌面截图，关键交互至少一张状态截图。

### Phase 5：发布流水线、Inspector、审计与回滚

目标：让用户敢于修改配置，能在发布前看到影响、发布后看到记录、出错后可回滚。

范围：
- 发布流水线：草稿、校验、预览、发布、回滚。
- Inspector：影响范围、调用页面、相关流程、最后修改人、审计记录、风险等级。
- 测试连接：通知渠道、Webhook、邮件网关等集成类配置优先。
- 回滚记录：展示上一个稳定版本、差异摘要、回滚动作和结果。

产物：
- 发布门禁 UI。
- Inspector 数据契约。
- 后端接口需求文档或实现。

验收：
- 高风险修改不能绕过发布前预览。
- 审计记录来自真实 API 或明确的后端契约。
- 回滚动作有确认、结果反馈和审计记录。

GitNexus/测试/视觉证据：
- impact：发布相关服务、审计服务、设置页调用方。
- API contract tests：发布/回滚/审计接口。
- Playwright：发布前预览、测试连接失败、回滚确认。

### Phase 6：二期设置应用卡片和系统管理区纳入

目标：把租户、自定义字段/字段集、权限菜单等从分散入口纳入设置 OS 的可发现体系。

范围：
- 租户：对接 `/tenants` API，作为设置应用卡片或系统管理区入口。
- 自定义字段/字段集：保留现有 `/system/custom-fields`、`/system/custom-fieldsets` 真实页面，可从设置 OS 卡片进入。
- 权限菜单：系统用户、角色、菜单、部门、岗位等以系统管理区组织。
- 不强行重写已有成熟页面；先统一入口、状态和影响说明。

产物：
- 设置应用卡片二期。
- 系统管理区导航。
- 入口状态和权限可见性规则。

验收：
- 用户能从设置 OS 找到租户、自定义字段/字段集、权限菜单。
- 不破坏原有 `/system/**` 独立页面。
- 入口显示真实权限状态或无权限说明。

GitNexus/测试/视觉证据：
- impact：路由、权限判断、卡片注册表。
- 单测：权限可见性、卡片链接、空态。
- Playwright：跳转链路和返回中枢链路。

### Phase 7：Future OS 增强能力

目标：在真实数据和契约基础上补齐高级能力，不做纯装饰。

范围：
- 全局命令中心：搜索设置项、路由、动作、最近访问、快捷操作。
- 设置应用卡片：健康度、待处理项、最近变更、权限状态。
- 右侧审计/影响 Inspector：审计、影响、风险、测试、回滚。
- 发布前预览/测试连接/回滚记录：优先集成类和高风险参数。
- AI 配置助手：必须基于真实配置、审计、错误和后端契约；首期可作为解释/建议层，不能自动改配置。
- 影响拓扑：基于字段集、通知链路、SLA 流程或权限关系；没有后端数据时先做契约，不做假图。

产物：
- Future OS 能力注册表。
- AI 助手安全边界。
- 影响拓扑数据契约。

验收：
- 每项高级能力都能追溯到真实数据或后端契约。
- AI 助手不暴露 secrets，不自动执行高风险动作。
- 影响拓扑没有数据时展示可解释空态。

GitNexus/测试/视觉证据：
- impact：AI 助手服务、拓扑数据服务、命令中心动作。
- 安全审查：敏感字段脱敏、日志不含 token/password。
- Playwright：命令中心、Inspector、拓扑空态/有数据态。

### Phase 8：验收、回归、交付门禁

目标：以证据完成阶段交付，避免“看起来完成但未覆盖硬约束”。

范围：
- AC-1..AC-12 验收。
- 路由保护回归。
- 首期页面交互回归。
- GitNexus detect_changes。
- 截图和 URL 证据归档。

产物：
- 验收报告。
- 截图清单。
- commands_run 和 verification_results。
- residual_risks 和 out_of_scope_refusals。

验收：
- `/dashboard` 可访问且未被替换。
- `/fixed-assets/workbench?menu=home` 正式入口未被直接替换。
- 移动端目录无写入。
- 提交前 detect_changes 输出符合预期范围。

GitNexus/测试/视觉证据：
- `detect_changes()` 或 compare main 的 detect_changes。
- `pnpm test` / 目标 Vitest。
- `pnpm e2e` 或目标 Playwright。
- 桌面和窄屏截图。

## 8. Implementation Backlog

### 首期：后台设置核心可用

- 设置 OS shell：任务型中枢、命令中心、应用卡片、Inspector 框架。
- 系统参数：快改、批量保存、刷新缓存、审计说明。
- 编号规则：试算、冲突检测、发布前预览。
- 通知渠道：健康状态、测试发送、失败说明。
- Webhook：测试连接、签名校验、事件订阅、失败重放。
- 邮件日志：筛选、批次、失败重试。
- SLA：优先级矩阵、保存、影响说明。
- API 统一：SLA/Webhook/service/Query 模式。
- 通知开关路径：对齐 `/notification-switches` 或提供兼容层。

### 二期：系统管理区纳入

- 租户入口：卡片、列表链接、当前租户状态、配额概览。
- 自定义字段/字段集：入口整合、影响说明、字段集关联。
- 权限菜单：用户、角色、菜单、部门、岗位卡片。
- 入口权限：无权限显示说明，避免死链接。
- 跨入口返回：从系统管理区回到设置 OS。

### 三期：Future OS 高级能力

- AI 配置助手：解释、建议、生成草稿，禁止默认自动发布。
- 影响拓扑：字段集、通知链路、SLA 流程、权限菜单。
- 发布流水线深化：版本差异、回滚历史、审批门禁。
- 审计分析：高风险操作、频繁失败、最近变更热区。
- 预览链接策略：业务前台新体验仅 preview-only，用户确认后才挂回正式入口。

## 9. Acceptance Checks AC-1..AC-12

- AC-1：后台设置页面先行，允许大改/替换/重构，且首期实现聚焦 `/settings` 相关后台设置。
- AC-2：明确不强行完全统一，按任务差异化设计，维护性、易用性、人类操作优先。
- AC-3：体现科技感/未来感，但每项高级能力都绑定真实数据或后端契约。
- AC-4：`/dashboard` 保留且不动。
- AC-5：业务前台 `/fixed-assets/workbench?menu=home` 只能 preview-only 后再经用户确认挂回，不能直接替换正式入口。
- AC-6：移动端 `frontend/src/pages/mobile/**` 冻结。
- AC-7：前后端分离边界清晰，前端体验层与后端契约层职责分明。
- AC-8：后续改函数/类/方法/共享符号前必须 GitNexus impact；提交前必须 detect_changes。
- AC-9：当前审计事实被纳入，包括 `/settings` tab、字段/字段集、租户 API、通知开关路径差异、数据获取混用、dashboard/workbench 边界。
- AC-10：第一阶段路线选择明确为“任务型设置中枢 + 发布流水线门禁”。
- AC-11：首期、二期、三期 backlog 明确，首期包含系统参数、编号规则、通知渠道、Webhook、邮件日志、SLA。
- AC-12：验收证据覆盖单测、Playwright、截图、URL、GitNexus impact/detect_changes、write-scope 和 redaction 状态。

## 10. Evidence / Verification Plan

- 单测：
  - API service 路径和参数映射。
  - 设置注册表、卡片筛选、命令中心搜索。
  - Query key、缓存失效和错误状态。
  - 权限可见性和入口链接。
- Playwright：
  - `/settings` 新中枢加载。
  - 首期六页进入、保存、测试连接、错误空态。
  - `/dashboard` 仍访问旧版仪表板。
  - `/fixed-assets/workbench?menu=home` 未被替换。
  - 移动端路由 smoke 只读验证，不改移动端源码。
- 截图：
  - 设置 OS 首屏宽屏截图。
  - 命令中心打开态。
  - Inspector 展开态。
  - 发布前预览/测试连接/回滚状态。
  - 首期六页关键状态。
- URL：
  - `http://localhost:5173/settings`
  - `http://localhost:5173/settings/sysconfig`
  - `http://localhost:5173/settings/numbering`
  - `http://localhost:5173/settings/notif-channel`
  - `http://localhost:5173/settings/webhook`
  - `http://localhost:5173/settings/mail-log`
  - `http://localhost:5173/settings/sla-config`
  - `http://localhost:5173/dashboard`
  - `http://localhost:5173/fixed-assets/workbench?menu=home`
- GitNexus：
  - 任何代码实施前：`impact({target: "symbolName", direction: "upstream"})`。
  - HIGH/CRITICAL：先警告用户并等待明确继续。
  - 提交前：`detect_changes()`。
  - 回归比较：`detect_changes({scope: "compare", base_ref: "main"})`。
- Redaction：
  - Webhook secret、邮件认证、token、password、API key 只显示脱敏状态。
  - 任何日志、截图、文档不得复制原始敏感值。

## 11. GAI2 Resumption Rules

每次续跑必须执行以下启动顺序：

1. 宣告 GAI2 Continuation Boot。
2. 读取本文档、AGENTS.md 和本轮目标。
3. 建立 workcard：classification、phase、write_scope、allowed paths、current truth、required change、delegation、AC、evidence、open risks。
4. 记录 policy_state：默认 `CONTINUE`，除非用户明确暂停或目标完成。
5. 记录 gap_fingerprint：如果上轮为 PARTIAL/FAIL，必须先证明该 gap 已关闭。
6. 中大型工作必须建立 `gai2-orchestrator` 调度；代码写入交给 `gai2-builder`；完成判断交给 `gai2-reviewer`。
7. 中文 GAI2 续跑时，子智能体必须有中文别名和第一行身份输出。
8. 每个子智能体结果被消费后必须关闭，并在 subagent ledger 中记录 consumed/closed。
9. 后续任何源码写入前都必须先做 GitNexus impact。
10. 不创建 `.omc` 或 Opencode runtime；不复制 secrets。
11. 写入范围必须显式：readonly、allowlist 或 unrestricted。
12. 移动端、dashboard、业务前台正式入口默认保护，除非用户明确重新开放范围。

## 12. Risk Ledger

| 风险 | 等级 | 触发条件 | 缓解 |
| --- | --- | --- | --- |
| 误替换业务前台正式入口 | Critical | 修改 `/fixed-assets/workbench` 正式路由或菜单挂载 | 仅 preview-only；用户确认后才能挂回 |
| 破坏 `/dashboard` | High | 改旧仪表板路由、组件或 API | 设为保护 URL；Playwright 回归 |
| 移动端误改 | High | 写入 `frontend/src/pages/mobile/**` | 默认冻结；write_scope 拒绝 |
| API 路径不一致 | High | 通知开关继续使用旧 `/notification-biz-switches` | 对齐 `/notification-switches` 或兼容层；补测试 |
| 假高级能力 | Medium | AI/拓扑/Inspector 无真实数据 | 无契约时只展示待补齐，不展示假成功 |
| 数据模式继续分裂 | Medium | 新页面继续直连 `http` 或散落状态 | API service + TanStack Query 统一 |
| 影响范围未知 | High | 改共享符号前未 impact | GitNexus impact 门禁 |
| 脏工作树误回滚 | High | 清理无关 dirty files | 只处理本任务路径，不回滚他人改动 |
| 敏感信息泄露 | Critical | Webhook secret、token、password 入文档/日志 | 脱敏、redaction 状态、禁止复制原值 |

## 13. Sources / Research Evidence

### Local Evidence

- `frontend/package.json`：当前前端为 Vite 6.4.2、React 18.3.1、React Router 7.17、Tailwind CSS 4.1、`@tailwindcss/vite`、Radix、cmdk、lucide-react、motion、TanStack Query、antd 6.4.3。
- `frontend/src/router/index.tsx`：`/settings` -> `/settings/sysconfig`，`/settings/:tab` 承载设置页；`/dashboard` 为旧版仪表板；`/fixed-assets/workbench` 为正式业务工作台；移动端在 `/m` 路由下。
- `frontend/src/pages/settings/SettingsPage.tsx`：当前设置页为 10 个 tab 的聚合导航。
- `frontend/src/api/customField.ts` 与后端 `CustomFieldController`、`CustomFieldsetController`：自定义字段/字段集已有 `/system/custom-fields`、`/system/custom-fieldsets`。
- `frontend/src/api/tenant.ts` 与后端 `TenantController`：租户已有 `/tenants` API。
- `frontend/src/api/notificationTemplate.ts` 与 `NotificationBizSwitchController`：前端旧路径 `/notification-biz-switches`，后端实际 `/notification-switches`。
- `frontend/src/pages/settings/SlaConfigTab.tsx`：SLA 使用 TanStack Query 但直连 `http`。
- `frontend/src/pages/settings/WebhookConfigTab.tsx`：Webhook 使用手写状态和 API 函数，后续应统一 Query 模式。
- `.superpowers/brainstorm/8566-1782585176/**`：历史方向明确后台设置先行、任务型设置中枢推荐、业务前台 preview-only、`/dashboard` 不动。

### Official Frontend References

这些资料作为前沿参考，不要求首期迁移：

- React 官方博客：https://react.dev/blog
- Next.js 官方博客：https://nextjs.org/blog
- Next.js 官方文档：https://nextjs.org/docs
- Tailwind CSS v4：https://tailwindcss.com/blog/tailwindcss-v4
- Tailwind CSS docs：https://tailwindcss.com/docs
- TanStack Query React docs：https://tanstack.com/query/latest/docs/framework/react/overview
- Radix UI docs：https://www.radix-ui.com/primitives/docs/overview/introduction
- Motion docs：https://motion.dev/docs/react
- shadcn/ui docs：https://ui.shadcn.com/docs
- Ant Design docs：https://ant.design/docs/react/introduce

### Technical Conclusion

先用现有 Vite + React 架构实现后台设置 OS；不要把“框架迁移”放在首期关键路径。Next.js 或 React 19 可作为后续独立迁移评估项，必须单独做兼容性、构建、路由、部署和回归成本评估。
