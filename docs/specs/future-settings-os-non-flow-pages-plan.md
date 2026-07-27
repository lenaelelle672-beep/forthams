# Future Settings OS 非流程平台后台页面 PLAN / PHASE 指令包

日期：2026-06-30

本文用于把 `http://localhost:5173/fixed-assets/workbench?menu=system-flow-definition` 所属的 Future Settings OS 后台设置区继续拆分给多个 Codex 会话并行推进。当前已有会话正在做“流程中心 / 流程平台”，所以本文只规划其他顶部菜单，避免与原线程冲突。

## 1. 总目标

把 Future Settings OS 的非流程平台后台页面从“导航中心 / 静态演示页”推进到可验收的后台设置工作台：

- 每个后台菜单都能从工作台稳定进入。
- 每个页面具备业务可读的信息架构、列表 / 表单 / 详情 / 状态反馈。
- 页面之间的关键配置关系可以串起来，例如用户-角色-菜单-数据权限、通知渠道-模板-日志、外部系统-接口-映射-同步规则。
- 保持与现有流程中心线程隔离，不触碰流程设计器、流程定义、流程运行监控等工作。
- 保持移动端冻结范围不被修改。

## 2. 已知代码锚点

后续会话应先用这些锚点确认现状，再进入对应顶部菜单的实现：

- 工作台入口：`frontend/src/pages/workspace-preview/WorkspacePreviewPage.tsx`
- 静态页面目录：`frontend/public/mock/workspace-preview/asset-kit-v8/system-hub/subpages/`
- Stitch 集成清单：`frontend/public/mock/workspace-preview/asset-kit-v8/system-hub/future-settings-os-stitch-integration-manifest.json`
- 浏览器回归：`frontend/src/e2e/workbench-platform-entry.browser-regression-smoke.spec.ts`
- 契约测试：`frontend/src/__tests__/workbenchPlatformEntry.contract.test.ts`
- 长任务约束：`docs/superpowers/specs/2026-06-28-future-settings-os-long-task-directive.md`

## 3. 禁止冲突范围

这些范围由流程中心原线程负责，其他并行会话不要修改：

- 顶部菜单：`流程平台`
- 菜单 ID：
  - `system-flow-definition`
  - `system-settings-command-center`
  - `system-runtime-monitor`
  - `system-flow-designer`
  - `system-form-config`
  - `system-form-storage`
  - `system-approval-rules`
  - `system-todo-fields`
  - `system-sla-config`
- 典型路径：
  - `/fixed-assets/workbench?menu=system-flow-definition`
  - `/workflow-designer?mode=create`
  - 任何流程设计器、流程定义、运行监控、审批规则、SLA、待办字段相关实现

如果某个非流程页面必须展示流程相关字段，只做只读占位或链接，不改流程模块本身。

## 4. 并行推进规则

建议一个新会话只拿一个顶部菜单。若顶部菜单较大，可以再按 Phase 拆分，但不要跨菜单同时改。

通用执行顺序：

1. 读取本文件对应顶部菜单章节。
2. 确认当前页面、菜单 ID、静态 HTML、manifest、已有测试。
3. 输出本会话的执行清单和不触碰范围。
4. 按 Phase 小步推进。
5. 每完成一个 Phase，补齐入口、页面状态、测试或验收记录。
6. 结尾说明改了哪些文件、验证了什么、仍缺什么。

通用验收口径：

- 菜单入口可达，不出现空白页、404、错误路由。
- 页面标题、导航面包屑、主操作、表格 / 表单 / 详情区域与菜单语义一致。
- 有 loading / empty / error / disabled / success 状态中的必要状态。
- 有可复用或可维护的数据结构，避免只堆静态文本。
- 不修改流程平台范围，不修改移动端冻结范围。

## 5. 顶部菜单 A：组织权限

范围：

- `system-user-management` 用户管理
- `system-role-permissions` 角色权限
- `system-menu-permissions` 菜单权限
- `system-dept-org` 部门组织
- `system-post-management` 岗位管理
- `system-data-permissions` 数据权限
- `system-handover` 交接管理
- `system-tenant-management` 租户管理

目标：

建立后台权限底座，让用户、角色、菜单、部门、岗位、数据范围、租户之间的关系能被配置和审计。

Phase A0 - 现状盘点与边界确认：

- 检查 8 个菜单的 HTML 是否存在、manifest 是否登记、工作台是否能跳转。
- 记录哪些页面只是壳，哪些页面已有表格、筛选、表单。
- 明确不改流程中心，仅允许在权限页面中展示“流程权限”只读占位。

Phase A1 - 信息架构与公共数据模型：

