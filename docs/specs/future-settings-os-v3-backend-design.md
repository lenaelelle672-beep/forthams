# Future Settings OS v3 后端设计方案

> 版本日期：2026-07-01  
> 文档角色：v3 后端设计基线；不等同于代码实现承诺。  
> 写入来源：GAI2 `20260701-gai2-v3-backend-prd-design` 会话的 `audit.json`、`debate.json`、`draft.json`、`refine.json` 与 `adjudication.json`。  
> 真实性红线：本文只描述已审计事实、设计目标、契约草案、缺口与验收方式；未运行的测试不写成已通过，未核查的安全能力不写成已完成。

---

## 1. 设计目标与非目标

### 1.1 设计目标

1. 以 `docs/specs/system-hub/INFORMATION-ARCHITECTURE.md` 为 IA 权威主文档，固化 Future Settings OS v3 后端目标范围。
2. 统一 `44 项 / 6 组`、`35 个非流程后台菜单`、`9 个流程平台菜单`、`39 张 Stitch 设计稿记录` 与 `Workbench V3 当前承载范围` 的口径，避免把阶段子集误认为全量范围。
3. 为每个 IA 菜单明确页面/导航需求、核心数据对象、后端契约草案、权限建议、业务规则、验证方式与缺口；没有现成实现的菜单也必须具备可执行设计，不得只写“待补”。
4. 建立跨页业务链：权限链、主数据链、通知链、集成链、系统参数链，使后台设置不只是页面集合，而是可读、可配、可查、可审计的系统治理能力。
5. 为后续 `/create-prd` 风格扩展 PRD、差异评分与实现排期提供后端设计基线。

### 1.2 非目标

1. 本文不修改业务源码、测试源码、移动端、dashboard、旧 workbench、项目配置、密钥或旧 GAI 状态。
2. 本文不把 `Handover` 写成真实资产/工单/审批对象转移已闭环；当前仅按交接任务摘要与状态记录设计。
3. 本文不把 `DataPermissionRule` 写成放权机制；它只能描述为只收紧的规则投影层，`CUSTOM` 边界依赖角色管理页部门配置。
4. 本文不声明 `MailGateway` 密码存储已加密；当前只可写响应脱敏已存在，存储加密、解密与密钥管理待核查。
5. 本文不直接生成扩展完整 PRD 或新旧评分文档；这些应在后续受控写入中按本设计继续完成。

---

## 2. 输入证据与版本口径

| 证据类别 | 路径 | 本文采用方式 | 口径说明 |
|---|---|---|---|
| 旧 PRD A | `prd.md`、`docs/archive/planning/prd.md` | 作为租户隔离、安全上下文、数据隔离、审计日志与数据权限红线输入 | 范围较窄，不可作为完整后台管理 PRD |
| 旧 PRD B | `docs/资产管理系统需求.docx` | 作为资产全生命周期、ERP、RFID、闲置/赔偿、流程审批、报表等宽需求输入 | `audit.json` 已通过只读抽取取得证据；普通 Read 未直接读取完整 docx |
| V1 候选 | `.stitch/forthams-uniview-product-suite-prd.md` | 作为 UNIVIEW 产品套、高层模块、视觉氛围和业务视角参考 | 不提供 44 项后台 IA、后端实体/API 或验收矩阵 |
| V2 候选 | `.stitch/system-hub-39-getstitch-100score-run.md`、System Hub 相关文档 | 作为 39 张设计稿执行记录、Future Settings OS 演进证据 | 39 是设计稿执行记录，不是菜单范围权威口径 |
| IA 主文档 | `docs/specs/system-hub/INFORMATION-ARCHITECTURE.md` | 作为菜单、导航、业务链和矩阵的 single source of truth | 定义 44 项 / 6 组，35 非流程，9 流程平台 |
| Workbench V3 约束 | `docs/workbench-v3-style-guide.md` | 作为独立后端管理壳、入口、默认菜单、旧入口保护和菜单承载范围输入 | 当前承载范围小于目标 IA，不是 44 项上限 |
| 旧实现矩阵 | `docs/superpowers/specs/2026-06-30-future-settings-os-non-flow-pages-implementation-audit.md` | 仅作为历史证据 | 已被 `DataPermissionRule`、`Handover`、`MailGateway`、`FormDefinition` 等当前事实部分刷新 |

### 2.1 证据使用原则

- 路径与状态来自 GAI2 审计产物；对代码当前状态的描述均为审计事实或设计假设，不代表本轮重新运行全量代码验证。
- 旧矩阵里的深度 0/1/2/3 只能作为历史分层提示；本文若引用，必须同时标注“需刷新”。
- 所有接口、权限码和实体名中没有现成实现证据的，均以“建议”或“契约草案”标注。
- 本文不包含任何密钥、令牌或口令原值。

---

## 3. 44/35/9/39/Workbench V3 口径统一

| 口径 | 含义 | v3 采用方式 | 禁止误用 |
|---|---|---|---|
| 44 项 / 6 组 | IA 主文档菜单注册表的全量目标范围 | v3 后端设计的全量覆盖矩阵 | 禁止只覆盖当前已做页面 |
| 35 个非流程后台菜单 | 44 减去流程平台 9 项 | 当前非流程后台推进的阶段子集 | 禁止把 35 当成全量 IA |
| 9 个流程平台菜单 | `流程平台` 组全部菜单 | 本文只做受控需求、契约与命名边界设计；实现需后续专项 | 禁止在非流程阶段误触流程平台实现 |
| 39 张 Stitch 设计稿记录 | V2 视觉/页面执行记录 | 作为页面氛围与可视参考 | 禁止当作菜单数量或 IA 权威范围 |
| IA 文档中的 44 张 HTML 设计稿映射 | `future-settings-os-<id>.html` 兜底目标态 | 可作为 iframe 兜底与渐进替换参考 | 禁止替代后端契约、权限和测试设计 |
| Workbench V3 当前承载范围 | 样式指南记录当前已登记真组件范围 | 作为当前实现状态与壳约束 | 禁止当作目标 IA 上限 |

