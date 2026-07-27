# Future Settings OS v3 后端架构导航 IA 切片

> 版本日期：2026-07-01  
> 文档角色：V3 后端架构 Markdown；按顶部导航分类与左侧导航功能点固化后端 IA、模块边界、契约、风险与验收口径。  
> 写入范围：仅新增本文档；不修改业务源码、测试源码、路由、配置、移动端、旧 Workbench 或其他 docs。  
> 真实性红线：本文是 V3 后端架构导航 IA 切片，不等同于实现完成；未运行项目测试，不声称未验证实现已完成。

---

## 1. 文档信息、适用范围、真实性边界

### 1.1 文档信息

| 项 | 内容 |
| --- | --- |
| 文档名称 | Future Settings OS v3 后端架构导航 IA 切片 |
| 适用入口 | `/fixed-assets/workbenchv3` |
| 默认菜单 | `?menu=system-user-management` |
| 适用对象 | 后端架构、产品验收、权限专项、后续实现拆分与 reviewer 复核 |
| IA 事实源 | `docs/specs/system-hub/INFORMATION-ARCHITECTURE.md` 的 `44 项 / 6 组` |
| 当前重点 | `35` 个非流程后台功能点 |
| 受控边界 | `9` 个流程平台功能点 |
| 输出约束 | 中文文档；不写业务代码；不写移动端；不写旧 Workbench；不写真实敏感原值 |

### 1.2 适用范围

本文只固化 **V3 后端架构导航 IA 切片**，用于说明：

1. 后端系统模块如何映射到 **顶部导航 6 类**。
2. 每类下面的具体功能点如何映射到 **左侧导航 44 项**。
3. 每个功能点需要哪些 Controller/API、Service/Domain、Entity/Migration、DTO、权限、审计、安全和验收契约。
4. `35 非流程` 与 `9 流程平台` 的推进边界，以及 `39 设计稿` 和 `V3 当前承载` 的交叉标签关系。

本文不替代 PRD、后端设计方案、实现任务单或测试报告；后续任何代码实现仍需按项目规则另行做影响分析、实现、测试和 reviewer 验收。

### 1.3 真实性边界

| 边界 | 说明 |
| --- | --- |
| 实现完成度 | 本文不声称 44 项均已实现；`草案`、`部分已有`、`从 0 建设`、`受控边界`必须区分。 |
| 旧 Workbench | 旧 `/fixed-assets/workbench`、旧 `WorkspacePreviewPage` 的 base path 与旧默认跳转不动。 |
| Workbench V3 route 权限 | 当前阶段不加 V3 route 权限规则；后续权限专项再处理 `routePermissions` 与 fail-closed 接入。 |
| 移动端 | `frontend/src/pages/mobile/**` 冻结，本切片不触碰。 |
| 流程平台 | 9 项流程平台在本文进入需求、架构与验收口径，但实际实现是受控专项，不由非流程阶段越界推进。 |
| 安全敏感信息 | 只描述脱敏、加密待核查、密钥管理和审计规则，不复制任何 password、token、secret、API key 原值。 |
| 测试 | 本轮仅做文档读回与结构自检，不运行项目单元测试、E2E 或构建；原因是仅文档写入。 |

---

## 2. 输入基线与版本口径

### 2.1 已读取并采用的输入基线

| 输入 | 路径 | 本文采用方式 |
| --- | --- | --- |
| GAI2 工作卡 | `.omc/gai2/sessions/20260701-v3-backend-architecture/workcard.json` | 采用写入边界、目标路径、验收项、非目标与当前 gate 口径。 |
| GAI2 分诊 | `.omc/gai2/sessions/20260701-v3-backend-architecture/triage.json` | 采用 Strategic 分级、6 类顶部导航、44 项左侧导航、35/9 边界与推荐章节。 |
| GAI2 审计 | `.omc/gai2/sessions/20260701-v3-backend-architecture/audit.json` | 采用当前代码事实、模块状态、关键风险、backend module boundaries、builder notes。 |
| 当前 gate | `.gai2/gate-state.json` | 采用当前 session 的 docs allowlist：目标文档与当前 session `changes.json`。 |
| V3 扩展 PRD | `docs/specs/future-settings-os-v3-expanded-prd.md` | 作为 V3 后端新需求主基线，采用 44 项矩阵、壳契约、安全与分期。 |
| V3 后端设计方案 | `docs/specs/future-settings-os-v3-backend-design.md` | 作为后端设计基线，采用通用契约、44 项矩阵、五链、风险与分期。 |
| 新旧需求评分 | `docs/specs/future-settings-os-v3-prd-comparison-score.md` | 采用 NEW 作为主基线的评分结论、差异点、后续验收建议。 |
| IA 主文档 | `docs/specs/system-hub/INFORMATION-ARCHITECTURE.md` | 作为 44 项 / 6 组、五条业务链、导航层级的 single source of truth。 |
| 非流程计划 | `docs/specs/future-settings-os-non-flow-pages-plan.md` | 采用 35 非流程推进、流程冻结、移动端冻结、五组分期任务。 |
| Workbench V3 风格指南 | `docs/workbench-v3-style-guide.md` | 采用 `/fixed-assets/workbenchv3`、`SystemPageHost activeMenu`、Inspector、旧入口保护、当前不加权限规则。 |

### 2.2 版本口径统一

| 口径 | 数量/含义 | 本文使用方式 | 禁止误用 |
| --- | ---: | --- | --- |
| `44 项` | IA 主文档菜单注册表全量目标 | 左侧导航矩阵必须完整列出 1-44 | 禁止只写已实现或 V3 当前承载项 |
| `35 非流程` | 44 项减去流程平台 9 项 | 当前重点：组织权限、基础资料、集成配置、消息与通知、系统参数 | 禁止把 35 当成全量 IA |
| `9 流程平台` | 流程平台整组 | 作为受控边界写需求、契约、风险和专项验收 | 禁止在非流程阶段误写成已完成 |
| `39 设计稿` | V2 Stitch / HTML 视觉执行记录 | 作为页面视觉与目标态参考 | 禁止替代后端契约、API、权限或测试 |
| `V3` | Workbench V3 壳与当前/目标承载标签 | 用于标注 `/fixed-assets/workbenchv3`、SystemPageHost、真实组件承载目标 | 禁止把当前 V3 registry 覆盖范围当作 44 项上限 |

---

## 3. 总体架构结论

