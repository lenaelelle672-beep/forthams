Repair this generated screen against the IMAGE2 v2 source for 导入导出配置.

This remains a 100/100 pixel-fidelity transcription task, not a redesign task.
Do not change business data, shell style, colors, table columns, or the current five-row middle table.
Keep the browser frame exactly 1595 x 986 with no page-level scroll.

Current failure to fix:
- The bottom four cards are too low and their footer links are clipped outside the 986px viewport.
- `导入队列(3)` and `导出队列(2)` must use fullwidth parentheses: `导入队列（3）`, `导出队列（2）`.
- `查看队列详情`, `查看全部错误（2）`, and `查看校验报告` must be visibly inside the screenshot, not hidden below the viewport.
- `10 条/页` in the middle table footer must remain visibly inside the screenshot.

Only perform a vertical density repair:
- Keep the header, dark shell, left active nav, four KPI cards, middle left table, and middle right strategy editor visually the same.
- Reduce vertical padding in the title/header band, KPI row, and middle workspace just enough to move the bottom row upward.
- The bottom row should start around y=620-635 and end before y=946, with all four footer links visible.
- Do not make table text vertical, wrapped, ellipsized, or hidden.
- Do not add internal scrollbars or overflow-hidden clipping to the bottom cards.
- Do not remove any of the five middle table rows or the eight right strategy rows.
- Do not remove the three right strategy buttons: `保存草稿`, `提交校验`, `试运行`.

Acceptance before finishing:
- Browser visible text includes `导入队列（3）`, `导出队列（2）`, `10 条/页`, `查看队列详情`, `查看全部错误（2）`, and `查看校验报告`.
- Document width/height are 1595 x 986.
- No required bottom-card content is below the viewport edge.
