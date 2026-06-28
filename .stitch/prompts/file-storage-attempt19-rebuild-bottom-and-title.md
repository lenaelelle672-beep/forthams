Edit the selected Stitch DESIGN screen into a new persistent DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription repair for `system-params-subpage-03-file-storage-v2.png`.
Do not redesign and do not change business data.

Current screen already passes viewport, no-scroll, top shell, sidebar, KPI cards, table rows, right fields, and right buttons.
Preserve those passing parts.

Fix exactly these remaining gates:

1. Right editor title position:
- Move `文件存储策略编排` upward so its text bottom is <= 285.
- Keep the editor card and all right fields/buttons visible.

2. Rebuild the internal content of the four bottom cards as visible compact content inside y=650..950.
Do not leave any bottom-card required text below y=986.
Do not rely on hidden overflow.

Use these absolute content bands:
- `存储拓扑`: card title y=640..690; visible node labels and topology content y=700..940.
- `缩略图队列`: rows y=715, 780, 845, 910; footer link `查看全部队列` y=936.
- `预览格式与安全扫描`: rows y=715, 760, 805, 850, 895; footer link `查看更多格式配置` y=936.
- `归档与失败回退`: rows y=715, 775, 835; footer link `查看失败明细` y=936.

Required visible lower-card text:
`diagram_v2.png`
`设备铭牌.jpg`
`plan_floor3.dwg`
`DWG`
`EXE`
`查看全部队列`
`查看更多格式配置`
`查看失败明细`

Hard gates:
- html/body/documentElement stay exactly 1595 x 986.
- realScrollerCount stays 0.
- No page scroll. No internal scrollbars.
- Preserve exact UNIVIEW brand lockup and source dark shell.
