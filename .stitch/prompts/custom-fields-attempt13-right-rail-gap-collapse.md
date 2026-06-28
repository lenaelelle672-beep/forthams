Edit the selected DESIGN candidate into a NEW complete Stitch DESIGN screen.

This remains a 100/100 pixel-fidelity transcription of IMAGE2 v2 `master-data-subpage-05-custom-fields-v2.png`.
The selected candidate is only a repair base; the IMAGE2 screenshot remains the only source of truth.
Do not redesign, simplify, modernize, or change business data.
Return a NEW persistent DESIGN screen with full HTML.

Scope of this edit: only repair the right `字段属性` rail bottom area and the validation-expression value. Keep the top shell, left sidebar, business-object list, main field table, and four bottom cards visually unchanged from the selected candidate.

Hard constraints:
- Canvas stays exactly 1586 x 992.
- No page scroll and no internal scrollbars.
- No `overflow-y-auto`, `overflow-x-auto`, `overflow-auto`, or hidden scroll tricks on the right rail.
- Do not reflow the center field table. Keep all table cells horizontal.
- Do not output `UM`, emoji, `undefined`, or `NaN`.

Right rail repair:
- Keep rail x=1286..1586, y=48..992.
- The right field list must end by y≈620, not y≈760.
- Remove the large blank spacer between `审计策略` and `风险提示`.
- Make the compact property rows about 24px high.
- `校验表达式` value must display exactly `^[A-Z0-9-]{1,20}$` with no backslash before the hyphen.

Place these blocks in the right rail:
- `风险提示` card y≈632..722.
  - visible title `风险提示`
  - visible lines:
    `发布后历史实例保持原字段版本`
    `ERP 回执冻结不允许无痕修改`
    `H5 与桌面布局需同步`
- `发布门禁（7/8 通过）` y≈734..984.
  - show all rows inside the viewport:
    `编码唯一 通过`
    `类型合法 通过`
    `必填策略 通过`
    `字典来源 通过`
    `布局绑定 通过`
    `导入导出 通过`
    `集成映射 通过`
    `历史影响 待确认`

Final self-check:
- At 1586 x 992, `风险提示`, all 3 risk lines, `发布门禁`, `历史影响`, and `待确认` are fully visible.
- `documentElement.scrollHeight` and `body.scrollHeight` are 992.
- Real internal scroller count is zero.
