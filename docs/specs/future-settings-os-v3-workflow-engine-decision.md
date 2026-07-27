# Future Settings OS v3 流程引擎选型结论

> 版本日期：2026-07-02  
> 文档角色：V3 流程平台的流程引擎选型基线，和 V3 PRD、后端架构、流程平台参考文档同目录维护。  
> 证据来源：`.omc/gai2/sessions/20260702-workflow-engine-decision/recommendation.json`、`debate.json`、`review.json`。  
> Review 状态：GAI2 reviewer `PASS`。

## 1. 一句话结论

V3 第一阶段继续采用：

```text
React Flow / Xyflow + forthAMS Workflow DSL + BPMN 兼容层
```

短期不接外部运行时流程引擎，不把 Flowable、Camunda 8、Activiti、jBPM、Zeebe、Temporal 等作为 V3 第一阶段主运行时。

当前阶段的重点不是先换流程引擎，而是先补齐 V3 流程平台 IA、页面骨架、设计中心、表单中心、运行监控、权限、审计、版本发布/回滚和运行态验收契约。

## 2. V2 当前实际使用

GAI2 审计结论显示，V2 当前没有发现外部 BPM 引擎接入证据。现有能力分为四层：

| 层级 | 当前事实 | 结论 |
| --- | --- | --- |
| 设计器画布 | `React Flow / Xyflow`，依赖为 `@xyflow/react` | 负责节点、连线、缩放、MiniMap、Controls 等画布交互，不是流程运行时引擎。 |
| 流程业务语义 | forthAMS 自有 `Workflow DSL / definitionJson / nodes-edges JSON` | 承载 `start`、`approval`、`task`、`cc`、`condition`、`end` 节点、处理人、条件、表单区段、版本、发布和回滚。 |
| BPMN 兼容层 | 当前是规划/未来兼容能力 | 审计未见 `bpmn-js` 依赖或 BPMN XML 作为主事实源。 |
| 运行时计划器 | `WorkflowDefinitionService + WorkflowRuntimePlanner` | 基于已发布 `definitionJson` 快照生成审批/办理计划并求值简单条件，属于内部运行时计划器，不是外部 BPM 引擎。 |

负向证据：未发现 `Flowable`、`Camunda`、`Activiti`、`jBPM`、`Temporal`、`Zeebe` 等外部流程引擎依赖或主运行时接入证据。

## 3. V3 第一阶段决策

V3 第一阶段采用 Option A：继续 `React Flow / Xyflow + forthAMS Workflow DSL + BPMN 兼容层` 路线。

执行口径：

- 内部 DSL / JSON 继续作为 V3 第一阶段流程定义事实源。
- 画布继续负责设计器交互，不被表述为运行时流程引擎。
- `WorkflowDefinitionService + WorkflowRuntimePlanner` 继续作为内部运行时计划器路线的基础。
- BPMN 兼容层按导出、导入、预览、标准校验和映射测试逐步建设。
- 外部引擎只进入后续专项评估或旁路试点，不替换第一阶段主运行时。

## 4. 为什么第一阶段不接外部引擎

第一阶段直接接 Flowable 或 Camunda 8 会把以下复杂度一次性前置：

- DSL 到 BPMN 的节点、连线、条件、网关、表单、版本、发布、回滚映射。
- 用户、角色、部门、岗位、租户、数据权限到外部引擎候选人、候选组、任务权限的映射。
- 流程实例、任务、审批、办理、历史、审计、SLA、异常、重试、终止、撤回和回滚语义统一。
- 外部引擎部署、监控、备份、升级、故障恢复和安全边界。
- 内部 DSL 与外部 BPMN 形成双事实源的风险。

因此 V3 第一阶段应先把流程平台的产品 IA、页面骨架和业务契约做稳，再决定是否进入引擎试点。

## 5. 方案比较

| 方案 | 结论 | 优点 | 风险 |
| --- | --- | --- | --- |
| Option A：继续 `React Flow/Xyflow + forthAMS Workflow DSL + BPMN 兼容层` | V3 第一阶段推荐 | 与 V2 事实一致，实施复杂度最低，维护成本可控，性能影响低，扩展路径清晰。 | 短期仍受内部 `WorkflowRuntimePlanner` 能力限制，复杂 BPMN 语义需后续补齐。 |
| Option B：接 Flowable | 保留为未来优先评估对象 | 更贴近 Java / Spring Boot 生态，可做嵌入式或可选执行引擎试点。 | 需要重做 DSL/BPMN、权限、任务、历史、审计和回滚映射，存在双事实源风险。 |
| Option C：接 Camunda 8 | 保留为长期标杆 | 云原生、分布式编排、可观测治理能力强。 | 外部运行时、部署拓扑、网络调用、运维监控和安全边界成本高，不适合第一阶段。 |
| Option D：纯自研状态机/审批链 | 不作为长期唯一路线 | 短期可控，无外部依赖，性能链路短。 | 长期需自研复杂网关、并行、事件、定时器、补偿、历史、迁移和监控，且削弱 BPMN 互操作。 |

