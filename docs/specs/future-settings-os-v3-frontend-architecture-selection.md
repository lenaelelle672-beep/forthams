# Future Settings OS v3 后端系统页面前端架构选型

> 版本日期：2026-07-02  
> 文档角色：V3 后端系统页面前端架构选型基线，和 V3 PRD、后端架构、流程平台参考、流程引擎选型文档同目录维护。  
> 证据来源：`.omc/gai2/sessions/20260702-backend-ui-architecture-research/architecture-selection-report.md`、`research.json`、`debate.json`、`review.json`。  
> Review 状态：GAI2 reviewer `PASS`。

## 1. 一句话结论

V3 后端系统页面当前主推：

```text
V3 增强型 React/Vite 后台操作系统架构
```

也就是不先整体迁移到 Next.js、TanStack Start、SvelteKit、Qwik、Astro 或微前端，而是在现有 V3 壳上升级成可治理的后台操作系统：

- 保留 `React 18 + Vite + React Router + React Query + Tailwind v4 + Radix/shadcn-like` 当前基线。
- 继续围绕 `SystemPageHost`、`systemRealPageRegistry`、`systemModuleRegistry`、`SystemInspectorSlotProvider` 建立统一后台架构层。
- 补齐资源注册、权限元数据、风险元数据、审计协议、URL 状态、Inspector、六域 IA 和合同测试。
- 长期吸收 `TanStack Router-first / TanStack Start` 的类型化 URL 状态、loader/serverFn、Query/Table/Form 协同思想。
- `Next.js App Router` 保留为未来绿地后台或独立 POC 强备选。

核心原则：**先把 V3 做成后台操作系统，不先换框架。**

## 2. 本地事实基线

本选型已经纳入以下 V3 事实：

| 事实 | 对架构选型的影响 |
| --- | --- |
| V3 入口固定为 `/fixed-assets/workbenchv3` | 当前是独立后台壳，不应被旧 `/fixed-assets/workbench` 或旧 `WorkspacePreviewPage` 牵动。 |
| 真组件通过 `SystemPageHost activeMenu` 承载 | 应继续强化 registry 与 host 协议，而不是重写所有页面。 |
| 右侧详情由 `SystemInspectorSlotProvider` 注入 | Inspector 应成为 V3 后台的核心交互模式。 |
| 目标 IA 是 44 项 / 6 组 | 前端架构必须能承载流程平台 9、组织权限 8、基础资料 6、集成配置 5、消息与通知 8、系统参数 8。 |
| 当前 registry 覆盖小于目标 IA | 第一阶段重点是资源注册和占位/真实组件统一，而不是换 UI 栈。 |
| 旧 Workbench、旧 Settings Tab、独立 `/system/*`、HTML mock 与 V3 真组件壳多轨并存 | 架构必须支持渐进收敛和可回退。 |
| 后端契约要求权限、审计、租户隔离、敏感字段脱敏、幂等提交、缓存刷新、Webhook、邮件、通知、流程表单等横切能力 | 前端需要统一权限、安全、数据和审计协议。 |
| 流程平台需要门户、设计中心、表单中心、运行监控和 Case/Record 业务视图分层 | 流程平台不能被当成普通 CRUD。 |
| 移动端冻结 | 本选型不触碰 `frontend/src/pages/mobile/**`。 |

## 3. 调研范围

### 3.1 前沿技术架构

本轮覆盖不少于 5 个前沿架构方向：

| 候选 | 定位 | 主要价值 | 主要风险 |
| --- | --- | --- | --- |
| V3 增强型 React/Vite 后台操作系统架构 | 当前主推 | 最大化复用现有资产，直接解决 registry、权限、Inspector、六域 IA 与多轨收敛 | 平台层变厚，需要强治理和合同测试 |
| TanStack Start / Router-first React | 长期演进方向 | URL 状态、类型化路由、loader/serverFn、Query/Table/Form 协同适合后台 | `TanStack Start` 仍需等待稳定性与隔离 POC |
| Next.js App Router + RSC + Streaming | 绿地强备选 | 生态成熟、服务端边界清晰、Streaming/RSC/BFF 能力强 | 当前 Vite SPA 迁移成本高，会重塑工程契约 |
| 微前端 / 模块联邦 | 组织级隔离备选 | 可支持六域独立发布和运行时隔离 | 过早引入会放大路由、权限、主题、依赖和测试复杂度 |
| SvelteKit / Svelte 5 | 性能与交互参考 | 编译器优化、极简组件、细粒度响应性 | 跨框架迁移削弱 React 资产复用 |
| Astro Islands / Server Islands | 文档与静态帮助路线 | 静态外壳、少 JS，适合帮助/文档/技术支持 | 不适合作为完整高密度后台主应用 |
| Qwik Resumability | 技术观察 | 无 hydration、低 JS、性能理念先进 | 企业后台、权限矩阵和流程平台长期案例不足 |