结论：v3 后端设计以 `44 项 / 6 组` 为全量目标；`35`、`9`、`39`、`Workbench V3 当前范围` 都是交叉标签或阶段证据，不改变 IA 全量范围。

---

## 4. 后端管理壳与导航

### 4.1 壳架构

- 独立入口：`/fixed-assets/workbenchv3`。
- 默认菜单：`?menu=system-user-management`。
- 承载方式：继续使用 `SystemPageHost activeMenu`，真实系统页面通过 registry 嵌入。
- Inspector：继续通过 `SystemInspectorSlotProvider` 接收各真实页面提供的右侧详情内容。
- 旧入口保护：不得修改 `/fixed-assets/workbench`、旧 `WorkspacePreviewPage` base path 或旧默认跳转。
- 权限阶段：样式指南明确当前阶段不在 `routePermissions.ts` 中加入 `/fixed-assets/workbenchv3`，后续权限专项再处理。

### 4.2 导航层级

1. 顶栏为 6 个 IA 分组：流程平台、组织权限、基础资料、集成配置、消息与通知、系统参数。
2. 左栏为当前分组的二级菜单，切换分组替换菜单集合，切换子菜单只替换中栏和右栏内容，不卸载 shell。
3. 中栏承载列表、矩阵、树、拓扑、配置表单和状态视图。
4. 右栏 Inspector 承载选中对象详情、影响分析、审计摘要、关联对象和操作风险。

### 4.3 Registry 与权限元数据

| 对象 | 职责 | 当前风险 | v3 设计要求 |
|---|---|---|---|
| `systemRealPageRegistry` | 菜单 ID 到真实组件的注册表 | 当前已登记范围小于 44 项；`mail-gateway` 等存在页面但未完全闭环 | 每个菜单进入真实页前必须有 registry 行、懒加载边界和空/错/加载状态 |
| `systemModuleRegistry` | 模块权限元数据事实源 | 审计显示仅用户与角色较完整 | 每个菜单至少补齐菜单级权限、按钮级权限、权限码前缀和审计动作定义 |
| `systemSubpageHtmlByMenuId` | 设计稿 iframe 兜底 | 容易让设计稿被误认为实现 | 仅作渐进迁移兜底，不能替代 API、权限、测试和数据契约 |
| `routePermissions` | 路由访问权限 | Workbench V3 当前不加入 | 后续专项需在不破坏旧入口前提下 fail-closed 接入 |

---

## 5. IA coverage matrix（44 项 / 6 组完整展开）

> 列说明：  
> **范围**：`44`=全量目标；`35`=非流程阶段；`9`=流程平台受控边界；`39`=有 V2 设计稿参考但不作范围口径；`V3`=Workbench V3 当前或目标承载。  
> **后端契约** 中标注“草案”的内容不代表已实现。  
> **验证方式** 默认包括：DB 迁移检查、权限种子检查、接口契约测试、服务层规则测试、页面导航 smoke、审计日志核验与 E2E 回归，具体按菜单取舍。

