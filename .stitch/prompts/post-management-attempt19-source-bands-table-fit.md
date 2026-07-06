Edit the selected uploaded IMAGE2 v2 product screenshot screen into HTML.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not hide source-visible content behind internal scroll.

Preserve the exact top-left IMAGE2 brand mark for this source screenshot:
white `UNIVIEW`, the blue round mark, the vertical divider, and `固定资产管理系统`.
Do not redraw, distort, split, re-space, lowercase, or replace the UNIVIEW wordmark.

Page name: 岗位管理
Menu id: system-post-management
Reference image: org-permission-subpage-07-post-management-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/org-permission-subpage-07-post-management-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-post-management

Frame and shell:
- Fixed desktop viewport: 1585 x 992.
- No page-level horizontal or vertical scroll.
- Body and document must be exactly 1585 x 992.
- Header height is about 48px, left sidebar width is about 211px.
- Active top nav is `系统运营中枢`.
- Active sidebar group is `组织权限`; active item is `岗位管理`.

Source layout bands that must fit in one viewport:
- Content area starts near x=226 and y=74.
- Header/title/action region: y=74..138.
- Green operation status strip: x=226..1572, y=141..178.
- KPI strip: x=226..1572, y=188..252.
- Middle three-column work area: y=263..703.
- Bottom `流程节点解析与发布检查` area: x=226..1572, y=713..936.
- Do not move the bottom area below y=713 and do not let it overlap the middle area.

Critical middle x-bands:
- Left `岗位分类` panel: x=226..393, width 167.
- Center `岗位列表` table panel: x=405..1208, width 803.
- Right `岗位详情` editor panel: x=1220..1572, width 352.
- Keep these three bands. Do not widen the center table beyond x=1208.
- Do not create a horizontal scroll container in the center table.

The center table must show all columns inside x=405..1208, including the rightmost `状态` and `操作` columns:
- radio selector, `岗位`, `岗位编码`, `职责范围`, `审批解析`, `角色联动`, `数据权限`, `交接策略`, `状态`, `操作`.
- Required visible rows and values:
  - `资产管理员`, `FA-AST-0001`, `资产全生命周期管理`, `资产新增审批`, `资产管理员角色包`, `公司级数据`, `离职自动交接`, `已启用`, `编辑`, `复制`, `更多`
  - `资产会计`, `FA-ACC-0002`, `资产核算与账务处理`, `资产入账审批`, `资产会计角色包`
  - `部门负责人`, `FA-DEP-0101`, `部门事务审批`, `部门费用审批`, `部门负责人角色包`
  - `系统管理员`, `SYS-ADM-0001`, `系统配置与维护`, `系统配置审批`, `系统管理员角色包`
  - selected row `CIP专员`, `FA-CIP-0001`, `CIP项目`, `CIP转固验收`, `资产项目角色包`, `项目级数据`, `待确认`
  - `审计岗`, `AUD-STA-0001`, `审计与合规检查`, `审计立项审批`, `已启用`
- Footer must show `共 128 条`, pagination `1 2 3 4 5 ... 13`, and `10 条/页`.

Column-fit hard rule:
- The center table visible wrapper must be at least 796px wide and the table content must be no wider than the visible wrapper.
- Target total table width: 790px max.
- Use compact 11px row text and source-like truncation only where the source truncates.
- Fit columns approximately as:
  selector 32, 岗位 72, 岗位编码 88, 职责范围 95, 审批解析 95, 角色联动 92, 数据权限 80, 交接策略 88, 状态 58, 操作 82.
- The `操作` column must be fully visible; never clip it at the right edge.
- Do not stack table cells vertically.
- Do not turn the table into cards.

Right editor panel must be fully visible, with no internal scroll:
- Title `岗位详情`.
- Required visible fields in order:
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
- Footer buttons visible: `保存岗位`, `影响预览`, `查看审计`.

Bottom area:
- Left card group title: `流程节点解析与发布检查`.
- Four cards: `资产新增审批`, `CIP转固验收`, `报废清退`, `工作交接`.
- Visible card values include `节点数：5`, `候选处理人：3`, `覆盖岗位：6`, `节点数：6`, `候选处理人：4`, `覆盖岗位：5`, `节点数：4`, `候选处理人：3`, `覆盖岗位：4`, `节点数：3`, `候选处理人：2`, `覆盖岗位：5`.
- Status texts: `检查通过`, `检查有警告`.
- Checklist card visible values:
  `岗位编码完整`, `兜底岗位已配置`, `角色包已绑定`, `数据权限已绑定`, `离职交接已覆盖`, `审计策略已开启`.
- Right flow preview visible nodes:
  `流程节点`, `岗位解析`, `候选处理人`, `兜底岗位`, `审计记录`.
- Bottom explanation text visible: `说明：当岗位解析无匹配或候选处理人不可用时，按兜底岗位执行并记录审计。`

Hard failures:
- Any center table horizontal scroll or hidden rightmost `操作` column is a failure.
- Any right editor internal scroll is a failure.
- Any bottom card/checklist/flow preview clipped below y=992 is a failure.
- Lowercase `uniview` is a failure.
- Generic emoji-like icons replacing the source icon style are a failure.
- Page title in English is a failure.
