[Context & Style]
Desktop web admin screen for a Chinese fixed asset management system, inside "系统运营中枢 / 组织权限". Use IMAGE2 source `org-permission-subpage-06-dept-org-v2.png` to recreate the dedicated subpage "部门组织与负责人配置". This is not a generic settings template. It must feel like an operations console for maintaining department hierarchy, department owner, EHR/钉钉/ERP sync differences, cost center, approval impact, and handover rules. Use a refined enterprise workbench style: white canvas, steel blue accents, compact dense tables, subtle green/orange/red status chips, 8px radius, no marketing hero, no KPI dashboard exaggeration, no purple gradient, no decorative blobs.

[Layout]
Full System Hub desktop page, 1586x992. Include the dark top navigation with five independent entries: 资产运营总览 / 数据监控中心 / 资产运维中心 / 风险预警中心 / 系统运营中枢, with 系统运营中枢 highlighted. Include the System Hub left navigation, 组织权限 expanded, 部门组织 highlighted. Do not place search in the top navigation or left navigation; search belongs only to this page content.

Main content header with title "部门组织与负责人配置", short subtitle "维护部门树、负责人、成本中心、外部组织同步和交接影响", and actions: "新建部门", "同步组织", "差异确认", "保存草稿", "提交校验".
Below header place a compact KPI strip: "部门节点 256", "负责人覆盖 92.6%", "同步差异 18", "交接影响 7".
Below KPI place one page-level search/filter bar with search placeholder "搜索部门、编码、负责人、成本中心、同步来源" and segmented tabs: "全部部门", "正常", "负责人变更", "同步差异".
Main work area is three columns:
1. Left: "组织架构树" showing 总部, A厂区, 制造中心, 生产一部, 设备管理部, 工程技术中心, 财务共享中心. Include source tags EHR / 钉钉 / ERP and node counts.
2. Middle: dense "部门列表" table. Columns: 部门, 编码, 父级路径, 负责人, 成本中心, 状态. Include selected row "设备管理部 A0503" and rows with status 正常 / 负责人变更 / 同步差异. Add toolbar actions 批量编辑, 负责人变更, 移动, 停用, 导出.
3. Right: "部门详情" inspector with editable fields: 部门名称, 编码, 父级路径, 成本中心, 部门负责人, 同步来源, 同步策略, 部门状态, 审批影响, 交接规则. Include publish checklist "发布前检查清单" with 6/7 status.
Bottom under the middle table: "审批影响链路" showing cards and arrows: CIP立项 -> 费用归集 -> 转固验收 -> 工作交接, with affected counts and statuses.
Below the impact lane include "变更与同步记录". Clicking table toolbar actions like "负责人变更", "停用", "批量编辑", "移动", or "导出" must not open generic placeholder dialogs. The current page operation feedback should update, and the action must append a record to "变更与同步记录" with batch number, department, action, state, impact, and time.

[Components]
Use realistic Chinese UI text. Use icons only where useful. Tables must be readable and action-oriented. Avoid placeholder lorem ipsum. The page must clearly show search belongs to this page, not to the left navigation.

## 硬性复刻要求
- 顶部业务视角和左侧导航不得放搜索框；搜索/筛选只能出现在当前专属页面内容区。
- 页面必须包含可真人模拟的保存草稿动作，并在操作反馈区显示保存结果。
- 页面必须包含可真人模拟的提交校验/发布复核动作，并在操作反馈区显示校验或复核结果。
- 新建、编辑、搜索、详情预览、保存、提交必须围绕当前业务对象完成，不得复用通用占位模板。
- 负责人变更、停用、批量编辑、移动和导出必须可真人模拟，并写入本页「变更与同步记录」，不得只弹通用预览弹窗。