- 定义用户、角色、菜单、部门、岗位、租户、数据权限、交接任务的 mock 数据结构。
- 梳理关系：用户属于部门 / 岗位 / 租户，用户绑定角色，角色绑定菜单权限和数据权限。
- 统一页面内的状态标签、权限范围文案、启停状态。

Phase A2 - 用户 / 角色 / 菜单权限闭环：

- 用户管理补齐搜索、列表、状态、详情、角色绑定入口。
- 角色权限补齐角色列表、权限范围、成员数量、启停状态。
- 菜单权限补齐菜单树、按钮权限、数据列权限的视觉表达。

Phase A3 - 组织 / 岗位 / 数据权限闭环：

- 部门组织补齐组织树、部门详情、负责人、成员统计。
- 岗位管理补齐岗位层级、岗位职责、关联用户。
- 数据权限补齐按本人、本部门、本部门及下级、自定义范围等规则配置。

Phase A4 - 租户 / 交接管理闭环：

- 租户管理补齐租户列表、套餐 / 权限边界、启停状态、资源统计。
- 交接管理补齐离职交接、资产 / 工单 / 审批待办交接视图。
- 明确交接只展示业务对象摘要，不进入流程中心实现。

Phase A5 - 验证：

- 覆盖 8 个菜单入口 smoke。
- 至少验证用户-角色-菜单权限、部门-数据权限、租户隔离这 3 条链路。
- 检查移动端冻结范围和流程中心无 diff。

组织权限新会话指令：

```text
你在 /Users/feigao/project/Project/forthAMS 工作。请只推进 Future Settings OS 非流程平台后台页面里的【组织权限】顶部菜单。

先阅读 docs/specs/future-settings-os-non-flow-pages-plan.md 的“顶部菜单 A：组织权限”章节，并检查 frontend/src/pages/workspace-preview/WorkspacePreviewPage.tsx、frontend/public/mock/workspace-preview/asset-kit-v8/system-hub/subpages/、future-settings-os-stitch-integration-manifest.json。

本会话允许处理这些菜单：system-user-management、system-role-permissions、system-menu-permissions、system-dept-org、system-post-management、system-data-permissions、system-handover、system-tenant-management。

不要修改流程平台 / 流程中心相关菜单，不要修改移动端冻结范围。先给出 Phase A0-A5 的执行清单，再开始实现和验证。
```

## 6. 顶部菜单 B：基础资料

范围：

- `system-asset-category` 资产分类
- `system-numbering-rules` 编号规则
- `system-location-management` 位置管理
- `system-vendor-management` 供应商管理
- `system-custom-fields` 自定义字段
- `system-custom-field-sets` 自定义字段集

目标：

把固定资产系统的主数据配置做成可复用底座，支撑资产分类、编号、位置、供应商和扩展字段。

Phase B0 - 现状盘点：

- 检查 6 个菜单入口、HTML、manifest、页面标题是否一致。
- 确认资产分类、编号规则、自定义字段是否已有第一阶段遗留实现。

Phase B1 - 主数据结构：

- 建立资产分类树、位置树、供应商档案、编号规则、自定义字段、自定义字段集的统一 mock 数据。
- 统一启停、默认、必填、适用范围、更新时间等字段。

Phase B2 - 资产分类 / 位置管理：

- 资产分类补齐分类树、编码、折旧策略摘要、字段集绑定。
- 位置管理补齐园区 / 楼栋 / 楼层 / 房间层级，支持责任人和容量信息。

Phase B3 - 编号规则：

- 编号规则补齐规则列表、适用对象、前缀、流水号、重置周期、预览样例。
- 加入冲突、停用、默认规则等状态表达。

Phase B4 - 供应商 / 自定义字段：

- 供应商管理补齐供应商档案、联系人、服务品类、评级、合作状态。
- 自定义字段补齐字段类型、校验规则、默认值、选项维护。
- 自定义字段集补齐字段编排、适用资产分类、预览。

Phase B5 - 验证：

- 覆盖 6 个菜单入口 smoke。
- 验证资产分类-字段集-自定义字段、分类-编号规则、位置-资产归属 3 条链路。

基础资料新会话指令：

```text
你在 /Users/feigao/project/Project/forthAMS 工作。请只推进 Future Settings OS 非流程平台后台页面里的【基础资料】顶部菜单。

先阅读 docs/specs/future-settings-os-non-flow-pages-plan.md 的“顶部菜单 B：基础资料”章节，并检查工作台入口、subpages 静态页和 manifest。

本会话允许处理这些菜单：system-asset-category、system-numbering-rules、system-location-management、system-vendor-management、system-custom-fields、system-custom-field-sets。

不要修改流程平台 / 流程中心相关菜单，不要修改移动端冻结范围。先给出 Phase B0-B5 的执行清单，再开始实现和验证。
```