## 6. 未来外部引擎优先级

如果后续必须接外部引擎，优先级如下：

1. `Flowable`：优先作为 Java / Spring 体系内的嵌入式或可选执行引擎试点，先做旁路验证，不直接替换主运行时。
2. `Camunda 8`：作为长期云原生、分布式编排和外部运行时治理能力的标杆对照，只有在运维、安全和契约成熟后进入主线评估。

`ProcessMaker`、`Appian`、`Microsoft Power Automate`、`ServiceNow Flow Designer / App Engine` 主要作为流程平台产品形态、页面 IA 和交互设计参考，不建议作为 forthAMS 底层运行时直接接入对象。

## 7. 接外部引擎前置条件

进入 Flowable 或 Camunda 8 专项前，必须先满足以下条件：

1. DSL 与 BPMN 的节点、边、条件、网关、表单、版本、发布、回滚和历史快照映射可审计。
2. BPMN 导出、导入、预览、标准校验和兼容层自动化测试完成。
3. 用户、角色、部门、岗位、租户、数据权限到外部引擎候选人、候选组和任务权限的映射明确。
4. 流程实例、任务、审批、办理、历史、审计、SLA、异常、重试、终止、撤回和回滚语义统一。
5. 双写或旁路验证、数据迁移、回滚、停机窗口、故障恢复、监控告警和运维升级方案明确。
6. 表单渲染、字段权限、审计留痕、敏感信息处理完成安全评审。
7. 页面级和 API 级验收覆盖新建、编辑、保存、发布、回读、发起、运行、撤回、回滚和审计链路。

## 8. V3 实施顺序

建议按四段推进：

| 阶段 | 动作 |
| --- | --- |
| V3 第一阶段 | 延续 Option A，不接外部主运行时；补齐流程平台 IA、页面骨架、表单中心、运行监控、权限、审计和发布回滚验收。 |
| 兼容层专项 | 建设 DSL 到 BPMN 的导出、预览、标准校验和映射测试，避免 BPMN 与内部 DSL 形成双事实源。 |
| 可选引擎试点 | 优先以 Flowable 做旁路验证或可选执行引擎试点，验证任务、历史、部署、权限、审计和回滚模型。 |
| 外部运行时标杆评估 | 在运维和安全能力成熟后，再用 Camunda 8 评估云原生外部运行时、分布式编排和治理能力。 |

## 9. 与 V3 相关文档的关系

本结论文档需要与以下文档一起使用：

- `docs/specs/future-settings-os-v3-expanded-prd.md`：V3 扩展完整 PRD。
- `docs/specs/future-settings-os-v3-backend-design.md`：V3 后端设计方案。
- `docs/specs/future-settings-os-v3-backend-architecture.md`：V3 后端架构与 44 项 IA 导航矩阵。
- `docs/specs/future-settings-os-v3-process-platform-reference.md`：成熟流程平台调研与 V3 流程平台页面 IA 参考。
- `docs/specs/future-settings-os-v3-prd-comparison-score.md`：新旧 PRD 对比评分。
- `docs/specs/workflow-designer-enterprise-architecture.md`：既有流程设计器企业架构讨论。

## 10. 固定口径

- 不把 `React Flow / Xyflow` 称为流程运行时引擎，它只是画布交互层。
- 不把当前 `WorkflowRuntimePlanner` 夸大为完整 BPMN 企业级流程引擎。
- 不把 BPMN 兼容层写成已实现能力；当前仍是未来兼容方向。
- 不在 V3 第一阶段直接把 Flowable 或 Camunda 8 接成主运行时。
- 不放弃 BPMN 兼容层，也不把纯自研状态机作为长期唯一方向。
- 不复制或记录任何 password、token、secret、API key 原值。

## 11. Review 证据

GAI2 review 结论：`PASS`。

证据产物：

- `.omc/gai2/sessions/20260702-workflow-engine-decision/workcard.json`
- `.omc/gai2/sessions/20260702-workflow-engine-decision/audit.json`
- `.omc/gai2/sessions/20260702-workflow-engine-decision/debate.json`
- `.omc/gai2/sessions/20260702-workflow-engine-decision/recommendation.json`
- `.omc/gai2/sessions/20260702-workflow-engine-decision/review.json`

Review 通过项包括：

- 已核对 V2 实际使用 `@xyflow/react`、内部 DSL / JSON 和 Spring 自研运行时计划器。
- 已确认未发现外部 BPM 引擎接入证据。
- 已比较 Option A / B / C / D 四种方案。
- 已回答 V3 第一阶段是否接外部引擎、未来优先评估对象和接入前置条件。
- 写边界只在 GAI2 会话产物目录，未修改业务源码。

## 12. 残余风险

- 本结论是架构选型基线，不证明当前流程功能运行通过。
- 当前未运行项目测试或构建；本轮只固化选型文档。
- BPMN 兼容层仍是规划能力，需要后续专项明确映射、测试和验收标准。
- Flowable 与 Camunda 8 的最终优先级仍需未来专项 spike、部署约束、业务复杂度和运维能力证据复核。
