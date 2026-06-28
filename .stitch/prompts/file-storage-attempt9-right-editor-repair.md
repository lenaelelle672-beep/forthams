Repair the generated 文件存储配置 screen against the IMAGE2 v2 source.

This remains a 100/100 pixel-fidelity transcription task, not a redesign task.
Preserve the current good structure from the generated candidate:
- dark top shell and dark system sidebar,
- KPI four-card row,
- five visible rows in `文件存储策略列表`,
- bottom four cards visible inside the 1595 x 986 viewport,
- footer links `查看全部队列`, `查看更多格式配置`, `查看失败明细`.

Only repair the right middle editor and exact text drift:
- Change right editor title from `文件存储策略编排` to exact source title `文件存储策略编辑`.
- Remove the right editor internal scrollbar. All eight form rows must be visible in the 986px screenshot:
  `存储后端`, `附件目录`, `缩略图策略`, `预览格式`, `归档生命周期`, `访问权限`, `安全检查`, `失败回退`.
- Keep right editor buttons visible: `保存草稿`, `提交校验`, `测试连接`.
- Use exact source punctuation:
  `对象存储（OSS）- 阿里云`,
  `启用（病毒扫描 + 敏感内容识别）`,
  `回退到本地临时存储（7 天）`.
- Keep middle table footer text visible, including `共 5 条`, page `1`, and `10 条/页`.
- Keep search placeholder visually as `搜索存储策略 / 桶名 / 模块`.

Do not change:
- the bottom card row position or content,
- the left table row count,
- the dark shell/sidebar,
- the KPI cards,
- the 1595 x 986 fixed frame.

Hard reject:
- any page-level scroll,
- any bottom card/footer pushed below the viewport,
- right editor still scrolling internally,
- vertical stacked text,
- missing `安全检查` or `失败回退`.