### 3.2 成熟企业或社区项目

本轮覆盖不少于 5 个成熟项目或企业实践：

| 项目 / 实践 | 可借鉴模式 | 对 V3 的启发 |
| --- | --- | --- |
| Linear.app | 高密度对象管理、命令中心、低噪音反馈、右侧上下文、人类 + agent 协作 | 后台操作应强调 Diff、影响解释、审计来源和可恢复操作。 |
| Vercel Dashboard | 多租户、项目/环境上下文、运行状态、失败重试、平台控制台叙事 | 集成配置、系统参数和诊断页需要状态化控制台。 |
| Camunda 8 | Console / Web Modeler / Operate / Tasklist 分离 | 流程平台必须分门户、设计、运行、任务，不应混成一个 CRUD 页面。 |
| Flowable | Task / Admin / Control / Modeler 多应用解耦 | 管理、设计、运行控制可共享壳协议，但页面模型要分层。 |
| ProcessMaker | Launchpad、Designer、Screens、Cases | 表单资源与流程绑定需要资产化、版本化和 Case 视图。 |
| Appian | Designer、Process HQ、Record Types / Data Fabric | 业务对象视图比裸流程实例更适合人类理解。 |
| ServiceNow / Power Automate | Record-centric、Flow executions、Solutions、Dataverse 结合 | 流程运行状态、业务记录、审批和审计应统一呈现。 |
| Ramp / OpenAI via Linear | agent 参与组织协作，权限、审批、审计与回滚显性化 | 为 AI/agent 操作来源、审批链和回滚提示预留协议。 |

## 4. 评分模型

评分采用 0-10 分制，按权重折算为 100 分。

| 维度 | 权重 | 解释 |
| --- | ---: | --- |
| D1 V3 现状与渐进迁移适配度 | 18 | 必须保护当前 Vite SPA、React 18、React Router、SystemPageHost、Inspector 和合同测试。 |
| D2 企业后台复杂交互承载力 | 16 | 表格、树、矩阵、批量操作、导入导出、流程画布、表单设计器和运行监控。 |
| D3 成熟度与生态稳定性 | 14 | 企业采用、稳定文档、活跃维护和长期兼容。 |
| D4 人性化与可理解性 | 12 | 权限影响、配置后果、流程状态、风险提示和可恢复操作。 |
| D5 安全、权限、审计、租户和敏感字段契合度 | 12 | route/menu/button/API 权限、租户隔离、脱敏与审计。 |
| D6 渐进迁移与双轨收敛能力 | 10 | 收敛 Settings、旧 Workbench、独立 `/system`、HTML mock 与 V3 壳。 |
| D7 性能与可维护性 | 8 | 分包、缓存、虚拟化、画布性能和避免巨型页面膨胀。 |
| D8 测试与验证友好度 | 6 | registry、权限元数据、合同测试、组件测试和浏览器 smoke。 |
| D9 设计系统与可视化表达 | 4 | 浅蓝白玻璃后台、流程图、指标卡、诊断视图和 Inspector。 |

## 5. 评分排名

| 排名 | 架构 | 总分 | 裁决 |
| ---: | --- | ---: | --- |
| 1 | V3 增强型 React/Vite 后台操作系统架构 | 88.6 | 当前主推 |
| 2 | TanStack Start / Router-first React | 85.4 | 长期演进方向，先吸收模式，不立即整体迁移 |
| 3 | Next.js App Router + RSC + Streaming | 79.8 | 绿地强备选，不建议当前直接重写 |
| 4 | 微前端 / 模块联邦后台壳 | 72.4 | 组织级隔离备选，待团队与发布边界明确后再评估 |
| 5 | SvelteKit + Svelte 5 | 66.2 | 性能与交互参考，不进当前主线 |
| 6 | Astro Islands + Server Islands | 65.6 | 文档、帮助、技术支持等静态/轻动态模块可用 |
| 7 | Qwik Resumability | 61.2 | 技术观察，当前淘汰为主线 |

## 6. 主推架构定义