1. **顶部导航 6 类**固定为：流程平台、组织权限、基础资料、集成配置、消息与通知、系统参数。
2. **左侧导航 44 项**按上述 6 类展开，组内数量必须为：流程平台 9、组织权限 8、基础资料 6、集成配置 5、消息与通知 8、系统参数 8。
3. **35 非流程是当前重点，9 流程平台是受控边界**：非流程阶段主要校准和建设组织权限、基础资料、集成配置、消息与通知、系统参数；流程平台仅固化需求、契约、命名边界和验收，不越界实现。
4. **安全合规是横切能力**，不作为第 7 个顶栏；RBAC、数据权限、租户隔离、敏感信息脱敏、存储加密待核查、审计日志和 fail-closed 必须覆盖所有 44 项。
5. Workbench V3 是独立后端管理壳：路径 `/fixed-assets/workbenchv3`，默认 `?menu=system-user-management`，中栏由 `SystemPageHost activeMenu` 承载真实系统页，右栏由 Inspector 承载选中对象详情和影响分析。
6. 当前架构文档必须诚实区分 **已审计现状**、**部分已有**、**草案/从 0 建设**、**命名待统一**、**安全待核查** 与 **测试待补**。

| 顶部分类 | 左侧项数 | 阶段标签 | 架构结论 |
| --- | ---: | --- | --- |
| 流程平台 | 9 | 44/9/39/V3，受控边界 | 需求与契约必须进入矩阵，实际实现后续走流程平台专项。 |
| 组织权限 | 8 | 44/35/39/V3，当前重点 | 权限链底座，已有能力较多，但 DataPermissionRule、Handover、permissionMeta 仍需补强。 |
| 基础资料 | 6 | 44/35/39/V3，当前重点 | 主数据链底座，分类/位置/供应商/字段已有基础，编号规则需独立后台与并发验收。 |
| 集成配置 | 5 | 44/35/39，当前重点但空白大 | 除 Webhook 外多为从 0 建设，是后续接口、同步、凭据安全重点。 |
| 消息与通知 | 8 | 44/35/39，当前重点 | 邮件网关、模板、渠道、偏好、开关形成通知链；MailGateway 存储加密待核查。 |
| 系统参数 | 8 | 44/35/39，当前重点 | 参数、安全、文件、导入导出、缓存、审计、文档、支持形成运维链；缓存刷新空实现风险需显性化。 |

---

## 4. Workbench V3 壳与导航模型

### 4.1 壳契约

| 层 | 契约 |
| --- | --- |
| 路由入口 | `/fixed-assets/workbenchv3` |
| 默认菜单 | `?menu=system-user-management` |
| 顶部分类导航 | 显示 6 类：流程平台、组织权限、基础资料、集成配置、消息与通知、系统参数；不增加安全合规顶栏。 |
| 左侧功能点导航 | 切换顶部分类后替换对应组的左侧菜单；左侧菜单 ID 同步 `?menu=`。 |
| 中栏内容 | `SystemPageHost activeMenu` 渲染真实系统页；未实现项只能标注草案或兜底，不把 iframe 当后端完成。 |
| 右栏 Inspector | 接收真实页面提供的选中对象详情、影响分析、审计摘要、关联对象和高危操作说明。 |
| 旧入口保护 | 不修改旧 `/fixed-assets/workbench`、旧默认跳转和旧 `WorkspacePreviewPage` base path。 |
| 权限规则 | 当前阶段不加 V3 route 权限规则；后续权限专项再把 44 项 permissionMeta、按钮权限和 route 权限 fail-closed 接入。 |

### 4.2 导航行为

1. 切换顶部分类：只替换左侧菜单集合，不卸载 V3 壳。
2. 切换左侧功能点：只替换 `activeMenu` 对应的中栏主视图与右栏 Inspector。
3. 已登记真组件：通过 `SystemPageHost activeMenu` 嵌入，保留 loading/empty/error/success/selected 状态。
4. 未登记真组件：文档只写目标契约和缺口，不声称已可用。
5. Inspector 必须支持跨页关系：权限影响、主数据引用、通知发送决策、集成调用、审计日志等。

---

## 5. 顶部导航 6 类完整架构

### 5.1 流程平台（9 项，受控边界）

- **业务边界**：流程定义、流程控制台、流程设计器、运行监控、表单配置、表单存储、审批规则、待办字段、SLA 策略。
- **后端职责**：提供流程定义与版本、运行监控、表单定义/实例边界、审批规则、待办字段配置与 SLA 策略的 API、状态机、发布/回滚、审计与高危操作保护。
- **核心对象**：FlowDefinition、FlowVersion、WorkflowInstance、WorkflowTask、RuntimeEvent、FormDefinition、FormInstance、ApprovalRule、TodoFieldConfig、SlaConfig。
- **权限前缀**：`workflow:*`。
- **当前状态**：已有 WorkflowDefinition、WorkflowDesigner、WorkflowRuntime、FormDefinition、SlaConfig 等部分能力线索；但 9 项整体仍由流程平台专项控制。
- **主要缺口**：Form Center/Designer 与 `form-config` / `form-storage` 命名双轨；表单实例存储未闭环；审批表达式安全、待办字段兼容和运行监控保留周期待设计。
- **验收口径**：流程平台 9 项必须在 IA 中可见并有 API/权限/审计/验收草案；进入实现时必须提供 DB/API/audit/page/E2E 多层证据。

### 5.2 组织权限（8 项，当前重点）

- **业务边界**：用户、角色、菜单、部门、岗位、数据权限、交接、租户。
- **后端职责**：维护权限链，保障 RBAC、按钮权限、数据范围、租户隔离、交接任务和审计日志的一致性。
- **核心对象**：User、Role、Menu、Dept、Post、DataPermissionRule、Handover、Tenant、RoleMenu、RoleDept、UserRole、UserPost。
- **权限前缀**：`system:user:*`、`system:role:*`、`system:menu:*`、`system:dept:*`、`system:post:*`、`system:data-permission:*`、`system:handover:*`、`system:tenant:*`。
- **当前状态**：用户、角色、菜单、部门、岗位、租户较成熟；DataPermissionRule 与 Handover 已有后端与 V3 真组件线索。
- **主要缺口**：DataPermissionRule 仍需 DTO、roleIds 结构化、角色存在性校验、影响分析与测试；Handover 真实对象转移未闭环；systemModuleRegistry permissionMeta 未覆盖 44 项。
- **验收口径**：无权限接口拒绝；数据权限规则只收紧；租户越权阻断；权限变更和交接状态流转有审计；不得把交接写成真实转移已完成。

### 5.3 基础资料（6 项，当前重点）

- **业务边界**：资产分类、编号规则、位置管理、供应商管理、自定义字段、字段集管理。
- **后端职责**：维护资产主数据链，提供引用保护、字段集绑定、编号生成、导入导出、审计和与资产业务的可验证联动。
- **核心对象**：AssetCategory、NumberingRule、Sequence、Location、Vendor、CustomField、CustomFieldset、FieldsetField。
- **权限前缀**：`master:*` 或按资源细分为 `master:asset-category:*`、`master:numbering-rule:*`、`master:location:*`、`master:vendor:*`、`master:custom-field:*`、`master:custom-fieldset:*`。
- **当前状态**：资产分类、位置、供应商、自定义字段、字段集已有 Controller/页面基础；编号规则已有服务并已出现接入资产创建的线索。
- **主要缺口**：编号规则缺独立 Controller/页面/并发唯一测试；供应商与采购/合同/维保引用链需强化；自定义字段与 Form Center schema 边界待统一。
- **验收口径**：有引用对象不可误删；编号预览与生成一致且并发不重复；字段集变更不破坏历史资产；导入导出脱敏并审计。

