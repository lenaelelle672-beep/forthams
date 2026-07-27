# Future Settings OS v3 流程平台成熟产品调研与 IA 设计参考

> 版本日期：2026-07-02  
> 文档角色：V3 流程平台页面架构与 IA 设计参考；用于在正式开工前固定“流程列表、流程设计器、表单中心、业务显示、绑定方式”的产品口径。  
> 证据来源：`.omc/gai2/sessions/20260702-process-platform-research/research.json` 与 `review.json`。  
> 真实性红线：本文是调研与设计参考，不等同于实现完成；部分商业平台细节受登录墙限制，后续像素级页面仍需补截图或演示环境验证。

---

## 1. 一句话结论

成熟流程平台普遍不把“流程列表、流程设计器、表单、业务数据”混在一个页面里，而是采用：

```text
角色化门户 + 独立设计中心 + 表单资源库 + 运行监控中心 + Case/Record 业务视图
```

落到 Future Settings OS v3，`流程平台` 这个顶部分类内部应拆成四类页面能力：

1. **流程门户 / Launchpad**：给业务用户发起流程、查看待办、查看我的申请和 Case。
2. **设计中心 / Designer**：给管理员或流程设计者维护流程模型、节点、规则、变量、权限和发布版本。
3. **表单中心 / Form Library**：把表单作为独立资产创建、版本化、复用和审计。
4. **运行监控 / Operate**：给管理员监控流程实例、异常、SLA、重试、终止和审计轨迹。

表单与流程的绑定发生在流程节点上，尤其是 `User Task` / `Form Task` 节点；业务展示应围绕 **Case / Record / 业务对象**，而不是只展示裸流程实例 ID。

---

## 2. 调研产品与关键设计模式

| 产品 | 流程列表 / 启动 | 设计器位置 | 业务显示 | 表单新建 | 表单绑定方式 | 页面设计特点 |
| --- | --- | --- | --- | --- | --- | --- |
| Camunda 8 | Console / Operate 展示流程与实例；Tasklist 展示人工任务 | Web Modeler，独立浏览器设计入口 | Operate 展示实例、变量、事件、Incident | Web Modeler 内创建 Camunda Forms | BPMN `User Task` 引用 Form，数据作为变量传递 | Console 统一入口，Modeler / Operate / Tasklist 分离 |
| Flowable | Task / Admin / Control 查看定义、任务、实例 | 独立 Flowable Modeler | Task 应用展示任务与 Case，Admin 监控运行实例 | Modeler 内表单设计器或 Forms 模块 | BPMN / CMMN 模型引用表单 | 多应用解耦，开发者与业务用户分层 |
| ProcessMaker | Process Launchpad 展示可发起流程，`+Case` 启动 | Designer 角色进入 Process Modeler | Cases 聚合多个 Requests，Inbox 展示任务 | 独立 Screens / Screen Builder | Form Task 引用 Screen，Web Entry 支持外部启动 | Participant / Designer / Admin 强角色分离 |
| Appian | Designer 管理 Process Model，Process HQ 监控 | Appian Designer 统一低代码设计环境 | Record Types / Data Fabric 是业务对象核心 | SAIL Interfaces | Process Model 引用 Interface，与 Record 双向绑定 | Record 驱动，Designer / HQ / Sites 分离 |
| Power Automate | My flows / Solutions 管理云流、桌面流、业务流程流 | Flow designer 画布 | Dataverse / SharePoint Record 与 Process Mining | Power Apps / Approvals | 触发器、动作、业务流程流步骤引用表单或记录 | M365 统一门户，低代码画布与 Copilot |
| ServiceNow Flow Designer | Flow Designer / Process Automation 列表和执行历史 | Flow Designer Studio | Record 表记录 + Flow executions | Form Designer 或 Flow 内配置 | Flow 以 Record 为上下文，Action / Subflow 绑定 | Record-centric，平台统一体验 |

### 2.1 共性模式