V3 增强型 React/Vite 后台操作系统架构不是普通 SPA，也不是纯 UI 改版，而是以现有 V3 壳为基础，建设一套可机器检查、可渐进迁移、可分域治理的后台操作系统层：

```text
V3 OS Shell
├─ 六域 IA：流程平台 / 组织权限 / 基础资料 / 集成配置 / 消息与通知 / 系统参数
├─ Resource Registry：menu、route、component、fallback、domain、lifecycle
├─ Permission Registry：route/menu/button/API、tenantScope、dataScope、actionMeta
├─ Safety Registry：sensitiveFields、auditActions、dangerOps、masking、confirmPolicy
├─ URL State Contract：search params、filter、sort、tab、selection、deep link
├─ Data Contract：React Query key、失效策略、幂等提交、错误码、审计反馈
├─ Inspector Contract：选中对象、影响分析、审计摘要、风险提示、建设中说明
└─ Test Contract：registry 覆盖率、权限元数据、合同测试、Playwright smoke
```

## 7. 为什么它胜出

- 最贴合当前仓库事实：已有 React/Vite/React Router/React Query/Tailwind/Radix/AntD/XYFlow/ECharts 资产，重写成本不符合当前阶段收益。
- 直接解决真实痛点：当前缺口是 44 项 IA 覆盖、registry、权限元数据、Inspector、多轨收敛和流程平台分层。
- 保留前沿能力入口：可先吸收 TanStack Router-first 思路，未来再用 TanStack Start 或 Next.js 做隔离 POC。
- 支持人性化后台交互：Inspector、风险提示、命令中心、审计摘要、建设中状态和空态引导可以先落地。
- 风险更可控：不破坏旧入口、合同测试、业务组件和现有部署链路。

## 8. 六域 IA 落地方式

| 域 | 重点页面特征 | V3 OS 需要提供的横切能力 |
| --- | --- | --- |
| 组织权限 | 用户、角色、菜单、部门、岗位、数据权限、交接、租户 | 授权矩阵、影响分析、数据范围、租户提示、审计摘要 |
| 基础资料 | 资产分类、编号规则、位置、供应商、自定义字段、字段集 | 引用保护、schema 版本、编号预览、导入导出、历史兼容 |
| 集成配置 | 外部系统、接口、字段映射、同步规则、Webhook | 连接测试、凭据掩码、表达式安全、同步任务、投递日志 |
| 消息与通知 | 邮件网关、模板、日志、渠道、偏好、流程通知开关 | 变量白名单、安全预览、渠道测试、失败重试、发送决策链 |
| 系统参数 | 基础参数、安全策略、文件存储、导入导出、缓存、审计、文档、技术支持 | 高危确认、真实缓存刷新、脱敏导出、诊断包、不可篡改提示 |
| 流程平台 | 门户、设计中心、表单中心、运行监控、Case/Record | 画布、节点属性、表单版本、SLA、异常重试、运行审计 |

## 9. 备选路线处理

### 9.1 TanStack Start / Router-first React

- 保留为长期演进方向。
- 先吸收 URL 状态、类型化 search params、loader/serverFn、Query/Table/Form 协同。
- 不立即整体迁移，因为 `TanStack Start` 仍需版本稳定性和隔离 POC 证明。

### 9.2 Next.js App Router

- 保留为绿地强备选。
- 适合未来新后台壳、SSR/RSC/BFF 或平台化重构。
- 当前不直接重写，因为会重塑路由、构建、测试、部署、`SystemPageHost`、Inspector 和合同测试。

### 9.3 微前端 / 模块联邦

- 保留为组织级治理备选。
- 当六域由不同团队独立发布、需要运行时隔离或插件市场时有价值。
- 当前不主推，因为平台协议尚未稳定，过早微前端会放大治理成本。

### 9.4 Astro / Svelte / Qwik

- `Astro` 可用于文档中心、技术支持、帮助与静态说明模块。
- `Svelte` 的细粒度响应性和交互理念可参考。
- `Qwik` 的 resumability 可作为性能观察方向。
- 三者都不作为 V3 后台主架构。

## 10. 阶段化落地路线

