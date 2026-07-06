Edit the selected screen using the uploaded IMAGE2 v2 product screenshot as the only authority.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not hide required content behind scroll if the uploaded screenshot shows it.

Preserve the exact top-left IMAGE2 brand mark for this source screenshot: white `UNIVIEW`, the source-visible divider/lockup, and adjacent product subtitle only if that subtitle is visible in the IMAGE2 source.
Do not redraw, distort, split, re-space, lowercase, or replace the UNIVIEW wordmark.

Page name: 导入导出配置
Menu id: system-import-export
Reference image: system-params-subpage-04-import-export-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-params-subpage-04-import-export-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-import-export
Canvas: exactly 1595 x 986.

Recreate this exact IMAGE2 v2 product screenshot as HTML.
Use a single fixed desktop frame matching the screenshot. No page-level scroll. No internal scrollbars or hidden-overflow clipping for any source-visible content.

Critical shell/layout facts:
- Dark top navigation and dark left system-parameter sidebar must match the source.
- Left sidebar active item is `导入导出配置` in teal.
- Content starts at x about 220 with white background.
- Header title is `导入导出模板与队列配置台`.
- Header buttons on the right are exactly `新建模板`, `保存草稿`, `提交校验`, `试运行`.
- KPI row has four cards: `模板数 16`, `待发布 3`, `导入队列 9`, `导出权限 5`.

Middle band must fit inside y about 247-608:
- Left middle card title: `导入导出模板列表`.
- Keep all five table rows visible in the screenshot:
  `待建资产导入`, `CIP 费用归集导入`, `资产台账导出`, `审计取证导出`, `供应商基础资料导入`.
- Keep template keys visible: `IMP_PRE_ASSET`, `IMP_CIP_COST`, `EXP_ASSET_LEDGER`, `EXP_AUDIT_EVIDENCE`, `IMP_VENDOR_BASE`.
- Table footer must show `共 5 条`, page `1`, and `10 条/页`.
- Right middle card title: `导入导出策略编排`.
- The progress header is `完成度 8/8`.
- Show all eight strategy rows without clipping:
  `模板版本`, `文件格式`, `批量上限`, `字段校验`, `重复处理`, `错误报告`, `导出控制`, `队列策略`.
- Show all three right-card bottom buttons in the middle card: `保存草稿`, `提交校验`, `试运行`.

Bottom band must fit inside y about 640-946:
- Four bottom cards appear in one row and stay fully visible.
- Card 1 title `字段映射预览`; show left Excel fields and right system fields connected by blue mapping lines.
- Card 2 title `队列运行情况`; tabs `全部队列`, `导入队列（3）`, `导出队列（2）`; table rows include `导入默认队列`, `导入CIP队列`, `导出默认队列`, `导出受限队列`, `历史归档队列`; footer link `查看队列详情`.
- Card 3 title `校验错误样例`; rows include line numbers `23`, `45`, `67`, `89`, `112`; footer link `查看全部错误（2）`.
- Card 4 title `发布校验清单`; rows include `版本锁定`, `权限门禁`, `字段映射`, `校验规则`, `水印策略`, `审计留痕`; footer link `查看校验报告`.

Important negative constraints from previous failed attempts:
- Do not show only two, three, or four template rows. All five middle table rows must be visible.
- Do not omit the right-card bottom buttons `保存草稿`, `提交校验`, `试运行`.
- Do not push bottom card footer links below the 986px frame.
- Do not use ellipsis or vertical stacked table text for source-visible labels.
- Do not use hidden DOM text as a substitute for visible screenshot content.
- Do not create a 3190 x 2048 design or a scaled sparse layout; the final browser screenshot must be 1595 x 986.
