Create a new persistent DESIGN/HTML screen by transcribing the selected uploaded IMAGE2 screenshot.

Source of truth: `system-params-subpage-04-import-export-v2.png`.
Do not redesign. Do not use a generic admin template.

Canvas and CSS:
- Exact viewport/canvas: 1595 x 986.
- html, body, root: width 1595px; height 986px; margin 0; overflow hidden.
- No page scroll, no internal visible scroll containers.
- Use absolute/fixed bands. Do not create a 2048px tall page.

Critical geometry:
- Top nav y 0-52.
- Sidebar x 0-206, y 52-986, dark system settings nav, active `导入导出配置`.
- Header x 236 y 72 w 1343 h 45.
- KPI row x 219 y 132 w 1366 h 99.
- Middle row y 246-606:
  - left table x 219 y 246 w 740 h 360.
  - right editor x 972 y 246 w 612 h 360.
- Bottom row y 640-946 with four cards:
  - x 4 w 420 `字段映射预览`
  - x 437 w 386 `队列运行情况`
  - x 833 w 362 `校验错误样例`
  - x 1207 w 377 `发布校验清单`

Must include exact text:
`导入导出模板与队列配置台`
`导入导出模板列表`
`导入导出策略编排`
`待建资产导入`
`CIP 费用归集导入`
`资产台账导出`
`审计取证导出`
`供应商基础资料导入`
`v2.3.0（草稿）`
`Excel（.xlsx）`
`启用（必填 + 格式 + 业务规则）`
`生成错误报告（分工作表输出）`
`脱敏 + 水印（公司名 + 时间戳）`
`导入默认队列（并发 3，失败重试 2 次）`
`导入队列（3）`
`导出队列（2）`
`查看队列详情`
`查看全部错误（2）`
`查看校验报告`

Table requirement:
- The five template names must be horizontal single-line rows, not stacked/wrapped.
- Use compact font size if necessary. Row height 42-48px.
- Columns: 模板名称, 模板键, 适用对象, 字段映射, 校验规则, 队列策略, 状态, 操作.
- Pagination visible: 共 5 条, 1, 10 条/页.

Right editor requirement:
- All 8 rows must fit between y 246 and y 606.
- Buttons `保存草稿`, `提交校验`, `试运行` must be inside the right editor near y 545-590.

Bottom requirement:
- Tabs `全部队列`, `导入队列（3）`, `导出队列（2）` visible in the queue card.
- Links `查看队列详情`, `查看全部错误（2）`, `查看校验报告` bottom <= 946.
- No halfwidth `导入队列(3)` or `导出队列(2)`.
- No `导入导出策略编辑`, undefined, NaN, Lorem.

Brand:
- Top-left brand exactly like source: UNIVIEW with cyan VIEW, divider, 固定资产管理系统.
- Active top tab `系统运营中枢`.
- Use line icons, no emoji, no gray placeholder squares.
