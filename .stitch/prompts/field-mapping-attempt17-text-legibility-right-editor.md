Edit this candidate into a new persistent Stitch DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
Use `integration-subpage-03-field-mapping-v2.png` as the only source of truth.
Keep attempt16's improved geometry, bottom grid, full-width `警告（2）` / `失败（1）`, and five-row sample table.

Canvas: exactly 1586 x 992 CSS pixels.
Page: 字段映射工作台, menu `system-field-mapping`.

Repair only visible text legibility in two areas:

1. Bottom-left `样例数据预览（前 5 行）` table:
   - Keep five rows and vertical grid lines.
   - Do not clip the last digit of codes.
   - `M2024050001` through `M2024050005` must be fully visible.
   - `ZC2024050001` through `ZC2024050005` must be fully visible.
   - Row 5 must visibly show: `D`, `M2024050005`, `设备 E`, `1500.00`, `CNY`, `其他`, `ZC2024050005`, `设备 E`, `1500.00`, `人民币`.
   - Use smaller 6.5px-7px font if needed, with line-height 16px-17px.
   - Use these fixed column widths inside the existing 555px card: 38, 88, 40, 55, 30, 44, 88, 40, 50, 32.
   - No ellipsis, no clipping, no text merging, no wrapping.

2. Right `字段映射配置编辑区`:
   - Replace any dot/placeholder-looking select value with the source-visible values.
   - Values must be visibly readable:
     `MES 设备绑定`
     `MES`
     `/api/asset/bind`
     `asset_class`
     `资产小类`
     `映射表`
     `A: 电子设备，B: 机械设备，C: 办公设备，D: 其他`
     `必填校验`
     `进入数据异常队列`
     `记录变更明细`
   - Preserve visible labels through `审计要求`.
   - Preserve bottom buttons: `保存草稿`, `提交校验`, `样例校验`.
   - Do not introduce internal scrollbars.

Do not change:
- top shell, sidebar, title, filters, four mapping cards;
- upper left mapping table;
- mapping canvas;
- bottom three right cards;
- exact `警告（2）`, `失败（1）`.

Hard failures:
- Any sample code is clipped or abbreviated.
- Right editor visible values are dots, placeholders, blank, or clipped.
- The rendered screenshot is not exactly 1586 x 992.
- Page-level or internal scroll appears for source-visible content.
