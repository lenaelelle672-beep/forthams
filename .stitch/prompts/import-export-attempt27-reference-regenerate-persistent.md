Edit the selected uploaded IMAGE2 reference screen into a NEW persistent Stitch DESIGN/HTML screen. Do not return only DOM operations for the reference image or an existing generated screen. The result must be downloadable through `get_screen` with a real `htmlCode.downloadUrl`.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Preserve the exact top-left IMAGE2 brand mark for the current source screenshot: white `UNIVIEW`, the source-visible divider/lockup, and any adjacent product subtitle only if that subtitle is visible in the IMAGE2 source.
Do not redraw, distort, split, re-space, or replace the UNIVIEW wordmark.

Page name: 导入导出配置
Menu id: system-import-export
Reference image: system-params-subpage-04-import-export-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-params-subpage-04-import-export-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-import-export

[Required frame]
- Desktop 1595 x 986.
- HTML/body/documentElement render exactly 1595 x 986.
- No page-level scroll and no internal scrollbars.
- One-screen desktop screenshot, not a long page.

[Exact layout]
- Top dark navy UNIVIEW shell, with `系统运营中枢` active.
- Left dark sidebar `系统设置`, expanded `系统参数`, active item `导入导出配置`.
- Main title: `导入导出模板与队列配置台`.
- Top action buttons: `新建模板`, `保存草稿`, `提交校验`, `试运行`.
- Four summary cards: `模板数`, `待发布`, `导入队列`, `导出权限`.
- Upper body two columns:
  - Left card title `导入导出模板列表`, with search/filter row and a 5-row table.
  - Right card title `导入导出策略编排`, progress `完成度 8/8`, 8 compact fields, and footer buttons.
- Bottom row has four cards in one visible row:
  - `字段映射预览`
  - `队列运行情况`
  - `校验错误样例`
  - `发布校验清单`

[Exact required text]
Left table rows:
- `待建资产导入`
- `CIP 费用归集导入`
- `资产台账导出`
- `审计取证导出`
- `供应商基础资料导入`

Right editor field values:
- `v2.3.0（草稿）`
- `Excel（.xlsx）`
- `启用（必填 + 格式 + 业务规则）`
- `生成错误报告（分工作表输出）`
- `脱敏 + 水印（公司名 + 时间戳）`
- `导入默认队列（并发 3，失败重试 2 次）`

Queue tabs and bottom links must use exact full-width Chinese parentheses:
- `导入队列（3）`
- `导出队列（2）`
- `查看队列详情`
- `查看全部错误（2）`
- `查看校验报告`

[Coordinate gates]
- `导入导出策略编排` in the right panel: x >= 972, bottom <= 310.
- Right editor footer buttons `保存草稿`, `提交校验`, `试运行`: x >= 972, y >= 520, bottom <= 606.
- Bottom card titles: y >= 630 and bottom <= 700.
- Bottom links `查看队列详情`, `查看全部错误（2）`, `查看校验报告`: y around 928-940, bottom <= 946, visible without scrolling.
- Left table rows must sit horizontally in x 219..970 and y 246..606.

Use compact row heights and fixed card heights to fit the source screenshot. Do not push footer links below the viewport. Do not use ASCII parentheses `(3)` `(2)`.