## 7. 顶部菜单 C：集成配置

范围：

- `system-external-systems` 外部系统
- `system-interfaces` 接口管理
- `system-field-mapping` 字段映射
- `system-sync-rules` 同步规则
- `system-webhook-config` Webhook 配置

目标：

建立外部系统接入、接口、字段映射、同步规则和 Webhook 的配置闭环。

Phase C0 - 现状盘点：

- 检查 5 个菜单入口和静态页状态。
- 确认是否已有 Webhook 或同步规则相关第一阶段页面。

Phase C1 - 集成对象模型：

- 定义外部系统、接口、字段映射、同步规则、Webhook 订阅、调用日志摘要的数据结构。
- 统一连接状态、鉴权方式、同步方向、重试策略、失败状态。

Phase C2 - 外部系统 / 接口管理：

- 外部系统补齐系统卡片 / 列表、连接状态、负责人、鉴权摘要。
- 接口管理补齐接口目录、方法、路径、调用方向、启停、最近调用结果。

Phase C3 - 字段映射：

- 字段映射补齐源字段、目标字段、转换规则、必填校验、冲突提示。
- 支持按外部系统和接口筛选。

Phase C4 - 同步规则 / Webhook：

- 同步规则补齐触发方式、调度频率、失败重试、冲突处理。
- Webhook 配置补齐订阅事件、目标 URL、签名策略、最近推送状态、测试发送入口。

Phase C5 - 验证：

- 覆盖 5 个菜单入口 smoke。
- 验证外部系统-接口-字段映射-同步规则-Webhook 的链路。
- 确认不引入真实密钥或敏感配置。

集成配置新会话指令：

```text
你在 /Users/feigao/project/Project/forthAMS 工作。请只推进 Future Settings OS 非流程平台后台页面里的【集成配置】顶部菜单。

先阅读 docs/specs/future-settings-os-non-flow-pages-plan.md 的“顶部菜单 C：集成配置”章节，并检查工作台入口、subpages 静态页和 manifest。

本会话允许处理这些菜单：system-external-systems、system-interfaces、system-field-mapping、system-sync-rules、system-webhook-config。

不要修改流程平台 / 流程中心相关菜单，不要修改移动端冻结范围，不要写入真实密钥。先给出 Phase C0-C5 的执行清单，再开始实现和验证。
```

## 8. 顶部菜单 D：消息与通知

范围：

- `system-mail-gateway` 邮件网关
- `system-workflow-mail` 流程邮件
- `system-mail-templates` 邮件模板
- `system-mail-logs` 邮件日志
- `system-notification-templates` 通知模板
- `system-notification-channels` 通知渠道
- `system-notification-preferences` 通知偏好
- `system-workflow-notification-switch` 流程通知开关

目标：

建立邮件与站内通知的配置、模板、发送记录和偏好设置闭环。注意：含“流程”命名的页面只做通知侧配置，不进入流程中心实现。

Phase D0 - 现状盘点：

- 检查 8 个菜单入口和静态页状态。
- 特别确认邮件日志、通知渠道、流程通知开关是否已有第一阶段页面。

Phase D1 - 通知对象模型：

- 定义渠道、模板、邮件网关、发送日志、通知偏好、流程通知开关的 mock 数据。
- 统一发送状态、渠道类型、模板变量、失败原因、重试状态。

Phase D2 - 邮件网关 / 邮件模板 / 邮件日志：

- 邮件网关补齐 SMTP / 企业邮箱配置摘要、连通状态、测试发送入口。
- 邮件模板补齐模板分类、变量、启停、预览。
- 邮件日志补齐收件人、主题、状态、失败原因、重发入口。

Phase D3 - 通知渠道 / 通知模板：

- 通知渠道补齐站内信、邮件、企业微信 / 钉钉等渠道配置摘要。
- 通知模板补齐多渠道内容、变量、场景、启停。

Phase D4 - 通知偏好 / 流程通知：

- 通知偏好补齐按用户 / 角色 / 场景配置接收方式。
- 流程邮件和流程通知开关只处理通知触达规则，不改流程定义和流程设计器。

Phase D5 - 验证：

- 覆盖 8 个菜单入口 smoke。
- 验证渠道-模板-偏好-日志链路。
- 确认流程中心相关文件无 diff。

消息与通知新会话指令：

