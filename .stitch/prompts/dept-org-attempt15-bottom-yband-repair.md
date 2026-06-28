Repair the existing generated DESIGN screen only. Do not redesign.

Target page: 部门组织与负责人配置 / system-dept-org.
Source of truth: `org-permission-subpage-06-dept-org-v2.png`.

Current successful parts to keep:
- All 8 department table rows are now visible.
- Right form fields and buttons are now visible.
- Top shell/sidebar/content x-bands are acceptable.

Current remaining failure:
- The top three-column workspace is too tall and leaves a large blank area under the table. It pushes the bottom `审批影响链路与发布检查` / `发布检查清单` area too low, so the bottom checklist is clipped in the 1586 x 992 screenshot.
- Counter still renders as spaced `8 / 12`; it must be exact `8/12`.

Mandatory y-band repair:
- Keep top title/action/search areas, but compress the top three-column workspace to end at y=692.
- Left `组织架构树`: y=162..835 currently too tall. Set visible panel to y=162..692.
- Center `部门列表`: y=162..835 currently too tall. Set visible panel to y=162..692. Keep all 8 table rows visible and move pagination immediately under the 8 rows, no giant blank area.
- Right `部门详情`: y=162..835 currently too tall. Set visible panel to y=162..692. Keep all fields and three buttons visible by using 26-28px controls and tight gaps.
- Bottom workspace must start around y=706 and end by y=948:
  - left impact chain card with four cards and orange warning visible,
  - middle `发布检查清单` all six rows visible,
  - right `提示说明` card and `查看差异详情` button visible.

Text repair:
- Counter must be exact `8/12`, not `8 / 12`.
- Keep exact warning `负责人变更会影响待办和审批节点，请先生成影响快照。`

Overflow rule:
- Remove internal scroll intent from center and right panels. Do not leave `overflow-y-auto` or `overflow-auto`.
- Do not solve by hiding overflow; solve by actual y-band compression.

Final self-check:
- In a real 1586 x 992 screenshot, all 8 rows, all right fields/buttons, all four bottom cards, all six checklist rows, orange warning, and hint card are fully visible.
