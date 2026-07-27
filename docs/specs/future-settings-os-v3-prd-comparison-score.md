# Future Settings OS v3 新旧需求差异对比与评分

> 文档日期：2026-07-01  
> 文档角色：V3 扩展新 PRD 与旧需求/V1/V2 的差异讨论、影响评估和评分依据。  
> NEW 评分对象：`docs/specs/future-settings-os-v3-expanded-prd.md`。  
> 写入来源：GAI2 会话 `.omc/gai2/sessions/20260701-gai2-v3-backend-prd-design/` 的 `workcard.json`、`triage.json`、`audit.json`、`debate.json`、`draft.json`、`refine.json`、`adjudication.json`，以及本轮读取的 V3 后端设计方案、V3 扩展 PRD、IA 主文档、Workbench V3 样式指南、OLD-A、V1、V2 文档。

---

## 1. 文档信息、证据边界与真实性说明

### 1.1 评分对象

本文只对需求文档与设计证据评分，不对当前业务代码完成度打分。评分对象为：

| 对象 ID | 对象名称 | 路径 | 本文角色 |
|---|---|---|---|
| OLD-A | 旧 PRD A：多租户隔离专项 PRD | `prd.md`，归档镜像为 `docs/archive/planning/prd.md` | 安全红线、租户隔离、审计与数据权限专项基线 |
| OLD-B | 旧 PRD B：资产管理系统宽需求 | `docs/资产管理系统需求.docx` | 资产全生命周期、ERP、RFID、流程审批、报表、移动/IoT、权限与安全的宽业务基线 |
| V1 | UNIVIEW 固定资产平台产品套 Stitch PRD | `.stitch/forthams-uniview-product-suite-prd.md` | 产品愿景、视觉氛围、高层业务模块与可复制屏幕套件参考 |
| V2 | System Hub / Future Settings OS IA 与 39 设计稿执行记录 | `.stitch/system-hub-39-getstitch-100score-run.md`，并结合 `docs/specs/system-hub/INFORMATION-ARCHITECTURE.md` | 后台 IA、39 设计稿执行、44/35/9 范围口径与页面验证证据 |
| NEW | Future Settings OS v3 扩展完整 PRD | `docs/specs/future-settings-os-v3-expanded-prd.md` | V3 后端新需求基线候选 |

### 1.2 证据边界

1. `OLD-A` 已直接读取根目录 `prd.md`；其内容聚焦 TenantContext、AssetController 拦截、tenant_id 查询隔离、回退保护和审计增强。
2. `OLD-B` 是二进制 docx，普通 Read 无法直接读取正文；本文使用 `audit.json` 中的只读抽取证据，不声称逐页完整阅读，也不伪造原文页码外的详细引用。
3. `V1` 已直接读取 `.stitch/forthams-uniview-product-suite-prd.md`，其重点是 UNIVIEW 固定资产平台产品套、智能制造总览、数据监控中心、资产运维中心和安全态势工作台。
4. `V2` 已直接读取 `.stitch/system-hub-39-getstitch-100score-run.md` 的核心执行记录，并直接读取 IA 主文档作为 V2 范围事实源。
5. `NEW` 已直接读取 `future-settings-os-v3-expanded-prd.md`，其直接设计基线为 `future-settings-os-v3-backend-design.md`。
6. 本文没有重新运行项目测试、E2E、后端单测或前端单测；评分只基于文档和会话产物证据。

### 1.3 真实性说明

- 不声称旧 docx 原文已逐页完整读取；OLD-B 的证据来自 GAI2 审计阶段只读抽取。
- 不声称未运行的项目测试已通过。
- 不复制、不输出任何 password、token、secret、API key 原值。
- 不夸大 `Handover`、`DataPermissionRule`、`MailGateway`、`Form Center/Designer` 的完成度：它们在 NEW 中被定位为已有部分事实与待补缺口并存。
- V1/V2 分数低于 NEW 时，不表示其原始目标失败；它们原本偏产品愿景、视觉执行或 IA/页面阶段，不是完整后端 PRD。

---

## 2. 评分公式与维度

评分公式：**总分 = Σ(raw_score/5 * weight)**，满分 100。`raw_score` 取 0-5 分，可用 0.5 粒度。

