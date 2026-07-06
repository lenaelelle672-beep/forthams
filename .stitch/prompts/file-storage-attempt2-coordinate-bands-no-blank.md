Create a complete 100/100 pixel-fidelity HTML transcription of the selected uploaded IMAGE2 v2 screenshot.

The uploaded IMAGE2 v2 screenshot is the only source of truth.
This is not a redesign and not a generic admin template.
Do not omit lower content. Do not leave a blank main area.
Hard failure: if the rendered page has a blank area below the KPI row, the answer is wrong.

Page: 文件存储配置
Menu id: system-file-storage
Reference: system-params-subpage-03-file-storage-v2.png
Viewport: 1595 x 986 fixed. No document scroll.

Global shell:
- Dark navy top bar: x=0..1595, y=0..52.
- Dark navy left sidebar: x=0..207, y=52..986.
- Main content: x=207..1595, y=52..986, light gray background.
- Preserve source top-left brand: white/teal UNIVIEW + `固定资产管理系统`. No emoji icons anywhere.
- Active top tab: `系统运营中枢`. Active left item: `文件存储配置`.

Coordinate bands that must be present:

1) Header band, y=72..132:
- White header card x=219..1580.
- Title `文件存储与缩略图配置台`.
- Subtitle `附件、缩略图、对象存储、本地存储、归档与安全扫描一盘配置。`
- Buttons at right: `新建存储策略`, `保存草稿`, `提交校验`, `测试连接`.

2) KPI band, y=132..232:
- Four white cards in one row:
  `存储策略 8 已启用 6 个，停用 2 个`
  `待测试 2 2 个策略上次测试失败`
  `缩略图队列 4 处理中 3，等待 1`
  `归档桶 3 生命周期策略已启用`

3) Upper work band, y=243..609:
- Left card x=219..966, title `文件存储策略列表`.
- This card must include filters and a 5-row table. No blank replacement.
- Table columns: 策略名称, 策略键, 文件范围, 存储值, 风险等级, 状态, 操作.
- Body rows:
  资产附件主桶 / ASSET_MAIN_BUCKET / 资产附件 / oss://uniview-asset-main / 低 / 启用 / 编辑 测试 ...
  CIP 验收附件归档桶 / CIP_ARCHIVE_BUCKET / CIP 验收附件 / oss://uniview-cip-archive / 中 / 启用 / 编辑 测试 ...
  缩略图生成策略 / THUMBNAIL_POLICY / 缩略图 / oss://uniview-thumb / 低 / 启用 / 编辑 测试 ...
  Office 预览策略 / OFFICE_PREVIEW_POLICY / 预览文件 / oss://uniview-preview / 中 / 启用 / 编辑 测试 ...
  安全扫描规则 / SEC_SCAN_POLICY / 全部文件 / local://sec-scan-temp / 高 / 启用 / 编辑 测试 ...
- Footer: 共 5 条, page 1, 10 条/页.

- Right card x=979..1580, title `文件存储策略编辑`.
- Top progress: `完成度 8/8` with teal bar.
- Must include all 8 visible editor rows:
  存储后端 = 对象存储（OSS）- 阿里云
  附件目录 = uniview-asset-main/attachments/
  缩略图策略 = 缩略图生成策略（THUMBNAIL_POLICY）
  预览格式 = PDF, DOCX, XLSX, PPTX, TXT_JPG, PNG
  归档生命周期 = 转归档：30 天后，删除：730 天后
  访问权限 = 私有读写（签名访问 15 分钟）
  安全检查 = 启用（病毒扫描 + 敏感内容识别）
  失败回退 = 回退到本地临时存储（7 天）
- Bottom buttons: 保存草稿, 提交校验, 测试连接.

4) Bottom diagnostics band, y=618..923:
- Four cards must occupy the full bottom row. Do not omit them.
- Card 1 x=6..422: title `存储拓扑`, graph nodes `应用服务集群 2 节点`, `对象存储（OSS）`, `本地临时存储`, `归档存储（OSS）`, and legend 主路径/回退路径/连接正常/连接异常.
- Card 2 x=437..838: title `缩略图队列`, tabs `处理中（3）`, `等待中（1）`, `失败（0）`, rows `IMG_20240520_001.jpg`, `diagram_v2.png`, `设备铭牌.jpg`, `plan_floor3.dwg`, footer `查看全部队列`.
- Card 3 x=857..1190: title `预览格式与安全扫描`, tabs `预览格式支持`, `安全扫描趋势`, rows PDF, DOCX, XLSX, PPTX, DWG, EXE, footer `查看更多格式配置`.
- Card 4 x=1203..1580: title `归档与失败回退`, table `默认归档策略 30 730 启用`, failure rows `回退到本地临时存储`, `回退到备用桶`, `写入失败`, footer `查看失败明细`.

Styling:
- Use source teal accent for active left item and primary buttons.
- Rounded cards, thin gray borders, compact 11-12px table typography.
- Horizontal readable text only; no vertical table text and no hidden rows.
- Icons should be simple source-like line icons or colored vector shapes. Never emoji.

Final self-check:
- At 1595x986, the screenshot has visible content through y=923.
- `ASSET_MAIN_BUCKET`, `SEC_SCAN_POLICY`, `完成度 8/8`, `IMG_20240520_001.jpg`, and `查看失败明细` are visible.
- No blank lower half.