### 5.4 集成配置（5 项，当前重点但空白最大）

- **业务边界**：外部系统、接口管理、字段映射、同步规则、Webhook 配置。
- **后端职责**：将外部系统、接口、字段映射、同步任务、Webhook 事件和失败告警形成可配置、可测试、可审计、可重试的集成链。
- **核心对象**：ExternalSystem、CredentialRef、IntegrationInterface、RequestTemplate、FieldMapping、TransformRule、SyncRule、SyncJob、SyncLog、WebhookConfig、WebhookDeliveryLog。
- **权限前缀**：`integration:*`。
- **当前状态**：Webhook 有基础能力；外部系统、接口、字段映射、同步规则未发现完整专属 Controller/Service，属于从 0 建设或草案状态。
- **主要缺口**：敏感凭据存储加密与密钥轮换待设计；表达式安全、同步幂等、失败重试、真实业务事件接入缺口大。
- **验收口径**：连通测试受权限控制并写审计；字段映射预览安全；同步失败可重试且幂等；Webhook 签名错误被拒绝。

### 5.5 消息与通知（8 项，当前重点）

- **业务边界**：邮件网关、流程邮件、邮件模板、邮件日志、通知模板、通知渠道、通知偏好、流程通知开关。
- **后端职责**：统一邮件和通知发送决策链，覆盖网关、模板、渠道、偏好、业务开关、日志、失败重试和审计。
- **核心对象**：MailGateway、MailSenderProvider、BpmMailConfig、MailTemplate、MailLog、NotificationTemplate、NotificationChannel、ChannelConfig、NotificationPreference、NotificationBizSwitch。
- **权限前缀**：`mail:*`、`notification:*`。
- **当前状态**：MailGateway CRUD、连通测试与响应脱敏已有线索；通知偏好/流程通知开关已进入发送决策的线索需在后续测试中固化。
- **主要缺口**：MailGateway 存储加密待核查；V3 registry 与权限种子待补；异常放行策略与 fail-closed 取舍待定；流程邮件真实节点调用链需确认。
- **验收口径**：响应不回显敏感原值；偏好或开关关闭后不发送；失败日志可重试且不重复发送；模板变量白名单和 HTML 安全可测。

### 5.6 系统参数（8 项，当前重点）

- **业务边界**：基础参数、安全策略、文件存储、导入导出、缓存管理、审计日志、文档中心、技术支持。
- **后端职责**：提供系统运维链，覆盖参数变更、策略生效、文件存储策略、导入导出任务、缓存刷新、审计查询、文档发布和诊断支持。
- **核心对象**：SystemConfig、SecurityPolicy、FileStoragePolicy、ImportTask、ExportTask、CacheNamespace、CacheRefreshTask、OperateLog、DocArticle、SupportTicket、DiagnosticPackage。
- **权限前缀**：`system:param:*`、`system:security-policy:*`、`system:file-storage:*`、`system:import-export:*`、`system:cache:*`、`system:audit-log:*`、`system:doc-center:*`、`system:tech-support:*`。
- **当前状态**：SystemConfig 与 OperLog/Audit 能力较强；文件、导入导出能力散落在业务 Controller；缓存刷新存在空实现风险；文档中心与技术支持从 0 建设。
- **主要缺口**：Cache refresh 空实现；安全策略是否独立实体待确认；文件存储策略化、导入导出统一任务、诊断包脱敏规则待设计。
- **验收口径**：参数更新有影响提示和审计；缓存刷新有真实结果；审计覆盖新增菜单；导出和诊断包不包含敏感原值。

---

## 6. 左侧导航 44 项完整 IA 矩阵

> 范围标签说明：`44`=IA 全量；`35`=非流程当前重点；`9`=流程平台受控边界；`39`=V2 设计稿/HTML 参考；`V3`=Workbench V3 当前或目标承载。`草案`不代表已实现。