| 维度 | 名称 | weight | 评分关注点 |
|---|---|---:|---|
| S1 | 业务与范围完整性 | 15 | 是否覆盖资产全生命周期、组织权限、流程、集成、通知、系统参数、安全与非目标 |
| S2 | IA 覆盖与导航一致性 | 20 | 是否解释 44/35/9/39/Workbench V3 口径，并映射导航、页面、对象和功能 |
| S3 | 需求粒度与清晰度 | 15 | 是否细化查询条件、列表字段、操作按钮、规则、异常、状态机与验收含义 |
| S4 | 后端契约与实现就绪度 | 15 | 是否定义 Controller/API、Service、Entity/Migration、DTO、权限码、测试和迁移 |
| S5 | 安全权限合规 | 10 | 是否覆盖租户隔离、RBAC、数据权限、敏感信息脱敏/加密、审计和 fail-closed |
| S6 | 跨模块链路与状态完整性 | 10 | 是否覆盖权限链、主数据链、通知链、集成链、系统参数链和关键状态机 |
| S7 | 验证与验收可执行性 | 10 | 是否给出 DB/API/audit/page/E2E 或等价验证方式 |
| S8 | 证据可追溯与版本诚实度 | 5 | 是否引用路径、标记过时矩阵、未决问题和真实性边界 |

---

## 3. OLD-A 评分表：多租户隔离专项 PRD

| 维度 | raw_score | weight | weighted_score | reason | evidence |
|---|---:|---:|---:|---|---|
| S1 | 1.0 | 15 | 3.0 | 范围聚焦多租户隔离，不覆盖资产主业务、System Hub、流程、集成、通知、系统参数或 V3 壳。 | `prd.md:4-22` |
| S2 | 0.5 | 20 | 2.0 | 没有 44/35/9/39 IA、导航层级、Workbench V3 或 SystemPageHost 口径。 | `prd.md:14-22`；IA 主文档 |
| S3 | 3.0 | 15 | 9.0 | 对 TenantContext、拦截、查询过滤、回退保护和审计有较清晰功能项，但仅限安全专项。 | `prd.md:16-22` |
| S4 | 2.0 | 15 | 6.0 | 提到 JwtUtil、Filter/AOP、参数化查询等技术方向，但缺完整 API、DTO、实体、迁移和测试矩阵。 | `prd.md:18-35` |
| S5 | 4.5 | 10 | 9.0 | 安全目标非常明确，强调强阻断、防注入、缺租户默认拒绝和审计日志。 | `prd.md:30-36` |
| S6 | 1.0 | 10 | 2.0 | 只覆盖租户隔离链路，不覆盖权限链、通知链、集成链、系统参数链或交接/表单状态。 | `prd.md:6-13` |
| S7 | 3.0 | 10 | 6.0 | 有有效 Token、无 Token、跨租户查询、SQL 注入和并发上下文验收，但缺完整端到端范围。 | `prd.md:38-46` |
| S8 | 2.5 | 5 | 2.5 | Markdown 路径清晰，但文档自身出现范围很窄且未说明版本演进关系。 | `prd.md`；`audit.json.old_prd_summary` |

**OLD-A 总分：39.5 / 100**

---

## 4. OLD-B 评分表：资产管理系统宽需求

