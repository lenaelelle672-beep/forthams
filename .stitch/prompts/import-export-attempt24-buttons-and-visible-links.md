This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Preserve the exact top-left IMAGE2 brand mark for the current source screenshot: white `UNIVIEW`, the source-visible divider/lockup, and any adjacent product subtitle only if that subtitle is visible in the IMAGE2 source.
Do not redraw, distort, split, re-space, or replace the UNIVIEW wordmark.
Do not let Stitch generate disconnected letters, generic logos, or a different brand lockup.

Page name: 导入导出配置
Menu id: system-import-export
Reference image: system-params-subpage-04-import-export-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-params-subpage-04-import-export-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-import-export

Continue from the current screen. Preserve all passing regions exactly:
- Browser viewport and document must stay exactly 1595 x 986.
- Do not introduce body/document scrolling.
- Keep the top shell, left sidebar, metric cards, the left template table, all five table rows, and all six right editor field rows unchanged.
- Keep the title text `导入导出模板与队列配置台`.
- Keep the right panel title `导入导出策略编排` in the right panel, with bottom <= 310px.
- Keep all existing Chinese data unchanged.

Only fix these two remaining layout gates:

1. Right editor footer buttons:
Move the right editor footer button row upward by 8px.
The visible text boxes for `保存草稿`, `提交校验`, and `试运行` inside the right editor must each be in the right panel and satisfy:
- x >= 972px
- y >= 520px
- bottom <= 606px
Target their text baseline around y=586-590px. Do not move the top toolbar buttons.

2. Bottom card links:
The bottom four cards must remain visible in one row. Inside the bottom cards, add or move the footer link texts so they are visible within the 1595 x 986 viewport:
- `查看队列详情`
- `查看全部错误（2）`
- `查看校验报告`

Place these footer link texts inside their corresponding bottom cards, visually matching the IMAGE2 source:
- `查看队列详情` in the queue status card, around x=690px, y=930px.
- `查看全部错误（2）` in the validation error sample card, around x=1015px, y=930px.
- `查看校验报告` in the publish checklist card, around x=1373px, y=930px.

Hard visibility requirement for each bottom link text:
- y >= 640px
- bottom <= 946px
- x >= 0
- right <= 1595px

If older offscreen duplicate copies already exist below the viewport, remove them or ignore them, but the visible copies above must be present. The result must not require scrolling to see them.
