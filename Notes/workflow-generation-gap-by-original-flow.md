# Notes 原分类流程生成缺口分析

## 结论

按“不合并，原先是什么分类就什么分类”的原则，拆分后的 Notes 文档可以支撑生成各原始流程的工作流草稿，但还不能直接生成可发布、可运行、可闭环落库的生产流程。

可直接生成的是流程定义骨架：`businessType`、节点、连线、节点名称、按钮对应的状态迁移、主线 Mermaid 走向、初版表单 HTML。缺失的是系统运行必需的映射信息：业务类型注册、审批角色编码、条件表达式、表单字段到系统 DTO 的映射、退回/重提规则、审批完成后的业务回调。

## 当前系统约束

- 流程定义发布要求：必须有 `id/name/description/businessType/nodes/edges`，且只能使用 `start / approval / task / cc / condition / end` 节点类型。
- 审批/办理节点必须配置 `approverRole` 或指定用户 `approverId`，审批模式只支持 `sequence / all / any`。
- 条件节点只支持简单表达式：`字段 操作符 值`，例如 `amount >= 1000`，不支持 Notes 复杂公式和 AND/OR 复合条件。
- 开始节点和审批节点必须有 `formSource`，当前系统把它当 HTML 表单源码使用。
- 当前一等业务类型主要是 `ASSET_TRANSFER / ASSET_CLEARANCE / ASSET_SCRAP / ASSET_COMPENSATION / RETIREMENT`。
- 当前会按发布流程计算运行路径并在审批完成后触发业务回调的资产处置类型主要是 `ASSET_TRANSFER / ASSET_CLEARANCE / ASSET_SCRAP / ASSET_COMPENSATION`。

## 原始流程逐项判断

| 原 Notes 流程 | 建议独立业务类型 | 可自动生成 | 当前主要缺口 |
| --- | --- | --- | --- |
| 资产调拨电子流 | `ASSET_ALLOCATION` | 可生成节点、表单草稿、主线审批图 | 系统未注册独立业务类型；缺提交入口、DTO、审批完成后的调拨/发货/库房回调；缺角色编码映射 |
| 资产转移电子流 | `ASSET_TRANSFER_LEGACY` | 可生成旧转移流程草稿 | 不能与新资产转移共用 `ASSET_TRANSFER`；需确认旧流程对应资产状态变更、转入/转出部门字段、转出人/转入人确认规则 |
| 新资产转移电子流 | `ASSET_TRANSFER_NEW` | 可生成新转移流程草稿 | 需独立业务类型；缺旧新版本并存策略、入口区分、业务 DTO 字段映射 |
| 配件转移电子流 | `ACCESSORY_TRANSFER` | 可生成审批流草稿 | 系统缺配件业务类型、配件实体状态更新回调、配件字段 DTO、配件查询数据源映射 |
| 资产清退电子流 | `ASSET_CLEARANCE` | 可生成主线，系统已有相近业务类型 | 需补 IT 判断条件、回收库房确认条件、清退原因与处置方式字段映射、退回/终止规则 |
| 配件清退电子流 | `ACCESSORY_CLEARANCE` | 可生成审批流草稿 | 系统缺配件清退业务类型、配件清退落库回调、库房接收规则、字段 DTO |
| 资产报废电子流 | `ASSET_SCRAP` | 可生成主干流程和部分分支 | 分支最复杂；需补资产原值、进出口、信息安全、财务、库房、异地处置、确认收款的条件决策表和字段映射 |
| 资产赔偿电子流 | `ASSET_COMPENSATION` | 可生成主线，系统已有业务类型 | 需补责任人异议、资产原值、一级资产管理部门、信息安全、财务总监等分支条件；需金额/责任人/资产字段映射 |

## 临时默认值

以下默认值用于先生成草稿和记录迁移假设，后续可逐项覆盖。默认值原则是：先保留 Notes 原分类、先生成可编辑草稿、先用系统最稳的兜底角色保证结构可校验；凡是业务含义不确定的地方，都写入节点说明或迁移备注，不伪装成已确认规则。

### 1. businessType 默认值

