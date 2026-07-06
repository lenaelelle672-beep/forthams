Repair the selected generated DESIGN screen. Keep the current shell/sidebar/header/cards/panels.
Do not redesign. This is a strict density repair for `字段映射`.

The current screen still fails because table rows are too tall and hidden. Convert the dense tables from auto table layout into fixed-position visual grids made of div rows. Do not rely on HTML table auto-sizing.

Global constraints:
- Root must remain exactly 1586 x 992.
- No page scroll, no internal scroll, no overflow:auto/scroll.
- No native select elements.
- Keep panel coordinates unchanged from the current screen.

Left panel `字段映射视图` fixed grid:
- Use a div-based grid, not `<table>`.
- Panel x≈203 y≈255 w≈520 h≈448.
- Header row y=306 h=28.
- Ten body rows must fit between y=334 and y=657, one line per row, row height 31px.
- Row y positions:
  1 y=334 `asset_class`
  2 y=365 `asset_no`
  3 y=396 `asset_name`
  4 y=427 `amount`
  5 y=458 `currency`
  6 y=489 `emp_no`
  7 y=520 `dept_code`
  8 y=551 `purchase_date`
  9 y=582 `supplier_id`
  10 y=613 `contract_no`
- Footer pagination y=670..698.
- Text must be horizontal; use 10px font and `white-space: nowrap`.
- Status badges may be small vertical-looking green pills only if source does, but source field names must stay horizontal and readable.

Bottom sample card fixed grid:
- Card x≈203 y≈713 w≈555 h≈251.
- Use div-based grid with 5 rows, not `<table>`.
- Header title y≈728.
- Column header y≈767 h=38.
- Data rows:
  row1 y=807
  row2 y=833
  row3 y=859
  row4 y=885
  row5 y=911
- Use 9px font, 24px row height, line-height 12px, no ellipsis.
- Row 5 must be visible inside the card:
  `D`, `M2024050005`, `设备 E`, `1500.00`, `CNY`, `其他`, `ZC2024050005`, `设备 E`, `1500.00`, `人民币`.
- Keep link `查看全部样例` bottom right.

Center connector repair:
- Current paths look horizontal. Redraw with visible cubic Bezier vertical displacement.
- Use SVG paths with d values like `M startX startY C midX startY-40 midX endY+40 endX endY`.
- At least 6 connectors must have bounding box height > 10px and visibly cross.
- Preserve node labels and legend.

Right editor text repair:
- Ensure note text appears exactly as one source string:
  `A: 电子设备，B: 机械设备，C: 办公设备，D: 其他`
- Keep `规则有效`.
- Keep visible values:
  `MES 设备绑定`, `MES`, `/api/asset/bind`, `asset_class`, `资产小类`, `映射表`, `必填校验`, `进入数据异常队列`, `记录变更明细`.

Bottom side cards:
- Keep current good visibility for `缺失字段异常`, `冲突检测`, and `发布门禁`.
- Do not move these cards below y=964.
- Preserve exact `警告（2）` and `失败（1）`.

Hard fail if:
- any of the 10 left table row names are absent from the left panel;
- `M2024050005` or `ZC2024050005` is not visible in the sample card;
- connectors are still horizontal;
- the right editor uses a native select or clips values.