| 维度 | raw_score | weight | weighted_score | reason | evidence |
|---|---:|---:|---:|---|---|
| S1 | 4.0 | 15 | 12.0 | 覆盖资产核算、ERP、重要设备、RFID、闲置资产、赔偿、流程审批、报表、移动/IoT、权限和数据安全，业务面最宽。 | `audit.json:located_documents`、`audit.json:evidence_quotes` 对 docx 的只读抽取 |
| S2 | 1.5 | 20 | 6.0 | 属于资产系统宽需求，不含 Future Settings OS 44/35/9/39 口径、Workbench V3 壳或 SystemPageHost。 | `audit.json.old_prd_summary` |
| S3 | 3.0 | 15 | 9.0 | 业务域描述较完整，但从审计证据看缺少逐 IA 菜单的查询条件、列表字段、按钮、异常和状态机细化。 | `audit.json:evidence_quotes` |
| S4 | 1.5 | 15 | 4.5 | 缺少当前项目后端 API、Controller、Service、Entity、权限码、迁移和测试契约。 | `audit.json.old_prd_summary` |
| S5 | 2.5 | 10 | 5.0 | 提到权限与数据安全，但没有 NEW 级别的租户隔离、数据权限只收紧、敏感字段和 fail-closed 细化。 | `audit.json:located_documents[docs/资产管理系统需求.docx]` |
| S6 | 3.0 | 10 | 6.0 | 有资产、ERP、RFID、流程审批和报表等链路意识，但没有 V3 五条业务链的可验证断点设计。 | `audit.json:evidence_quotes` |
| S7 | 2.5 | 10 | 5.0 | 有需求目标，但缺 DB/API/audit/page/E2E 一一对应验收矩阵。 | `audit.json.old_prd_summary` |
| S8 | 1.5 | 5 | 1.5 | 当前只能通过 audit 抽取证据引用，尚未转换为可审计 Markdown，因此追溯性弱。 | `audit.json:verification_notes` |

**OLD-B 总分：49.0 / 100**

---

## 5. V1 评分表：UNIVIEW 产品套 Stitch PRD

| 维度 | raw_score | weight | weighted_score | reason | evidence |
|---|---:|---:|---:|---|---|
| S1 | 2.5 | 15 | 7.5 | 覆盖登录、智能制造总览、数据监控、资产运维、安全态势等高层模块，但不是完整后台设置或资产全生命周期 PRD。 | `.stitch/forthams-uniview-product-suite-prd.md:21-70` |
| S2 | 2.0 | 20 | 8.0 | 有顶栏模块和左侧 icon sidebar 的产品套 IA，但没有 44 项 System Hub 菜单或 Workbench V3 口径。 | `.stitch/forthams-uniview-product-suite-prd.md:15-19,71-79` |
| S3 | 2.0 | 15 | 6.0 | 对屏幕内容、视觉和模块卡片有要求，但缺表单字段、状态机、权限、异常、验收规则。 | `.stitch/forthams-uniview-product-suite-prd.md:25-70` |
| S4 | 0.5 | 15 | 1.5 | 基本没有后端契约、API、实体、迁移、权限码或测试策略。 | `.stitch/forthams-uniview-product-suite-prd.md` |
| S5 | 1.0 | 10 | 2.0 | 有安全态势工作台视觉，但没有租户隔离、RBAC、数据权限、敏感字段和审计合规细化。 | `.stitch/forthams-uniview-product-suite-prd.md:62-69` |
| S6 | 2.0 | 10 | 4.0 | 连接 MES、设备状态、资产位置、维保、告警、巡检等业务视角，但未形成后端可验收链路。 | `.stitch/forthams-uniview-product-suite-prd.md:5-7` |
| S7 | 1.0 | 10 | 2.0 | 输出目标是高保真屏幕套件，可用于视觉验收，但缺需求验收矩阵。 | `.stitch/forthams-uniview-product-suite-prd.md:80-82` |
| S8 | 2.0 | 5 | 2.0 | 路径和目标明确，但与后续 V2/NEW 的版本关系需要由审计和评分文档补充说明。 | `audit.json:v1_summary` |

**V1 总分：33.0 / 100**

---

## 6. V2 评分表：System Hub / Future Settings OS IA 与执行记录