| 原 Notes 流程 | 默认 businessType | 默认流程名称 | 默认提交入口 |
| --- | --- | --- | --- |
| 资产调拨电子流 | `ASSET_ALLOCATION` | 资产调拨流程 | `/workflow-form/ASSET_ALLOCATION` |
| 资产转移电子流 | `ASSET_TRANSFER_LEGACY` | 资产转移流程（旧） | `/workflow-form/ASSET_TRANSFER_LEGACY` |
| 新资产转移电子流 | `ASSET_TRANSFER_NEW` | 新资产转移流程 | `/workflow-form/ASSET_TRANSFER_NEW` |
| 配件转移电子流 | `ACCESSORY_TRANSFER` | 配件转移流程 | `/workflow-form/ACCESSORY_TRANSFER` |
| 资产清退电子流 | `ASSET_CLEARANCE` | 资产清退流程 | `/workflow-form/ASSET_CLEARANCE` |
| 配件清退电子流 | `ACCESSORY_CLEARANCE` | 配件清退流程 | `/workflow-form/ACCESSORY_CLEARANCE` |
| 资产报废电子流 | `ASSET_SCRAP` | 资产报废流程 | `/workflow-form/ASSET_SCRAP` |
| 资产赔偿电子流 | `ASSET_COMPENSATION` | 资产赔偿流程 | `/workflow-form/ASSET_COMPENSATION` |

### 2. 节点与连线默认值

| 项目 | 临时默认值 |
| --- | --- |
| 节点类型 | 开始用 `start`；审批确认类用 `approval`；库房发货、资产核算、收款确认等办理类优先用 `task`；结束用 `end` |
| 节点 ID | `start-1`、`approval-1`、`task-1`、`end-1` 等顺序编号 |
| 节点编码 | 按状态语义生成大写编码，例如 `APP_DEPT_MANAGER`、`TASK_WAREHOUSE_CONFIRM` |
| 节点说明 | 写入 Notes 原状态名、按钮文本、是否为临时推断 |
| 连线 | 先按文档 Mermaid 主线生成；多目标按钮默认取主线正向目标 |
| 退回连线 | 暂不生成回环；先记录为驳回动作，后续确认重提规则后再补 |
| 终止连线 | 暂按取消/终止结束处理 |
| 条件节点 | 缺条件表达式时不生成条件节点，只在迁移备注记录候选分支 |

### 3. 审批角色默认值

- `approverRole` 临时统一填 `SUPER_ADMIN`，作为可校验兜底。
- 节点说明中保留 `intendedRole`，记录 Notes 语义角色，后续替换为真实 `role_code` 或动态处理人规则。

| Notes 语义角色 | intendedRole 默认值 | 发布兜底 approverRole |
| --- | --- | --- |
| 部门直接主管 / 部门主管 / 权签人 | `DEPT_MANAGER` | `SUPER_ADMIN` |
| 部门资产管理员 / 转入部门资产管理员 / 转出部门资产管理员 | `ASSET_MANAGER` | `SUPER_ADMIN` |
| 一级资产管理员 / 一级资源管理部门 | `ASSET_MANAGER_L1` | `SUPER_ADMIN` |
| 资产管理处 / 管理办 / 运作支持部 | `ASSET_OFFICE` | `SUPER_ADMIN` |
| 回收库房 / 库房确认 | `WAREHOUSE_MANAGER` | `SUPER_ADMIN` |
| 资产核算处 / 资产原值 / 财务权签人 / 财务总监 | `FINANCE` | `SUPER_ADMIN` |
| 信息安全审批员 | `SECURITY_ADMIN` | `SUPER_ADMIN` |
| 进出口部 | `IMPORT_EXPORT` | `SUPER_ADMIN` |
| 申请人 / 经办人 / 转出人 / 转入人 / 责任人 | `DYNAMIC_USER` | `SUPER_ADMIN` |

说明：`DYNAMIC_USER` 只是迁移备注。当前流程定义的 `approverId` 是静态用户 ID，不能直接表达“表单里选的转出人/转入人”；这类动态审批人后续需要扩展运行时解析，或在提交前把节点改成指定用户。

### 4. 审批模式默认值

| 场景 | 临时默认值 |
| --- | --- |
| 单人审批/办理 | `sequence` |
| 多个角色但未确认会签/或签 | `sequence` |
| 明确需要全部确认 | 先记录备注，暂不默认 `all` |
| 明确任一人可确认 | 先记录备注，暂不默认 `any` |
| count / 几人通过 | 不使用；当前发布校验不支持 `count` |

### 5. 表单默认值