1. **设计与运行分离**：设计器不应该和业务办理列表混在一起。
2. **表单是独立资产**：表单需要独立创建、版本化、发布、停用和复用。
3. **绑定发生在节点上**：流程节点引用表单版本，并配置输入变量、输出变量、权限角色和提交后动作。
4. **业务视图围绕 Case / Record**：用户关心的是资产申请、变更单、审批对象，而不是流程实例技术 ID。
5. **角色化入口降低认知成本**：业务用户看 Launchpad / Inbox；设计者看 Designer；管理员看 Operate / Admin。

### 2.2 差异模式

| 模式 | 代表产品 | 启示 |
| --- | --- | --- |
| 专业 BPMN + 独立表单构建器 | Camunda、Flowable、ProcessMaker | 适合 ForthAMS 这种需要强审批、强审计、复杂节点规则的后台流程平台。 |
| 低代码统一画布 | Power Automate、ServiceNow、Appian | 可借鉴统一配置体验，但不宜把所有功能塞进一个页面。 |
| Record / Case 驱动 | Appian、ServiceNow、ProcessMaker | V3 应把业务对象作为一等公民，流程实例只是业务对象的运行轨迹。 |

---

## 3. V3 推荐流程平台 IA

`流程平台` 仍作为 V3 顶部 6 类之一；其内部左侧导航保持 IA 主文档 9 项，但页面职责需要按成熟产品模式重新解释。

```text
流程平台
├── 流程门户
│   ├── 可发起流程
│   ├── 我的待办
│   ├── 我的申请
│   └── Case / Record 列表
├── 设计中心
│   ├── 流程定义
│   ├── 流程设计器
│   ├── 审批规则
│   ├── 待办字段
│   └── SLA 策略
├── 表单中心
│   ├── 表单配置
│   ├── 新建表单
│   ├── 表单版本
│   ├── 表单预览
│   └── 被哪些流程使用
└── 运行监控
    ├── 流程控制台
    ├── 运行监控
    ├── 异常 / Incident
    ├── 重试 / 终止
    └── SLA 报表
```

### 3.1 与现有 9 个流程 IA 菜单的映射

| 序号 | 现有 menu_id | 当前显示名称 | 推荐归属 | 推荐职责调整 |
| ---: | --- | --- | --- | --- |
| 1 | `system-flow-definition` | 导航控制台 | 设计中心 | 改为“流程定义”：负责流程定义列表、版本、启停、引用影响、发布记录。 |
| 2 | `system-settings-command-center` | 流程控制台 | 流程门户 + 运行监控 | 作为综合入口：业务用户看待办/申请/Case；管理员看异常和高危命令入口。 |
| 3 | `system-flow-designer` | 流程设计器 | 设计中心 | 独立流程画布：草稿、节点、连线、变量、校验、发布、回滚。 |
| 4 | `system-runtime-monitor` | 运行监控 | 运行监控 | 只读监控实例、节点耗时、异常轨迹、导出和性能指标。 |
| 5 | `system-form-config` / `system-form-center` | 表单配置 | 表单中心 | 改为“表单中心”：表单定义、版本、发布、停用、预览、被引用分析。 |
| 6 | `system-form-storage` | 表单存储 | 表单中心 | 管理表单实例数据、归档、附件、字段脱敏、导出和删除留痕。 |
| 7 | `system-approval-rules` | 审批规则 | 设计中心 | 审批人解析、条件规则、模拟、冲突检测、表达式白名单。 |
| 8 | `system-todo-fields` | 待办字段 | 设计中心 | 配置待办列表字段、排序、角色可见性和默认恢复。 |
| 9 | `system-sla-config` | SLA 策略 | 设计中心 + 运行监控 | 设计侧配置 SLA，运行侧展示超时、提醒、报表和审计。 |

结论：现有 9 项可以保留为 IA 底座，但需要补一个明确的 **流程门户 / Case 视图**。短期可由 `system-settings-command-center` 承载，长期建议拆出更清晰的业务入口，如 `process-launchpad` 或在业务工作台中建立“流程门户”入口。

---

