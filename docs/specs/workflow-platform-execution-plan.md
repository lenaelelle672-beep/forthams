# 流程平台执行计划

## 1. 结论

本计划是 **5 个自然开发日的自主长任务完整实现计划**，目标是在不裁剪范围的前提下，把流程平台做到企业发布级 100 分。P0-P10 只是执行顺序和验收分组，不是可放弃分片；不得用“切片”“MVP”“阶段性交付”等口径降低目标。

方向保持不变：流程主线先行，资产退役后验。当前最优入口不是继续扩页面，而是把流程平台做成可真实设计、可保存、可发布、可版本化、可回滚、可运行、可审计、可验证的流程能力。

主验证业务固定为 `ASSET_TRANSFER` 资产转移流程：后台发布后，桌面端“我的资产”必须出现申请入口；未发布、停用、无权限或契约阻断时必须隐藏或置灰，并显示可解释原因。

## 2. 当前事实

- 系统配置默认进入 `流程平台 > 流程定义`，流程平台下已有 `流程定义`、`流程设计器`、`表单配置`、`表单存储`、`审批规则`、`待办字段配置`、`SLA 配置`。
- 真实后端 E2E 已覆盖流程设计器保存草稿、流程中心、业务表单入口、托管流程发布回读节点表单并发起审批、资产转移三环节停在第 3 步可回看历史表单和意见、工单审批 `DRAFT -> PENDING -> APPROVED` 金线。
- 资产转移真实后端闭环已通过，下一步不是重复证明“能不能发布”，而是进入运行态产品化：证据冻结与稳定化、环节子表单运行页、运行态流程图、处理人计算与动作区治理、设计器健壮性补强、工单金线与资产退役后验。
- 当前 Phase F 已将 P6 资产退役 approve/complete 和资产 `SCRAPPED` 不可逆写入移出真实后端 smoke 主线；P6 仍只能作为后验边界，不得提前做不可逆退役写入。
- 前端已有流程/审批相关页面和服务，包括 `frontend/src/pages/workflow/WorkflowDesignerPage.tsx`、`frontend/src/pages/workflow/WorkflowCenterPage.tsx`、`frontend/src/pages/approval/ApprovalDetailPage.tsx`、`frontend/src/app/components/approval/ApprovalFlowChart.tsx`、`frontend/src/services/approvalFlowService.ts`。
- `frontend/src/pages/mobile/**` 继续冻结，除非用户明确重新打开 mobile scope。

### 2.1 Stitch 设计稿事实源

后续查找流程平台和后台设置新整合页面时，Stitch 风格/设计系统事实源固定为 **Future Settings OS**，不要误用 `UAMS System Hub Pages`。

| 用途 | Stitch 项目 / 屏幕 |
| --- | --- |
| 项目 ID | `11462082228439399504` |
| 当前 MCP project title | `Next-Gen Doc-to-UI` |
| 设计系统 / Design MD 名称 | `Future Settings OS`，高密度后台设置 OS 风格 |
| 流程平台导航中枢 | `流程平台 · 资产导航中心 (精修版)` / `61f7e22a060a46d38774b9134a53da85` |
| 流程定义 | `流程定义 · 全宽沉浸版` / `27bbd67bdb8d4318abd4495dfb84d1f1` |
| 生产级流程设计器 | `可视化流程设计 · 极致全宽生产级精修版 (交互增强)` / `4bbe87574c90478c8edb91739d95c291` |
| 环节子表单矩阵 | `环节表单矩阵 · 权限级联配置版` / `f6b52701c4304e319f486ebd626f8fc6` |
| 环节表单逻辑 | `环节表单逻辑 · 深度细化配置版` / `e8a84f0d02b743bb8884ccd158d7810c` |
| 运行监测 / 流程实例 | `业务执行看板 · 流程实例监控 (全宽沉浸版)` / `ecf5acbe12c34fe6a2c281ee7078dcee` |
| 发布门禁 / 发布策略 | `安全门禁与发布策略 · 生产级治理中枢` / `c388e2b7767348029cf2e5617e5d9667` |