| 项目 | 临时默认值 |
| --- | --- |
| formSource | 根据字段明细生成 HTML `<form>`，字段名沿用 Notes 字段名 |
| 字段类型 | text / number / date / textarea / select，无法判断时默认 text |
| 必填规则 | 只把按钮校验提示中的“请输入...”字段标为必填；其他先可选 |
| 隐藏/只读规则 | 不直接实现，写入字段备注 |
| 默认值公式 | 不执行 Notes 公式，只保留文字备注 |
| summaryFields | 默认 `assetId,reason,amount,approvalComment`，没有对应字段时按实际字段替换 |
| legacy 字段 | 默认加入 `legacyFormName`、`legacyStatus`、`legacySource=notes-dxl` 隐藏字段 |

### 6. 字段映射默认值

| 业务含义 | 系统字段默认名 | Notes 字段候选 |
| --- | --- | --- |
| 资产 ID / 资产编号 | `assetId` | `bianhao`、`bianhao1`、`zcbh`、`zcid`、`assetId` |
| 申请原因 / 处置原因 | `reason` | `yuanyin`、`reason`、`shuoming`、`remark` |
| 目标部门 / 转入部门 | `targetDeptId` | `zrbm`、`targetDeptId`、`dept` |
| 目标用户 / 转入人 | `targetUserId` | `zrrID`、`zrlID`、`targetUserId` |
| 赔偿金额 | `compensationAmount` | `amount`、`jine`、`pcje` |
| 责任人 | `responsibleUserId` | `zrr`、`zrrID`、`responsibleUserId` |
| 位置 / 地点 | `targetLocation` | `region`、`louhao`、`location` |
| 审批意见 | `approvalComment` | 各节点意见字段，无法识别时统一使用 `approvalComment` |

### 7. 条件分支默认值

| 场景 | 临时默认处理 |
| --- | --- |
| 一个按钮对应多个状态目标 | 默认选择文档推断主线的正向目标 |
| 信息安全 / 进出口 / 异地 / 收款等复杂分支 | 不自动生成条件节点，写入迁移备注 |
| 必须保留分支但无表达式 | 使用人工占位字段 `migrationDecision`，但默认不发布 |
| Notes 复杂公式 | 原文保存在备注，不转换为系统表达式 |

### 8. 审批完成回调默认值

| businessType | 临时默认通过动作 | 临时默认驳回动作 | 临时默认取消动作 |
| --- | --- | --- | --- |
| `ASSET_ALLOCATION` | 仅记录审批通过，业务回调待补 | 记录驳回 | 记录取消 |
| `ASSET_TRANSFER_LEGACY` | 仅记录审批通过，业务回调待补 | 记录驳回 | 记录取消 |
| `ASSET_TRANSFER_NEW` | 仅记录审批通过，业务回调待补 | 记录驳回 | 记录取消 |
| `ACCESSORY_TRANSFER` | 仅记录审批通过，业务回调待补 | 记录驳回 | 记录取消 |
| `ASSET_CLEARANCE` | 优先沿用系统清退回调；字段不齐时仅记录 | 记录驳回 | 记录取消 |
| `ACCESSORY_CLEARANCE` | 仅记录审批通过，业务回调待补 | 记录驳回 | 记录取消 |
| `ASSET_SCRAP` | 优先沿用系统报废回调；字段不齐时仅记录 | 记录驳回 | 记录取消 |
| `ASSET_COMPENSATION` | 优先沿用系统赔偿回调；字段不齐时仅记录 | 记录驳回 | 记录取消 |

### 9. 催办、通知、打印、归档默认值

| 项目 | 临时默认值 |
| --- | --- |
| 通知 | 先依赖系统现有审批通知；Notes 邮件脚本只记录备注 |
| 催办 | 先记录 2 天、5 天、20 天规则，不自动生成定时任务 |
| 打印 | 只保留打印按钮和视图线索，不生成打印模板 |
| 归档 | 审批结束后默认视为归档候选；`mark=1` 映射待确认 |
| 当前处理人 | 先由系统运行时审批节点计算；`current_processor` 作为 legacy 字段保留 |

## 必须补齐的信息

1. `原流程 -> businessType -> 提交入口`
2. `Notes 角色/人员字段 -> 系统 role_code/user_id`
3. `Notes 字段 -> 系统 DTO 字段`
4. `条件分支 -> 简单表达式 -> true/false 去向`

没有这四张表，也可以生成草稿，但不能保证发布后可运行。
