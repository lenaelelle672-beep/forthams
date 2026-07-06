Edit the selected uploaded IMAGE2 v2 screenshot into a new persistent Stitch DESIGN/HTML screen.

This is a strict 100/100 transcription of `system-params-subpage-04-import-export-v2.png`.
Use the uploaded IMAGE2 screenshot as the only source of truth. Do not redesign, simplify, modernize, or use a generic admin template.

Page: 导入导出模板与队列配置台
Canvas: exactly 1595 x 986 CSS pixels.

Hard technical constraints:
- Build one fixed canvas: html, body, and the root app must be width:1595px; height:986px; margin:0; overflow:hidden.
- The generated HTML must not create page scroll: documentElement/body scrollWidth=1595 and scrollHeight=986.
- Do not use any visible overflow-y:auto or overflow-y:scroll container.
- Do not create a 2048px tall page. All source-visible content must be within y=0..986.
- Use fixed/absolute layout bands, not natural document flow.
- All table/body text must be horizontal. No row label may wrap into vertical stacks.
- If a long value needs to fit, reduce font size or use ellipsis inside one horizontal line. Do not increase panel height.

Fixed source geometry:
- Top nav: x=0 y=0 w=1595 h=52.
- Left sidebar: x=0 y=52 w=206 h=934.
- Header toolbar: x=236 y=72 w=1343 h=45.
- KPI row: x=219 y=132 w=1366 h=99.
- Middle work area: y=246..606.
  - Left template table card: x=219 y=246 w=740 h=360.
  - Right strategy editor card: x=972 y=246 w=612 h=360.
- Bottom diagnostics row: y=640..946.
  - 字段映射预览: x=4 y=640 w=420 h=306.
  - 队列运行情况: x=437 y=640 w=386 h=306.
  - 校验错误样例: x=833 y=640 w=362 h=306.
  - 发布校验清单: x=1207 y=640 w=377 h=306.

Brand and shell:
- Top-left brand must match the IMAGE2 source: UNIVIEW wordmark with cyan VIEW, vertical divider, 固定资产管理系统.
- Active top tab: 系统运营中枢.
- Sidebar is the dark system settings navigation. Active menu item: 导入导出配置.
- Use line icons only. No emoji. No gray square placeholders.

Header:
- Title: 导入导出模板与队列配置台
- Subtitle: 统一维护模板版本、字段映射、校验规则、导入队列、导出权限、水印与审计留痕。
- Buttons, all visible on the right: 新建模板, 保存草稿, 提交校验, 试运行.

KPI row:
- Four cards with exact labels and values:
  1. 模板数, 16, 含导入 8 / 导出 8
  2. 待发布, 3, 含 CIP 费用模板 1
  3. 导入队列, 9, 今日处理中 4，今日失败 2
  4. 导出权限, 5, 受限模板 2，需审批 1

Middle left table:
- Title: 导入导出模板列表.
- Render exactly 5 horizontal rows in the 740x360 panel. Row height should be compact, about 44-48px.
- Required rows:
  待建资产导入
  CIP 费用归集导入
  资产台账导出
  审计取证导出
  供应商基础资料导入
- Required columns: 模板名称, 模板键, 适用对象, 字段映射, 校验规则, 队列策略, 状态, 操作.
- Use a CSS grid or table-layout:fixed pattern so every row remains a single horizontal line.
- Long first-column names may be 10px or 11px but must remain horizontal and visible.
- Pagination must be visible inside the panel: 共 5 条, 1, 10 条/页.

Middle right editor:
- Title: 导入导出策略编排.
- Progress text: 完成度 8/8.
- Fit all 8 field rows and the 3 bottom buttons inside y=246..606. Use compact rows around 30px.
- Required field rows:
  模板版本 = v2.3.0（草稿）
  文件格式 = Excel（.xlsx）
  批量上限 = 10,000 行
  字段校验 = 启用（必填 + 格式 + 业务规则）
  重复处理 = 按唯一键去重，重复更新
  错误报告 = 生成错误报告（分工作表输出）
  导出控制 = 脱敏 + 水印（公司名 + 时间戳）
  队列策略 = 导入默认队列（并发 3，失败重试 2 次）
- Buttons inside this card: 保存草稿, 提交校验, 试运行.

Bottom cards:
- All four cards must be visible as one row, top y=640, bottom y<=946.
- Card 1 字段映射预览: include source-like mapping lines and legend labels 已映射, 未映射, 类型不匹配, 可选映射.
- Card 2 队列运行情况: tabs exactly 全部队列, 导入队列（3）, 导出队列（2） and link 查看队列详情.
- Card 3 校验错误样例: include line numbers 23, 45, 67, 89, 112 and link 查看全部错误（2）.
- Card 4 发布校验清单: include six pass/check rows and link 查看校验报告.
- The three footer links 查看队列详情, 查看全部错误（2）, 查看校验报告 must have bottom <= 946.

Required exact strings:
- 导入导出模板与队列配置台
- 导入导出模板列表
- 导入导出策略编排
- 待建资产导入
- CIP 费用归集导入
- 资产台账导出
- 审计取证导出
- 供应商基础资料导入
- v2.3.0（草稿）
- Excel（.xlsx）
- 启用（必填 + 格式 + 业务规则）
- 生成错误报告（分工作表输出）
- 脱敏 + 水印（公司名 + 时间戳）
- 导入默认队列（并发 3，失败重试 2 次）
- 导入队列（3）
- 导出队列（2）
- 查看队列详情
- 查看全部错误（2）
- 查看校验报告

Forbidden exact failures:
- 导入队列(3)
- 导出队列(2)
- 导入导出策略编辑
- undefined
- NaN
- Lorem
- Vertical stacked Chinese row names.
- Any link or card footer below y=946.
