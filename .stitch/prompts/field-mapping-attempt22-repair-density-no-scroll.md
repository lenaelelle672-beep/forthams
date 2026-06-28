Repair the selected generated DESIGN screen. Do not redesign it.
The IMAGE2 v2 reference remains the source of truth:
`integration-subpage-03-field-mapping-v2.png`, 1586 x 992.

This is a 100/100 pixel-fidelity repair task.
Keep the current shell, sidebar, title, filter row, summary cards, panel x positions, colors, borders, and business data.
Only repair density, clipping, native selects, bottom-row visibility, and connector geometry.

Hard coordinate targets:
- Root stays exactly 1586 x 992, no page scroll.
- Middle panels stay exactly y=256..704.
- Bottom cards stay exactly y=713..964.
- No element inside these panels may use `overflow:auto` or `overflow:scroll`.
- Replace scrollable content with smaller typography and tighter row heights.

Left panel repair:
- The `字段映射视图` table currently shows only 3 rows; this is wrong.
- It must show all 10 rows inside the 448px panel:
  `asset_class`, `asset_no`, `asset_name`, `amount`, `currency`, `emp_no`, `dept_code`, `purchase_date`, `supplier_id`, `contract_no`.
- Use 28px header height, 30px body row height, 10px-11px font, compact line-height.
- Footer pagination must remain visible at the bottom of the panel.
- Do not stack Chinese text vertically. Keep table cells horizontal.

Center canvas repair:
- Keep 8 left nodes and 8 right nodes visible.
- Current connector paths are too flat and partially off-screen.
- Redraw SVG connectors as visible Bezier curves with vertical displacement, crossing between rows:
  `asset_class -> 资产小类`, `asset_no -> 资产编码`, `asset_name -> 资产名称`, `amount -> 原值`, `currency -> 币种`, `emp_no -> 工号`, `dept_code -> 部门编码`, `purchase_date -> 取得日期`.
- At least 6 paths must have visible vertical arc height greater than 10px.

Right editor repair:
- Remove all native `<select>` elements from the editor. Use `div`/`span` dropdown-looking boxes so Chrome does not render clipping dots or hidden values.
- All right editor fields must fit between y=256 and y=704.
- Required visible values:
  `MES 设备绑定`, `MES`, `/api/asset/bind`, `asset_class`, `资产小类`, `映射表`, `配置`,
  `A: 电子设备，B: 机械设备，C: 办公设备，D: 其他`, `规则有效`,
  `请输入默认值`, `必填校验`, `进入数据异常队列`, `记录变更明细`,
  buttons `保存草稿`, `提交校验`, `样例校验`.
- Use 22px field height, 6px vertical gaps, 10px-11px label font.

Bottom row repair:
- The current bottom cards are clipped and the sample table shows only 3 rows; this is wrong.
- All four bottom cards must fully fit inside y=713..964.
- Sample data card must show 5 rows, no ellipsis:
  1. `A`, `M2024050001`, `设备 A`, `12000.00`, `CNY`, `电子设备`, `ZC2024050001`, `设备 A`, `12000.00`, `人民币`
  2. `B`, `M2024050002`, `设备 B`, `35000.00`, `CNY`, `机械设备`, `ZC2024050002`, `设备 B`, `35000.00`, `人民币`
  3. `A`, `M2024050003`, `设备 C`, `8800.00`, `CNY`, `电子设备`, `ZC2024050003`, `设备 C`, `8800.00`, `人民币`
  4. `C`, `M2024050004`, `设备 D`, `2200.00`, `CNY`, `办公设备`, `ZC2024050004`, `设备 D`, `2200.00`, `人民币`
  5. `D`, `M2024050005`, `设备 E`, `1500.00`, `CNY`, `其他`, `ZC2024050005`, `设备 E`, `1500.00`, `人民币`
- Use 9px text and 27px row height in the sample table; it is acceptable to reduce column padding to 4px.
- Missing card must show both rows and the link `进入异常队列`.
- Conflict card must show `asset_no`, `重复值`, `资产编码 M2024050002 在 2 条记录中重复`, badge `高`, and link `查看冲突详情`.
- Publish gate must show all five checklist rows and disabled button:
  `字段映射校验 通过`
  `转换规则校验 通过`
  `样例数据校验 通过`
  `缺失字段处理 警告（2）`
  `冲突检测 失败（1）`
  `发布`

Reject the current failure modes:
- no 32px+ row heights in dense tables;
- no scroll containers;
- no native select widgets;
- no bottom content below y=964;
- no missing row 5;
- no missing `警告（2）` or `失败（1）`.
