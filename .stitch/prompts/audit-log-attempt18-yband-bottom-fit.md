Repair the current Operation Audit DESIGN screen against the IMAGE2 v2 source.

This is still a 100/100 pixel-fidelity transcription task.
Do not redesign. Do not change business data. Do not use screenshot backgrounds.
Generate or persist real HTML/CSS. A browser screenshot at 1595 x 986 must match the source.

Target page: `系统操作审计配置台`
Reference image: `system-params-subpage-06-audit-log-v2.png`
Canvas: exactly `1595 x 986`.

Attempt17 current state:
- Good: right title is now `审计策略编辑`; forbidden `审计策略编排` is gone.
- Good: no emoji glyphs.
- Failure: middle workspace is too tall; bottom cards start around y=750.
- Source requirement: bottom row starts around y=635 and all four cards fit to y≈925.

Make this geometry repair:

1. Preserve all currently correct top/header/KPI text.
- Do not change `系统操作审计配置台`.
- Do not change `审计策略编辑`.
- Do not reintroduce `审计策略编排`.
- Do not change the four KPI labels/values.

2. Rebuild vertical bands to match source:
- Top nav: y=0..52.
- Header title/actions: y=70..100.
- KPI row: y=115..200.
- Middle cards: y=214..625. This is the critical height cap.
- Bottom cards: y=635..925. All bottom content must be visible.

3. Middle left card `审计事件查询工作台`:
- Keep the card within y=214..625.
- Filter area must use two compact rows, not oversized controls.
- Table rows must be compact and horizontal; use 12px table text and nowrap.
- All 4 rows must remain visible:
  `张三`, `李四`, `王五`, `赵六`.
- Pagination must remain visible near the card bottom.
- It is acceptable to make action links smaller so `查看详情`, `追溯链路`, `下载取证包` stay on one line.

4. Middle right card `审计策略编辑`:
- Keep the card within y=214..625.
- Use compact row height so all fields and toggles remain visible.
- Keep exact title `审计策略编辑`.
- Keep values:
  `CIP 转固高危操作审计`, `CIP管理、资产管理、集成中心、权限管理`, `3年`,
  `默认脱敏规则-管理员（部分字段脱敏）`.

5. Bottom row:
- Move all four bottom cards up to start around y=635.
- Titles must be exact:
  `导出取证包预览`
  `留存保护策略`
  `风险事件趋势（近 7 天）`
  `审计链路追溯（示例）`
- Do not clip the bottom of any card at y=986.
- The first card must show button `下载取证包`.
- The fourth card must show all numbered timeline items through `审计归档入库`.

Required exact text in exported HTML:
`审计策略编辑`
`张三`
`李四`
`王五`
`赵六`
`导出取证包预览`
`留存保护策略`
`风险事件趋势（近 7 天）`
`审计链路追溯（示例）`
`下载取证包`
`审计归档入库`

Forbidden exact text:
`审计策略编排`

Do not return only DOM operations that fail to persist into exported HTML.
The exported HTML after re-export must visibly reflect the y-band repair.
