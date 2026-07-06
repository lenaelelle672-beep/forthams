Repair the existing generated DESIGN screen only. Do not redesign the page.

Target screen: 资产编号规则配置台 / system-numbering-rules.
Source of truth remains the uploaded IMAGE2 screenshot `master-data-subpage-02-numbering-rules-v2.png`.

Current failure to repair:
- In the 1586 x 992 browser screenshot, the center `冲突检测队列（共 1 项待处理）` is below the visible viewport.
- The right `发布门禁 / 回滚策略` starts too low; only the first row is visible.
- The HTML still uses internal scroll containers like `overflow-y-auto` for center/right panels.

Narrow repair constraints:
- Keep the current top nav, sidebar, title, status strip, filters, left rule list, and main table x positions.
- Do not change business data or wording.
- Remove all internal vertical scroll from center workspace and right rail. No `overflow-y-auto`, no `overflow-auto`, no clipped custom scrollbar panels.
- Fit all source-visible content into the fixed 1586 x 992 viewport.

Vertical compression targets:
- Main table panel: y=247..802 currently too tall. Compress it to y=247..802? No: set the main table panel to y=247..802 only if preview and conflict still fit; otherwise use source y bands below.
- Detail table must end by y=526. Six rows visible, each row about 36px. Use one-line horizontal cells, truncate only when the source visually truncates.
- Numbering preview must occupy y=538..760. Keep input sample, arrow, result table, and blue preview note visible, but reduce padding and row height.
- Conflict queue must start at y=773 and end by y=924. Title text must be exactly `冲突检测队列（共 1 项待处理）`; four rows visible: `历史锁号重复`, `手工改号冲突`, `资产小类缺失`, `已核销批次只读`.
- Right editor fields must finish by y=724. Use 28px controls and tight 8px row gaps.
- Right publish gate must start at y=737 and finish by y=932. Visible rows include `数量折行已配置`, `试算样本通过`, `回滚方案已编写`, plus the orange warning.

Text gates:
- Keep exact strings `数量折行`, `序列位数`, `预览不占号`.
- Forbidden strings remain forbidden: `数量拆行`, `序位位数`, `预留不占号`, `历史号重复`.

Final self-check:
- At 1586 x 992, the bottom conflict queue and right publish gate are fully visible without scrolling.
- Do not introduce a page-level scroll.
- Do not convert table cells into vertical stacks.
