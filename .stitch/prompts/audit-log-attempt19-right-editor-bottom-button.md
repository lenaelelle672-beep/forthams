Repair ONLY the remaining layout failures in the current Operation Audit DESIGN screen.

This is a 100/100 pixel-fidelity transcription task from the IMAGE2 v2 source.
Do not redesign the shell, table, KPI row, or bottom card titles.
Do not change business data. No emoji. No page-level scroll.

Target viewport: exactly `1595 x 986`.

Current attempt18 good state:
- Main title is correct: `系统操作审计配置台`.
- Right card title is correct: `审计策略编辑`.
- Forbidden `审计策略编排` is absent.
- Table rows are horizontal and all 4 body rows are visible.
- Bottom cards now start at the right y-band.

Remaining failures to fix:

1. Right editor overflows downward into the bottom row.
- The `审计策略编辑` card must stay entirely in the middle row, approximately y=217..626.
- All right editor field rows must fit within this card:
  `策略名称`, `采集范围`, `留存周期`, `高危标记`, `导出水印`, `脱敏规则`, `不可删除策略`, `取证审批`, `告警通知`.
- Use a compact source-like row height:
  - label column width about 72px
  - control height 28px
  - row gap 8px or less
  - font 12px
- If needed, shorten long visible values with source-like ellipsis inside the input, but keep exact text in HTML.
- Do not let `告警通知` or any blue toggle extend below the card boundary.

2. `导出取证包预览` first bottom card button is too low.
- The entire first bottom card must be visible from y≈644 to y≈932.
- Button `下载取证包` must be inside the card, not below the card and not at the viewport edge.
- The SHA256 hash can wrap to two compact lines exactly as in the source.
- Reduce vertical gaps inside this card so these source rows fit:
  `取证包编号`, `事件数量`, `完整性哈希（SHA256）`, `水印信息`, `下载审批状态`, `下载取证包`.

3. Keep bottom fourth card fully visible.
- `审计链路追溯（示例）` must show all four timeline steps including `审计归档入库`.
- It must not overlap with the right editor.

4. Preserve the currently fixed table.
- Do not re-wrap the table body vertically.
- Keep row action links horizontal: `查看详情`, `追溯链路`, `下载取证包`.

Required exact text in exported HTML:
`审计策略编辑`
`告警通知`
`下载取证包`
`审计链路追溯`
`审计归档入库`

Forbidden exact text:
`审计策略编排`

The exported HTML and real Chrome screenshot must visibly reflect these repairs after re-export.