`UAMS System Hub Pages` 只能作为旧系统页面资料排查，不得作为本轮 Future OS 页面风格、流程平台 PRD 或前端落地主依据。

## 3. 硬目标与硬验收

### 3.1 完整目标

- 5 个自然开发日内自主推进完整实现，不按“能做多少”裁剪范围。
- 设计、保存、发布、版本化、回滚路径、发布状态回读必须闭环。
- `ASSET_TRANSFER` 必须由已发布流程驱动发起、运行、流转和回看，禁止继续用 `STANDARD_V2`、`FAST_TRACK` 等硬编码作为运行主路径。
- 前台普通申请用户不得依赖 `workflow:definition:*` 管理权限才能发起申请。必须提供业务可用性接口或等价契约，例如返回 `canStart`、`status`、`version`、`entryUrl`、`blockReason`。
- 每个环节绑定子表单或表单区段，概念类似 HCL Notes 区段；运行页单页按环节加载。
- 到第三环节时可查看前两环节表单信息和处理意见；历史环节默认折叠可展开，当前环节默认展开。
- 流程图必须成熟、清晰、美观，显示已过、当前、待处理、异常、结束态。
- 处理人计算必须支持加载触发和手动触发；缺条件或缺信息时不得显示不可靠结果。
- DB / API / audit / page / E2E 证据全满足才可 PASS。

### 3.2 GAI2 执行契约

- 必须使用 GAI2 双推理模式：真实 `gai2-drafter` / `gai2-refiner`，或等价可审计链路。文本声明不能替代可审计链路。
- 最终 closeout 必须给出 `PASS` / `PARTIAL` / `FAIL`。
- 100 分是硬验收。缺核心项、缺证据层、缺权限契约、缺发布回读、缺审计、缺 E2E、缺 DB/API/audit/page 任一核心证据，都不得 PASS。
- `gai2-builder` 只能在明确 allowlist 内落地；`gai2-reviewer` 必须独立验收，不能由 builder 自我授予 PASS。
- 工具 trace、prompt、文档和 closeout 不得复制 raw secrets、token、密码或敏感配置。

### 3.3 企业发布级 100 分定义

100 分不是“页面能用”。必须同时满足：

- 视觉：设计器、流程图、运行页、空态、错误态、阻断态、只读态、加载态达到成熟企业产品质量。
- 功能：设计、保存、发布、版本化、回滚、发布状态回读、业务入口、流程发起、环节表单、处理人计算、动作区、历史回看闭环。
- 权限：普通申请用户只依赖业务可用性契约；管理权限只用于流程定义管理。
- 审计：发布、回滚、发起、处理、处理人计算、异常阻断均可追踪。
- 异常态：未发布、停用、无版本、无权限、缺字段、缺处理人、条件冲突、服务失败都有明确状态和用户解释。
- E2E：真实后端 E2E 覆盖 `ASSET_TRANSFER` 主链路和关键阻断态。
- 证据：DB / API / audit / page 四层证据加 E2E 命令输出全部可追溯。

## 4. 成熟产品借鉴门禁

实施流程设计器和流程图前，必须复核最新官方资料，至少覆盖泛微 OA / e-cology、飞书审批、钉钉审批，并输出 `borrow / adapt / reject`。不得只引用旧印象。

可借鉴方向：

- 泛微 e-cology / E-Workflow：字段、表单、节点、操作者、路由、图形化建模、流程跟踪、版本控制、流程仿真模拟。
- 飞书审批：审批定义由表单信息和审批流程组成，节点内可以有一个或多个审批人，适合参考“表单 + 节点 + 审批人”的产品抽象。
- 钉钉审批：表单设计、条件分支、自定义审批人、集成接口或子流程、同步数据等能力，适合参考条件分支和处理人配置。

参考链接，执行时必须复核最新官方文档并记录来源日期：