| 序号 | 顶部分类 | 左侧 menu_id | IA id | 显示名称 | 范围标签 | 页面职责 | 后端职责 / Controller API 草案或现状 | 核心对象 | 权限建议 | 审计/安全点 | 当前状态 | 缺口 | 验收方式 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 流程平台 | `system-flow-definition` | `flow-definition` | 导航控制台 | 44/9/39/V3目标 | 展示流程定义、版本、启停、引用影响 | `FlowDefinitionController` 草案：列表、版本、发布、启停、引用分析 | FlowDefinition、FlowVersion | `workflow:definition:*` | 发布/启停写审计，历史版本冻结 | 受控边界，部分流程定义能力待校准 | 非流程阶段不得越界实现；版本状态机待验 | API 契约、发布审计、版本状态机、页面 smoke |
| 2 | 流程平台 | `system-settings-command-center` | `settings-command-center` | 流程控制台 | 44/9/39/V3目标 | 展示实例、待办、异常、SLA、重试终止入口 | `WorkflowCommandController` 草案：聚合查询、重试、终止 | WorkflowInstance、WorkflowTask、WorkflowException | `workflow:command:view/retry/terminate` | 重试/终止高危二次确认与审计 | 需求草案 | 不得绕过流程引擎直接改业务状态 | 聚合查询、权限拒绝、重试/终止审计 |
| 3 | 流程平台 | `system-flow-designer` | `flow-designer` | 流程设计器 | 44/9/39/V3当前承载 | 流程图草稿、节点、连线、发布、回滚 | `WorkflowDesignerController` 或等价 API：保存、校验、发布、回滚 | FlowDraft、FlowNode、FlowEdge | `workflow:designer:*` | 图结构校验、发布/回滚审计 | V3 有当前承载线索 | 后端达标、权限元数据待校准 | 图结构校验、发布回滚测试、审计 |
| 4 | 流程平台 | `system-runtime-monitor` | `runtime-monitor` | 运行监控 | 44/9/39/V3目标 | 监控实例运行、节点耗时、异常轨迹、导出 | `WorkflowRuntimeMonitorController` 草案：只读列表、详情、异常轨迹、导出 | RuntimeEvent、NodeExecutionLog | `workflow:runtime:view/export` | 导出脱敏、只读权限 | 需求草案 | 数据保留周期与脱敏策略待定 | 查询性能、导出权限、异常轨迹核验 |
| 5 | 流程平台 | `system-form-config` / `system-form-center` | `form-config` | 表单配置 | 44/9/39/V3当前承载 | 表单定义、版本、发布、停用、回滚 | 现状有 `FormDefinitionController`；需统一 IA 命名 | FormDefinition、FormVersion | `workflow:form:*` | 表单 schema 与 HTML/source 安全过滤 | 部分已有 | `form-config` 与 `system-form-center` 命名双轨 | API、版本状态机、schema 安全测试 |
| 6 | 流程平台 | `system-form-storage` | `form-storage` | 表单存储 | 44/9/39/V3目标 | 表单实例数据、归档、附件、导出 | `FormStorageController` 草案：实例查询、归档、导出、删除 | FormInstance、FormFieldValue、Attachment | `workflow:form-storage:*` | 租户隔离、字段脱敏、删除留痕 | 未确认闭环 | 不能用表单定义替代表单实例存储 | DB 结构、租户过滤、归档、导出脱敏 |
| 7 | 流程平台 | `system-approval-rules` | `approval-rules` | 审批规则 | 44/9/39/V3目标 | 审批条件、审批人解析、冲突检测 | `ApprovalRuleController` 草案：规则 CRUD、模拟、启停 | ApprovalRule、ApproverResolver | `workflow:approval-rule:*` | 表达式白名单、防注入、变更审计 | 需求草案 | 表达式安全和冲突检测待设计 | 规则模拟、冲突检测、权限审计 |
| 8 | 流程平台 | `system-todo-fields` | `todo-fields` | 待办字段 | 44/9/39/V3目标 | 配置待办列表字段、排序、角色可见性 | `TodoFieldConfigController` 草案：查询、更新、重置 | TodoFieldConfig、RoleVisibility | `workflow:todo-field:*` | 默认配置可恢复，角色覆盖可解释 | 需求草案 | 需兼容待办业务页字段 | 保存、角色覆盖、默认恢复、页面 smoke |
| 9 | 流程平台 | `system-sla-config` | `sla-config` | SLA 策略 | 44/9/39/V3当前承载 | SLA 策略、提醒、超时记录、适用流程 | `SlaConfigController` 草案或现有等价 API 待校准 | SlaConfig、ReminderPolicy | `workflow:sla:*` | 超时记录、提醒发送、策略启停审计 | V3 有当前承载线索 | 后端路径与权限元数据待确认 | 策略计算、提醒触发、超时审计 |
| 10 | 组织权限 | `system-user-management` | `user-management` | 用户管理 | 44/35/39/V3当前承载 | 用户列表、部门岗位角色、状态、详情 Inspector | `UserManagementController` 现状：列表、详情、创建、更新、重置、启停、删除 | User、UserRole、UserPost | `system:user:*` | 重置不回显敏感原值，停用阻断登录 | V3 默认菜单，能力较成熟 | 44 项统一 permissionMeta 待补 | API、角色分配、停用登录、审计、页面合同 |
| 11 | 组织权限 | `system-role-permissions` | `role-permissions` | 角色权限 | 44/35/39/V3当前承载 | 角色、菜单授权、数据范围、成员影响 | `RoleManagementController` / `RoleService` 现状与校准 | Role、RoleMenu、RoleDept | `system:role:*` | 数据范围和菜单授权写审计 | V3 当前承载，能力较成熟 | 与 DataPermissionRule 只收紧边界需一致 | 菜单授权、数据范围、越权拦截、审计 |
| 12 | 组织权限 | `system-menu-permissions` | `menu-permissions` | 菜单权限 | 44/35/39/V3当前承载 | 菜单树、按钮权限、API 权限、引用角色 | `SysMenuController` / `MenuController` 现状或校准 | Menu、ButtonPermission、ApiPermission | `system:menu:*` | 删除需检查角色引用，权限码唯一 | V3 真组件存在 | 44 项 permissionMeta 未全量注册 | 菜单树、按钮码、引用检查、权限元数据 |
| 13 | 组织权限 | `system-dept-org` | `dept-org` | 部门组织 | 44/35/39/V3当前承载 | 部门树、成员、负责人、资产引用、影响分析 | `DeptController` 现状：树、CRUD、引用校验待强化 | Dept、User、AssetReference | `system:dept:*` | 树结构防循环，删除前查引用 | V3 真组件存在，基础 CRUD | Inspector 数据权限影响待补 | 树结构、循环引用、删除保护、影响分析 |
| 14 | 组织权限 | `system-post-management` | `post-management` | 岗位管理 | 44/35/39/V3当前承载 | 岗位列表、成员数量、岗位与用户关联 | `PostController` 现状：岗位 CRUD、引用检查待强化 | Post、UserPost | `system:post:*` | 删除前检查用户引用 | V3 真组件存在，基础 CRUD | 与用户 Inspector 联动待补 | CRUD、引用检查、审计 |
| 15 | 组织权限 | `system-data-permissions` | `data-permissions` | 数据权限 | 44/35/39/V3当前承载 | 规则目录、启停、影响分析、角色投影 | 已有 `DataPermissionRuleController` / `DataPermissionRuleService` 线索 | DataPermissionRule、Role.dataScope、Dept | `system:data-permission:*` | 只收紧不放宽；`CUSTOM` 跳过投影 | Controller/Service/Migration/V3 页面存在 | DTO、roleIds、角色存在性、测试、permissionMeta 待补 | CRUD、只收紧断言、CUSTOM 边界、审计 |
| 16 | 组织权限 | `system-handover` | `handover` | 交接管理 | 44/35/39/V3当前承载 | 交接任务、对象摘要、状态流转、风险提示 | 已有 `HandoverController` / `HandoverService` 线索 | Handover、ObjectSummary | `system:handover:*` | 状态变更审计，真实转移不得伪造 | 任务摘要与状态记录存在 | 真实资产/工单/审批对象转移未闭环 | 状态机、对象摘要 schema、审计、页面 smoke |
| 17 | 组织权限 | `system-tenant-management` | `tenant-management` | 租户管理 | 44/35/39/V3当前承载 | 租户列表、状态、资源、隔离配置、审计 | `TenantController` 现状或历史能力校准 | Tenant、TenantContext | `system:tenant:*` | 停用阻断访问，跨租户审计 | 历史能力较成熟 | 需继承旧租户隔离红线 | 租户过滤、停用拦截、越权测试 |
| 18 | 基础资料 | `system-asset-category` | `asset-category` | 资产分类 | 44/35/39/V3当前承载 | 分类树、字段集绑定、资产引用 | `AssetCategoryController` 现状 | AssetCategory、CustomFieldset | `master:asset-category:*` | 删除前检查资产引用 | V3 真组件存在 | 与字段集和资产创建联动需强化 | 树结构、字段集绑定、删除保护 |
| 19 | 基础资料 | `system-numbering-rules` | `numbering-rules` | 编号规则 | 44/35/39/V3目标 | 规则列表、适用对象、预览、冲突提示 | `NumberingRuleController` 草案；服务已接入资产创建线索 | NumberingRule、Sequence | `master:numbering-rule:*` | 编号生成审计，并发唯一 | Service 线索存在，页面/Controller 不足 | 独立后台、并发测试、预览回滚待补 | 并发生成、预览、资产创建接入、审计 |
| 20 | 基础资料 | `system-location-management` | `location-management` | 位置管理 | 44/35/39/V3当前承载 | 位置树、资产数量、区域、负责人 | `LocationController` 现状 | Location、Asset | `master:location:*` | 删除前检查资产引用 | V3 真组件存在 | 资产位置变更审计联动待补 | 树结构、引用检查、Inspector 联动 |
| 21 | 基础资料 | `system-vendor-management` | `vendor-management` | 供应商管理 | 44/35/39/V3当前承载 | 供应商、联系人、合同/采购/维保引用 | `VendorController` 现状 | Vendor、Contract、Purchase | `master:vendor:*` | 删除前查业务引用，导入导出脱敏 | V3 真组件存在，基础 CRUD | 旧宽 PRD 供应商链需细化 | CRUD、引用检查、导入导出、审计 |
| 22 | 基础资料 | `system-custom-fields` | `custom-fields` | 自定义字段 | 44/35/39/V3当前承载 | 字段类型、校验、适用范围、引用 | `CustomFieldController` 现状 | CustomField、ValidationRule | `master:custom-field:*` | 字段删除需检查字段集引用 | V3 真组件存在，基础 CRUD | 与 Form Center schema 边界待统一 | 字段校验、引用检查、历史兼容 |
| 23 | 基础资料 | `system-custom-field-sets` | `custom-field-sets` | 字段集管理 | 44/35/39/V3当前承载 | 字段集、字段排序、分类绑定、预览 | `CustomFieldsetController` 现状 | CustomFieldset、FieldsetField | `master:custom-fieldset:*` | 变更不破坏历史资产 | V3 真组件存在 | 与资产分类双向校验需强化 | 字段集绑定、排序、历史兼容、审计 |
| 24 | 集成配置 | `system-external-systems` | `external-systems` | 外部系统 | 44/35/39/V3目标 | 外部系统目录、认证方式、健康状态 | `ExternalSystemController` 草案：CRUD、启停、测试 | ExternalSystem、CredentialRef | `integration:external-system:*` | 敏感配置脱敏，存储加密待设计 | 从 0 建设 | 实体、API、权限、加密、测试缺失 | 连通测试、脱敏响应、启停、审计 |
| 25 | 集成配置 | `system-interfaces` | `interfaces` | 接口管理 | 44/35/39/V3目标 | 接口目录、方法、URL 摘要、限流重试 | `IntegrationInterfaceController` 草案：CRUD、测试、禁用 | IntegrationInterface、RequestTemplate | `integration:interface:*` | 测试调用隔离生产副作用 | 从 0 建设 | 需与外部系统和映射建立 FK | 接口测试、权限、限流、审计 |
| 26 | 集成配置 | `system-field-mapping` | `field-mapping` | 字段映射 | 44/35/39/V3目标 | 源字段、目标字段、转换规则、版本 | `FieldMappingController` 草案：CRUD、预览、测试 | FieldMapping、TransformRule | `integration:field-mapping:*` | 表达式白名单/沙箱，防注入 | 从 0 建设 | 转换表达式安全与异常样例待设计 | 映射预览、异常样例、表达式安全 |
| 27 | 集成配置 | `system-sync-rules` | `sync-rules` | 同步规则 | 44/35/39/V3目标 | 同步方向、频率、触发器、失败重试 | `SyncRuleController` 草案：CRUD、启停、运行、重试 | SyncRule、SyncJob、SyncLog | `integration:sync-rule:*` | 幂等、失败重试、告警审计 | 从 0 建设 | 调度、失败重试、告警未设计 | 任务调度、失败重试、幂等、审计 |
| 28 | 集成配置 | `system-webhook-config` | `webhook-config` | Webhook 配置 | 44/35/39/V3目标 | Webhook 订阅、签名、投递日志 | `WebhookConfigController` / `WebhookService` 现状或等价 API | WebhookConfig、WebhookDeliveryLog | `integration:webhook:*` | 签名校验、投递幂等、失败审计 | Webhook 基础能力存在 | `fireEvent` 需接入真实业务事件 | CRUD、签名校验、事件触发、失败重试 |
| 29 | 消息与通知 | `system-mail-gateway` | `mail-gateway` | 邮件网关 | 44/35/39/V3目标 | SMTP 主备、优先级、连通测试、脱敏状态 | 已有 `MailGatewayController` / `MailGatewayService` 线索 | MailGateway、MailSenderProvider | `mail:gateway:*` | 响应脱敏；存储加密待核查 | API/页面线索存在 | V3 registry、权限种子、字段校验、加密待核查 | CRUD、测试端点、响应脱敏、权限、审计 |
| 30 | 消息与通知 | `system-workflow-mail` | `workflow-mail` | 流程邮件 | 44/35/39/V3目标 | 流程节点邮件配置、触发策略、模板 | `WorkflowMailController` 草案或 `BpmMailConfigService` 校准 | BpmMailConfig、WorkflowNode | `mail:workflow:*` | 流程触发审计，模板变量白名单 | 服务线索存在但调用链待确认 | 需确认真实节点发送决策 | 节点触发、模板渲染、发送审计 |
| 31 | 消息与通知 | `system-mail-templates` | `mail-templates` | 邮件模板 | 44/35/39/V3目标 | 模板、变量、预览、版本、启停 | `MailTemplateController` 现状或校准 | MailTemplate、TemplateVariable | `mail:template:*` | HTML 安全、变量白名单 | 基础 CRUD | 与 EmailService/Thymeleaf 边界待统一 | 预览、变量校验、渲染安全、审计 |
| 32 | 消息与通知 | `system-mail-logs` | `mail-logs` | 邮件日志 | 44/35/39/V3目标 | 发送记录、失败原因、重试、导出 | `MailLogController` 现状或校准 | MailLog、RetryRecord | `mail:log:*` | 重试幂等，导出脱敏 | 基础能力存在 | 保留周期与导出脱敏字段待定 | 日志查询、重试、导出脱敏、审计 |
| 33 | 消息与通知 | `system-notification-templates` | `notification-templates` | 通知模板 | 44/35/39/V3目标 | 多渠道模板、变量、预览、启停 | `NotificationTemplateController` 现状或校准 | NotificationTemplate、Variable | `notification:template:*` | 变量白名单，多渠道渲染审计 | 基础 CRUD | 与邮件模板边界需清晰 | 模板预览、渠道渲染、审计 |
| 34 | 消息与通知 | `system-notification-channels` | `notification-channels` | 通知渠道 | 44/35/39/V3目标 | 渠道类型、配置状态、健康、测试 | `ChannelConfigController` / `NotificationChannelController` 校准 | NotificationChannel、ChannelConfig | `notification:channel:*` | 敏感配置脱敏，真实 POST 隔离测试环境 | 历史矩阵较强 | 测试环境隔离与配置加密待设计 | 连通测试、脱敏、启停、审计 |
| 35 | 消息与通知 | `system-notification-preferences` | `notification-preferences` | 通知偏好 | 44/35/39/V3目标 | 用户/角色偏好、渠道偏好、免打扰 | `NotificationPreferenceController` / Service 现状或校准 | NotificationPreference、UserPreference | `notification:preference:*` | 偏好变更审计，默认可恢复 | 已有发送决策调用线索 | 异常放行策略与测试覆盖待补 | 偏好保存、发送决策调用、默认恢复 |
| 36 | 消息与通知 | `system-workflow-notification-switch` | `workflow-notification-switch` | 流程通知开关 | 44/35/39/V3目标 | 流程通知范围、灰度、影响分析 | `NotificationBizSwitchController` / Service 现状或校准 | NotificationBizSwitch、GrayScope | `notification:workflow-switch:*` | 关闭阻断对应通知，灰度审计 | 已进入服务调用线索 | 开关生效测试与 fail-closed 策略待补 | 开关生效、发送决策、审计 |
| 37 | 系统参数 | `system-base-params` | `base-params` | 基础参数 | 44/35/39/V3目标 | 参数分组、键值、影响范围、历史 | `SysConfigController` / `SystemConfigService` 现状 | SystemConfig、ParamHistory | `system:param:*` | 修改审计、影响提示、缓存刷新 | SystemConfig 能力存在 | `refreshCache` 空实现风险需核查 | 参数校验、缓存刷新、审计、回滚 |
| 38 | 系统参数 | `system-security-policy` | `security-policy` | 安全策略 | 44/35/39/V3目标 | 密码、登录、会话、IP/设备策略 | `SecurityPolicyController` 草案或 SystemConfig 扩展 | SecurityPolicy、LoginPolicy | `system:security-policy:*` | 策略错误 fail-closed | 配置型或基础能力待确认 | 是否独立实体、登录链路生效待确认 | 策略保存、登录链路生效、审计 |
| 39 | 系统参数 | `system-file-storage` | `file-storage` | 文件存储 | 44/35/39/V3目标 | 存储后端、容量、上传限制、访问策略 | `FileStorageController` 草案；现有 FileController 不等于策略管理 | FileStoragePolicy、FileObject | `system:file-storage:*` | 上传下载权限，敏感配置脱敏 | 仅底层本地上传线索 | 策略化存储待设计 | 上传下载、权限、存储测试、审计 |
| 40 | 系统参数 | `system-import-export` | `import-export` | 导入导出 | 44/35/39/V3目标 | 模板、任务、错误报告、导出记录 | `ImportExportController` 草案或业务 Controller 聚合 | ImportTask、ExportTask、ErrorReport | `system:import-export:*` | 导出脱敏、下载权限、任务审计 | 能力散落在业务 Controller | 统一任务、限流、模板版本待设计 | 模板校验、异步任务、导出脱敏、审计 |
| 41 | 系统参数 | `system-cache-management` | `cache-management` | 缓存管理 | 44/35/39/V3目标 | 缓存命名空间、命中率、刷新/清理 | `CacheManagementController` 草案；真实刷新服务待补 | CacheNamespace、CacheRefreshTask | `system:cache:*` | 清理高危确认、失败回滚审计 | 仅底层能力，刷新空实现风险 | 真实缓存刷新实现缺失 | 刷新生效、权限、审计、失败回滚 |
| 42 | 系统参数 | `system-audit-log` | `audit-log` | 审计日志 | 44/35/39/V3目标 | 操作日志、权限变更、配置变更、导出 | `OperLogController` / `@OperLog` 现状 | OperateLog、AuditEvent | `system:audit-log:*` | 查询导出脱敏、不可篡改性 | OperLog 能力较强 | 新增 44 菜单动作覆盖需补 | 查询、导出脱敏、保留周期、覆盖率 |
| 43 | 系统参数 | `system-doc-center` | `doc-center` | 文档中心 | 44/35/39/V3目标 | 管理员文档、版本、附件、发布 | `DocCenterController` 草案：CRUD、发布、版本、附件 | DocArticle、DocVersion、Attachment | `system:doc-center:*` | 附件安全、删除留痕 | 从 0 建设 | 内部文档或外部知识库边界待定 | 版本、权限、附件安全、审计 |
| 44 | 系统参数 | `system-tech-support` | `tech-support` | 技术支持 | 44/35/39/V3目标 | 支持请求、诊断包、系统信息、反馈 | `TechSupportController` 草案：工单、诊断包、导出 | SupportTicket、DiagnosticPackage | `system:tech-support:*` | 诊断包必须脱敏，禁止导出敏感配置原值 | 从 0 建设 | 诊断字段、支持流转、脱敏策略待设计 | 诊断包脱敏、权限、反馈创建、审计 |

