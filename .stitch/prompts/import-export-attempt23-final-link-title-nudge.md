Edit the selected Stitch DESIGN screen into a new persistent DESIGN/HTML screen.

This is the final verifier-gate coordinate nudge for `system-params-subpage-04-import-export-v2.png`.
Do not redesign. Do not change business data.

Preserve all currently passing gates:
- 1595 x 986 fixed viewport.
- realScrollerCount 0.
- all five left table rows horizontal.
- all six right field values visible.
- exact full-width queue tabs `导入队列（3）` and `导出队列（2）`.

Make only these small changes:

1. Move the right editor title `导入导出策略编排` upward by 8px.
   Current bottom is y=314; target bottom <= y=310.

2. Move the right editor button row upward by 8px.
   Buttons `保存草稿`, `提交校验`, `试运行` must have bottom <= y=606.

3. Place visible footer links inside the bottom cards at y=930..945.
   These exact link texts must be visible above y=946:
   - `查看队列详情`
   - `查看全部错误（2）`
   - `查看校验报告`
   If old hidden/offscreen copies exist, keep or remove them, but the visible copies must be inside the cards at y=930..945.

Do not move:
- header
- KPI cards
- left table
- bottom card titles
- queue tab labels

Hard gates:
- html/body/documentElement stay exactly 1595 x 986.
- no page scroll and no internal scrollbars.
- preserve exact UNIVIEW brand lockup and source dark shell.