- 泛微工作流程管理：https://www.weaver.com.cn/subpage/e-cology/process.asp
- 泛微流程引擎 e-workflow：https://www.weaver.com.cn/new/product/BPM/function.html
- 飞书审批管理员手册：https://www.feishu.cn/hc/zh-CN/articles/360033971554
- 飞书审批流程设计：https://www.feishu.cn/hc/zh-CN/articles/360036163653
- 飞书审批概述：https://open.feishu.cn/document/server-docs/approval-v4/approval-overview
- 钉钉审批配置：https://open.dingtalk.com/document/connection/approve-configuration
- 钉钉工作流概述：https://open.dingtalk.com/document/isvapp/workflow-overview

借鉴边界：

- 借成熟产品的信息架构、交互语义、状态表达和错误阻断，不照搬品牌视觉。
- 流程图必须适配本系统的资产管理、工单、审批、审计语境。
- 优先落地可验证能力，不做复杂 BPMN 全量引擎。

## 5. 5 天执行节奏

- Day 1：P0-P2，证据冻结、调研借鉴、流程定义可用性契约和资产入口闭环。
- Day 2：P3-P4，设计器保存/发布/版本/回滚闭环，`ASSET_TRANSFER` 发布流程驱动发起。
- Day 3：P5-P6，环节子表单单页运行、运行态流程图产品化。
- Day 4：P7-P8，处理人计算与动作区治理，异常态、权限态、审计证据补齐。
- Day 5：P9-P10，真实后端 E2E、DB/API/audit/page 证据矩阵、100 分 closeout。

上述节奏不是范围切分。若某日未完成，后续继续追平完整目标，不得删减 P0-P10 任一核心项。

## 6. P0-P10 执行主结构

### P0 纪律、证据基线与冻结边界

目标：

- 冻结当前真实 E2E 事实，明确 DB / API / audit / page / E2E 各层事实源。
- 建立 GAI2 双推理执行链、acceptance map、evidence map 和 closeout 模板。
- 明确 mobile scope 冻结、P6 资产退役后验、GitNexus 约束。

交付物：

- 当前真实 E2E 覆盖清单。
- `ASSET_TRANSFER` 主验证链路验收矩阵。
- GAI2 drafter/refiner 或等价可审计链路记录。
- DB/API/audit/page/E2E 证据模板。

门禁：

- 未建立 100 分验收矩阵，不进入 P1。
- 未明确 mobile freeze 和 P6 后验边界，不进入 P1。

### P1 成熟产品复核与 borrow/adapt/reject

目标：

- 复核泛微 OA / e-cology、飞书审批、钉钉审批官方资料。
- 为流程图、设计器、环节表单、处理人配置沉淀可执行借鉴。

交付物：

- 官方资料来源、日期、链接。
- `borrow / adapt / reject` 表。
- 本系统流程图状态标准：已过、当前、待处理、异常、结束。

门禁：

- 未完成官方资料复核和 borrow/adapt/reject，不进入流程图和设计器视觉落地。

### P2 业务可用性契约与“我的资产”入口

目标：

- 后台发布 `ASSET_TRANSFER` 后，桌面端“我的资产”出现申请入口。
- 未发布、停用、无版本、无权限或业务阻断时，入口隐藏或置灰，并显示原因。
- 普通申请用户不得依赖 `workflow:definition:*` 管理权限。

交付物：

- 业务可用性接口或等价契约，至少包含 `canStart`、`status`、`version`、`entryUrl`、`blockReason`。
- “我的资产”入口展示、隐藏、置灰、原因说明。
- 权限测试：普通申请用户可看到可用入口，管理权限只用于定义管理。

门禁：

- 前台申请仍依赖流程定义管理权限，不进入 P3。
- 未发布/停用状态无明确原因，不进入 P3。

### P3 设计器保存、发布、版本化、回滚闭环

目标：

- 流程设计器支持真实建模、保存草稿、发布、版本化、回滚、发布状态回读。
- 发布前阻断非法配置：未绑定表单、无处理人、无结束节点、不可达节点、条件冲突、循环风险。

交付物：

