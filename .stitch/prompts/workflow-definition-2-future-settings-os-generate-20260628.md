[Context]
UNIVIEW 固定资产管理系统后台，生成一个完整桌面高保真模块页面，模块名称为「流程定义 2」。这是现有「流程定义 / 工作流」模块的 Future Settings OS 版本，用于灰度确认；后续落地时先挂到测试入口 `/workflows-v2`，菜单显示「流程定义 2」，不得替换正式 `/workflows`。

设计语言：Future Settings OS。它不是营销页、不是大屏首页、不是普通 CRUD 表格，而是未来感后台设置操作系统：任务型、数据密、可治理、可预览、可发布、可回滚。视觉上继承现有后台设置 OS：冷白工作台、深色顶部运行条、细边框、低阴影、紧凑密度、8px 以内圆角、蓝色主行动、青色数据 accent、绿色/琥珀/红色状态。页面必须让真实管理员在同一屏完成流程定义查询、流程选择、草稿编辑、节点配置摘要、处理人预览、发布检查、版本历史和回滚判断。

真实产品事实：
- 主 API 是 `/workflows/*`，旧 `/workflow-designer/*` 已废弃。流程定义存储为 definition JSON，包含 nodes 和 edges。
- 支持状态：UNCONFIGURED 未配置、DRAFT 草稿中、PUBLISHED/ENABLED 已发布/已启用、DISABLED 已停用。
- 支持业务类型：资产转移流程 ASSET_TRANSFER、资产清退流程 ASSET_CLEARANCE、资产报废转让流程 ASSET_SCRAP、资产赔偿流程 ASSET_COMPENSATION，以及 CUSTOM_* 自定义流程。
- 节点类型：开始节点 start、审批节点 approval、条件分支 condition、结束节点 end。
- 审批节点支持按角色审批、指定用户、任一审批 any、会签 all、顺序审批 sequence。
- 条件分支支持表达式，例如「申请金额 >= 5000」，并有「满足条件 / 不满足条件」出口。
- 版本能力包含发布说明、影响范围、回滚预案、发布快照、回滚到历史版本；已发起实例保持原版本快照。
- 处理人预览支持输入业务数据 JSON，展示 calculable、缺失字段、节点解析状态、候选处理人数量；具体处理人名单可隐藏。
- 权限态：只有 workflow:definition:query 时只读；有 workflow:definition:edit 时可新建、保存草稿、发布、启停、删除自定义流程、回滚。

