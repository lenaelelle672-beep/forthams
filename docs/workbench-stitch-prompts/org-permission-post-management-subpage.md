[Context & Style]
Desktop web admin screen for a Chinese fixed asset management system, inside "系统运营中枢 / 组织权限". Recreate IMAGE2 reference `frontend/public/mock/workspace-preview/asset-kit-v8/system-hub/subpages/org-permission-subpage-07-post-management-v2.png`. Create the dedicated subpage "岗位管理与审批解析配置". This is not a generic settings template. It must feel like an operations console for maintaining post definitions, approval resolver rules, role linkage, data permission linkage, fallback post, handover policy, and audit policy. Use a refined enterprise workbench style: white canvas, steel blue accents, compact dense tables, subtle green/orange/red status chips, 8px radius, no marketing hero, no KPI dashboard exaggeration, no purple gradient, no decorative blobs.

[Layout]
Full desktop app shell, 1585x992. Include the UNIVIEW fixed asset management top navigation and the System Hub left sidebar. Highlight top navigation "系统运营中枢" and sidebar "组织权限 / 岗位管理". Do not place search in the top navigation or left sidebar; search belongs only inside this page.

Top header with title "岗位管理与审批解析配置", subtitle "维护岗位编码、职责范围、审批岗位解析、角色联动、数据权限联动和离职交接策略", and actions: "新建岗位", "影响预览", "保存草稿", "提交校验".
Below header place a slim operation status strip: "操作状态 / 已加载岗位规则", last validation time, and a validation message.
Below header place compact KPI strip: "岗位数量 128", "流程引用 56", "权限联动 94", "待确认岗位 16".
Below KPI place page-level search/filter bar with placeholder "搜索岗位、编码、职责、流程节点、角色包..." and segmented tabs: "全部岗位", "已启用", "待确认", "流程引用", "权限联动".
Main work area is three columns:
1. Left: "岗位分类" grouped by 资产管理, 财务处理, 部门审批, 系统运维, CIP项目, 设备运维. Each group has child posts and counts/status chips.
2. Middle: dense "岗位列表" table. Columns: 岗位, 岗位编码, 职责范围, 审批解析, 角色联动, 数据权限, 交接策略, 状态, 操作. Include selected row "CIP专员 FA-CIP-0301" plus rows 资产管理员, 资产会计, 部门负责人, 系统管理员, 审计岗.
3. Right: "岗位详情" inspector with editable fields: 岗位名称, 岗位编码, 职责范围, 审批解析, 兜底岗位, 角色联动, 数据权限联动, 交接策略, 审计策略, 启用状态. Include actions 保存岗位, 影响预览, 查看审计.
Bottom: "流程节点解析与发布检查" with workflow cards for 资产新增审批, CIP转固验收, 报废清退, 工作交接; publish checklist; and a flow diagram: 流程节点 -> 岗位解析 -> 候选处理人 -> 兜底岗位 -> 审计记录.
Add an in-page "影响与审计记录" ledger below the approval resolver simulation. It must record each 影响预览 and 查看审计 action with batch number, post name, action, status, impact summary, and timestamp. This ledger is part of the current page, not a modal and not a generic placeholder route.

[Components]
Use realistic Chinese UI text. Use table-led B2B density and strong operational affordances. The page must clearly show its own search and filter area; no top navigation search and no left-navigation search. Avoid placeholder lorem ipsum and avoid a generic settings-card layout.

## 硬性复刻要求
- 顶部业务视角和左侧导航不得放搜索框；搜索/筛选只能出现在当前专属页面内容区。
- 页面必须包含可真人模拟的保存草稿动作，并在操作反馈区显示保存结果。
- 页面必须包含可真人模拟的提交校验/发布复核动作，并在操作反馈区显示校验或复核结果。
- 影响预览和查看审计必须在当前岗位管理页生成岗位影响与审计记录，记录审批解析、角色联动、数据权限、交接策略和审计策略。
- 新建、编辑、搜索、详情预览、保存、提交必须围绕当前业务对象完成，不得复用通用占位模板。