- 设计器节点增删改、排序、连接、条件分支。
- 节点类型：开始、审批、办理、条件、抄送、结束。
- 发布前预检查、版本号、发布说明、影响范围、回滚路径、发布状态回读。
- 发布、回滚、失败阻断 audit 证据。

门禁：

- 非法配置可发布，不进入 P4。
- 发布后状态不能从 API 和页面回读，不进入 P4。

### P4 `ASSET_TRANSFER` 发布流程驱动发起

目标：

- 资产转移表单必须由已发布 `ASSET_TRANSFER` 流程驱动。
- 禁止继续用 `STANDARD_V2`、`FAST_TRACK` 等硬编码作为运行主路径。

交付物：

- `ASSET_TRANSFER` 发布版本与发起实例的版本关联。
- 发起页、API、DB、audit 均能证明使用已发布流程定义。
- 硬编码路径清理或隔离说明；若保留兼容代码，不得成为主运行路径。

门禁：

- 发起实例无法证明来自已发布 `ASSET_TRANSFER`，不进入 P5。
- 主路径仍依赖 `STANDARD_V2` / `FAST_TRACK`，不得 PASS。

### P5 环节子表单单页运行

目标：

- 每个环节绑定子表单或表单区段，类似 HCL Notes 区段。
- 新建流程实例时，在同一页面按环节加载表单。
- 到第三环节时，可查看前两个环节表单信息和处理意见。

交付物：

- 环节子表单区段模型：可见、只读、必填、可编辑、校验规则。
- 单页多环节结构：流程标题、业务编号、状态、当前处理人、SLA、环节表单、操作区。
- 历史环节默认折叠，可展开；当前环节默认展开；后续环节置灰或只显示摘要。
- 前序环节表单快照和处理意见回放。

门禁：

- 前序环节表单快照和处理意见不可回放，不进入 P6。
- 当前环节与历史环节状态混淆，不得 PASS。

### P6 运行态流程图产品化

目标：

- 运行页提供成熟、清晰、好看的流程图。
- 显示完整路径、已过节点、当前节点、待处理节点、异常节点、结束状态。
- 设计器结构模型与运行态实例状态保持可追踪一致。

交付物：

- 流程图组件或现有 `ApprovalFlowChart` 产品化扩展。
- 节点 hover/click 摘要、异常态、当前节点焦点、结束态。
- 异常态覆盖：处理人缺失、条件未满足、超时、节点配置错误。
- 与 P1 借鉴结论一致的视觉和交互说明。

技术原则：

- 优先评估现有 `@xyflow/react` 依赖承载设计器和运行态流程图。
- 若现有 `ApprovalFlowChart` 已满足基础展示，可先扩展为运行态流程图；设计态复杂编辑再单独抽象。
- 不手写复杂 SVG 拖拽引擎，除非现有依赖无法满足布局和交互。

门禁：

- 流程图不能清晰表达当前、历史、待处理、异常和结束态，不进入 P7。

### P7 处理人计算与动作区治理

目标：

- 处理人计算支持加载触发和手动触发。
- 条件缺失、必要信息缺失或服务端不能确认时，不显示不可靠处理人结果。
- 当前环节动作区治理清晰，避免用户对不可执行动作产生误判。

交付物：

- 自动触发：页面加载、表单关键字段变化、节点切换后防抖计算。
- 手动触发：用户点击“计算处理人”或“预览流转路径”。
- 动作区状态矩阵：可处理、只读、缺条件、无权限、已结束、服务失败。
- 处理人计算 audit 或可追踪日志，至少验收阶段可回放。

不显示处理人结果的情况：

- 条件字段缺失。
- 组织、角色、岗位、部门数据无法解析。
- 分支条件冲突或无匹配分支。
- 当前用户权限不足。
- 服务端返回计算失败或结果不可信。

门禁：

- 处理人结果无法被服务端确认或审计，不进入 P8。
- 缺条件仍显示猜测名单，不得 PASS。

### P8 异常态、权限态、审计与回读补齐

目标：

