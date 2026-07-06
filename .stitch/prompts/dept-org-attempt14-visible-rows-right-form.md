Repair the existing generated DESIGN screen only. Do not redesign the page.

Target page: 部门组织与负责人配置 / system-dept-org.
Source of truth remains the uploaded IMAGE2 screenshot `org-permission-subpage-06-dept-org-v2.png`.

Current failure to repair:
- Browser screenshot is 1586 x 992, but the center department table still has an internal scroll/clip area and does not visibly show all 8 source rows.
- Right `部门详情` uses internal vertical scroll and hides lower source fields behind the button area.
- Counter text must be exact `8/12`, not `8 / 12`.

Keep:
- Existing top nav, left sidebar, page title/action row, bottom impact chain, checklist, and instruction card.
- Current three-column x positions.
- Existing source data and row order.

Mandatory repairs:
- Remove internal scroll containers from the left tree, center table, and right detail body. No `overflow-y-auto`, no `overflow-auto`, no custom scroll body hiding source content.
- Center table must visibly show these 8 rows in the 1586 x 992 screenshot:
  `设备管理部`, `工程技术中心`, `资产会计组`, `CIP项目组`, `信息技术部`, `财务共享中心`, `物资管理组`, `运维支持组`.
- Reduce center table row height to about 34-38px and keep pagination below the 8 rows without covering them.
- Right detail must visibly show all fields before the buttons:
  `部门名称`, `部门编码`, `父级路径`, `成本中心`, `部门负责人`, `同步来源`, `同步策略`, `部门状态`, `审批影响`, `交接规则`, `是否启用`.
- Right detail buttons `保存部门`, `差异确认`, `查看审计` must remain visible.
- Counter must be exactly `8/12`.

Density rules:
- Use 11-12px table text and 28px form controls.
- Use 4-6px vertical form gaps.
- If space is tight, reduce padding inside table cells and form rows. Do not hide rows or lower fields.

Final self-check:
- A real 1586 x 992 screenshot shows all 8 rows, all right fields, the three right buttons, bottom four impact cards, checklist, and orange warning.
- There is no page-level scroll and no internal scroll panel for the center table or right detail.
