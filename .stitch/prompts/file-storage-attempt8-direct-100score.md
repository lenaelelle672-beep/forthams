Edit the selected uploaded IMAGE2 v2 reference screen into HTML.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not hide required content behind scroll if the uploaded screenshot shows it.

Preserve the exact top-left IMAGE2 brand mark for this source screenshot: white `UNIVIEW`, the source-visible divider/lockup, and adjacent product subtitle only if that subtitle is visible in the IMAGE2 source.
Do not redraw, distort, split, re-space, lowercase, or replace the UNIVIEW wordmark.

Page name: 文件存储配置
Menu id: system-file-storage
Reference image: system-params-subpage-03-file-storage-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-params-subpage-03-file-storage-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-file-storage
Canvas: exactly 1595 x 986.

Recreate this exact IMAGE2 v2 product screenshot as HTML.
Use one fixed desktop frame. No page-level scroll. No internal scrollbars or hidden-overflow clipping for source-visible content.

Critical shell/layout facts:
- Dark top navigation, active module `系统运营中枢`.
- Dark left system settings sidebar, active item `文件存储配置`.
- Main title: `文件存储与缩略图配置台`.
- Header buttons: `新建存储策略`, `保存草稿`, `提交校验`, `测试连接`.
- The main content starts at x about 207, y about 53, with a white workspace.

Top KPI row:
- Four cards exactly: `存储策略 8`, `待测试 2`, `缩略图队列 4`, `归档桶 3`.
- Preserve subtitles: `已启用 6 个，停用 2 个`, `2 个策略上次测试失败`, `处理中 3，等待 1`, `生命周期策略已启用`.

Middle band must fit inside y about 242-607:
- Left card title: `文件存储策略列表`.
- Filters: `搜索存储策略 / 桶名 / 模块`, `文件范围 全部`, `状态 全部`, `风险 全部`.
- Show all five table rows:
  `资产附件主桶`, `CIP 验收附件归档桶`, `缩略图生成策略`, `Office 预览策略`, `安全扫描规则`.
- Preserve keys:
  `ASSET_MAIN_BUCKET`, `CIP_ARCHIVE_BUCKET`, `THUMBNAIL_POLICY`, `OFFICE_PREVIEW_POLICY`, `SEC_SCAN_POLICY`.
- Preserve storage values:
  `oss://uniview-asset-main`, `oss://uniview-cip-archive`, `oss://uniview-thumb`, `oss://uniview-preview`, `local://sec-scan-temp`.
- Footer must show `共 5 条`, page `1`, `10 条/页`.
- Right card title: `文件存储策略编辑`, progress `完成度 8/8`.
- Show all eight right form rows without clipping:
  `存储后端`, `附件目录`, `缩略图策略`, `预览格式`, `归档生命周期`, `访问权限`, `安全检查`, `失败回退`.
- Values must use the source punctuation exactly:
  `对象存储（OSS）- 阿里云`,
  `启用（病毒扫描 + 敏感内容识别）`,
  `回退到本地临时存储（7 天）`.
- Right bottom buttons: `保存草稿`, `提交校验`, `测试连接`.

Bottom band must fit inside y about 617-918:
- Four cards in one row:
  1. `存储拓扑`
  2. `缩略图队列`
  3. `预览格式与安全扫描`
  4. `归档与失败回退`
- In `缩略图队列`, show all file rows and footer link:
  `IMG_20240520_001.jpg`, `diagram_v2.png`, `设备铭牌.jpg`, `plan_floor3.dwg`, `查看全部队列`.
- In `预览格式与安全扫描`, show format rows `PDF`, `DOCX`, `XLSX`, `PPTX`, `DWG`, `EXE`, and footer link `查看更多格式配置`.
- In `归档与失败回退`, show `默认归档策略`, `失败回退统计（近 7 天）`, and footer link `查看失败明细`.

Important previous failure corrections:
- Do not show only three or four middle table rows. The fifth row `安全扫描规则` must be fully visible above the footer.
- Do not hide `安全检查` or `失败回退` in the right editor.
- Do not push bottom card entries below the viewport. Required visible strings: `diagram_v2.png`, `设备铭牌.jpg`, `plan_floor3.dwg`, `DWG`, `EXE`, `查看全部队列`, `查看更多格式配置`, `查看失败明细`.
- Avoid vertical stacked text in any table cell.
- Avoid internal `overflow-y-auto`, `overflow-auto`, or hidden clipping containers for the table and bottom cards.
