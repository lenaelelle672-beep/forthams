Edit the selected post-management DESIGN screen into a new persistent Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot `org-permission-subpage-07-post-management-v2.png` remains the only source of truth.
Use the selected attempt10 screen only as the closest visual baseline.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Create a NEW persistent DESIGN screen. Do not return only DOM operations.

Reference:
- Page name: 岗位管理
- Menu id: system-post-management
- Reference image: org-permission-subpage-07-post-management-v2.png
- Source viewport: 1585 x 992 CSS pixels
- Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-post-management

Preserve the exact top-left IMAGE2 brand mark: white `UNIVIEW`, the source-visible divider/lockup, and `固定资产管理系统`. Do not redraw, distort, split, re-space, lowercase, or replace the UNIVIEW wordmark.

Keep from the selected baseline:
- Top shell and sidebar visual structure.
- Title: `岗位管理与审批解析配置`.
- Top buttons: `新建岗位`, `影响预览`, `保存草稿`, `提交校验`.
- Status bar, KPI row, left category tree, center `岗位列表`, right `岗位详情`, and bottom `流程节点解析与发布检查`.
- All table rows and values, especially:
  `FA-CIP-0301`, `CIP专员`, `CIP转固验收`, `资产项目角色包`, `审计策略已开启`.
- Forbidden text must stay absent: `审计策略未开启`.
- Keep all table text horizontal. Do not stack table cells vertically.

Only repair the failed geometry:
- The document/body must be exactly 1585 x 992, not 995px tall.
- No page-level scroll and no hidden content below y=992.
- Bottom section must sit fully inside the source viewport.
- Right `岗位详情` buttons must not be covered by the bottom section.

Source geometry budget:
- Top nav: y=0..48.
- Header/title: y=72..137.
- Status strip: y=147..181.
- KPI row: y=189..253.
- Middle workspace: y=264..703.
  - Left tree x=226..392.
  - Center table x=406..1208.
  - Right detail x=1220..1572.
- Bottom workflow/check section: y=714..936.
- Sidebar collapse control remains near y=930, inside viewport.

Repair instructions:
- Move the bottom `流程节点解析与发布检查` card up so its bottom is <=936.
- Reduce only vertical padding/gaps in the middle and bottom cards by a few pixels.
- If necessary, reduce the right `岗位详情` input height by 2-4px and form row gaps by 2px.
- Keep right detail fields visible through `启用状态` and the buttons `保存岗位`, `影响预览`, `查看审计`.
- Keep bottom cards visible:
  `资产新增审批`, `CIP转固验收`, `报废清退`, `工作交接`;
  checklist `岗位编码完整`, `兜底岗位已配置`, `角色包已绑定`, `数据权限已绑定`, `离职交接已覆盖`, `审计策略已开启`;
  process diagram `流程节点`, `岗位解析`, `候选处理人`, `兜底岗位`, `审计记录`.

Acceptance gates:
- Browser CSS viewport/document: 1585 x 992.
- `documentElement.scrollHeight <= 992`, `body.scrollHeight <= 992`.
- Required strings visible: `FA-CIP-0301`, `审计策略已开启`, `岗位管理与审批解析配置`, `岗位详情`, `流程节点解析与发布检查`.
- Forbidden strings absent: `审计策略未开启`.
- No visible overlap between the right `岗位详情` action buttons and the bottom workflow section.