| # | 分组 | 菜单 ID / 名称 | 范围 | 页面与导航需求 | 后端契约草案或现状 | 权限建议 | 核心对象与业务规则 | 验证方式 | 缺口与边界 |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | 流程平台 | `flow-definition` / 导航控制台 | 44、9、39 | 在流程平台组展示流程定义目录、启停状态、版本入口和影响范围 Inspector | 草案：`FlowDefinitionController`、`FlowDefinitionService`、`FlowDefinition`、版本表和发布记录；API 需支持列表、版本、启停、引用分析 | `workflow:definition:list/view/create/update/publish/disable` | 流程定义、版本、节点摘要；发布后需冻结历史版本，变更需审计 | API 契约、版本状态机、发布审计、页面 smoke | 流程平台受控；非流程阶段只写需求，不扩大实现 |
| 2 | 流程平台 | `settings-command-center` / 流程控制台 | 44、9、39 | 展示流程运行概览、异常队列、待办积压、重试入口 | 草案：`WorkflowCommandController` 聚合流程实例、任务、异常、SLA；只读聚合优先，写操作必须审计 | `workflow:command:view/retry/terminate` | 流程实例、任务、异常、SLA；高风险操作需二次确认 | 聚合查询、权限拦截、重试/终止审计 | 不得绕过流程引擎直接改业务状态 |
| 3 | 流程平台 | `flow-designer` / 流程设计器 | 44、9、39、V3 | 作为真组件或原生设计器入口，保留版本、草稿、发布与回滚 | 草案：`FlowDesignerController` 或沿用现有设计器 API；需保存草稿、校验图结构、发布版本 | `workflow:designer:view/save/publish/rollback` | 流程图 JSON、节点、条件、版本；发布前校验开始/结束节点、孤立节点、权限节点 | 图结构校验、发布回滚测试、权限与审计 | 流程平台专项；不得在本文声称现有设计器后端已全部达标 |
| 4 | 流程平台 | `runtime-monitor` / 运行监控 | 44、9、39 | 监控流程实例运行、异常、耗时、SLA 告警 | 草案：`WorkflowRuntimeMonitorController`，只读列表、详情、异常轨迹、导出 | `workflow:runtime:view/export` | 流程实例、节点执行记录、异常原因、SLA 状态 | 查询性能、导出权限、异常轨迹准确性 | 需明确数据保留周期与脱敏策略 |
| 5 | 流程平台 | `form-config` / 表单配置 | 44、9、39、V3 | 与现有 `system-form-center` / `system-form-designer` 命名关系待统一；页面需显示表单定义、版本与发布状态 | 审计发现 `FormDefinitionController`、`FormDefinitionService`、表单定义迁移已存在；契约需统一到 IA 菜单命名 | `workflow:form:list/view/create/update/publish/disable/rollback` | `FormDefinition`、版本历史、`definition_json`；字段级 schema 和 HTML source 安全边界需定义 | API、版本状态机、字段 schema、安全过滤、发布回滚测试 | 命名关系待统一：`form-config`、`form-storage` 与 `system-form-center/system-form-designer` 不得双轨失控 |
| 6 | 流程平台 | `form-storage` / 表单存储 | 44、9、39 | 展示表单数据存储策略、提交数据索引、归档和导出策略 | 草案：`FormStorageController`、提交记录表、归档策略；若复用表单定义服务需分离定义与实例数据 | `workflow:form-storage:view/export/archive/delete` | 表单提交数据、附件、归档状态；需租户隔离、字段脱敏和删除留痕 | DB 结构、租户过滤、导出脱敏、归档回滚 | 当前审计只确认表单定义能力，未确认表单实例存储闭环 |
| 7 | 流程平台 | `approval-rules` / 审批规则 | 44、9、39 | 配置审批条件、审批人解析、默认策略和冲突检测 | 草案：`ApprovalRuleController`、规则引擎服务、条件表达式校验 | `workflow:approval-rule:list/create/update/enable/test` | 审批规则、条件、审批人解析；规则启停只影响后续实例 | 规则模拟、冲突检测、权限与审计 | 需防止表达式注入和错误规则影响历史流程 |
| 8 | 流程平台 | `todo-fields` / 待办字段 | 44、9、39 | 配置待办列表字段、排序、可见性和角色差异 | 草案：`TodoFieldConfigController`、字段配置实体、角色覆盖策略 | `workflow:todo-field:list/update/reset` | 字段配置、角色可见性；默认配置必须可恢复 | 配置保存、角色覆盖、默认恢复、页面 smoke | 需与待办业务页面字段兼容，不得破坏旧待办入口 |
| 9 | 流程平台 | `sla-config` / SLA 策略 | 44、9、39、V3 | 展示 SLA 策略、超时规则、提醒策略与适用流程 | 审计和样式指南显示 V3 当前含 SLA 策略；后端契约需校准 `SlaConfigController/Service` 或现有等价实现 | `workflow:sla:list/create/update/enable/test` | SLA 策略、时间规则、提醒策略；启停需影响后续任务 | 策略计算、提醒触发、超时记录、审计 | 需确认已有实现路径和权限元数据 |
| 10 | 组织权限 | `user-management` / 用户管理 | 44、35、39、V3 | V3 默认菜单；展示用户、部门、岗位、角色、状态和 Inspector | 现状倾向完整；契约应包含 `UserController`、用户服务、用户角色/岗位关联 | `system:user:list/view/create/update/delete/reset-password/assign-role` | 用户、部门、岗位、角色；停用需阻断登录，重置敏感操作需审计 | API、角色分配、停用登录、审计、页面合同 | 不得泄露敏感凭据；重置动作只显示结果状态 |
| 11 | 组织权限 | `role-permissions` / 角色权限 | 44、35、39、V3 | 展示角色、菜单权限、数据范围、成员 Inspector | 现状倾向完整；契约包含 `RoleController`、角色菜单、角色部门、dataScope | `system:role:list/view/create/update/delete/assign-menu/assign-dept` | 角色、菜单权限、数据范围；`CUSTOM` 部门仍由角色管理页维护 | 菜单授权、数据范围投影、越权拦截、审计 | 需与 `DataPermissionRule` 的只收紧投影边界一致 |
| 12 | 组织权限 | `menu-permissions` / 菜单权限 | 44、35、39、V3 | 展示菜单树、按钮权限、API 权限映射和影响角色 | 现状倾向完整；契约包含 `MenuController`、菜单树、按钮权限、权限码 | `system:menu:list/create/update/delete` | 菜单、按钮、权限码；删除需检查角色引用 | 菜单树、按钮码、引用检查、权限元数据 | 需补齐全部 44 菜单的 permissionMeta |
| 13 | 组织权限 | `dept-org` / 部门组织 | 44、35、39、V3 | 展示部门树、成员、负责人、数据权限影响 | 历史矩阵为基础 CRUD；契约包含 `DeptController`、部门树、成员引用检查 | `system:dept:list/create/update/delete` | 部门、父子关系、成员；删除前需检查用户/资产引用 | 树结构、循环引用、删除保护、数据权限影响 | Inspector 需显示数据权限影响，不只显示部门信息 |
| 14 | 组织权限 | `post-management` / 岗位管理 | 44、35、39、V3 | 展示岗位、岗位成员、岗位与用户关联 | 历史矩阵为基础 CRUD；契约包含 `PostController`、用户岗位关联 | `system:post:list/create/update/delete` | 岗位、用户岗位关联；删除前需检查用户引用 | CRUD、引用检查、审计 | 需与用户管理 Inspector 联动 |
| 15 | 组织权限 | `data-permissions` / 数据权限 | 44、35、39、V3 | 展示规则目录、启停、影响分析、角色投影结果 | 审计发现 `DataPermissionRuleController`、`DataPermissionRuleService`、迁移已存在；规则投影到 `Role.dataScope` | `system:data-permission:list/view/create/update/delete/enable/analyze` | `DataPermissionRule`、角色 dataScope、部门配置；规则只收紧，不放宽；`CUSTOM` 跳过投影，部门配置仍在角色管理页 | 规则 CRUD、启停、只收紧断言、`CUSTOM` 边界、影响分析、审计 | `roleIds` 结构化校验、角色存在性、专属测试和 permissionMeta 待补 |
| 16 | 组织权限 | `handover` / 交接管理 | 44、35、39、V3 | 展示交接任务、状态、交接双方、对象摘要与 Inspector | 审计发现 `HandoverController`、`HandoverService`、迁移已存在；当前是任务摘要和状态记录 | `system:handover:list/view/create/update/start/complete/cancel` | `Handover`、业务对象摘要 JSON；状态为 PENDING / IN_PROGRESS / COMPLETED / CANCELLED；真实对象转移未闭环 | 状态机、对象摘要 schema、权限、审计、页面 smoke | 不得写成资产/工单/审批真实转移闭环；PENDING 直达 COMPLETED 需产品确认 |
| 17 | 组织权限 | `tenant-management` / 租户管理 | 44、35、39、V3 | 展示租户、租户状态、隔离配置和审计入口 | 历史矩阵为完整；契约包含 `TenantController`、租户服务、租户状态 | `system:tenant:list/view/create/update/disable` | 租户、状态、安全上下文；停用需阻断租户访问 | 租户过滤、停用拦截、审计、越权测试 | 必须继承旧 PRD A 的租户隔离红线 |
| 18 | 基础资料 | `asset-category` / 资产分类 | 44、35、39、V3 | 展示分类树、字段集绑定、资产引用数量 | 历史矩阵为完整；契约包含 `AssetCategoryController`、分类服务、字段集关联 | `master:asset-category:list/create/update/delete` | `AssetCategory`、`CustomFieldset`；删除需检查资产引用 | 树结构、字段集绑定、删除保护 | 需与自定义字段集和资产创建链路联动 |
| 19 | 基础资料 | `numbering-rules` / 编号规则 | 44、35、39 | 展示编号规则、适用对象、预览、冲突提示 | 历史矩阵为仅底层；契约草案：`NumberingRuleController`、`NumberingRuleService.generate()` 接入资产创建 | `master:numbering-rule:list/create/update/enable/preview` | 编号规则、流水号、适用对象；生成需并发安全、可预览、可回滚 | 并发生成、资产创建接入、预览、审计 | IA 明确断点：编号规则未接入资产生成，需补真实调用 |
| 20 | 基础资料 | `location-management` / 位置管理 | 44、35、39、V3 | 展示位置树、资产数量、上级位置和地图/区域信息 | 历史矩阵为完整；契约包含 `LocationController`、位置服务 | `master:location:list/create/update/delete` | `Location`、资产位置引用；删除需检查资产引用 | 树结构、引用检查、资产关联 Inspector | 需与资产位置变更审计联动 |
| 21 | 基础资料 | `vendor-management` / 供应商管理 | 44、35、39、V3 | 展示供应商、联系人、合同/采购/维保引用 | 历史矩阵为基础 CRUD；契约包含 `VendorController`、供应商服务 | `master:vendor:list/create/update/delete` | `Vendor`、合同/采购/维保引用；删除需检查业务引用 | CRUD、引用检查、导入导出、审计 | 旧宽 PRD 的供应商链路需纳入后续 PRD |
| 22 | 基础资料 | `custom-fields` / 自定义字段 | 44、35、39、V3 | 展示字段定义、类型、校验、适用范围 | 历史矩阵为基础 CRUD；契约包含 `CustomFieldController`、字段服务 | `master:custom-field:list/create/update/delete` | `CustomField`、字段类型、校验规则；字段删除需检查字段集引用 | 字段校验、引用检查、表单/资产兼容 | 需统一与 Form Center 字段 schema 的边界 |
| 23 | 基础资料 | `custom-field-sets` / 字段集管理 | 44、35、39、V3 | 展示字段集、字段排序、资产分类绑定 | 历史矩阵为完整；契约包含 `CustomFieldsetController`、字段集服务 | `master:custom-fieldset:list/create/update/delete/bind` | `CustomFieldset`、字段集合、分类绑定；变更需影响新建资产，不破坏历史数据 | 字段集绑定、排序、历史兼容、审计 | 需与资产分类和自定义字段双向校验 |
| 24 | 集成配置 | `external-systems` / 外部系统 | 44、35、39 | 展示外部系统目录、认证方式、启停、健康状态 | 历史矩阵为从 0 造；契约草案：`ExternalSystemController`、`ExternalSystemService`、连接配置实体 | `integration:external-system:list/create/update/delete/enable/test` | 外部系统、认证方式、健康状态；敏感配置只允许脱敏展示 | 连通测试、脱敏响应、启停、审计 | 不写任何密钥原值；存储加密和密钥管理需设计 |
| 25 | 集成配置 | `interfaces` / 接口管理 | 44、35、39 | 展示接口目录、方法、地址、鉴权、限流与重试策略 | 历史矩阵为从 0 造；契约草案：`IntegrationInterfaceController`、接口定义实体 | `integration:interface:list/create/update/delete/test` | 接口定义、请求模板、响应映射；测试调用需隔离生产副作用 | 接口测试、权限、限流、审计 | 需与外部系统和字段映射建立 FK |
| 26 | 集成配置 | `field-mapping` / 字段映射 | 44、35、39 | 展示源字段、目标字段、转换规则、版本 | 历史矩阵为从 0 造；契约草案：`FieldMappingController`、映射规则服务 | `integration:field-mapping:list/create/update/delete/test` | 字段映射、转换表达式、版本；表达式需安全沙箱或白名单 | 映射预览、异常样例、表达式安全、审计 | 需防止表达式注入和错误映射污染数据 |
| 27 | 集成配置 | `sync-rules` / 同步规则 | 44、35、39 | 展示同步方向、频率、触发器、失败重试、告警 | 历史矩阵为从 0 造；契约草案：`SyncRuleController`、同步任务服务、执行日志 | `integration:sync-rule:list/create/update/enable/run/retry` | 同步规则、任务实例、失败日志；启停只影响后续任务 | 任务调度、失败重试、幂等、审计 | 需与通知链联动告警，避免重复同步 |
| 28 | 集成配置 | `webhook-config` / Webhook 配置 | 44、35、39 | 展示 webhook 订阅、事件、签名、调用日志 | 历史矩阵为基础 CRUD；契约包含 `WebhookController/Service` 或等价实现；需接入业务事件 | `integration:webhook:list/create/update/delete/test` | Webhook、事件订阅、签名、重试；调用需签名和幂等 | CRUD、签名校验、业务事件触发、失败重试 | IA 断点：`WebhookService.fireEvent` 需接入真实业务事件 |
| 29 | 消息与通知 | `mail-gateway` / 邮件网关 | 44、35、39 | 展示 SMTP 主备、优先级、连通测试、脱敏状态 | 审计发现 `MailGatewayController`、`MailGatewayService`、`MailSenderProvider`、`MailGatewayResponse` 已存在；响应脱敏已存在 | `mail:gateway:list/view/create/update/delete/test` | `MailGateway`、主备优先级、测试结果；响应只显示配置状态和掩码，不回显明文 | CRUD、测试端点、响应脱敏、权限、审计 | 存储加密、解密与密钥管理待核查；`systemRealPageRegistry` 接入和权限种子待确认 |
| 30 | 消息与通知 | `workflow-mail` / 流程邮件 | 44、35、39 | 展示流程邮件配置、触发节点、发送策略 | 历史矩阵为完整或可挂载；契约需校准 `BpmMailConfigService` 与流程节点调用 | `mail:workflow:list/create/update/enable/test` | 流程邮件配置、模板、节点触发；需进入发送决策链 | 节点触发、模板渲染、发送审计 | IA 断点：流程邮件服务存在但业务调用需确认 |
| 31 | 消息与通知 | `mail-templates` / 邮件模板 | 44、35、39 | 展示模板、变量、预览、适用场景 | 历史矩阵为基础 CRUD；契约包含 `MailTemplateController`、模板渲染服务 | `mail:template:list/create/update/delete/preview` | 邮件模板、变量、渲染结果；变量白名单、HTML 安全 | 预览、变量校验、渲染安全、审计 | 需与 `EmailServiceImpl` 使用模板的关系统一 |
| 32 | 消息与通知 | `mail-logs` / 邮件日志 | 44、35、39 | 展示发送记录、失败原因、重试状态 | 历史矩阵为基础 CRUD；契约包含 `MailLogController`、重试调度器 | `mail:log:list/view/retry/export` | 邮件日志、失败状态、重试次数；失败重试需幂等 | 日志查询、重试、导出脱敏、审计 | 需明确日志保留周期与脱敏字段 |
| 33 | 消息与通知 | `notification-templates` / 通知模板 | 44、35、39 | 展示站内/钉钉/邮件等通知模板与变量 | 历史矩阵为基础 CRUD；契约包含 `NotificationTemplateController` | `notification:template:list/create/update/delete/preview` | 通知模板、变量、渠道适配；变量白名单 | 模板预览、渠道渲染、审计 | 需与邮件模板边界清晰，避免双模板混乱 |
| 34 | 消息与通知 | `notification-channels` / 通知渠道 | 44、35、39 | 展示渠道类型、配置、启停、健康状态 | 历史矩阵为完整；契约包含 `NotificationChannelController`、渠道配置 | `notification:channel:list/create/update/delete/test` | 渠道配置、健康状态；敏感配置脱敏展示 | 连通测试、脱敏、启停、审计 | DingTalk 等真实 POST 需隔离测试环境 |
| 35 | 消息与通知 | `notification-preferences` / 通知偏好 | 44、35、39 | 展示用户/角色通知偏好、订阅范围 | 历史矩阵为完整但 IA 指出零调用断点；契约包含 `NotificationPreferenceController` | `notification:preference:list/update/reset` | 用户偏好、渠道偏好、免打扰；发送前必须读取偏好 | 偏好保存、发送决策调用、默认恢复 | 断点：`NotificationPreferenceService.isEnabled` 需接入发送决策 |
| 36 | 消息与通知 | `workflow-notification-switch` / 流程通知开关 | 44、35、39 | 展示流程通知开关、范围、灰度和影响分析 | 历史矩阵为基础 CRUD 或完整偏弱；契约包含 `NotificationBizSwitchController` | `notification:workflow-switch:list/update/test` | 业务开关、适用流程、灰度范围；关闭需阻断对应通知 | 开关生效、发送决策、审计 | 断点：开关服务需接入通知发送路径 |
| 37 | 系统参数 | `base-params` / 基础参数 | 44、35、39 | 展示系统参数分组、键值、影响范围和修改历史 | 历史矩阵为完整；契约包含 `SystemConfigController/Service` | `system:param:list/view/update/refresh` | 系统参数、分组、缓存；修改需审计和影响提示 | 参数校验、缓存刷新、审计、回滚 | `refreshCache` 历史上为空实现，需核查并补齐 |
| 38 | 系统参数 | `security-policy` / 安全策略 | 44、35、39 | 展示密码策略、登录策略、会话策略、IP/设备策略 | 历史矩阵为基础 CRUD；契约草案或现状需统一 `SecurityPolicyController` | `system:security-policy:list/update/test` | 安全策略、登录限制、会话参数；策略错误需 fail-closed | 策略保存、登录链路生效、审计 | 旧矩阵称无独立实体，需确认是否从系统配置中拆分 |
| 39 | 系统参数 | `file-storage` / 文件存储 | 44、35、39 | 展示存储后端、容量、上传限制、访问策略 | 历史矩阵为仅底层；契约草案：`FileStorageController`、存储策略服务 | `system:file-storage:list/update/test` | 存储配置、上传策略、访问 URL；配置敏感字段脱敏 | 上传下载、权限、存储测试、审计 | 当前 `FileController` 使用本地上传，策略化存储待设计 |
| 40 | 系统参数 | `import-export` / 导入导出 | 44、35、39 | 展示导入模板、导出任务、错误报告、权限 | 历史矩阵为基础 CRUD；契约包含 `ImportExportController`、任务日志 | `system:import-export:list/run/export/download` | 导入任务、导出任务、错误明细；导出需权限和脱敏 | 模板校验、异步任务、导出脱敏、审计 | 需按业务对象定义导入导出范围和限流 |
| 41 | 系统参数 | `cache-management` / 缓存管理 | 44、35、39 | 展示缓存命名空间、命中率、刷新/清理入口 | 历史矩阵为仅底层；契约草案：`CacheManagementController`、缓存刷新服务 | `system:cache:list/refresh/clear` | 缓存键、命名空间、刷新任务；清理需高危确认 | 刷新生效、权限、审计、失败回滚 | 需补真实缓存刷新实现，避免空刷新造成误导 |
| 42 | 系统参数 | `audit-log` / 审计日志 | 44、35、39 | 展示操作日志、权限变更、配置变更、导出 | 历史矩阵为完整；契约包含 `OperLogController`、`@OperLog` 切面 | `system:audit-log:list/view/export` | 操作日志、操作者、对象、结果；敏感字段需脱敏 | 查询、导出脱敏、不可篡改性、保留周期 | 需覆盖新菜单的审计动作和风险等级 |
| 43 | 系统参数 | `doc-center` / 文档中心 | 44、35、39 | 展示管理员文档、版本、权限、发布状态 | 历史矩阵为从 0 造；契约草案：`DocCenterController`、文档服务、附件存储 | `system:doc-center:list/create/update/publish/delete` | 文档、版本、附件、发布状态；删除需保留审计 | 文档版本、权限、附件安全、审计 | 需确定是否仅系统内文档还是接入外部知识库 |
| 44 | 系统参数 | `tech-support` / 技术支持 | 44、35、39 | 展示支持信息、诊断包、问题反馈、联系方式 | 历史矩阵为从 0 造；契约草案：`TechSupportController`、诊断包服务、反馈记录 | `system:tech-support:view/create-ticket/export-diagnostic` | 支持请求、诊断包、环境摘要；诊断包必须脱敏 | 诊断包脱敏、权限、反馈创建、审计 | 禁止导出密钥、令牌、口令或敏感配置原值 |