矩阵计数结论：流程平台 1-9 共 9 项；组织权限 10-17 共 8 项；基础资料 18-23 共 6 项；集成配置 24-28 共 5 项；消息与通知 29-36 共 8 项；系统参数 37-44 共 8 项，合计 44 项。

---

## 7. 后端模块边界与通用契约

### 7.1 分层边界

| 层 | V3 后端契约 |
| --- | --- |
| Controller/API | 按资源暴露列表、详情、创建、更新、删除、启停、测试、导入导出、发布回滚等接口；延续 `Result<T>` / 分页风格；每个写接口必须有权限和审计。 |
| Service/Domain | 写操作使用事务；状态机、引用检查、租户隔离、数据权限、幂等、缓存刷新和外部调用重试由服务层统一控制。 |
| Entity/Migration | 实体字段与 SQL 迁移幂等；权限种子、菜单种子和按钮权限可重复执行；敏感字段只保存必要状态或加密值，具体加密待安全专项核查。 |
| DTO/校验 | Request/Response 分离；创建/更新 DTO 校验必填、长度、枚举、引用存在、状态合法、租户一致；响应 DTO 对敏感字段只返回掩码、已配置或测试状态。 |
| 权限码 | 每个菜单至少有菜单级、按钮级、接口级权限；`systemModuleRegistry permissionMeta` 后续需补齐 44 项。 |
| 审计 | 权限变更、配置变更、发布回滚、导入导出、连接测试、清缓存、诊断包、高危流程操作均落审计。 |
| 租户隔离 | 查询和写入绑定 TenantContext；缺失租户上下文默认拒绝；跨租户访问、导出、诊断包和日志查询需拦截并审计。 |
| 幂等 | 同步、Webhook、导入导出、邮件重试、缓存刷新、流程重试/终止等需要幂等键或等价策略。 |
| 导入导出 | 模板版本、异步任务、错误报告、下载权限、导出脱敏、任务审计必须成套设计。 |
| 缓存 | 参数、权限、菜单、字典等缓存刷新必须有真实执行结果，失败时返回可解释错误，不允许空刷新冒充成功。 |
| Webhook | 事件订阅、签名、重试、投递日志、幂等、失败告警；真实业务事件接入需明确事件源。 |
| 邮件 | 邮件网关主备优先级、连通测试、动态发送器、响应脱敏；存储加密和密钥轮换待核查。 |
| 通知 | 模板、渠道、偏好、开关、日志、重试进入统一发送决策链；关闭开关或偏好后不得发送。 |
| 流程表单 | 表单定义、版本、发布、停用、回滚、字段 schema 与 HTML/source 安全边界；表单实例存储另行契约化。 |