| 维度 | raw_score | weight | weighted_score | reason | evidence |
|---|---:|---:|---:|---|---|
| S1 | 3.5 | 15 | 10.5 | 已进入系统设置中心、组织权限、基础资料、集成配置、消息通知和系统参数，但不等同于扩展完整 PRD。 | IA 主文档 `2. 菜单注册表`；V2 执行记录 |
| S2 | 4.0 | 20 | 16.0 | IA 主文档明确 44 项/6 组、35 非流程和导航契约；但 39 设计稿记录与 44 菜单仍需 NEW 统一解释。 | `INFORMATION-ARCHITECTURE.md:28-45`；V2 记录 `Current Audit` |
| S3 | 3.0 | 15 | 9.0 | 有实现深度矩阵、导航、状态层级和跨页关系，但未按完整 PRD 逐项写查询、按钮、规则、异常。 | `INFORMATION-ARCHITECTURE.md:105-149` |
| S4 | 3.0 | 15 | 9.0 | 提供深度矩阵与重构动作，但 DataPermissionRule、Handover、MailGateway、FormDefinition 状态已部分过时。 | `INFORMATION-ARCHITECTURE.md:129-149`；`audit.json:ia_gaps` |
| S5 | 3.0 | 10 | 6.0 | 权限链、TenantContext、审计和断点有记录，但缺 NEW 级别的敏感字段、密钥管理和 fail-closed 验收。 | `INFORMATION-ARCHITECTURE.md:52-63,94-101` |
| S6 | 3.5 | 10 | 7.0 | 五条业务链被清楚提出，断点也被识别；但未把所有状态机和后端契约落成 PRD。 | `INFORMATION-ARCHITECTURE.md:48-101` |
| S7 | 3.5 | 10 | 7.0 | V2 Stitch 执行记录包含浏览器可见性和 no-scroll 等页面证据；但不是后端测试验收。 | `.stitch/system-hub-39-getstitch-100score-run.md:9-16,60-75` |
| S8 | 4.0 | 5 | 4.0 | 证据路径、截图、尝试记录和 IA 文档较清楚，也诚实记录 known gaps。 | `.stitch/system-hub-39-getstitch-100score-run.md`；IA 主文档 |

**V2 总分：68.5 / 100**

---

## 7. NEW 评分表：Future Settings OS v3 扩展完整 PRD

| 维度 | raw_score | weight | weighted_score | reason | evidence |
|---|---:|---:|---:|---|---|
| S1 | 4.5 | 15 | 13.5 | 覆盖旧 PRD A/B、V1/V2、44 项 IA、七类核心模块、安全合规、分期和非目标；业务范围完整但仍需用户确认 V1/V2 权威路径。 | `future-settings-os-v3-expanded-prd.md:22-139,417-595` |
| S2 | 5.0 | 20 | 20.0 | 明确 44/35/9/39/Workbench V3 口径，44 项矩阵连续展开，并写入 `/fixed-assets/workbenchv3`、SystemPageHost 和旧入口保护。 | `future-settings-os-v3-expanded-prd.md:171-233,598-647` |
| S3 | 4.5 | 15 | 13.5 | 按模块写查询条件、列表字段、操作按钮、业务规则、状态机、验收含义；少数从 0 建设项仍是契约草案。 | `future-settings-os-v3-expanded-prd.md:431-581` |
| S4 | 4.5 | 15 | 13.5 | 给出通用 API、DTO、事件集成、权限、审计、幂等、迁移和分期契约；实现级细节需后续代码专项确认。 | `future-settings-os-v3-expanded-prd.md:651-688,731-755` |
| S5 | 4.0 | 10 | 8.0 | 覆盖 RBAC、数据权限、租户隔离、审计、敏感信息规则和 MailGateway 加密待核查；未把未核查事项写成完成。 | `future-settings-os-v3-expanded-prd.md:691-728,760-779` |
| S6 | 4.5 | 10 | 9.0 | 五条业务链、交接、表单、邮件/通知状态机和跨模块断点均有说明；真实实现闭环仍需后续专项。 | `future-settings-os-v3-expanded-prd.md:192-200,353-414` |
| S7 | 4.5 | 10 | 9.0 | 明确 IA 覆盖、MVP/P1/P2、上线检查、文档自检和未运行项目测试原因；后续代码测试另行执行。 | `future-settings-os-v3-expanded-prd.md:731-807` |
| S8 | 5.0 | 5 | 5.0 | 明确来源索引、证据边界、旧 docx 只读抽取、旧矩阵过时和真实性红线。 | `future-settings-os-v3-expanded-prd.md:38-49,142-168,758-807` |

**NEW 总分：91.5 / 100**

---

## 8. 汇总排名表

