Edit the selected Stitch DESIGN screen into a new persistent DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription repair for `system-params-subpage-04-import-export-v2.png`.
Do not redesign and do not change any business data.

Current screen already passes:
- 1595 x 986 fixed viewport.
- zero real scrollers.
- all five left table rows horizontal and visible.
- bottom card titles visible.

Preserve those passing parts.

Fix only these verifier gates:

1. Right editor vertical compression:
- Move the right editor content upward enough so:
  - `导入导出策略编排` bottom <= y=310.
  - `导入默认队列（并发 3，失败重试 2 次）` bottom <= y=606.
  - Buttons `保存草稿`, `提交校验`, `试运行` are inside y=520..606.
- Keep all right editor field values exact:
  `v2.3.0（草稿）`
  `Excel（.xlsx）`
  `启用（必填 + 格式 + 业务规则）`
  `生成错误报告（分工作表输出）`
  `脱敏 + 水印（公司名 + 时间戳）`
  `导入默认队列（并发 3，失败重试 2 次）`

2. Bottom queue tabs:
- Add or correct exact full-width punctuation labels in the queue card:
  `导入队列（3）`
  `导出队列（2）`
- Do not use ASCII parentheses `(3)` or `(2)`.

3. Bottom footer links:
- Move the bottom card footer links upward by about 115px so all are inside y=640..946:
  `查看队列详情`
  `查看全部错误（2）`
  `查看校验报告`

Hard gates:
- html/body/documentElement remain exactly 1595 x 986.
- realScrollerCount remains 0.
- No page scroll. No internal scrollbars.
- Preserve exact UNIVIEW brand lockup and source dark shell.