### 7.2 六个后端服务域边界

| 服务域 | 包含菜单 | 后端边界 | 不能越界 |
| --- | --- | --- | --- |
| 流程平台服务域 | 1-9 | 流程定义、设计、运行、表单、审批、待办、SLA 的版本状态机和审计 | 非流程阶段不推动流程实现；不绕过流程引擎改业务状态 |
| 组织权限服务域 | 10-17 | 用户、角色、菜单、部门、岗位、数据权限、交接、租户的权限链 | DataPermissionRule 不放权；Handover 不伪造真实对象转移 |
| 基础资料服务域 | 18-23 | 分类、编号、位置、供应商、字段、字段集的主数据链 | 不让字段配置破坏历史资产；不绕过引用保护删除 |
| 集成配置服务域 | 24-28 | 外部系统、接口、映射、同步、Webhook 的集成链 | 不保存或输出敏感原值；不让测试调用影响生产副作用 |
| 消息通知服务域 | 29-36 | 邮件、模板、日志、渠道、偏好、开关的发送决策链 | 响应脱敏不等于存储加密；异常放行策略需安全评审 |
| 系统参数服务域 | 37-44 | 参数、安全、文件、导入导出、缓存、审计、文档、技术支持的运维链 | 不把空缓存刷新、散落导出或未脱敏诊断包写成完成 |

