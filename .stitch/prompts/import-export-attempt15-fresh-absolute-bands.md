Edit the selected uploaded IMAGE2 v2 screenshot into a new persistent Stitch DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded screenshot `system-params-subpage-04-import-export-v2.png` is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 导入导出模板与队列配置台
Menu id: system-import-export
Canvas: exactly 1595 x 986 CSS pixels.

Critical layout requirement:
- Build a single fixed 1595 x 986 canvas.
- Do not use `overflow-y-auto`, internal main scrolling, or page scrolling.
- Use absolute/fixed bands so all source-visible bottom card links are visible.
- The document scrollHeight and body scrollHeight must both stay at 986.

Absolute source bands:
- Top navigation: x=0 y=0 w=1595 h=52.
- Sidebar: x=0 y=52 w=206 h=934.
- Header: x=236 y=72 w=1343 h=45.
- KPI row: x=219 y=132 w=1366 h=99.
- Middle row: x=219 y=246 w=1366 h=360.
- Bottom row: x=4 y=640 w=1580 h=306.

Top shell:
- Preserve the exact IMAGE2 brand: `UNIVIEW` with cyan `VIEW`, divider, `固定资产管理系统`.
- Active top tab `系统运营中枢`.
- Use source-like line icons, not gray square placeholders and not emoji.

Sidebar:
- Dark system settings sidebar.
- Active item `导入导出配置`.

Header:
- Title `导入导出模板与队列配置台`.
- Subtitle `统一维护模板版本、字段映射、校验规则、导入队列、导出权限、水印与审计留痕。`
- Buttons: `新建模板`, `保存草稿`, `提交校验`, `试运行`.

KPI row:
- Four equal source-like cards:
  `模板数` value `16` text `含导入 8 / 导出 8`;
  `待发布` value `3` text `含 CIP 费用模板 1`;
  `导入队列` value `9` text `今日处理中 4，今日失败 2`;
  `导出权限` value `5` text `受限模板 2，需审批 1`.

Middle row:
- Left panel x=219 y=246 w=740 h=360, title `导入导出模板列表`.
- Compact filter row and exactly 5 visible rows:
  `待建资产导入`, `CIP 费用归集导入`, `资产台账导出`, `审计取证导出`, `供应商基础资料导入`.
- Columns: `模板名称`, `模板键`, `适用对象`, `字段映射`, `校验规则`, `队列策略`, `状态`, `操作`.
- Pagination `共 5 条`, `1`, `10 条/页` must be visible in the left panel.
- Right panel x=972 y=246 w=612 h=360, title exactly `导入导出策略编排`, progress `完成度 8/8`.
- It must show all 8 rows and 3 buttons above y=606:
  `模板版本` value `v2.3.0（草稿）`;
  `文件格式` value `Excel（.xlsx）`;
  `批量上限` value `10,000 行`;
  `字段校验` value `启用（必填 + 格式 + 业务规则）`;
  `重复处理` value `按唯一键去重，重复更新`;
  `错误报告` value `生成错误报告（分工作表输出）`;
  `导出控制` value `脱敏 + 水印（公司名 + 时间戳）`;
  `队列策略` value `导入默认队列（并发 3，失败重试 2 次）`.
- Buttons: `保存草稿`, `提交校验`, `试运行`.

Bottom row:
- Four cards in one row, all content above y=946:
  1. x=4 y=640 w=420 h=306 title `字段映射预览`, with source-like mapping lines and legend `已映射`, `未映射`, `类型不匹配`, `可选映射`.
  2. x=437 y=640 w=386 h=306 title `队列运行情况`, tabs exactly `全部队列`, `导入队列（3）`, `导出队列（2）`, link `查看队列详情`.
  3. x=833 y=640 w=362 h=306 title `校验错误样例`, rows with line numbers `23`, `45`, `67`, `89`, `112`, link `查看全部错误（2）`.
  4. x=1207 y=640 w=377 h=306 title `发布校验清单`, six pass rows, link `查看校验报告`.

Required exact text:
- `导入导出模板与队列配置台`
- `导入导出模板列表`
- `导入导出策略编排`
- `待建资产导入`, `CIP 费用归集导入`, `资产台账导出`, `审计取证导出`, `供应商基础资料导入`
- `v2.3.0（草稿）`
- `Excel（.xlsx）`
- `启用（必填 + 格式 + 业务规则）`
- `生成错误报告（分工作表输出）`
- `脱敏 + 水印（公司名 + 时间戳）`
- `导入默认队列（并发 3，失败重试 2 次）`
- `导入队列（3）`, `导出队列（2）`
- `查看队列详情`, `查看全部错误（2）`, `查看校验报告`

Forbidden:
- Halfwidth tab labels like `导入队列(3)` or `导出队列(2)`.
- Any internal vertical scroll container.
- Any bottom card link below y=946 or hidden outside viewport.
- `导入导出策略编辑`.
- Gray square nav/KPI icons or emoji.

Final self-check:
- 1595 x 986 screenshot shows no scrolling, all four bottom cards, all footer links, and all 8 right-panel rows.
- Generated HTML contains the required full-width punctuation strings exactly.