## 4. 页面设计原则

### 4.1 流程列表放在哪里

流程列表要分两类，不应混在一起：

| 列表类型 | 面向角色 | 推荐页面 | 说明 |
| --- | --- | --- | --- |
| 可发起流程列表 | 业务用户 | 流程门户 / Launchpad | 用户从这里发起资产采购、调拨、报废、维修等流程。 |
| 流程定义列表 | 管理员 / 设计者 | 设计中心 / 流程定义 | 管理流程版本、启停、发布、引用影响。 |
| 流程实例列表 | 管理员 / 运营 | 运行监控 | 查实例、异常、SLA、重试、终止和导出。 |
| Case / Record 列表 | 业务用户 + 管理员 | 流程门户或业务对象页 | 以业务对象为中心显示状态、轨迹、附件、评论和子流程。 |

### 4.2 流程设计器放在哪里

流程设计器应放在 **设计中心**，不要嵌在普通业务办理页中。

设计器页面应包含：

1. 左侧组件面板：开始、结束、审批、抄送、条件、网关、脚本、Webhook、消息通知。
2. 中间流程画布：节点、连线、分支、子流程。
3. 右侧属性面板：节点名称、审批人、表单绑定、变量映射、SLA、通知、权限。
4. 顶部操作栏：保存草稿、校验、预览、发布、回滚、版本对比。
5. 底部或侧边校验区：缺表单、缺审批人、变量未映射、权限冲突、循环风险。

### 4.3 表单在哪里新建

表单应优先在 **表单中心** 新建，不应只作为流程设计器里的临时配置。

表单中心需要支持：

1. 表单列表：按业务域、状态、版本、引用流程过滤。
2. 新建表单：空白表单、模板表单、AI 生成草稿。
3. 表单设计器：字段、分组、布局、校验、联动、默认值、权限可见性。
4. 表单版本：草稿、已发布、已停用、历史版本、回滚。
5. 引用分析：显示被哪些流程、哪些节点、哪些版本使用。

流程设计器可以提供“快速新建表单”，但新建结果仍必须进入表单中心，成为可复用、可审计、可版本化资产。

### 4.4 表单怎么绑定到流程

绑定发生在流程节点上，而不是把表单硬编码到流程定义里。

推荐绑定字段：

| 字段 | 说明 |
| --- | --- |
| 节点 ID | 绑定到哪个 `User Task` / `Form Task`。 |
| 表单 ID | 引用表单中心里的表单资产。 |
| 表单版本 | 默认绑定已发布版本；草稿流程可绑定草稿表单。 |
| 输入变量 | 流程变量如何填充表单默认值。 |
| 输出变量 | 表单提交后写回哪些流程变量和业务对象字段。 |
| 权限角色 | 谁可填写、谁只读、谁可退回或转交。 |
| 提交动作 | 提交后流转、暂存、退回、驳回、补充材料。 |
| 审计策略 | 记录提交人、字段变化、附件变化、IP、时间和节点。 |

### 4.5 业务怎么显示

业务页面应显示 **Case / Record**，不是只显示流程实例。

一个 Case / Record 页面至少包含：

1. 基本信息：业务编号、标题、申请人、部门、资产对象、金额或数量。
2. 当前状态：草稿、审批中、待补充、已通过、已驳回、已取消、异常。
3. 当前任务：待谁处理、到期时间、SLA 状态。
4. 流程轨迹：节点、处理人、意见、时间、附件、变量变化。
5. 关联对象：资产、供应商、合同、采购单、维修单、通知、外部同步记录。
6. 子流程 / 子请求：补充材料、会签、外部系统同步、二次审批。
7. 审计日志：关键字段变化、高危操作、重试/终止/撤回记录。

---

## 5. V3 开工前固定口径

### 5.1 不建议做的设计

1. 不要把流程设计器、表单设计器、实例监控、业务待办塞进同一个页面。
2. 不要让表单只存在于流程节点内部，导致无法复用、无法版本化、无法引用分析。
3. 不要让业务用户看到以流程实例 ID 为中心的技术列表。
4. 不要把运行监控里的重试、终止、迁移等高危操作暴露给普通业务用户。
5. 不要把流程平台 9 项写成已经全部实现；当前仍是受控边界和后续专项。

