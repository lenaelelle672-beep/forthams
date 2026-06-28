Edit the selected uploaded IMAGE2 v2 screenshot into a new persistent Stitch DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded screenshot `system-params-subpage-03-file-storage-v2.png` is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 文件存储与缩略图配置台
Menu id: system-file-storage
Reference image: system-params-subpage-03-file-storage-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-params-subpage-03-file-storage-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-file-storage
Canvas: exactly 1595 x 986 CSS pixels.

Build directly from the uploaded IMAGE screen, not from any prior candidate.

Top shell and sidebar:
- Top bar y=0..52, dark navy. Preserve the exact IMAGE2 brand mark: white/cyan `UNIVIEW`, divider, `固定资产管理系统`.
- Active top tab: `系统运营中枢`.
- Left sidebar x=0..206, dark system settings sidebar. Active item: `文件存储配置`.
- Do not split `UNIVIEW`; do not render emoji or generic decorative icons.

Main page bands:
- Content starts at x=206 y=52, white background.
- Page header y=68..118. Title `文件存储与缩略图配置台`; subtitle `附件、缩略图、对象存储、本地存储、归档与安全扫描一配置。`
- Header buttons on the right: `新建存储策略`, `保存草稿`, `提交校验`, `测试连接`.
- KPI row y=132..230 with 4 equal cards:
  `存储策略` value `8` text `已启用 6 个，停用 2 个`;
  `待测试` value `2` text `2 个策略上次测试失败`;
  `缩略图队列` value `4` text `处理中 3，等待 1`;
  `归档桶` value `3` text `生命周期策略已启用`.

Middle band y=242..606:
- Left panel x=219..966 title `文件存储策略列表`.
- It has filter row and a table with exactly 5 visible body rows:
  `资产附件主桶`, `CIP 验收附件归档桶`, `缩略图生成策略`, `Office 预览策略`, `安全扫描规则`.
- Table columns: `策略名称`, `策略键`, `文件范围`, `存储值`, `风险等级`, `状态`, `操作`.
- Pagination row stays inside this panel around y=550..586.
- Right panel x=980..1580 title must be exactly `文件存储策略编排`, progress `完成度 8/8`.
- Right panel shows all 8 rows in this order without internal scrolling:
  `存储后端` value `对象存储（OSS）- 阿里云`;
  `附件目录` value `uniview-asset-main/attachments/`;
  `缩略图策略` value `缩略图生成策略（THUMBNAIL_POLICY）`;
  `预览格式` value `PDF, DOCX, XLSX, PPTX, TXT_JPG, PNG`;
  `归档生命周期` value `转归档：30 天后；删除：730 天后`;
  `访问权限` value `私有读写（签名访问 15 分钟）`;
  `安全检查` value `启用（病毒扫描 + 敏感内容识别）`;
  `失败回退` value `回退到本地临时存储（7 天）`.
- Right panel bottom buttons around y=560..596: `保存草稿`, `提交校验`, `测试连接`.

Bottom band y=618..918, four cards in one row:
- Card 1 x=6..423 title `存储拓扑`; draw the source-like topology nodes and legend.
- Card 2 x=433..838 title `缩略图队列`; tabs `处理中 (3)`, `等待中 (1)`, `失败 (0)`; rows `IMG_20240520_001.jpg`, `diagram_v2.png`, `设备铭牌.jpg`, `plan_floor3.dwg`; bottom link `查看全部队列`.
- Card 3 x=849..1193 title `预览格式与安全扫描`; tabs `预览格式支持`, `安全扫描趋势`; rows `PDF`, `DOCX`, `XLSX`, `PPTX`, `DWG`, `EXE`; bottom link `查看更多格式配置`.
- Card 4 x=1203..1580 title `归档与失败回退`; tables `归档策略` and `失败回退统计（近 7 天）`; bottom link `查看失败明细`.
- All bottom-card text and links must remain above y=918. No page-level vertical scroll. No clipped bottom links.

Required exact text:
- `文件存储与缩略图配置台`
- `文件存储策略列表`
- `文件存储策略编排`
- `对象存储（OSS）- 阿里云`
- `缩略图生成策略（THUMBNAIL_POLICY）`
- `启用（病毒扫描 + 敏感内容识别）`
- `回退到本地临时存储（7 天）`
- `存储拓扑`, `缩略图队列`, `预览格式与安全扫描`, `归档与失败回退`
- `查看全部队列`, `查看更多格式配置`, `查看失败明细`

Forbidden failure modes:
- Do not render `对象存储 (OSS) - 阿里云`.
- Do not render `缩略图生成策略 (THUMBNAIL_POLICY)`.
- Do not render `启用 (病毒扫描 + 敏感内容识别)`.
- Do not render `回退到本地临时存储 (7 天)`.
- Do not change `文件存储策略编排` to `文件存储策略编辑`.
- Do not create bottom cards taller than the source.
- Do not add scrollbars or hide source-visible rows.

Before finishing, grade against the uploaded IMAGE2 source. Only finish if the 1595 x 986 viewport shows the complete middle and bottom bands with no clipped required text.
