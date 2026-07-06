Edit the selected previous DESIGN candidate into a NEW complete Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `master-data-subpage-05-custom-fields-v2.png` is the only source of truth.
The selected screen is only a repair base; do not treat it as the visual authority.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Return a NEW persistent DESIGN screen with full HTML.

Page: 自定义字段 / `system-custom-fields`.
Canvas: exact 1586 x 992 CSS pixels.
No page scroll. No internal scroll containers. No content below y=992.
Keep all table and form text horizontal; no vertical stacked table cells.

Keep these already-correct source-matching areas:
- fixed-asset top shell and `固定资产管理系统` brand area; do not output `UM`.
- left system sidebar active item `自定义字段`.
- business object list.
- title `自定义字段治理台`, header buttons, status strip, chips, 5-row field table, and four bottom cards.

Hard repair targets from the source screenshot:
1. Main field table must stay horizontal and compact:
   - 5 visible rows: `转固批次号`, `设备序列号`, `MAC地址`, `保修到期日`, `发票号`.
   - Technical values must be visible: `cip_cap_batch_no`, `device_serial_no`, `mac_address`, `warranty_expire_date`, `invoice_no`, `ERP.CIP_BATCH_NO`, `ERP.SERIAL_NO`, `ERP.MAC_ADDR`, `ERP.WARRANTY_END`, `ERP.INVOICE_NO`.
   - Row height around 34-38px. Do not stack values vertically.

2. Right property panel must fit fully inside x=1286..1586 and y=48..992:
   - Use compact field rows h<=28px, label/value on one horizontal line or compact two-line source-like pair.
   - The full field sequence must be visible by y<=720:
     `字段名称`, `字段编码`, `业务对象`, `字段类型`, `默认值`, `必填策略`, `字典来源`, `校验表达式`, `桌面布局绑定`, `H5 布局绑定`, `导入导出绑定`, `集成映射`, `权限策略`, `历史影响`, `审计策略`.
   - Required values visible: `转固批次号`, `cip_cap_batch_no`, `CIP 项目`, `文本 / 唯一编码`, `请输入默认值`, `业务必填`, `—`, `^[A-Z0-9-]{1,20}$`, `资产卡片-基础信息`, `H5-基础信息`, `导入模板-第1列`, `ERP.CIP_BATCH_NO`, `按业务对象控制`, `查看 236 条实例`, `标准审计策略`.

3. Orange risk card must be a real visible card, not a sliver:
   - Place it around y=724..812.
   - Title `风险提示`.
   - Three visible horizontal lines:
     `发布后历史实例保持原字段版本`
     `ERP 回执冻结不允许无痕修改`
     `H5 与桌面布局需同步`

4. Release gate must be fully visible below the risk card and above y=984:
   - Title `发布门禁（7/8 通过）`.
   - Rows: `编码唯一 通过`, `类型合法 通过`, `必填策略 通过`, `字典来源 通过`, `布局绑定 通过`, `导入导出 通过`, `集成映射 通过`, `历史影响 待确认`.
   - Use compact row height <=18px if needed. Do not hide any rows behind scroll.

Forbidden output:
- `UM`
- `undefined`
- `NaN`
- any emoji icons
- `overflow-y-auto` or `overflow-x-auto` on main content, table, bottom cards, or right property panel.

Final self-check before returning:
- Browser at 1586 x 992 shows `风险提示`, all three risk lines, `发布门禁（7/8 通过）`, and `历史影响 待确认`.
- Document/body scrollWidth=1586 and scrollHeight=992.
- No internal scrollbar is required to see source-visible content.
