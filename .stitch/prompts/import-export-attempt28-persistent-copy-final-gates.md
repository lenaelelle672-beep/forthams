Edit the selected Stitch DESIGN screen into a NEW persistent DESIGN/HTML screen. Do not return only DOM operations. The result must have its own downloadable `htmlCode.downloadUrl` from `get_screen`.

This is a 100/100 pixel-fidelity transcription repair for `system-params-subpage-04-import-export-v2.png`.
The selected screen is already the best generated HTML candidate. Copy it almost exactly. Do not regenerate from a generic admin template. Do not change business data.

Preserve the exact top-left IMAGE2 brand mark: white `UNIVIEW`, the source-visible divider/lockup, and adjacent product subtitle only when visible in the source.

Current selected screen already passes:
- viewport/document/body exactly 1595 x 986
- no page scroll and no real internal scrollers
- no missing required text
- all five left table rows are horizontal and visible
- all six right editor field values are visible
- bottom card titles are visible
- queue tabs use exact full-width parentheses `导入队列（3）` and `导出队列（2）`

Preserve those passing regions exactly.

Make only these final coordinate changes:

1. Right editor button row.
Move the right editor footer buttons `保存草稿`, `提交校验`, `试运行` upward by 8px.
The visible text for those three buttons must be inside the right editor panel and satisfy:
- x >= 972
- y >= 520
- bottom <= 606
Do not move or hide the top toolbar buttons with the same labels.

2. Bottom footer links.
Move or duplicate the bottom footer links so visible copies are inside the bottom card band:
- `查看队列详情`
- `查看全部错误（2）`
- `查看校验报告`
Their visible text must be around y=930 and satisfy:
- y >= 640
- bottom <= 946
- x >= 0
- right <= 1595
If old offscreen duplicates remain below the viewport, remove them or hide them. The visible copies must be readable without scrolling.

Hard gates:
- html/body/documentElement stay exactly 1595 x 986.
- realScrollerCount stays 0.
- No page scroll. No internal scrollbars.
- Do not alter header, sidebar, KPI cards, left table, right field rows, or bottom card titles.