- 全链路补齐异常态、权限态、审计和回读。
- 确保发布、停用、回滚、发起、处理、驳回、撤回、终止、计算失败均有状态表达。

交付物：

- API 契约错误码和页面解释文案。
- 权限矩阵：申请用户、审批/办理用户、流程管理员、只读审计用户。
- audit 事件矩阵：谁在何时因为什么做了什么。
- 发布状态、版本状态、实例状态、节点状态回读证据。

门禁：

- 核心异常态只在页面呈现、没有 API/audit 支撑，不进入 P9。

### P9 真实后端 E2E 与 DB/API/audit/page 证据矩阵

目标：

- 用真实后端 E2E 验证 `ASSET_TRANSFER` 主链路和关键阻断态。
- DB / API / audit / page 四层证据全部对齐。

交付物：

- `ASSET_TRANSFER` 发布后“我的资产”入口出现并可发起。
- 未发布/停用时入口隐藏或置灰并显示 `blockReason`。
- 三环节运行到第三环节可回看前两环节表单和处理意见。
- 流程图状态与实例状态一致。
- 处理人计算加载触发、手动触发、缺条件阻断用例。
- DB 直读、API 响应、audit 事件、页面断言、E2E 命令输出。

门禁：

- DB/API/audit/page 任一层缺核心证据，P9 只能 PARTIAL，不能进入 P10 PASS closeout。

### P10 100 分 closeout、回归与后验边界

目标：

- 汇总 100 分证据，完成 GAI2 closeout。
- 明确残余风险、回滚路径、后验边界。
- 保持 P6 资产退役后验，不提前实现不可逆退役写入。

交付物：

- `PASS` / `PARTIAL` / `FAIL` closeout。
- acceptance map、evidence map、commands run、residual risks。
- GitNexus `detect_changes()` 或等价变更影响检查结果。
- P6 资产退役后验边界说明：资产退役只读/演练模式证据；不可逆写入继续禁止，除非三方对账、审批链、审计、回滚和熔断全部通过。

门禁：

- 缺独立 reviewer 验收，不得 PASS。
- 缺核心证据项，不得 PASS。
- 任何不可逆退役写入必须在三方对账通过、审批链闭合、审计事件落盘、回滚路径演练成功后才可放行。

## 7. 旧 Phase A-F 与新 P0-P10 映射

旧测试文档和历史记录可继续引用 Phase A-F，但后续开发以 P0-P10 为权威主线。

| 旧 Phase | 原含义 | 新 P0-P10 映射 |
|---|---|---|
| Phase A | 证据冻结与稳定化 | P0、P9、P10 |
| Phase B | 环节子表单运行页产品化 | P5 |
| Phase C | 运行态流程图产品化 | P1、P6 |
| Phase D | 处理人计算与动作区治理 | P7、P8 |
| Phase E | 设计器健壮性补强 | P3、P4、P8 |
| Phase F | 工单金线与资产退役后验 | P9、P10；资产退役仅后验边界 |

兼容规则：

- 旧 Phase A-F 不再作为执行主结构。
- 旧测试文档若引用 Phase 名称，必须在新报告中映射到 P0-P10。
- 新增验收、closeout、goal、计划文档一律使用 P0-P10。

## 8. 验收证据模板

每个 P 项都必须提供：

- AC 编号。
- 种子数据。
- 操作步骤。
- DB 断言。
- API 断言。
- audit 断言。
- page 断言。
- E2E 命令和产物。
- 残余风险。

事实源顺序：

1. DB：最终业务事实。
2. API：系统契约和读模型。
3. audit：谁在何时因为什么做了什么。
4. page：用户可见性。
5. E2E：用户路径和系统集成证据。

缺 DB / API / audit / page 任一核心证据时，该 P 项不能标记 PASS，只能标记 PARTIAL。

## 9. 测试入口

已有入口：

```bash
cd frontend
npm run e2e:real -- --reporter=line
```

```bash
python3 scripts/test_workflow_e2e.py
python3 scripts/test_asset_workflow_e2e.py
```