### 5.1 矩阵结论

- 44 项已完整展开，且每项均包含需求、契约草案或现状、权限建议、验证方式和缺口。
- 35 个非流程菜单覆盖组织权限、基础资料、集成配置、消息与通知、系统参数；它们是当前阶段主要实现范围。
- 9 个流程平台菜单已纳入需求与契约草案，但标注为受控边界，后续实现需专项推进。
- `system-form-center/system-form-designer` 与 IA 中 `form-config/form-storage` 的关系仍待统一；本文不把两套命名写成已解决。

---

## 6. 后端契约矩阵

### 6.1 通用后端契约

| 契约维度 | v3 要求 |
|---|---|
| 返回模型 | 延续项目现有 `Result<T>` / 分页返回风格；失败需包含业务错误码与可定位消息 |
| 权限门禁 | Controller 层统一使用接口级权限校验；权限码需与菜单级、按钮级、permissionMeta 对齐 |
| 数据隔离 | 所有租户相关查询必须受 TenantContext 与租户过滤保护；数据权限使用 fail-closed 策略 |
| 写事务 | 写操作由 Service 层事务保护，状态变更和关联表更新必须同事务提交或回滚 |
| 审计 | 配置、权限、状态、敏感连接测试、导出、清理、发布、回滚等操作必须落审计 |
| DTO 校验 | 入口 DTO 必须校验枚举、长度、引用存在性、状态机合法性和敏感字段边界 |
| 响应脱敏 | 密码、连接凭据、签名密钥、访问令牌等仅返回“已配置/掩码/状态”，不返回原值 |
| 迁移 | SQL 迁移应幂等，权限种子需可重复执行，并保留菜单与按钮权限层级 |
| 测试 | 每个 Controller/Service 至少覆盖权限拒绝、成功路径、非法状态、审计或数据隔离关键用例 |

