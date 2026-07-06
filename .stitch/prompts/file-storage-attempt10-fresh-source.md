Use the uploaded IMAGE2 v2 screenshot as the only source of truth and generate a fresh HTML transcription.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
Canvas: exactly 1595 x 986. No page-level scroll.

Page: 文件存储配置
Menu: system-file-storage
Source image: system-params-subpage-03-file-storage-v2.png

Non-negotiable source text:
- Page title: `文件存储与缩略图配置台`
- Active sidebar item: `文件存储配置`
- Right middle card title must be exactly `文件存储策略编辑`.
- Forbidden right title: never render `文件存储策略编排`.
- Right editor rows must all be visible: `存储后端`, `附件目录`, `缩略图策略`, `预览格式`, `归档生命周期`, `访问权限`, `安全检查`, `失败回退`.
- Right editor values must use exact source punctuation:
  `对象存储（OSS）- 阿里云`
  `启用（病毒扫描 + 敏感内容识别）`
  `回退到本地临时存储（7 天）`
- Right editor buttons visible: `保存草稿`, `提交校验`, `测试连接`.

Preserve source structure:
- Dark top shell, dark system settings sidebar, teal active item.
- KPI cards: `存储策略 8`, `待测试 2`, `缩略图队列 4`, `归档桶 3`.
- Middle left table title: `文件存储策略列表`.
- Five visible table rows:
  `资产附件主桶`, `CIP 验收附件归档桶`, `缩略图生成策略`, `Office 预览策略`, `安全扫描规则`.
- Technical keys visible:
  `ASSET_MAIN_BUCKET`, `CIP_ARCHIVE_BUCKET`, `THUMBNAIL_POLICY`, `OFFICE_PREVIEW_POLICY`, `SEC_SCAN_POLICY`.
- Table footer visible: `共 5 条`, page `1`, `10 条/页`.
- Bottom four cards visible in one row: `存储拓扑`, `缩略图队列`, `预览格式与安全扫描`, `归档与失败回退`.
- Bottom required visible strings:
  `IMG_20240520_001.jpg`, `diagram_v2.png`, `设备铭牌.jpg`, `plan_floor3.dwg`,
  `PDF`, `DOCX`, `XLSX`, `PPTX`, `DWG`, `EXE`,
  `查看全部队列`, `查看更多格式配置`, `查看失败明细`.

Hard reject:
- Any internal scrollbar in the middle table, right editor, or bottom cards.
- Any hidden source-visible content behind overflow.
- Vertical stacked table text.
- Missing fifth table row `安全扫描规则`.
- Missing right rows `安全检查` or `失败回退`.
- Missing bottom links.
