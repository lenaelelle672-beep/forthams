Repair only the bottom center panels of the current 外部系统配置 screen.

This is a strict pixel-fidelity repair. Do not redesign the page. Do not change business text, shell, sidebar, table rows, or right form data.

Hard mismatch:
- In the IMAGE2 source, the bottom `同步策略` panel shows four complete strategy rows: `全量初始化`, `增量同步`, `失败重试`, `审计归档`.
- The current generated screen shows only the first three strategy rows clearly; `审计归档` is missing or clipped below the viewport.

Required repair:
- Keep the overall layout from attempt4: right `系统属性` starts level with the status strip and `发布校验 5/6` is fully visible.
- Keep the bottom panels at y≈741 to y≈970 or source-like equivalent, but reduce vertical padding and row heights inside `同步策略`.
- `同步策略` must show all four rows fully:
  1. `全量初始化` with `首次接入或结构变更时执行全量拉取`
  2. `增量同步` with `基于时间戳/ID 增量拉取变更数据`
  3. `失败重试` with `失败自动重试 3 次，间隔 5 分钟`
  4. `审计归档` with `同步记录与变更日志长期留存`
- If needed, reduce icon boxes and row gaps in the bottom two panels only.
- Do not increase page height, do not introduce scrollbars, and do not hide `发布校验 5/6`.
- At 1586 x 992 browser screenshot, `审计归档` must be visible above the bottom edge.