### 6.2 分组契约

| 分组 | Controller/API 边界 | Service/Entity 边界 | 权限码前缀建议 | 测试重点 |
|---|---|---|---|---|
| 流程平台 | `FlowDefinition`、`WorkflowCommand`、`FlowDesigner`、`RuntimeMonitor`、`FormDefinition`、`FormStorage`、`ApprovalRule`、`TodoField`、`SlaConfig` | 流程定义、版本、实例、表单定义/实例、审批规则、SLA 策略 | `workflow:*` | 版本状态机、发布回滚、表单 schema、流程高危操作审计 |
| 组织权限 | `User`、`Role`、`Menu`、`Dept`、`Post`、`DataPermissionRule`、`Handover`、`Tenant` | 用户角色岗位、角色菜单部门、数据权限规则、交接任务、租户 | `system:*` | 权限 fail-closed、数据权限只收紧、交接状态机、租户隔离 |
| 基础资料 | `AssetCategory`、`NumberingRule`、`Location`、`Vendor`、`CustomField`、`CustomFieldset` | 分类、编号、位置、供应商、字段、字段集 | `master:*` | 引用保护、编号并发、字段校验、资产链路联动 |
| 集成配置 | `ExternalSystem`、`IntegrationInterface`、`FieldMapping`、`SyncRule`、`Webhook` | 外部系统、接口、字段映射、同步规则、Webhook 订阅 | `integration:*` | 脱敏、连通测试、映射表达式安全、同步幂等、签名校验 |
| 消息与通知 | `MailGateway`、`WorkflowMail`、`MailTemplate`、`MailLog`、`NotificationTemplate`、`NotificationChannel`、`NotificationPreference`、`NotificationSwitch` | 邮件网关、模板、日志、通知渠道、偏好、开关 | `mail:*`、`notification:*` | 邮件响应脱敏、发送决策链、失败重试、偏好和开关生效 |
| 系统参数 | `SystemConfig`、`SecurityPolicy`、`FileStorage`、`ImportExport`、`CacheManagement`、`OperLog`、`DocCenter`、`TechSupport` | 参数、安全策略、文件存储、导入导出、缓存、审计、文档、诊断 | `system:*` | 缓存刷新、导出脱敏、审计不可篡改、诊断包脱敏 |

