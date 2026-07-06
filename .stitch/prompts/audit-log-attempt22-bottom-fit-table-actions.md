Create a NEW DESIGN screen. Do not return DOM operations against the existing file.
The response must include outputComponents.design.screens with a new DESIGN screen id.

This is a 100/100 pixel-fidelity repair against the IMAGE2 v2 source screenshot.
Do not redesign. Preserve business data.

Use the current candidate only as a starting point for style. Fix these visible failures:

1. The page must fit inside a 1595 x 986 viewport with no clipped content.
   - The bottom diagnostic cards must end above y=933 like the source.
   - The first bottom card `导出取证包预览` must show the full blue `下载取证包` button inside the card.
   - Do not let any bottom card content run past the viewport.

2. Compress the middle workspace to match the source.
   - Middle cards start near y=214 and must end near y=625.
   - Audit table row height must be denser; four rows and pagination must still be visible.
   - Right `审计策略编排` form must remain fully visible and not overlap bottom cards.

3. Fix audit table horizontal fit.
   - The action column must be fully visible inside the left card.
   - Keep the three action links on one line: `查看详情`, `追溯链路`, `下载取证包`.
   - Use smaller 12px table text, tighter column widths, and nowrap behavior.
   - Do not let text overflow past the card boundary.

4. Preserve the already-correct source locks.
   - Brand must remain `UNIVÍEW | 固定资产管理系统`.
   - Right card title must remain `审计策略编排`.
   - KPI icons must remain large colored badges, not pale square tiles.
   - Bottom card titles must remain `导出取证包预览`, `留存保护策略`, `风险事件趋势（近 7 天）`, `审计链路追溯（示例）`.

5. Avoid external dependencies where possible.
   - Prefer inline SVG or CSS badges for icons.
   - Do not use emoji.

The output must visually match the IMAGE2 v2 source more closely than the current candidate.