---

## 8. 跨模块 IA 链路

| 链路 | 涉及顶部分类 | 涉及左侧菜单 | 数据流 | 关键断点 | 后端验收证据 |
| --- | --- | --- | --- | --- | --- |
| 权限链 | 组织权限、系统参数、安全横切 | 用户管理、角色权限、菜单权限、部门组织、岗位管理、数据权限、租户管理、审计日志 | User → Dept/Post → Role → Menu/Button → RoleDept/dataScope → DataPermissionRule → TenantContext → OperLog | systemModuleRegistry permissionMeta 不全；DataPermissionRule CUSTOM 边界；租户停用拦截需持续验证 | 无权限 API 拒绝；数据范围只收紧；跨租户阻断；审计表有权限变更记录 |
| 主数据链 | 基础资料、组织权限、流程平台 | 资产分类、字段集、自定义字段、编号规则、位置、供应商、部门组织、表单配置 | AssetCategory → CustomFieldset → CustomField → Asset；Location/Dept/Vendor → Asset/合同/采购；NumberingRule → Asset 创建 | 编号规则独立后台与并发测试不足；自定义字段与 Form schema 边界待统一 | 引用保护测试；编号并发唯一；字段集变更不破坏历史资产；资产创建编号证据 |
| 通知链 | 消息与通知、流程平台、集成配置 | 邮件网关、流程邮件、邮件模板、邮件日志、通知模板、通知渠道、通知偏好、流程通知开关、SLA 策略、Webhook | 事件/流程节点 → 模板渲染 → 渠道/网关 → 偏好/开关 → 发送 → 日志 → 重试/告警 | MailGateway 加密待核查；流程邮件调用链需确认；偏好/开关异常策略需定 | 关闭偏好/开关后不发送；失败日志可重试且幂等；响应不回显敏感原值 |
| 集成链 | 集成配置、消息与通知、系统参数 | 外部系统、接口管理、字段映射、同步规则、Webhook 配置、通知渠道、审计日志 | ExternalSystem → IntegrationInterface → FieldMapping → SyncRule → SyncJob/Log → Webhook → Notification | 除 Webhook 外多数从 0 建设；凭据加密、表达式安全、同步幂等待设计 | 连通测试审计；映射预览安全；同步失败可重试；Webhook 签名错误拒绝 |
| 系统参数链 | 系统参数、安全横切 | 基础参数、安全策略、文件存储、导入导出、缓存管理、审计日志、文档中心、技术支持 | SystemConfig → SecurityPolicy → FileStorage → Import/Export Task → CacheRefresh → OperLog → Doc/Support | Cache refresh 空实现；文件存储策略化不足；诊断包脱敏规则待定 | 参数生效或刷新结果；缓存真实刷新；导出/诊断包脱敏；审计覆盖高危操作 |

---

## 9. 安全合规横切架构

安全合规是横切能力，不作为第 7 个顶栏。它必须覆盖 6 类顶部导航和 44 项左侧导航。

| 能力 | 后端要求 | 重点菜单 | 验收方式 |
| --- | --- | --- | --- |
| RBAC | 菜单级、按钮级、接口级权限一致；后端拒绝是最终边界；缺失权限元数据时高危写操作默认拒绝。 | 全部 44 项，尤其组织权限、集成配置、系统参数 | 无权限接口拒绝；按钮隐藏与接口拒绝一致；permissionMeta 覆盖检查 |
| 数据权限 | Role.dataScope 是基础；DataPermissionRule 只能收紧；`CUSTOM` 部门配置仍在角色页。 | 角色权限、数据权限、部门组织、用户管理 | 规则启用后范围变小或不变；CUSTOM 不误投影；影响分析可解释 |
| 租户隔离 | 查询和写入绑定 TenantContext；缺失租户上下文默认拒绝；跨租户导出和诊断包也受控。 | 用户、角色、租户、审计、导入导出、技术支持 | 跨租户读取失败；租户停用阻断；审计记录越权尝试 |
| 敏感信息脱敏 | 邮件、Webhook、外部系统、通知渠道、导出、诊断包只返回掩码或已配置状态。 | 邮件网关、外部系统、Webhook、通知渠道、技术支持 | 响应字段核查；导出/诊断包脱敏检查；日志不含原值 |
| 密钥加密待核查 | MailGateway、外部系统、Webhook、通知渠道的存储加密、解密、密钥轮换与访问审计需专项确认。 | 邮件网关、外部系统、Webhook、通知渠道 | 安全设计评审；加密实现测试；密钥轮换演练 |
| 审计日志 | 权限、配置、发布、回滚、测试连接、导出、清缓存、诊断包、终止流程等高危操作均记录。 | 审计日志及所有高危菜单 | 审计表记录操作者、对象、结果、失败原因、前后值摘要 |
| fail-closed | 权限缺失、租户缺失、策略错误、表达式校验失败、敏感配置不可解密时默认拒绝或阻断。 | 安全策略、数据权限、集成配置、流程高危操作 | 异常路径测试；错误不泄露内部敏感实现 |

---

## 10. 实施分期与验收矩阵

