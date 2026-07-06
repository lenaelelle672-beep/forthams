Edit the selected screen into a new persistent Stitch DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The original uploaded IMAGE2 v2 screenshot `system-params-subpage-04-import-export-v2.png` is still the only source of truth.
Use the selected generated screen only as a draft to repair; do not use your own default admin template.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not change business data.

Page name: 导入导出模板与队列配置台
Menu id: system-import-export
Canvas: exactly 1595 x 986 CSS pixels.

Critical repair target from the previous draft:
- The previous browser render had body/document scrollHeight 1023. Fix it to 986 or less.
- The previous draft used `overflow-auto` inside the middle table and right editor. Remove all vertical scroll containers for source-visible content.
- The previous middle table row heights were too tall and text stacked vertically. Make all table rows compact single-line rows like the IMAGE2 source.
- The previous right editor hid lower rows/actions in an internal scroll. Show all 8 rows and the 3 buttons inside y=246..606.
- The previous bottom card link `查看全部错误（2）` rendered below the viewport. Place every bottom link above y=946.

Absolute geometry, must match the IMAGE2 source:
- Top navigation: x=0 y=0 w=1595 h=52.
- Sidebar: x=0 y=52 w=206 h=934.
- Main content left: x=206 y=52 w=1389 h=934.
- Header: x=236 y=72 w=1343 h=45.
- KPI row: x=219 y=132 w=1366 h=99.
- Middle row: x=219 y=246 w=1366 h=360.
  - Left table panel: x=219 y=246 w=740 h=360.
  - Right editor panel: x=972 y=246 w=612 h=360.
- Bottom row: x=4 y=640 w=1580 h=306.

Hard CSS behavior:
- Use `html, body { width:1595px; height:986px; overflow:hidden; }`.
- Do not use `overflow:auto`, `overflow-y:auto`, `overflow-scroll`, or inner scroll panels anywhere for visible content.
- Do not make the overall page taller than 986.
- Use compact 28-32px table rows and 13px Chinese text.
- Use `white-space: nowrap` for table cells and action links.
- Use fixed heights and absolute positioning for the five major bands.

Top shell and sidebar:
- Preserve the exact source brand mark: `UNIVIEW` with cyan `VIEW`, divider, `固定资产管理系统`.
- Active top tab `系统运营中枢`.
- Use source-like line icons, not gray square placeholders and not emoji.
- Dark system settings sidebar with active item `导入导出配置`.

Header:
- Title `导入导出模板与队列配置台`.
- Subtitle `统一维护模板版本、字段映射、校验规则、导入队列、导出权限、水印与审计留痕。`
- Buttons: `新建模板`, `保存草稿`, `提交校验`, `试运行`.

KPI row:
- Four source-like cards with large circular icons:
  `模板数` value `16` text `含导入 8 / 导出 8`;
  `待发布` value `3` text `含 CIP 费用模板 1`;
  `导入队列` value `9` text `今日处理中 4，今日失败 2`;
  `导出权限` value `5` text `受限模板 2，需审批 1`.

Middle left panel `导入导出模板列表`:
- Keep it inside x=219 y=246 w=740 h=360.
- Show a compact filter row and exactly 5 visible single-line rows.
- Rows: `待建资产导入`, `CIP 费用归集导入`, `资产台账导出`, `审计取证导出`, `供应商基础资料导入`.
- Columns: `模板名称`, `模板键`, `适用对象`, `字段映射`, `校验规则`, `队列策略`, `状态`, `操作`.
- Keep pagination visible: `共 5 条`, `1`, `10 条/页`.
- Do not wrap `待建资产导入` into two vertical lines.
- Do not stack action text vertically; keep `编辑`, `试跑`, `...` in one compact row.

Middle right panel `导入导出策略编排`:
- Keep it inside x=972 y=246 w=612 h=360.
- Header contains `完成度 8/8`.
- Show all 8 rows above the buttons:
  `模板版本` value `v2.3.0（草稿）`;
  `文件格式` value `Excel（.xlsx）`;
  `批量上限` value `10,000 行`;
  `字段校验` value `启用（必填 + 格式 + 业务规则）`;
  `重复处理` value `按唯一键去重，重复更新`;
  `错误报告` value `生成错误报告（分工作表输出）`;
  `导出控制` value `脱敏 + 水印（公司名 + 时间戳）`;
  `队列策略` value `导入默认队列（并发 3，失败重试 2 次）`.
- Buttons at the bottom of this panel, still above y=606: `保存草稿`, `提交校验`, `试运行`.

Bottom row:
- Four cards must be fully visible in one row.
- Place card top y=640 and bottom y=946.
- Card 1 title `字段映射预览`, with compact mapping lines and legend `已映射`, `未映射`, `类型不匹配`, `可选映射`.
- Card 2 title `队列运行情况`, tabs exactly `全部队列`, `导入队列（3）`, `导出队列（2）`, link `查看队列详情`.
- Card 3 title `校验错误样例`, rows with line numbers `23`, `45`, `67`, `89`, `112`, link `查看全部错误（2）`.
- Card 4 title `发布校验清单`, six pass rows, link `查看校验报告`.
- All links must have bottom <= 946.

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
- `导入队列(3)` or `导出队列(2)`.
- `导入导出策略编辑`.
- Any page-level or internal vertical scroll.
- Bottom links below y=946.
- Gray square icons or emoji.

Final self-check before returning:
- 1595 x 986 browser viewport has no scrolling.
- All 5 left table rows are visible as compact horizontal rows.
- All 8 right editor rows and 3 right editor buttons are visible.
- All four bottom cards and their footer links are visible above y=946.
