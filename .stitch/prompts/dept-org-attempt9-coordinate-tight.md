Edit the selected uploaded IMAGE2 v2 screenshot screen into a new DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 部门组织与负责人配置
Menu id: system-dept-org
Reference image: org-permission-subpage-06-dept-org-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/org-permission-subpage-06-dept-org-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-dept-org

Preserve the exact top-left IMAGE2 brand mark for this source: white UNIVIEW, divider, and adjacent subtitle 固定资产管理系统. Do not split, lowercase, redraw, or replace the wordmark.

Canvas:
- Use exactly 1586 x 992 CSS pixels.
- No document scroll and no internal scrollbars for source-visible content.
- Do not generate a doubled 3172 x 1984 coordinate layout.

Exact source geometry:
- Top navigation: x=0 y=0 w=1586 h=57, dark navy. Active top tab 系统运营中枢 at x about 1000.
- Left sidebar: x=0 y=57 w=174 h=859, dark navy. Active group 组织权限 and active item 部门组织. Bottom 收起 at y about 910.
- Main content root: x=174 y=57 w=1412 h=935, white/light gray.
- Header: x=190 y=76, title 部门组织与负责人配置, subtitle 维护部门树、负责人、成本中心、外部组织同步和交接影响，发布前确认审批影响范围。 Top buttons at x about 1027: 新建部门, 同步组织, 差异确认, 保存草稿, 提交校验.
- Filter bar: x=188 y=142 w=1062 h=74, with search placeholder 搜索部门、编码、负责人、成本中心、同步来源, tabs 全部部门, 正常, 负责人变更, 同步差异, counter 8/12.
- Main workspace: y=222 to 693. Three columns:
  1. Tree card x=188 y=222 w=240 h=471.
  2. Department table card x=432 y=222 w=815 h=471.
  3. Detail card x=1263 y=222 w=310 h=471.
- Bottom section: x=188 y=705 w=1385 h=252, not taller. It contains left approval chain, middle checklist, right blue hint card. Orange warning bar at y about 891. Everything visible above y=958.

Tree card visible text:
- Title 组织架构树, icons, refresh.
- Nodes exactly as screenshot: 总部 1, A厂区 7, 资产管理中心 12, 设备管理部 ERP 6, 工程技术中心 钉钉 5, 财务共享中心 ERP 4, 信息技术部 EHR 6.
- Selected row 设备管理部 uses blue left bar and pale blue fill.

Department table:
- Title 部门列表.
- Toolbar buttons: 批量编辑, 负责人变更, 移动, 停用, 导出, gear icon.
- Columns: checkbox, 部门, 编码, 父级路径, 负责人, 成本中心, 同步来源, 状态, 操作.
- Show all eight rows compactly: 设备管理部 DM-0010 张伟 CC-410100 ERP 正常; 工程技术中心 ET-0020 李强 CC-420100 钉钉 负责人变更; 资产会计组 FA-0031 王芳 CC-410110 ERP 正常; CIP项目组 CIP-0032 赵敏 CC-410120 ERP 同步差异; 信息技术部 IT-0040 陈磊 CC-430100 EHR 正常; 财务共享中心 FC-0050 刘洋 CC-440100 ERP 正常; 物流管理组 MM-0051 孙超 CC-410130 ERP 负责人变更; 运维支持组 OS-0052 周俊 CC-410140 钉钉 正常.
- Footer: 共 8 条, page 1, 20 条/页, 跳至 1 页.

Right detail card:
- Title 部门详情, current object 设备管理部.
- All fields must be fully visible without clipping inside y=222..693:
  部门名称 设备管理部
  部门编码 DM-0010
  父级路径 总部 / A厂区 / 资产管理中心
  成本中心 CC-410100
  部门负责人 张伟
  同步来源 ERP
  同步策略 每日增量同步
  部门状态 正常
  审批影响 中（4条待办，2条审批）
  交接规则 按组织规则执行
  是否启用 toggle on
- Bottom buttons inside this card: 保存部门, 差异确认, 查看审计.
- Use compact 30-34px field rows. Do not stop after 同步来源.

Bottom section:
- Left title: 审批影响链路与发布检查.
- Four flow cards: CIP立项, 费用归集, 转固验收, 工作交接 with arrows.
- Orange warning: 负责人变更会影响待办和审批节点，请先生成影响快照。 Button: 生成影响快照.
- Checklist title: 发布检查清单; items 父级路径有效, 成本中心已绑定, 负责人已确认, 同步差异已处理, 审批影响已预览, 交接规则已配置 with pass/pending statuses.
- Right hint card: 提示说明 and button 查看差异详情.

Critical fixes from prior candidate:
- Do not make sidebar 193px wide; source sidebar is 174px wide.
- Do not hide the lower right fields. All right form rows and buttons are required.
- Do not make the filter/search row overly tall or sparse.
- Do not use emoji icons; use simple line icons matching the source.