---

## 7. 跨页业务链

### 7.1 权限链

链路：用户 → 部门/岗位 → 角色 → 菜单/按钮权限 → 数据范围 → 数据权限规则 → 租户隔离 → 审计日志。

- 后端契约：用户、角色、菜单、部门、岗位、租户、数据权限规则 API 必须在权限码、数据范围、审计动作上对齐。
- 关键断点：`systemModuleRegistry` 仍需补齐除用户和角色外的 permissionMeta；数据权限规则只收紧，不能替代角色管理页的 `CUSTOM` 部门配置。
- 验收方式：越权接口返回拒绝；数据范围收紧后查询范围变小或不变；权限变更有审计记录。

### 7.2 主数据链

链路：资产分类 → 字段集 → 自定义字段 → 资产；位置、部门、供应商与资产/合同/采购/维保引用。

- 后端契约：基础资料删除必须做引用检查；编号规则需接入资产创建，保证并发安全。
- 关键断点：编号规则历史上未接入资产生成；供应商与资产主业务的关系需在扩展 PRD 继续细化。
- 验收方式：有引用对象不可误删；编号生成可预览、并发不重复；字段集变更不破坏历史资产数据。

### 7.3 通知链

链路：邮件网关 → 邮件模板/通知模板 → 渠道 → 偏好/开关 → 发送日志 → 失败重试。

