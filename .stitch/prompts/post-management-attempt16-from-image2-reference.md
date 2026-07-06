Edit the selected IMAGE/reference screen into a new persistent Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The selected uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not hide required content behind scroll if the uploaded screenshot shows it.

Page name: 岗位管理
Menu id: system-post-management
Reference image: org-permission-subpage-07-post-management-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/org-permission-subpage-07-post-management-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-post-management

Preserve the exact top-left IMAGE2 brand mark for this source:
- white `UNIVIEW` wordmark
- the source-visible blue circular mark next to it
- the vertical divider
- `固定资产管理系统`
Do not redraw, distort, split, re-space, or replace the UNIVIEW lockup.

Fixed frame:
- Canvas and CSS viewport must be exactly 1585 x 992.
- The document height must be exactly 992; no page-level vertical scroll.
- No internal scroll containers in any visible card or form.
- No clipped content at the right panel or the bottom section.
- Do not introduce hidden overflow that cuts the buttons, form fields, card bottoms, or process diagram.

Required visible source structure:
- Top nav y=0..48 with active `系统运营中枢`.
- Sidebar x=0..211 y=48..992 with active `岗位管理`.
- Main content x=226..1572.
- Header `岗位管理与审批解析配置` y=72..137.
- Status strip y=141..181, including `操作状态`, `已加载岗位规则`, `最后校验时间：2025-05-15 10:24:31`, and `校验通过：未发现阻断性问题，建议提交校验。`.
- KPI row y=189..253 with `岗位数量 128`, `流程引用 56`, `权限联动 94`, `待确认岗位 16`.
- Middle workspace y=264..703:
  - Left `岗位分类` card x=226..393.
  - Center `岗位列表` card x=405..1209.
  - Right `岗位详情` card x=1221..1572.
- Bottom `流程节点解析与发布检查` card x=226..1572 y=714..936.
- Bottom-left collapse control visible around y=930.

Middle workspace details:
- The center card must show search, segmented filters, table, six visible rows, and pagination in the same vertical space as the source.
- Search placeholder text: `搜索岗位、编码、职责、流程节点、角色包...`
- Filter labels: `全部岗位`, `已启用`, `待确认`, `流程引用`, `权限联动`.
- Table columns: `岗位`, `岗位编码`, `职责范围`, `审批解析`, `角色联动`, `数据权限`, `交接策略`, `状态`, `操作`.
- Keep these rows visible: `资产管理员`, `资产会计`, `部门负责人`, `系统管理员`, `CIP专员`, `审计岗`.
- Keep these source values visible: `FA-CIP-0001`, `CIP专员`, `CIP项目`, `CIP转固验收`, `资产项目角色包`, `项目级数据`, `离职自动交接`.
- Pagination/footer must be inside the center card around y=660..690, with `共 128 条`, pages `1 2 3 4 5 ... 13`, and `10 条/页`.

Right detail panel must be fully visible inside y=264..703:
- Title `岗位详情`.
- Fields and values in this order:
  - `岗位名称` `CIP专员`
  - `岗位编码` `FA-CIP-0301`
  - `职责范围` `CIP项目`
  - `审批解析` `CIP转固验收`
  - `兜底岗位` `CIP负责人（FA-CIP-0302）`
  - `角色联动` `资产项目角色包`
  - `数据权限联动` `项目级数据`
  - `交接策略` `离职自动交接`
  - `审计策略` `审计策略-标准（STA-STD-01）`
  - `启用状态`
- Buttons at the bottom of this panel must be visible and not clipped: `保存岗位`, `影响预览`, `查看审计`.

Bottom section must be fully visible inside y=714..936:
- Title `流程节点解析与发布检查`.
- Four workflow cards: `资产新增审批`, `CIP转固验收`, `报废清退`, `工作交接`.
- Checklist items: `岗位编码完整`, `兜底岗位已配置`, `角色包已绑定`, `数据权限已绑定`, `离职交接已覆盖`, `审计策略已开启`.
- Process diagram nodes: `流程节点`, `岗位解析`, `候选处理人`, `兜底岗位`, `审计记录`.
- Explanatory sentence: `说明：当岗位解析无匹配或候选处理人不可用时，按兜底岗位执行并记录审计。`

Visual fidelity rules:
- Preserve the source white background, pale blue active sidebar state, thin blue outlines, compact table density, 4px to 8px radii, and exact source-like icon scale.
- Use horizontal Chinese table text; do not stack characters vertically.
- Keep the same source proportions. Do not make the bottom card too tall, and do not push it below the viewport.
- Forbidden text: `审计策略未开启`.

Final self-check before completion:
- Viewport is 1585 x 992.
- `document.documentElement.scrollHeight` is 992.
- All right-panel buttons are visible.
- All bottom workflow cards, checklist items, and process nodes are visible.
- The result looks like a direct HTML transcription of the uploaded IMAGE2 screenshot, not a generic admin dashboard.