按影响范围追加：

```bash
cd frontend
npm test -- workflow
npm test -- approval
```

如果修改后端服务或控制器：

```bash
cd backend
mvn test -Dtest=<相关测试类>
```

执行本计划时的最小验收组合：

- markdown/doc 更新：只做 markdown 基本检查和关键词确认。
- 代码实现：按影响范围运行 typecheck、build、真实后端 E2E、DB/API/audit/page 断言。
- 提交前：遵守 AGENTS.md，运行 GitNexus `detect_changes()`；比较默认分支时使用 `detect_changes({scope: "compare", base_ref: "main"})`。

## 10. 执行约束

- 编辑任何函数、类、方法前，必须按 AGENTS.md 先跑 GitNexus `impact({target: "symbolName", direction: "upstream"})`，并报告 blast radius：direct callers、affected processes、risk level。
- 若 GitNexus impact 返回 HIGH 或 CRITICAL，必须先警示用户再继续。
- 提交前必须跑 `detect_changes()`。
- 不做 find-and-replace 式符号重命名；重命名必须使用 GitNexus `rename`。
- 不触碰 `frontend/src/pages/mobile/**`。
- 不把 P6 资产退役能力前置到 P0-P9。
- 不把页面可见结果当作业务状态事实。
- 不复制 raw secrets、token、密码或敏感配置到文档、日志、prompt 或 closeout。
- 不得以“切片/MVP/阶段性交付”降低本计划目标；P0-P10 是顺序和验收分组，不是范围削减依据。

## 11. 可复制 /goal 指令

```md
/goal [$gai] 基于 docs/specs/workflow-platform-execution-plan.md，执行 5 个自然开发日的自主长任务完整实现：不要被切片、MVP、阶段性交付口径束缚，P0-P10 只是执行顺序和验收分组，不是可放弃分片。目标是企业发布级 100 分，必须使用 GAI2 双推理模式（真实 drafter/refiner 或等价可审计链路），最终 closeout 必须给出 PASS/PARTIAL/FAIL；100 分是硬验收，缺核心项不得 PASS。

主验证业务：
- 以 ASSET_TRANSFER 资产转移流程为主验证业务。
- 后台发布 ASSET_TRANSFER 后，桌面端“我的资产”必须出现申请入口。
- 未发布、停用、无版本、无权限或业务阻断时，入口隐藏或置灰并显示原因。
- 普通申请用户前台申请不得依赖 workflow:definition:* 管理权限；必须有业务可用性接口/契约，例如 canStart/status/version/entryUrl/blockReason。
- 资产转移表单必须由已发布 ASSET_TRANSFER 流程驱动，禁止继续用 STANDARD_V2/FAST_TRACK 等硬编码作为运行主路径。

核心实现：
- 设计、保存、发布、版本化、回滚路径、发布状态回读必须闭环。
- 每环节绑定子表单/区段，类似 HCL Notes 区段；单页按环节加载。
- 到第三环节可看前两环节；历史环节默认折叠可展开；当前环节展开。
- 流程图必须好看且成熟，显示已过、当前、待处理、异常、结束态；执行前复核泛微 OA/e-cology、飞书审批、钉钉审批官方资料，并输出 borrow/adapt/reject。
- 处理人计算支持加载触发和手动触发；缺条件或缺信息时不显示不可靠结果。
- P6 资产退役仍是后验边界，不提前实现不可逆退役写入。
- mobile scope 继续冻结，不触碰 frontend/src/pages/mobile/**。

验收：
- 企业发布级 100 分：视觉、功能、权限、审计、异常态、E2E、DB/API/audit/page 证据全满足。
- DB/API/audit/page 任一核心证据缺失只能 PARTIAL，不能 PASS。
- 遵守 AGENTS.md：编辑函数/类/方法前 GitNexus impact；提交前 detect_changes；HIGH/CRITICAL 先警示。
- 使用旧 Phase A-F 与新 P0-P10 映射，避免旧测试文档断链。
```