| 阶段 | 范围 | 交付重点 | 验收证据 |
| --- | --- | --- | --- |
| P0 口径冻结 | 44/35/9/39/V3 | 冻结 6 类顶部导航、44 项左侧导航、35 非流程重点、9 流程受控、安全横切不做第 7 顶栏 | 本文 3、5、6 章；44 项矩阵连续；六组数量 9/8/6/5/8/8 |
| P1 V3 壳与已有真组件 | `/fixed-assets/workbenchv3`、默认菜单、SystemPageHost、Inspector、已有真实页面 | V3 壳只承载真实系统页，不复制业务逻辑；旧 Workbench 和移动端不动；当前不加 route 权限规则 | 合同测试或读回证据：路径、默认菜单、`SystemPageHost activeMenu`、旧入口保护存在 |
| P2 组织权限/基础资料校准 | 组织权限 8、基础资料 6 | 校准 Controller/API、权限码、permissionMeta、引用保护、DataPermissionRule、Handover、编号规则 | 权限拒绝、只收紧、租户隔离、引用保护、编号并发、Handover 状态机证据 |
| P3 集成配置 | 外部系统、接口、字段映射、同步规则、Webhook | 从 0 建设实体/API/权限/审计/加密设计；打通集成链 | 连通测试审计、字段映射预览、同步幂等、Webhook 签名/重试证据 |
| P4 消息通知 | 邮件网关、流程邮件、模板、日志、渠道、偏好、开关 | 打通发送决策链；确认 MailGateway 存储加密；偏好/开关进入真实发送路径 | 关闭偏好/开关不发送；失败重试幂等；响应脱敏；连通测试审计 |
| P5 系统参数 | 参数、安全、文件、导入导出、缓存、审计、文档、支持 | 参数生效、缓存真实刷新、统一导入导出、诊断包脱敏、审计覆盖 | 参数更新生效；缓存刷新结果；导出/诊断包脱敏；审计日志覆盖 |
| P6 流程平台专项 | 流程平台 9 项 | 单独设计/实现流程定义、运行、表单、审批、待办、SLA；统一 Form Center/Designer 命名 | DB/API/audit/page/E2E；版本状态机；发布/回滚；表单 schema 安全 |
| P7 权限元数据/测试补齐 | 全部 44 项 | 补齐 systemModuleRegistry permissionMeta、按钮权限、接口权限、审计动作、合同测试与 E2E | 44 项 permissionMeta 覆盖率；无权限测试；按钮与接口一致；detect_changes 仅用于代码实现阶段 |

---

## 11. 风险、开放问题、查缺补漏清单

| 风险/问题 | 等级 | 当前真实状态 | 必须补的动作 |
| --- | --- | --- | --- |
| Handover 真实对象转移未闭环 | 高 | 当前只能描述为交接任务摘要、对象摘要 JSON 和状态记录；真实资产/工单/审批对象转移动作未闭环 | 建立对象 schema、事务边界、回滚策略、审计和专属测试 |
| DataPermissionRule `CUSTOM` 边界 | 高 | 规则只收紧；`CUSTOM` 跳过投影，部门配置仍在角色管理页 | DTO、角色存在性校验、影响分析、CUSTOM 测试、文档一致性 |
| MailGateway 存储加密待核查 | 高 | 响应脱敏已有线索；存储加密、解密、密钥管理和轮换未核查 | 安全专项核查实现、加密迁移、密钥轮换、测试与审计 |
| Form Center/Designer 命名双轨 | 中 | IA 为 `form-config` / `form-storage`，当前实现存在 `system-form-center` / `system-form-designer` | 建立别名映射、统一菜单/权限/路由/registry 口径 |
| systemModuleRegistry permissionMeta 不全 | 高 | 审计显示当前仅部分菜单权限元数据较完整 | P7 补齐 44 项菜单级、按钮级、接口级权限和审计动作 |
| 集成配置空白 | 高 | 外部系统、接口、字段映射、同步规则多数从 0 建设 | 设计 ExternalSystem/Interface/Mapping/SyncRule 实体、API、迁移、测试和凭据加密 |
| Cache refresh 空实现 | 中 | `SystemConfigService.refreshCache` 存在空实现风险 | 补真实缓存命名空间、刷新结果、失败回滚和审计 |
| OLD-B docx 未完整转换 | 中 | 旧资产管理系统宽需求仍主要来自审计抽取，未形成可逐行引用 Markdown | 后续将 `docs/资产管理系统需求.docx` 转换或摘录为可审计 Markdown |
| 当前工作区 dirty | 中 | 审计记录存在大量既有 dirty/untracked 文件 | 后续 builder 必须严格 planned_writes/actual_writes；不得清理或覆盖无关改动 |
| V3 route 权限暂不做 | 中 | 当前阶段不把 `/fixed-assets/workbenchv3` 加入 route 权限规则 | 后续专项 fail-closed 接入，保持旧 `/fixed-assets/workbench` 不受影响 |
| 流程平台受控边界 | 中 | 流程平台 9 项进入矩阵但不在非流程阶段实现 | P6 单独专项，避免非流程变更误触流程设计器/运行监控 |
| 敏感信息泄露风险 | 高 | 集成、邮件、通知、诊断包、导出均涉及敏感配置 | 响应/日志/导出/诊断包统一脱敏；存储加密待核查；不记录原值 |

### 11.1 查缺补漏清单

1. 为 44 项建立机器可检查的 IA registry：序号、顶部分类、左侧 menu_id、权限前缀、状态、缺口、验收证据。
2. 为 44 项补齐 `systemModuleRegistry permissionMeta`，并与后端 `@PreAuthorize`、按钮权限、审计动作对齐。
3. 对 DataPermissionRule、Handover、MailGateway、FormDefinition、NumberingRule、Notification Preference/Switch、Cache Management 建立专项测试计划。
4. 对集成配置从 0 建设项先做实体关系和敏感配置安全设计，再写 Controller。
5. 对系统参数链补真实缓存刷新、导入导出统一任务、诊断包脱敏和审计覆盖。
6. 对流程平台建立 P6 专项，不在非流程阶段顺手改流程设计器、流程运行监控、审批规则或 SLA 实现。

---

## 12. 文档自检清单

| 自检项 | 结果口径 |
| --- | --- |
| 标题存在 | 本文标题为 `Future Settings OS v3 后端架构导航 IA 切片`。 |
| V3 壳关键词 | 包含 `/fixed-assets/workbenchv3`、`SystemPageHost activeMenu`、顶部导航、左侧导航、Inspector。 |
| 6 类顶部导航 | 流程平台、组织权限、基础资料、集成配置、消息与通知、系统参数均已逐类展开。 |
| 44 项矩阵 | 第 6 章列出 1-44 连续矩阵，并写明六组数量 9/8/6/5/8/8。 |
| 安全合规定位 | 明确“安全合规是横切能力”，不作为第 7 个顶栏。 |
| 真实性边界 | 明确本文不是实现完成，不运行项目测试，旧 Workbench 和移动端不动。 |
| 敏感信息 | 文档只描述脱敏、加密待核查和密钥管理，不写敏感原值赋值形式。 |
