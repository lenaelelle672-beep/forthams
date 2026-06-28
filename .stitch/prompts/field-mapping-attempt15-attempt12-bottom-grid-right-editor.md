Edit this candidate into a new persistent Stitch DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `integration-subpage-03-field-mapping-v2.png` is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 字段映射工作台
Menu id: system-field-mapping
Reference image: integration-subpage-03-field-mapping-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/integration-subpage-03-field-mapping-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-field-mapping
Canvas: exactly 1586 x 992 CSS pixels.

Important: return a new persistent DESIGN screen with full HTML/CSS. Do not return only DOM operations on the existing screen.

Keep the current candidate's good layout:
- Exact dark top shell and left sidebar.
- Page title, action buttons, filters, four mapping cards.
- Upper three panels: `字段映射视图`, `映射关系画布`, `字段映射配置编辑区`.
- Bottom four panels.

Repair only these source mismatches:

1. Bottom grid x/y bands must match the IMAGE2 source.
   - Bottom panels start at y≈716 and end at y≈965.
   - Left sample panel: x≈194, y≈716, w≈555, h≈250.
   - Missing-field panel: x≈762, y≈716, w≈290, h≈250.
   - Conflict panel: x≈1064, y≈716, w≈260, h≈250.
   - Publish gate panel: x≈1338, y≈716, w≈235, h≈250.
   - Do not let the sample panel overlap or merge text across columns.

2. `样例数据预览（前 5 行）` table must be readable like the source.
   - Show exactly five rows inside the panel.
   - Use fixed table layout with tiny but readable 8px-9px text.
   - Header row and body rows must not overlap.
   - The following values must be visibly readable, not ellipsized or merged:
     `M2024050005`, `ZC2024050005`, `设备 E`, `1500.00`, `人民币`.
   - Preserve the grouped headers: `源数据（MES）` and `目标数据（固定资产）`.

3. Right editor must expose its lower fields and buttons without vertical scroll.
   - Keep `字段映射配置编辑区` at source x≈1245..1567, y≈256..704.
   - All labels through `异常处理` and `审计要求` must be visible.
   - Bottom buttons `保存草稿`, `提交校验`, `样例校验` must remain visible.
   - Reduce field row height/padding if needed; do not hide content behind overflow.

4. Publish gate labels must use exact full-width Chinese punctuation:
   - `警告（2）`
   - `失败（1）`
   Forbidden ASCII variants: `警告 (2)`, `失败 (1)`.

5. Keep source-visible business content; do not simplify.
   Required visible text includes:
   - `进入异常队列`, `查看冲突详情`, `purchase_date`, `supplier_id`, `contract_no`, `人民币`, `审计要求`
   - `样例数据预览（前 5 行）`, `缺失字段异常（共 2 条）`, `冲突检测（共 1 条）`, `发布门禁`
   - `警告（2）`, `失败（1）`

Forbidden failure modes:
- Metadata or rendered document larger than the 1586 x 992 viewport.
- Page-level scroll or internal scrollbars for source-visible content.
- Sample table text overlap, vertical stacking, clipping, or ellipsis for row 5 values.
- Dropping source business rows, links, or right-editor fields.

Final self-check:
- Headless browser screenshot at 1586 x 992 shows all five sample rows, full bottom four-card row, visible right-editor lower fields/buttons, and exact `警告（2）` / `失败（1）`.