| 排名 | 对象 | 总分 | 核心优势 | 核心短板 | 适合作为什么基线 |
|---:|---|---:|---|---|---|
| 1 | NEW | 91.5 | 范围、IA、契约、权限、安全、链路、验收和证据边界最完整 | 仍是需求与契约文档，不等于实现完成；部分事项待确认 | V3 后端新需求主基线 |
| 2 | V2 | 68.5 | IA 主文档、39 设计稿执行、页面验证和业务链断点清楚 | 旧矩阵部分过时，后端契约和 PRD 粒度不足 | IA/视觉执行/页面迁移证据基线 |
| 3 | OLD-B | 49.0 | 业务域最宽，覆盖资产全生命周期和外部集成诉求 | docx 可追溯性弱，缺 V3 IA、后端契约和验收矩阵 | 资产管理宽业务域引用基线 |
| 4 | OLD-A | 39.5 | 租户隔离与安全红线强 | 范围很窄，不能承载完整后台管理 PRD | 安全专项与租户隔离引用基线 |
| 5 | V1 | 33.0 | 产品愿景、视觉方向和高层模块清晰 | 缺后台 IA、权限、后端契约和验收 | 产品愿景与视觉风格引用基线 |

---

## 9. 新旧差异讨论

### 9.1 新增

- 新增 `44 项 / 6 组` 全量 IA coverage matrix，并统一 `35 非流程`、`9 流程平台`、`39 设计稿`、`Workbench V3 当前承载` 的关系。
- 新增 Workbench V3 壳需求：入口 `/fixed-assets/workbenchv3`、默认 `system-user-management`、复用 `SystemPageHost` 与 Inspector，不嵌套旧 Workbench。
- 新增组织权限、基础资料、集成配置、消息与通知、系统参数、流程平台、安全合规七类模块的后端契约草案。
- 新增 DataPermissionRule、Handover、MailGateway、Form Center/Designer 的当前事实与剩余缺口说明。
- 新增后端契约、DTO、审计、幂等、迁移、权限码、测试验证和分期路线。

### 9.2 继承

- 从 OLD-A 继承租户隔离、TenantContext、缺失租户默认拒绝、跨租户阻断和安全审计红线。
- 从 OLD-B 继承资产全生命周期、ERP、RFID、流程审批、报表、移动/IoT、权限与数据安全的宽业务背景。
- 从 V1 继承工业 SaaS、高密度企业屏幕、资产运维、数据监控和安全态势的产品愿景。
- 从 V2 继承 System Hub 设计稿执行、IA 主文档、五条业务链、页面状态和 Workbench 渐进迁移思路。

### 9.3 改写

- 将 V2 中可能被误读的 `39 张设计稿` 改写为视觉/页面参考，而不是菜单范围事实源。
- 将 OLD-A 的租户隔离专项改写为 NEW 的横切安全合规章节，而不是完整 PRD 主体。
- 将 OLD-B 的资产宽需求改写为基础资料、集成链、流程平台和主数据链的背景输入。
- 将 Handover 从“离职交接后端待建”改写为“已有任务摘要与状态记录，但真实资产/工单/审批对象转移未闭环”。
- 将 DataPermissionRule 从“仅底层/待配置”改写为“规则只收紧、CUSTOM 跳过投影、部门配置仍在角色管理页”。

### 9.4 澄清

- 澄清 IA 数字关系：`44` 是全量目标，`35` 是非流程阶段子集，`9` 是流程平台受控边界，`39` 是 V2 设计稿执行记录。
- 澄清 Workbench V3 只是独立后端管理壳，不替换旧 `/fixed-assets/workbench`，当前阶段权限暂不做，即不把 V3 路由加入 `routePermissions`。
- 澄清 `SystemPageHost` 是真实系统页面承载层，不能用设计稿 iframe 代替 API、权限、测试和后端契约。
- 澄清 MailGateway 响应脱敏不等于存储加密；存储加密、解密和密钥管理仍待核查。
- 澄清 Form Center/Designer 与 IA 中 `form-config`、`form-storage` 的命名和边界待统一。

### 9.5 删除/降级

- 移动端、dashboard、旧 Workbench 改造被降级为非本轮范围；移动端继续冻结。
- 流程平台 9 项在 NEW 中纳入需求和契约草案，但实现被降级为后续专项，不在非流程阶段误做。
- V3 route 权限暂不做，降级为后续权限专项，避免破坏现有入口和旧工作台。
- OLD-B 中移动/IoT 宽诉求不作为当前 V3 后端文档写入的实现承诺，仅作为业务背景和后续引用。

### 9.6 风险变化