### 5.2 建议先做的最小可用切片

第一阶段可以先实现页面骨架和导航语义，不急于接真实流程引擎全能力：

1. 在 V3 `流程平台` 顶部分类下，左侧先完整显示 9 个流程 IA 菜单。
2. 对 `system-flow-definition`、`system-flow-designer`、`system-form-center`、`system-sla-config` 等已有或目标承载项保留 `SystemPageHost` 接入。
3. 对未实现项提供统一“建设中 + 契约说明 + 后续接口”占位页。
4. `system-settings-command-center` 页面应先明确分区：可发起流程、我的待办、我的申请、实例/Case 列表。
5. 表单中心先固定表单资产模型：表单定义、版本、引用节点、发布状态。
6. 后续再逐步补真实 API、权限、审计、变量映射和运行监控。

### 5.3 与 V3 后端架构文档的关系

本文补充 `docs/specs/future-settings-os-v3-backend-architecture.md` 中流程平台 9 项的页面设计解释：

| 已有架构文档口径 | 本文补充 |
| --- | --- |
| 流程平台是顶部 6 类之一 | 明确流程平台内部应分“门户、设计、表单、监控”。 |
| 左侧 9 项流程 IA | 明确 9 项怎么承担成熟流程平台的常见页面职责。 |
| 35 非流程当前重点，9 流程受控边界 | 明确流程平台当前可先做导航骨架和契约占位，不越界实现复杂引擎。 |
| Workbench V3 使用 `SystemPageHost activeMenu` | 明确已有真组件继续复用，未实现项用占位契约页。 |

---

## 6. 后续实现验收建议

后续每做一个流程平台页面，至少按以下清单验收：

1. **导航验收**：是否属于流程门户、设计中心、表单中心、运行监控之一；是否与 9 个 IA 菜单一致。
2. **角色验收**：业务用户、设计者、管理员能看到的内容是否分离。
3. **表单验收**：表单是否作为独立资产存在，是否有版本、发布、引用分析。
4. **绑定验收**：流程节点是否能明确绑定表单版本、输入变量、输出变量、权限角色。
5. **业务对象验收**：页面是否能围绕 Case / Record 展示，而不是只展示流程实例 ID。
6. **运行监控验收**：异常、SLA、重试、终止、导出是否具备权限和审计。
7. **真实性验收**：未实现项必须标注“建设中 / 契约草案”，不得写成已完成。

---

## 7. 来源与限制

### 7.1 来源

本结论来自 GAI2 调研产物：

- `.omc/gai2/sessions/20260702-process-platform-research/research.json`
- `.omc/gai2/sessions/20260702-process-platform-research/review.json`

核心外部来源包括：

- `https://docs.camunda.io/docs/components/modeler/web-modeler/`
- `https://docs.camunda.io/docs/components/operate/operate-introduction/`
- `https://docs.camunda.io/docs/components/tasklist/introduction-to-tasklist/`
- `https://www.flowable.com/open-source/docs/`
- `https://docs.flowable.com/latest/`
- `https://docs.processmaker.com/`
- `https://docs.processmaker.com/docs/create-a-process`
- `https://docs.processmaker.com/docs/screens`
- `https://docs.processmaker.com/docs/requests-and-cases`
- `https://docs.appian.com/`
- `https://learn.microsoft.com/en-us/power-automate/`
- `https://docs.servicenow.com/`

### 7.2 限制

1. Appian、ServiceNow、Flowable 企业版部分后台细节受登录墙限制。
2. ServiceNow 具体表单绑定 UI、Flowable 企业版 React Modeler 细节仍需后续演示环境确认。
3. 本文用于 IA 和页面架构，不用于像素级复刻。
4. 若后续需要视觉稿，应再补充公开演示截图或真实产品演示环境验证。