```text
你在 /Users/feigao/project/Project/forthAMS 工作。请只推进 Future Settings OS 非流程平台后台页面里的【消息与通知】顶部菜单。

先阅读 docs/specs/future-settings-os-non-flow-pages-plan.md 的“顶部菜单 D：消息与通知”章节，并检查工作台入口、subpages 静态页和 manifest。

本会话允许处理这些菜单：system-mail-gateway、system-workflow-mail、system-mail-templates、system-mail-logs、system-notification-templates、system-notification-channels、system-notification-preferences、system-workflow-notification-switch。

注意：system-workflow-mail 和 system-workflow-notification-switch 只做通知侧配置，不进入流程中心实现。不要修改流程平台 / 流程中心相关菜单，不要修改移动端冻结范围。先给出 Phase D0-D5 的执行清单，再开始实现和验证。
```

## 9. 顶部菜单 E：系统参数

范围：

- `system-base-params` 基础参数
- `system-security-policy` 安全策略
- `system-file-storage` 文件存储
- `system-import-export` 导入导出
- `system-cache-management` 缓存管理
- `system-audit-log` 审计日志
- `system-doc-center` 文档中心
- `system-tech-support` 技术支持

目标：

把系统级运行配置、审计、文件、导入导出和支持入口做成可运维页面。

Phase E0 - 现状盘点：

- 检查 8 个菜单入口和静态页状态。
- 确认基础参数、安全策略、文件存储、导入导出、缓存、审计日志是否已有第一阶段页面。

Phase E1 - 参数与安全策略：

- 基础参数补齐参数分组、键值、作用域、修改记录。
- 安全策略补齐密码策略、登录限制、会话策略、二次验证配置摘要。

Phase E2 - 文件存储 / 导入导出：

- 文件存储补齐存储类型、容量、访问域名、健康状态。
- 导入导出补齐模板下载、任务列表、导入状态、错误报告、导出记录。

Phase E3 - 缓存 / 审计日志：

- 缓存管理补齐缓存分组、命中率、刷新操作、最近刷新记录。
- 审计日志补齐操作人、对象、动作、时间、结果、详情查看。

Phase E4 - 文档中心 / 技术支持：

- 文档中心补齐按角色 / 场景的帮助文档索引。
- 技术支持补齐系统信息、版本信息、诊断包、联系方式或工单入口。

Phase E5 - 验证：

- 覆盖 8 个菜单入口 smoke。
- 验证参数修改记录、导入任务错误态、审计日志详情 3 类关键状态。
- 确认不引入真实凭据、真实服务地址或敏感日志。

系统参数新会话指令：

```text
你在 /Users/feigao/project/Project/forthAMS 工作。请只推进 Future Settings OS 非流程平台后台页面里的【系统参数】顶部菜单。

先阅读 docs/specs/future-settings-os-non-flow-pages-plan.md 的“顶部菜单 E：系统参数”章节，并检查工作台入口、subpages 静态页和 manifest。

本会话允许处理这些菜单：system-base-params、system-security-policy、system-file-storage、system-import-export、system-cache-management、system-audit-log、system-doc-center、system-tech-support。

不要修改流程平台 / 流程中心相关菜单，不要修改移动端冻结范围，不要写入真实密钥、真实服务地址或敏感日志。先给出 Phase E0-E5 的执行清单，再开始实现和验证。
```

## 10. 总控指令

如果你想开一个总控会话，只做协调不写代码，可以复制：

```text
你在 /Users/feigao/project/Project/forthAMS 工作。请作为 Future Settings OS 非流程后台页面的总控会话，只做计划拆解、冲突检查和验收汇总，不直接改代码。

先阅读 docs/specs/future-settings-os-non-flow-pages-plan.md。当前已有独立线程负责流程平台 / 流程中心，所以总控只跟踪组织权限、基础资料、集成配置、消息与通知、系统参数这 5 个顶部菜单。

请输出：
1. 每个顶部菜单当前状态。
2. 哪些 Phase 可以并行。
3. 哪些文件或菜单存在冲突风险。
4. 每个新会话应该复制的启动指令。
5. 最终统一验收清单。

不要修改流程平台 / 流程中心相关菜单，不要修改移动端冻结范围。
```

## 11. 统一验收清单

所有非流程顶部菜单完成后，统一做一次收口：

- 工作台能打开所有非流程菜单。
- `future-settings-os-stitch-integration-manifest.json` 与实际 HTML 页面一致。
- 每个顶部菜单至少有一条业务链路可读可验收。
- 浏览器 smoke 覆盖主要菜单入口。
- 契约测试覆盖菜单 ID 到页面资源的映射。
- `git diff` 确认没有误改流程中心相关文件。
- `git diff` 确认没有误改移动端冻结范围。
- 不包含真实密钥、真实 token、真实生产地址、真实敏感日志。