- 风险降低：NEW 将 OLD-A/OLD-B/V1/V2 分层引用，避免用单一旧文档替代全量需求。
- 风险降低：NEW 公开标注旧实现矩阵过时，避免误判 DataPermissionRule、Handover、MailGateway、FormDefinition 完成度。
- 风险新增：NEW 的范围扩展到 44 项，后续实现、测试、权限元数据和迁移工作量明显增加。
- 风险保留：MailGateway 存储加密、Handover 真转移、DataPermissionRule CUSTOM 边界、Form Center 命名统一仍是高优先未决。
- 风险受控：通过分期路线、验证矩阵和真实性红线，NEW 将风险从隐性问题转为可排期、可验收事项。

---

## 10. 必须专题讨论的差异点

| 主题 | 旧材料状态 | NEW 处理 | 影响 |
|---|---|---|---|
| IA 44/35/9/39 口径 | V2 同时存在 IA 44、非流程 35、流程 9、设计稿 39 | 明确 44 全量、35 子集、9 受控、39 视觉参考 | 产品范围和验收口径统一 |
| Workbench V3 壳 | V2 有工作台演进，样式指南固定 V3 | NEW 写入入口、默认菜单、三栏、Inspector、旧入口保护 | 前端实现有清晰壳边界 |
| SystemPageHost | V2 IA 提到真实组件承载 | NEW 明确它是 V3 承载方式，不替代业务契约 | 防止 iframe/视觉稿冒充真实现 |
| 权限暂不做 | 样式指南写当前不加 V3 route 权限 | NEW 保留为后续权限专项 | 降低当前壳上线风险，但需后续 fail-closed |
| 组织权限 | V2 较强，OLD-A 提供租户安全 | NEW 细化用户、角色、菜单、部门、岗位、数据权限、交接、租户 | 形成权限链主线 |
| 基础资料 | OLD-B 有资产主数据背景，V2 有 6 项 IA | NEW 写分类、编号、位置、供应商、字段、字段集 | 支撑资产主数据链 |
| 集成配置 | OLD-B 有 ERP/RFID，V2 标记整链 mock/断链 | NEW 写外部系统、接口、字段映射、同步、Webhook 契约 | 从背景诉求变成可建设后端链路 |
| 消息与通知 | V2 有邮件/通知断点，MailGateway 有新增事实 | NEW 写网关、流程邮件、模板、日志、渠道、偏好、开关 | 通知链从页面集合转为发送决策链 |
| 系统参数 | V2 有缓存空实现、审计较强等断点 | NEW 写参数、安全、文件、导入导出、缓存、审计、文档、支持 | 运维链路可验收 |
| 流程平台 | V2 有 9 项设计稿与部分页面 | NEW 作为受控边界进入需求，后续专项实现 | 避免非流程阶段越界 |
| 安全合规 | OLD-A 强，OLD-B 泛化，V2 部分链路 | NEW 横切 RBAC、数据权限、租户隔离、审计、敏感信息 | 安全从单点 PRD 变成全局基线 |
| Handover | 旧矩阵认为无后端，审计发现已有摘要和状态 | NEW 写“已有部分能力，但真转移未闭环” | 避免夸大完成度 |
| DataPermissionRule | 旧矩阵偏底层，审计发现已有规则 Controller/Service | NEW 写只收紧、CUSTOM 边界、角色页部门配置 | 权限语义更准确 |
| MailGateway | 旧矩阵偏弱，审计发现 API/页面/响应脱敏 | NEW 写响应脱敏已存在、存储加密待核查 | 安全风险被显性化 |
| Form Center/Designer | V2 IA 为 form-config/form-storage，审计发现 system-form-center/designer | NEW 写命名关系待统一、流程平台边界 | 防止菜单双轨和权限码冲突 |

---

## 11. 影响评估

