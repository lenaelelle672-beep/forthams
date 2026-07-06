Edit the selected Stitch DESIGN screen into a new persistent DESIGN/HTML screen.

This is a final coordinate nudge for `system-params-subpage-03-file-storage-v2.png`.
Do not redesign and do not change any business data.

Preserve everything currently passing:
- 1595 x 986 fixed viewport.
- zero page scroll and zero internal scrollbars.
- top shell, sidebar, KPI row, left table, right fields, right buttons.
- all five table rows.

Make only these tiny y-coordinate changes:

1. Move the text `文件存储策略编排` up by 12px.
   Current text bottom is about y=294; target bottom <= y=285.

2. Move only the internal content and footer links of the four bottom cards up by 100px.
   Keep the card containers and card titles in place.

Targets after move:
- `plan_floor3.dwg` must be visible around y=900..930.
- `DWG` and `EXE` must be visible around y=880..920.
- `查看全部队列`, `查看更多格式配置`, `查看失败明细` must be visible around y=930..955.

Do not move these already-correct items:
- header
- KPI cards
- left strategy table
- right editor values and buttons
- bottom card titles

Hard gates:
- html/body/documentElement exactly 1595 x 986.
- realScrollerCount remains 0.
- No content needed by the screenshot is below y=986.
- Preserve exact UNIVIEW brand lockup and source dark shell.