[Design System]
Platform: Web desktop.
Theme: Light workspace with dark command header.
Canvas size: 1586x992 desktop, no mobile layout.
Background: #F5F7FB page, #FFFFFF surfaces, #F8FAFC secondary surface, #071B33 top bar.
Primary: #1677FF for primary actions and active states.
Secondary accents: #22D3EE cyan telemetry, #10B981 success, #F59E0B review, #EF4444 danger, #64748B neutral.
Typography: PingFang SC / Microsoft YaHei for Chinese, Inter for numerals. H1 20px/700, section title 14px/700, body 13px/400, table 12px/500, metadata 11px/600.
Component style: 1px borders (#D8E2F0 / #E5E7EB), radius 6px, no decorative gradient orbs, no large drop shadows, compact row height 36-40px, dense controls with clear hover/selected states.
Interaction style: filled primary buttons, outline secondary buttons, ghost icon buttons, segmented controls for status filters, toggles for enabled state, checklist gates for publishing, timeline for versions.

[Layout]
Full page shell:
1. Top dark product bar, height 56px.
   - Left: UNIVIEW 固定资产平台.
   - Center nav: 资产运营中枢、资产台账、流程协同、系统运营中枢. Active item: 系统运营中枢.
   - Right: notification icon with badge 12, theme/system icon, user avatar, text 系统管理员.

2. Left sidebar, width 232px, white, border right.
   - Group title: Future Settings OS.
   - Navigation groups:
     - 系统设置 collapsed.
     - 组织与权限 collapsed.
     - 流程平台 expanded and active.
       - 流程定义
       - 流程定义 2 active, blue left border and pale blue background.
       - 流程设计器
       - 表单配置
       - 审批规则
       - SLA 配置
     - 集成配置 collapsed.
     - 安全与审计 collapsed.
   - No global search box in top bar or sidebar.

3. Main area, padding 18px, grid with:
   - Header command zone at top.
   - KPI/control strip.
   - Main three-column workbench: left flow list, center flow definition editor + visual path preview, right inspector.
   - Bottom release/version runway.

Header command zone:
- Breadcrumb: 系统运营中枢 / 流程平台 / 流程定义 2.
- H1: 流程定义 2.
- Subtitle: Future Settings OS 版本，用于灰度验证；正式入口仍保留在 /workflows。
- Right aligned actions in this exact order:
  1. 新建流程 (primary blue, plus icon)
  2. 保存草稿 (outline, save icon)
  3. 处理人预览 (outline cyan, user-check icon)
  4. 发布检查 (outline amber, shield icon)
  5. 发布流程 (primary green)
  6. 更多 (icon menu)
- Directly below H1: three small state pills:
  - 灰度入口 /workflows-v2
  - 正式入口未切换
  - 只影响新发起实例

KPI/control strip:
- Four compact metrics, one row:
  1. 流程总数 6, subtext 全部业务流程
  2. 已发布 4, subtext 可用于发起
  3. 草稿中 2, subtext 待完善发布
  4. 已停用 1, subtext 暂停新发起
- Next to metrics, a segmented status filter: 全部 / 已发布 / 草稿中 / 已停用.
- Search input only here: placeholder 搜索流程名称、编码、业务对象或版本.

Main workbench:
Left column width 330px, title「流程定义库」.
- Dense list of flows, selectable rows with status pill, version, updated time:
  - 资产转移流程 / ASSET_TRANSFER / 已发布 / v8 / 5 个节点
  - 资产清退流程 / ASSET_CLEARANCE / 草稿中 / v3 / 6 个节点
  - 资产报废转让流程 / ASSET_SCRAP / 已发布 / v5 / 5 个节点
  - 资产赔偿流程 / ASSET_COMPENSATION / 已停用 / v2 / 4 个节点
  - CIP 转固补充流程 / CUSTOM_CIP_ACCEPTANCE / 草稿中 / v1 / 7 个节点
- Selected flow: 资产转移流程. Use blue border and pale blue background.
- Row actions visible on selected row: 打开设计器, 表单入口, 启停.

Center column flexible, title「定义草稿与路径预览」.
- Top mini toolbar: 当前版本 v8, 草稿基线 v9-draft, 保存于 2026-06-28 14:20, owner 流程管理员.
- Two tabs: 定义编辑 active, JSON 快照 inactive.
- Editing form in compact two-column layout:
  - 流程名称: 资产转移流程
  - 流程编码: ASSET_TRANSFER
  - 业务对象: 资产转移
  - 绑定表单: /disposals/transfer/new
  - 发布范围: 资产转出、转入确认、双方部门审批
  - 版本说明: 增加金额阈值分支与财务复核
- Visual path preview below: horizontal/branched flow with connected nodes:
  1. 提交资产申请 (start, cyan)
  2. 部门负责人审批 (approval, blue, sequence)
  3. 金额阈值判断 (condition, amber, expression 申请金额 >= 5000)
  4a. 财务复核 (approval, purple, all)
  4b. 常规采购路径 (thin branch)
  5. 归档并同步审批列表 (end, green)
- Node chips must show small labels: start / approval / condition / end, node codes START-APPLY, APP-DEPT, COND-AMOUNT, APP-FINANCE, END-ARCHIVE.
- Below preview: validation feedback bar, green/amber mixed:
  - 已保存草稿
  - 条件表达式通过
  - 财务复核处理人需二次确认

Right inspector width 360px, title「发布 Inspector」.
- Section 1: 发起可用性
  - 状态: 可发起
  - 入口: /disposals/transfer/new
  - 阻断原因: 无阻断
- Section 2: 处理人预览
  - JSON input preview: {"amount": 6800, "deptId": 12}
  - Button: 重新计算
  - Result cards:
    - 部门负责人审批: 已解析 2 名候选处理人
    - 财务复核: 已解析 3 名候选处理人
    - 常规采购路径: 条件不满足时跳过
- Section 3: 发布检查清单
  - 必须有 checklist:
    - 流程必须且只能包含一个开始节点: 通过
    - 流程至少一个审批节点: 通过
    - 流程必须且只能包含一个结束节点: 通过
    - 所有连线目标存在: 通过
    - 条件分支 true/false 出口: 通过
    - 处理人解析: 需确认
- Section 4: 权限态
  - 当前账号: workflow:definition:edit
  - 风险等级: 中
  - 影响说明: 仅影响后续新发起审批，已发起实例保持原版本快照.

Bottom release/version runway:
- Full-width panel below workbench, title「版本历史与回滚」.
- Left: horizontal timeline of versions:
  - v8 当前发布头, 2026-06-28 10:40, PUBLISH
  - v7 稳定版本, 2026-06-26 16:12, PUBLISH, button 回滚到此版本
  - v6 回滚发布, 2026-06-24 09:18, ROLLBACK, source v4
- Middle: selected version details:
  - 发布说明: 增加金额阈值分支
  - 影响范围: 资产转移新发起审批
  - 回滚预案: 观察 24 小时，异常时回滚到 v7
  - 快照节点: 5
- Right: release gate buttons:
  - 取消
  - 保存草稿
  - 提交校验
  - 发布流程

[Components]
Use concrete enterprise UI elements:
- lucide-style icons: Workflow, GitBranch, Save, Send, History, RotateCcw, UserCheck, ShieldCheck, Search, Filter, MoreHorizontal.
- Buttons must have visible icon + text except tiny icon-only menu buttons.
- Status pills: 已发布 green, 草稿中 amber, 已停用 gray, 未配置 red outline.
- Flow nodes: rectangular compact nodes, radius 6px, colored top stripe, connection line arrows. Do not use a blank canvas; this screen is a management console with path preview, not a full designer canvas.
- Tables/lists must have realistic rows, never Lorem Ipsum, never Item 1/2.
- No decorative bokeh, no gradient orbs, no hero section, no marketing language.
- Keep text inside buttons and chips; no overlap; no tiny unreadable text.

[Hard requirements]
- The label「流程定义 2」must be visible in the left sidebar and page title.
- The route note `/workflows-v2` must be visible as a small gray pill in the header.
- Show that formal `/workflows` remains unchanged with the phrase「正式入口未切换」.
- This is one complete module page, not multiple separate pages.
- Do not include mobile UI.
- Do not show the deprecated `/workflow-designer/*` API as the main path; mention only `/workflows/*` if any API path is shown.
- Search must appear only in the flow list control strip, not in top nav or sidebar.
- Include save draft feedback and publish validation feedback on screen.