| 维度 | 影响 |
|---|---|
| 产品 | NEW 可作为 V3 后端主 PRD，但需要把 OLD-A、OLD-B、V1、V2 分别保留为安全、业务域、愿景、IA/视觉证据，而不是覆盖掉。 |
| 后端 | 后续需按 44 项矩阵补 Controller/API、DTO、Service、Entity/Migration、权限码、审计和幂等；从 0 建设项集中在集成配置、文档中心、技术支持和流程平台部分菜单。 |
| 前端 | Workbench V3 壳、SystemPageHost、systemRealPageRegistry、systemModuleRegistry 和 Inspector 要按 NEW 的 IA 和权限元数据补齐；不得触碰旧 Workbench 和移动端冻结范围。 |
| 权限 | 当前 V3 route 权限暂不做，但每个菜单的菜单级、按钮级、接口级权限码要进入后续权限专项；permissionMeta 需从用户/角色扩展到 44 项。 |
| 安全 | 租户隔离、数据权限只收紧、敏感字段脱敏、存储加密待核查、导出/诊断包脱敏、审计日志成为横切验收项。 |
| 测试 | 文档阶段只做读回和内容检查；实现阶段需要 DB/API/Service/权限拒绝/租户隔离/页面 smoke/E2E，尤其补 DataPermissionRule、Handover、MailGateway、FormDefinition 专属测试。 |
| 迁移 | 迁移 SQL 和权限种子需要幂等；form-config/form-storage 与 system-form-center/designer 命名统一需迁移策略；旧实现矩阵要标记历史化。 |
| 实施排期 | 推荐先做 P0 口径冻结和 P1 已有能力校准，再做 P2 新增能力补强、P3 非流程断链补齐、P4 从 0 建设、P5 流程平台专项、P6 V3 权限壳专项。 |

---

## 12. 决策建议

建议采用 **NEW：`docs/specs/future-settings-os-v3-expanded-prd.md`** 作为 V3 后端新需求基线。

同时保留以下引用关系：

1. **OLD-A**：保留为租户隔离、安全红线、审计和数据权限专项引用，不作为完整后台 PRD。
2. **OLD-B**：保留为资产管理业务域宽基线，尤其是资产全生命周期、ERP、RFID、流程审批、报表和移动/IoT 背景。
3. **V1**：保留为产品愿景、视觉氛围、高层模块和工业 SaaS 体验参考。
4. **V2**：保留为 IA、设计稿执行、System Hub 演进、页面可见性验证和 Workbench 迁移证据。
5. **V3 后端设计方案**：与 NEW 共同作为后续实现拆分、权限专项、测试专项和 reviewer 验收的直接输入。

---

## 13. 后续验收建议

1. 将 `docs/资产管理系统需求.docx` 转换或摘录为可审计 Markdown，再补充 OLD-B 更细粒度逐项差异。
2. 对 NEW 的 44 项矩阵建立机器检查：IA 编号连续、分组数量正确、每行含契约、权限、缺口和验收。
3. 对 V3 壳建立合同测试：`/fixed-assets/workbenchv3`、默认菜单、SystemPageHost、旧 Workbench 不动、route 权限暂不做。
4. 对权限专项建立菜单级、按钮级、接口级、permissionMeta 和审计动作映射表。
5. 对安全专项建立租户隔离、DataPermissionRule 只收紧、MailGateway 存储加密、导出/诊断脱敏测试。
6. 对 Handover 建立真实对象转移专项 PRD，明确事务、回滚、审计和对象 schema。
7. 对 Form Center/Designer 建立命名统一方案，决定 `form-config`、`form-storage`、`system-form-center`、`system-form-designer` 的别名、迁移和权限码关系。

---

## 14. 未决问题

1. 用户是否确认 V1/V2 的最终权威路径就是本次审计定位的 Stitch PRD 与 System Hub 39 执行记录。
2. OLD-B 是否需要转换为 Markdown 后进行更严格的逐条业务需求差异评分。
3. Workbench V3 route 权限何时启动专项，如何与旧 `/fixed-assets/workbench` 共存。
4. `MailGateway` 存储层是否已有加密/解密和密钥轮换；若没有，应作为安全 P0/P1 风险处理。
5. `Handover` 是否允许 PENDING 直达 COMPLETED，以及真实资产/工单/审批对象转移是否进入当前 V3 范围。
6. `DataPermissionRule` 的 roleIds 结构化、角色存在性校验和 CUSTOM 部门配置边界如何落实现。
7. `Form Center/Designer` 与 IA 菜单命名是否合并、替换或保留别名。
8. 流程平台 9 项何时从受控需求进入实现专项。