- 后端契约：发送前必须检查模板、渠道、偏好和开关；发送后写日志，失败进入重试队列。
- 关键断点：`workflow-mail`、通知偏好、流程通知开关与真实发送决策仍需确认调用链。
- 验收方式：关闭开关后不发送；偏好禁用后不发送；失败日志可重试且不重复发送。

### 7.4 集成链

链路：外部系统 → 接口 → 字段映射 → 同步规则 → Webhook 事件 → 通知告警。

- 后端契约：连接配置敏感字段脱敏；同步任务幂等；Webhook 签名校验与失败重试。
- 关键断点：除 webhook 配置 CRUD 外，外部系统、接口、字段映射、同步规则多为从 0 造；Webhook 需接入真实业务事件。
- 验收方式：连通测试可审计；同步失败可重试；字段映射预览可解释；Webhook 签名错误被拒绝。

### 7.5 系统参数链

链路：基础参数 → 安全策略 → 文件存储 → 导入导出 → 缓存管理 → 审计日志 → 文档/技术支持。

- 后端契约：参数修改需影响范围提示、审计、必要时刷新缓存；导出和诊断包必须脱敏。
- 关键断点：缓存刷新历史上存在空实现风险；安全策略是否独立实体待确认。
- 验收方式：参数更新后生效或明确等待刷新；缓存刷新有结果；导出与诊断包不包含敏感原值。

---

## 8. 关键后端领域设计

### 8.1 数据权限规则（DataPermissionRule）

- 当前事实：审计发现已有 `DataPermissionRuleController`、`DataPermissionRuleService` 与迁移，前端已有规则目录与 Inspector。
- 设计边界：规则只能收紧角色 `dataScope`，不得放宽权限；`CUSTOM` 跳过投影，部门配置仍由角色管理页负责。
- 必补契约：角色 ID 结构化 DTO、角色存在性校验、影响分析 API、启停审计、权限种子、专属后端测试。
- 验收重点：启用规则后角色数据范围只变小或不变；`CUSTOM` 不误投影部门；越权用户无法管理规则。

### 8.2 交接管理（Handover）

- 当前事实：审计发现已有 `HandoverController`、`HandoverService` 与迁移，支持任务摘要、状态流转和对象摘要 JSON。
- 真实性边界：当前不能写成真实资产/工单/审批对象转移闭环；完成交接只可描述为记录状态与完成时间，真实业务对象转移需后续专项接入。
- 必补契约：对象摘要 schema、状态机口径确认、真实转移动作的事务边界、审计、专属测试。
- 验收重点：非法状态流转被拒绝；完成动作不伪造对象转移；交接任务能追溯创建、开始、完成或取消。

### 8.3 邮件网关（MailGateway）

- 当前事实：审计发现已有邮件网关 CRUD、优先级主备、连通性测试、动态发送器与响应脱敏 DTO。
- 真实性边界：只能写响应脱敏已存在；存储加密、解密和密钥管理待核查，不能写成已完成。
- 必补契约：字段 Bean Validation、权限种子、Workbench V3 registry 接入、存储加密设计、密钥轮换、专属测试。
- 验收重点：响应不回显敏感原值；连通测试受权限控制并记录审计；主备优先级选择可验证。

### 8.4 表单中心与流程平台命名

- 当前事实：审计发现 `FormDefinitionController`、`FormDefinitionService`、表单定义迁移、表单中心/设计器页面已存在。
- 命名边界：IA 菜单仍是 `form-config` / `form-storage`，前端 registry 有 `system-form-center` / `system-form-designer`；关系待统一。
- 建议策略：短期建立别名映射和文档口径；中期在 IA、registry、权限码和路由中统一命名；长期分离表单定义、设计器、表单实例存储三个后端边界。
- 验收重点：菜单不双轨；权限码不冲突；表单定义版本、发布、回滚和 schema 校验可测试。

### 8.5 集成配置

- 当前事实：IA 将集成链标为仅 mock 或断链，除 webhook 配置外多项需要从 0 建设。
- 设计重点：外部系统、接口、字段映射、同步规则必须形成 FK 与状态链；所有连接敏感配置必须脱敏响应并规划存储加密。
- 验收重点：连通测试、映射预览、同步幂等、Webhook 签名和失败重试。

### 8.6 系统参数

- 当前事实：审计认为审计日志较强，系统参数链完整偏弱；缓存刷新、安全策略、文件存储和技术支持仍有缺口。
- 设计重点：参数变更必须可审计、可回滚或可恢复默认；缓存刷新不能是空动作；诊断包和导出必须脱敏。
- 验收重点：参数生效路径、缓存刷新结果、审计日志和导出脱敏。

---

## 9. 安全合规

| 主题 | v3 设计要求 | 验收证据 |
|---|---|---|
| 租户隔离 | 继承旧 PRD A 的 TenantContext、租户过滤和隔离红线；任何后台配置查询不得跨租户泄露 | 租户越权查询失败、审计记录、数据范围测试 |
| 数据权限 | 只收紧不放宽；`CUSTOM` 部门配置仍在角色管理页；数据权限规则不得绕过角色权限 | 规则投影测试、`CUSTOM` 边界测试、权限拒绝测试 |
| 敏感字段 | 网关、外部系统、Webhook、诊断包、导出等不返回敏感原值；只返回已配置状态或掩码 | 响应字段核查、导出/诊断包脱敏测试 |
| 存储加密 | 邮件网关和集成配置的敏感存储加密待核查；后续需明确密钥管理与轮换 | 设计评审、加密实现测试、密钥轮换演练 |
| 审计日志 | 权限、配置、发布、回滚、导出、测试连接、清缓存、诊断包生成均落审计 | 审计表记录、操作者、对象、结果、失败原因 |
| 权限 fail-closed | 未配置权限元数据或按钮权限时默认拒绝高危写操作 | 无权限用例、按钮隐藏与接口拒绝一致 |
| 输入校验 | DTO 校验枚举、长度、引用存在性、状态机合法性和表达式安全 | Bean Validation、服务层校验、异常路径测试 |

