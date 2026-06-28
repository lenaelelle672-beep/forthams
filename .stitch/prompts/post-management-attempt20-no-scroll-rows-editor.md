Edit the selected uploaded IMAGE2 v2 product screenshot screen into HTML.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 岗位管理
Menu id: system-post-management
Reference image: org-permission-subpage-07-post-management-v2.png
Source size: 1585 x 992
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/org-permission-subpage-07-post-management-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-post-management

Critical correction from the last failed candidate:
- Do not create `overflow-auto`, `overflow-y-auto`, or hidden scroll containers inside `岗位列表`.
- Do not create scroll inside `岗位详情`.
- The `岗位列表` table must show header + six visible rows + footer at once.
- The right editor must show every field through `审计策略-标准（STA-STD-01）` and the footer buttons at once.

Brand and shell:
- Preserve the source top-left brand exactly: one-line white `UNIVIEW`, blue round mark, divider, and one-line `固定资产管理系统`.
- Do not split `固定资产管理系统` onto two lines.
- Do not use lowercase `uniview`.
- Active top navigation: `系统运营中枢`.
- Active sidebar group: `组织权限`.
- Active sidebar item: `岗位管理`.

Fixed source coordinate bands:
- Page: 1585 x 992, no document scroll.
- Left sidebar width: 211px.
- Content left edge: x=225.
- Header/title/actions: y=66..123.
- Green status strip: y=124..158.
- KPI strip: y=171..251.
- Middle block: y=263..704.
- Bottom block: y=715..976.
- Left category panel: x=225..392.
- Center table panel: x=404..1209.
- Right detail panel: x=1220..1572.

Middle filter/search row:
- y=275..312 only.
- Search input at x=416..697, with text `搜索岗位、编码、职责、流程节点...`.
- Tabs/buttons at x=709..1131: `全部岗位`, `已启用`, `待确认`, `流程引用`, `权限联动`.
- Keep this row compact. Do not use more than 38px height.

Center `岗位列表` table panel:
- Panel header/title `岗位列表`: y=328..347.
- Table header: y=348..388, height about 40.
- Six body rows: y=389..640, about 42px each.
- Footer/pagination: y=641..701.
- No vertical scroll and no horizontal scroll.
- No hidden overflow wrapper around the table body.
- Table content width must fit inside x=404..1209.
- All ten columns visible:
  radio selector, `岗位`, `岗位编码`, `职责范围`, `审批解析`, `角色联动`, `数据权限`, `交接策略`, `状态`, `操作`.
- Fit column widths within 794px:
  selector 30, 岗位 76, 岗位编码 88, 职责范围 96, 审批解析 96, 角色联动 92, 数据权限 82, 交接策略 88, 状态 58, 操作 80.
- Use compact 11px text. Keep row text single-line or source-like two-line only when the source does it.
- Do not stack cells vertically.
- Do not turn rows into cards.

Required visible table values:
- `资产管理员`, `FA-AST-0001`, `资产全生命周期管理`, `资产新增审批`, `资产管理员角色包`, `公司级数据`, `离职自动交接`, `已启用`, `编辑`, `复制`, `更多`
- `资产会计`, `FA-ACC-0002`, `资产核算与账务处理`, `资产入账审批`, `资产会计角色包`
- `部门负责人`, `FA-DEP-0101`, `部门事务审批`, `部门费用审批`, `部门负责人角色包`
- `系统管理员`, `SYS-ADM-0001`, `系统配置与维护`, `系统配置审批`, `系统管理员角色包`
- selected `CIP专员`, `FA-CIP-0001`, `CIP项目`, `CIP转固验收`, `资产项目角色包`, `项目级数据`, `待确认`
- `审计岗`, `AUD-STA-0001`, `审计与合规检查`, `审计立项审批`, `审计角色包`
- Footer: `共 128 条`, `1`, `2`, `3`, `4`, `5`, `...`, `13`, `10 条/页`.

Right `岗位详情` panel:
- No scroll and no clipped lower fields.
- Panel x=1220..1572, y=263..704.
- Header `岗位详情` y=278..302.
- Compact form rows from y=319 to y=620. Each row height no more than 28px; row gap no more than 8px.
- Required fields and values, all visible:
  `岗位名称` = `CIP专员`
  `岗位编码` = `FA-CIP-0301`
  `职责范围` = `CIP项目`
  `审批解析` = `CIP转固验收`
  `兜底岗位` = `CIP负责人（FA-CIP-0302）`
  `角色联动` = `资产项目角色包`
  `数据权限联动` = `项目级数据`
  `交接策略` = `离职自动交接`
  `审计策略` = `审计策略-标准（STA-STD-01）`
  `启用状态`
- Footer buttons y=650..687: `保存岗位`, `影响预览`, `查看审计`.
- Use fullwidth Chinese parentheses exactly: `（STA-STD-01）`, not `(STA-STD-01)`.

Bottom `流程节点解析与发布检查` area:
- Starts around y=715. Do not let it overlap the middle block.
- Fully visible inside y<=976.
- Four cards: `资产新增审批`, `CIP转固验收`, `报废清退`, `工作交接`.
- Checklist visible: `岗位编码完整`, `兜底岗位已配置`, `角色包已绑定`, `数据权限已绑定`, `离职交接已覆盖`, `审计策略已开启`.
- Flow preview nodes visible: `流程节点`, `岗位解析`, `候选处理人`, `兜底岗位`, `审计记录`.
- Explanation visible: `说明：当岗位解析无匹配或候选处理人不可用时，按兜底岗位执行并记录审计。`

Hard failure conditions:
- Any document scroll is failure.
- Any horizontal scroll in `岗位列表` is failure.
- Any vertical scroll in `岗位列表` is failure.
- Any scroll in `岗位详情` is failure.
- Missing exact `审计策略-标准（STA-STD-01）` is failure.
- Clipped `操作` column is failure.
- Clipped bottom flow/checklist/explanation is failure.
- Generic emoji-like icons are failure.
