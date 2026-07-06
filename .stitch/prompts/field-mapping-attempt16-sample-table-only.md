Edit this candidate into a new persistent Stitch DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `integration-subpage-03-field-mapping-v2.png` is the only source of truth.
Do not redesign the page. Keep attempt15's improved overall layout, right editor visibility, bottom four-card row, and exact `警告（2）` / `失败（1）` labels.

Page name: 字段映射工作台
Menu id: system-field-mapping
Canvas: exactly 1586 x 992 CSS pixels.

Repair only the bottom-left `样例数据预览（前 5 行）` table.

Source requirements for the sample table:
- Card stays at source position: x≈194, y≈716, width about 555px, height about 250px.
- The table must visually look like the IMAGE2 source grid with thin vertical separators and readable cells.
- Do not let adjacent text touch or merge. Every value must sit in its own cell.
- Use 5 source columns and 5 target columns:
  Source group `源数据（MES）`: `asset_class`, `asset_no`, `asset_name`, `amount`, `currency`.
  Target group `目标数据（固定资产）`: `资产小类`, `资产编码`, `资产名称`, `原值`, `币种`.
- Use fixed table layout. Suggested column widths inside the 555px card:
  `asset_class` 42px, `asset_no` 82px, `asset_name` 50px, `amount` 64px, `currency` 36px,
  `资产小类` 54px, `资产编码` 82px, `资产名称` 50px, `原值` 58px, `币种` 37px.
- Use 7.5px to 8px font, 16px to 18px row height, no text wrapping.
- If needed, slightly reduce horizontal padding to 1px, but keep visible vertical grid lines.
- Show all five rows fully:
  1. `A`, `M2024050001`, `设备 A`, `12000.00`, `CNY`, `电子设备`, `ZC2024050001`, `设备 A`, `12000.00`, `人民币`
  2. `B`, `M2024050002`, `设备 B`, `35000.00`, `CNY`, `机械设备`, `ZC2024050002`, `设备 B`, `35000.00`, `人民币`
  3. `A`, `M2024050003`, `设备 C`, `8800.00`, `CNY`, `电子设备`, `ZC2024050003`, `设备 C`, `8800.00`, `人民币`
  4. `C`, `M2024050004`, `设备 D`, `2200.00`, `CNY`, `办公设备`, `ZC2024050004`, `设备 D`, `2200.00`, `人民币`
  5. `D`, `M2024050005`, `设备 E`, `1500.00`, `CNY`, `其他`, `ZC2024050005`, `设备 E`, `1500.00`, `人民币`
- `查看全部样例` must remain visible at the bottom right of this sample card.

Do not change:
- Top shell, sidebar, page title, filters, four mapping cards.
- Upper `字段映射视图`, `映射关系画布`, or right editor geometry.
- Bottom `缺失字段异常`, `冲突检测`, or `发布门禁` card positions.
- Exact `警告（2）` and `失败（1）`.

Hard failures:
- Any sample value is merged with a neighbor, ellipsized, hidden, wrapped, or vertical.
- The table shows fewer than 5 rows.
- Page-level scroll appears.
- The rendered screenshot is not exactly 1586 x 992.