---

## 10. 分期路线

| 阶段 | 范围 | 交付重点 | 出口标准 |
|---|---|---|---|
| P0：口径冻结 | 44/35/9/39/Workbench V3 | IA 与写入范围冻结，旧矩阵标为历史证据 | 本文矩阵通过 reviewer 覆盖检查 |
| P1：已具备能力校准 | 用户、角色、菜单、租户、资产分类、位置、字段集、审计日志等 | 校准权限码、permissionMeta、测试和审计 | 现有能力与矩阵行一致，不夸大实现 |
| P2：审计新增能力补强 | `data-permissions`、`handover`、`mail-gateway`、表单定义 | 补 DTO 校验、状态机、权限种子、测试、registry 接入 | 真实性红线全部可测试 |
| P3：非流程断链补齐 | 编号规则、webhook 业务事件、通知偏好/开关、缓存刷新、文件存储 | 打通五条业务链关键断点 | 链路测试证明断点闭合 |
| P4：从 0 建设非流程能力 | 外部系统、接口、字段映射、同步规则、文档中心、技术支持 | 建立 Controller/Service/Entity/Migration/权限/测试 | 每个菜单至少有 API、权限、审计和页面入口 |
| P5：流程平台专项 | 9 个流程平台菜单 | 表单命名统一、流程定义/运行/审批/SLA 后端专项设计与实现 | 不破坏非流程后台，流程高危操作可审计 |
| P6：权限与壳专项 | Workbench V3 route 权限、全部菜单 permissionMeta | fail-closed 权限链、按钮级权限、旧入口保护 | V3 独立壳权限通过合同测试和 E2E |

---

## 11. 风险与验收矩阵

### 11.1 主要风险

| 风险 ID | 等级 | 风险 | 缓解措施 | 验收证据 |
|---|---|---|---|---|
| R-01 | 高 | 旧 PRD A/B 混用导致范围失真 | 分开引用租户隔离专项和资产宽需求 | 来源证据表、对比文档中分开评分 |
| R-02 | 高 | 44/35/9/39/Workbench V3 口径冲突 | 本文先统一口径，再展开矩阵 | 第 3 节和第 5 节完整存在 |
| R-03 | 高 | 旧实现矩阵过时 | 标记为历史证据，用审计事实刷新 | DataPermissionRule、Handover、MailGateway、FormDefinition 章节 |
| R-04 | 高 | MailGateway 被误写为已加密存储 | 只写响应脱敏已存在，存储加密待核查 | 第 8.3 节和安全矩阵 |
| R-05 | 中 | Handover 被误写为真实转移闭环 | 明确真实对象转移未接入 | 第 8.2 节和 IA 行 16 |
| R-06 | 中 | DataPermissionRule 被误解为放权 | 明确只收紧、`CUSTOM` 跳过投影 | 第 8.1 节和 IA 行 15 |
| R-07 | 中 | Form Center 命名双轨 | 标注命名关系待统一，设计别名/统一策略 | 第 8.4 节和 IA 行 5/6 |
| R-08 | 中 | 未实现菜单被空泛写“待补” | 每个菜单均给出契约草案、权限建议、验证方式 | 第 5 节 44 行完整矩阵 |
| R-09 | 中 | 敏感信息外泄 | 只讨论脱敏、加密和密钥管理，不写原值 | 文档敏感信息自检 |
| R-10 | 低 | 文档任务误改源码 | 写入边界限制为指定文档和 GAI2 `changes.json` | `changes.json` 的 `write_scope_check` |

### 11.2 验收矩阵

| 验收项 | 判定标准 | 本文证据 | 验证方式 |
|---|---|---|---|
| AC-01 输入证据 | 旧 PRD、V1、V2、IA、Workbench V3 路径清晰 | 第 2 节 | 路径与 audit/debate 对照 |
| AC-02 后端设计覆盖 | 覆盖导航、内容结构、IA、核心对象、页面层级、功能点、交互和数据关系 | 第 4、5、6、7、8 节 | 章节关键词与矩阵核查 |
| AC-03 IA 功能点显式体现 | 44 项 / 6 组全部展开，无仅写“待补”的行 | 第 5 节 | 逐项计数为 44 行 |
| AC-04 `/create-prd` 支撑 | 本文为后续 PRD 提供 1-14 章输入和第 10 章矩阵基础 | 第 1、5、6、7、8、10 节 | 后续 PRD 生成时引用本文 |
| AC-05 新旧对比支撑 | 已定义旧 PRD A/B、V1、V2、新 PRD 的证据角色 | 第 2、11 节 | 后续评分文档按对象引用 |
| AC-06 评分可追溯支撑 | 风险、证据、契约和验证方式可映射到 S1-S8 | 第 5、6、9、11 节 | 后续评分表绑定证据路径 |
| AC-07 中文与写入范围 | 自然语言为简体中文；不修改业务源码 | 全文、`changes.json` | 读取文件与写入范围检查 |
| AC-08 reviewer 可复核 | 提供明确矩阵、风险、验收和缺口 | 第 5、11 节 | reviewer 逐条 PASS/PARTIAL/FAIL |

---

## 12. 后续待决事项

1. 是否由用户确认 V1/V2 的最终权威路径；当前采用审计定位候选。
2. 是否将 `docs/资产管理系统需求.docx` 转换为可审计 Markdown，以便后续差异评分引用更多原文证据。
3. `system-form-center/system-form-designer` 与 `form-config/form-storage` 的最终命名、路由和权限码关系。
4. `MailGateway` 存储加密、解密、密钥管理和轮换方案。
5. `Handover` 真实资产/工单/审批对象转移动作是否进入 v3 当前范围，还是单独专项。
6. Workbench V3 是否以及何时接入 `routePermissions`，以及如何保证旧入口不被破坏。
7. 44 项菜单的 permissionMeta、按钮权限、审计动作和合同测试需要后续专项补齐。
