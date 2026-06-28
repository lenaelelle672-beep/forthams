Edit the selected uploaded IMAGE2 v2 screenshot into a new persistent Stitch DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded screenshot `system-params-subpage-03-file-storage-v2.png` is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 文件存储与缩略图配置台
Menu id: system-file-storage
Canvas: exactly 1595 x 986 CSS pixels.

Critical layout requirement:
- Do not use normal vertical document flow for the main content.
- Build a single fixed 1595 x 986 canvas.
- Use absolute/fixed bands so the document scrollHeight is 986, not 1100+.
- No element may extend below y=925 except empty page background.
- No page-level vertical scrolling and no hidden clipped required text.

Absolute frame:
- Top navigation: x=0 y=0 w=1595 h=52.
- Sidebar: x=0 y=52 w=206 h=934.
- Main content: x=206 y=52 w=1389 h=934.
- Header: x=222 y=68 w=1357 h=48.
- KPI row: x=222 y=132 w=1357 h=98.
- Middle row: x=222 y=242 w=1357 h=364.
- Bottom row: x=6 y=618 w=1574 h=300.

Top shell:
- Preserve source brand: `UNIVIEW` with cyan `VIEW`, divider, `固定资产管理系统`.
- Active top tab: `系统运营中枢`.
- Use simple line icons like the source, not gray square placeholders and not emoji.

Sidebar:
- Dark system settings sidebar.
- Active item `文件存储配置`.

Header:
- Title `文件存储与缩略图配置台`.
- Subtitle `附件、缩略图、对象存储、本地存储、归档与安全扫描一配置。`
- Buttons: `新建存储策略`, `保存草稿`, `提交校验`, `测试连接`.

KPI row:
- Four equal cards with source-like circular icons, not square blocks.
- Text:
  `存储策略` `8` `已启用 6 个，停用 2 个`
  `待测试` `2` `2 个策略上次测试失败`
  `缩略图队列` `4` `处理中 3，等待 1`
  `归档桶` `3` `生命周期策略已启用`

Middle row:
- Left panel x=222 y=242 w=804 h=364, title `文件存储策略列表`.
- Compact filter row h=44 and table h=224.
- Exactly 5 visible rows: `资产附件主桶`, `CIP 验收附件归档桶`, `缩略图生成策略`, `Office 预览策略`, `安全扫描规则`.
- Pagination inside left panel at y about 552.
- Right panel x=1042 y=242 w=537 h=364, title exactly `文件存储策略编排`, progress `完成度 8/8`.
- Right panel field rows must be 31px high or less so all 8 rows and 3 buttons fit above y=604.
- Field values:
  `对象存储（OSS）- 阿里云`
  `uniview-asset-main/attachments/`
  `缩略图生成策略（THUMBNAIL_POLICY）`
  `PDF, DOCX, XLSX, PPTX, TXT_JPG, PNG`
  `转归档：30 天后；删除：730 天后`
  `私有读写（签名访问 15 分钟）`
  `启用（病毒扫描 + 敏感内容识别）`
  `回退到本地临时存储（7 天）`
- Buttons inside right panel: `保存草稿`, `提交校验`, `测试连接`.

Bottom row:
- Four separate cards in one row. They must not overlap the middle right panel.
- Card 1 `存储拓扑`: x=6 y=618 w=417 h=300.
- Card 2 `缩略图队列`: x=433 y=618 w=405 h=300.
- Card 3 `预览格式与安全扫描`: x=849 y=618 w=344 h=300.
- Card 4 `归档与失败回退`: x=1203 y=618 w=377 h=300.
- Each card title at y about 637. Each bottom link must be visible above y=900:
  `查看全部队列`, `查看更多格式配置`, `查看失败明细`.
- Use compact 12px rows. It is acceptable to simplify tiny sparkline strokes, but not to remove required rows or links.

Required exact text:
- `文件存储与缩略图配置台`
- `文件存储策略列表`
- `文件存储策略编排`
- `资产附件主桶`, `CIP 验收附件归档桶`, `缩略图生成策略`, `Office 预览策略`, `安全扫描规则`
- `对象存储（OSS）- 阿里云`
- `缩略图生成策略（THUMBNAIL_POLICY）`
- `启用（病毒扫描 + 敏感内容识别）`
- `回退到本地临时存储（7 天）`
- `存储拓扑`, `缩略图队列`, `预览格式与安全扫描`, `归档与失败回退`
- `查看全部队列`, `查看更多格式配置`, `查看失败明细`

Forbidden:
- Any `docScrollHeight` above 986.
- Any card or field row extending below y=925.
- ASCII punctuation variants for the four Chinese full-width values.
- `文件存储策略编辑`.
- Gray square nav icons or KPI icon blocks.
- Internal scrollbars.

Final self-check:
- 1595 x 986 screenshot shows the full bottom row exactly like the source.
- Right editor no longer covers or overlaps the bottom row.
- The generated HTML body text contains the exact required strings.
