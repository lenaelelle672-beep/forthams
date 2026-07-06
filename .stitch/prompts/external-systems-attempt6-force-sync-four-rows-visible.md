Repair the current 外部系统配置 screen. This is a final visual gate repair.

Do not change top shell, sidebar, right system attributes, publish checklist, table data, or business text.

The previous version still fails because the HTML contains `审计归档`, but the real 1586 x 992 browser screenshot does not visually show it. The fix must be visual, not only textual.

Absolute visual requirement:
- In the real 1586 x 992 screenshot, inside the `同步策略` panel, these four labels must all be visible above the bottom edge:
  `全量初始化`, `增量同步`, `失败重试`, `审计归档`.
- The `审计归档` label and its description `同步记录与变更日志长期留存` must appear around y=930 to y=955, not below y=992.

How to repair:
- Keep the bottom `同步策略` panel title at the same top position, but make its four rows ultra-compact.
- Use row height about 36px, icon size about 24px, vertical gap 3px, description font about 11px.
- Remove any extra top/bottom padding inside the `同步策略` panel body.
- If needed, slightly reduce the height of the `接入系统清单` table panel by 12px and start the bottom panels 10px earlier, but keep all six table rows visible.
- Do not make the panel scroll internally.
- Do not hide the right `发布校验 5/6` rows.

Final visual self-check:
- A screenshot at 1586 x 992 must visibly show `审计归档`.
- If `审计归档` exists only in HTML but not the screenshot, the task is failed.
