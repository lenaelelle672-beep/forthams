Edit the selected DESIGN candidate into a NEW complete Stitch DESIGN screen.

This remains a 100/100 pixel-fidelity transcription of IMAGE2 v2 `master-data-subpage-06-custom-field-sets-v2.png`.
The selected candidate is only a repair base; the IMAGE2 screenshot remains the only source of truth.
Do not redesign or change business data. Return a NEW persistent DESIGN screen with full HTML.

Scope: fix only the right `字段集属性` rail geometry and any width impact needed to keep the center table visible.

Current defect to fix:
- The candidate right rail starts around y=185, so `发布门禁 8/9` begins below y=998.
- In the IMAGE2 source, the right rail starts near y=55 and spans almost the full viewport height.

Required right rail geometry:
- Place the right rail at x≈1308..1586, y≈55..992.
- It must NOT start below the status strip or below the main table.
- It must be a full-height column like the source screenshot.
- No right-rail internal scrollbar; all source-visible content fits.
- Keep the center workspace ending before x=1308.

Right rail content order and placement:
- Header `字段集属性` at y≈68.
- Property fields from y≈100 to y≈535:
  `名称`, `编码`, `业务对象`, `当前版本`, `字段组成`, `排序策略`, `桌面布局绑定`, `H5布局绑定`, `导入导出模板`, `集成映射`, `权限策略`, `历史影响`, `审计策略`.
- Orange warning card y≈548..626:
  `发布后生成字段集版本快照；已发布版本不能无痕改字段顺序；H5/桌面/导入模板需同步。`
- Publish gate y≈640..965:
  title `发布门禁` and score `8/9`
  rows `编码唯一 通过`, `字段存在 通过`, `排序合法 通过`, `必填策略 通过`, `布局绑定 通过`, `H5套用 通过`, `导入导出 通过`, `历史影响 待处理`, `权限审计 通过`.

Preserve:
- source-like top shell, left sidebar, action/status rows, field-set table, bottom cards, and text content.
- bottom-left `字段组成排序` table with six rows and horizontal text.
- no page scroll; document/body remain 1586 x 992.

Forbidden:
- moving the right rail offscreen
- clipping `历史影响 待处理` or `权限审计`
- hiding required content behind overflow
- emoji glyphs, `undefined`, `NaN`, `Lorem`