| 阶段 | 目标 | 产出 |
| --- | --- | --- |
| P0：平台协议冻结 | 明确 V3 OS 的资源、权限、安全、URL、数据、Inspector、测试合同 | `systemResourceRegistry` 设计、权限元数据 schema、风险字段协议、验收清单 |
| P1：补齐 44 项资源 registry | 覆盖六域菜单、route、component、fallback、domain、状态 | 44 项 registry 覆盖率测试，建设中页面契约，不再硬编码扩散 |
| P2：权限与安全横切 | route/menu/button/API 权限、tenantScope、sensitiveFields、dangerOps | 权限矩阵、敏感字段掩码、高危确认、审计动作登记 |
| P3：URL 与数据状态标准化 | 搜索参数、筛选、分页、tab、selection、Query key、失效策略 | URL 状态规范、React Query key 规范、错误与审计反馈规范 |
| P4：六域迁移 | 按域迁移真实页面；流程平台单独分门户、设计中心、表单中心、运行监控 | 每域 smoke、Inspector 覆盖、空态/建设中/回退策略 |
| P5：前沿架构 POC | 隔离验证 TanStack Start；必要时验证 Next.js 绿地壳 | POC 报告、迁移成本、性能/权限/测试证据 |

## 11. 固定口径

- 当前不直接整体迁移到 `Next.js App Router`。
- 当前不立即整体迁移到 `TanStack Start`。
- 当前不跨框架重写到 `SvelteKit`、`Qwik` 或 `Astro`。
- 当前不把微前端作为首轮主线。
- 当前不继续扩散硬编码菜单和硬编码页面状态。
- 当前优先补 `Resource Registry`、`Permission Registry`、`Safety Registry`、`URL State Contract`、`Data Contract`、`Inspector Contract` 和 `Test Contract`。
- 不复制或记录任何 password、token、secret、API key 原值。

## 12. HTML 演示

自包含 HTML 演示已固化到：

```text
docs/specs/future-settings-os-v3-frontend-architecture-demo.html
```

该演示展示：

- 候选架构评分矩阵。
- 当前主推结论。
- 成熟项目模式借鉴地图。
- 六域 IA。
- 阶段化落地路线。
- 风险提示与 Inspector 风格信息面板。

## 13. 与 V3 相关文档的关系

本选型文档需要与以下文档一起使用：

- `docs/specs/future-settings-os-v3-expanded-prd.md`：V3 扩展完整 PRD。
- `docs/specs/future-settings-os-v3-backend-design.md`：V3 后端设计方案。
- `docs/specs/future-settings-os-v3-backend-architecture.md`：V3 后端架构与 44 项 IA 导航矩阵。
- `docs/specs/future-settings-os-v3-process-platform-reference.md`：成熟流程平台调研与 V3 流程平台页面 IA 参考。
- `docs/specs/future-settings-os-v3-workflow-engine-decision.md`：流程引擎选型结论。
- `docs/specs/future-settings-os-v3-prd-comparison-score.md`：新旧 PRD 对比评分。
- `docs/workbench-v3-style-guide.md`：V3 页面风格指南。

## 14. Review 证据

GAI2 review 结论：`PASS`。

证据产物：

- `.omc/gai2/sessions/20260702-backend-ui-architecture-research/architecture-selection-report.md`
- `.omc/gai2/sessions/20260702-backend-ui-architecture-research/architecture-selection-demo.html`
- `.omc/gai2/sessions/20260702-backend-ui-architecture-research/research.json`
- `.omc/gai2/sessions/20260702-backend-ui-architecture-research/debate.json`
- `.omc/gai2/sessions/20260702-backend-ui-architecture-research/review.json`

Review 通过项包括：

- 已读取并纳入 V3 前端文档、V3 PRD、后端架构、流程平台参考。
- 已调研至少 5 个前沿技术架构方向。
- 已调研至少 5 个成熟企业或社区项目。
- 已建立评分权重、评分矩阵和排名。
- 已给出最终推荐结论、备选路线、落地路线和残余风险。
- 已产出自包含 HTML 演示。

## 15. 残余风险

- 本文档是架构选型基线，不代表业务源码已实现或测试已通过。
- `TanStack Start` 仍需版本稳定性、1.0 状态和隔离 POC 证明。
- 如果未来强依赖 SSR/RSC/BFF 或 Vercel 型部署平台，`Next.js App Router` 可能在绿地重构中反超。
- 当前 V3 registry 覆盖不足，后续落地成败取决于 44 项资源 registry、权限元数据、敏感字段协议和测试合同。
- 流程平台 9 项复杂度高，需要单独分层治理，不能按普通 CRUD 页处理。
- 外部前沿技术生态有时间敏感性，正式立项前应复核 `TanStack Start`、`Next.js`、`Astro`、`Svelte`、`Qwik` 的最新官方状态。
