Repair the current generated 外部系统配置 screen from attempt4 only.

This is a narrow 100/100 pixel-fidelity repair against IMAGE2 source `integration-subpage-01-external-systems-v2.png`.
Do not redesign the page. Do not re-layout the KPI row, system list cards, center table, right system attributes card, or publish checklist.
Preserve attempt4 geometry because it is the closest source-like structure:
- right `系统属性` starts at the same y band as the status strip,
- status strip stops before the right column,
- KPI cards remain one horizontal row,
- `接入系统清单` keeps all six visible rows,
- bottom `接入链路预览` and `同步策略` stay in the same lower band,
- right `发布校验 5/6` remains fully visible.

Fix exactly these two source mismatches:

1. Source text correction:
- Replace every visible and DOM occurrence of `待补认证` with exact source text `待认证`.
- Keep other status text unchanged: `已启用`, `在线`, `试运行`, `异常`, `待确认`.
- `待补认证` must not appear anywhere in the exported HTML.

2. Bottom `同步策略` visibility:
- In the real 1586 x 992 browser screenshot, the `同步策略` card must visibly show all four source rows:
  1. `全量初始化` with `首次接入或结构变更时执行全量拉取`
  2. `增量同步` with `基于时间戳/ID 增量拉取变更数据`
  3. `失败重试` with `失败自动重试 3 次，间隔 5 分钟`
  4. `审计归档` with `同步记录与变更日志长期留存`
- The fourth row `审计归档` must be visible above y=958, not hidden below the viewport and not only present in HTML.
- Make only the `同步策略` card body more compact if needed: row height 38-42px, icon 24px, row gap 3-4px, description 11px.
- Do not add an internal scrollbar.
- Do not increase document height.
- Do not hide or clip the adjacent `接入链路预览` panel.

Hard fail conditions:
- Any `待补认证` text remains.
- `审计归档` or `同步记录与变更日志长期留存` is missing from the visible 1586 x 992 screenshot.
- KPI cards become a 2x2 block or move into the left column.
- Right `系统属性` clips `数据范围` or `失败处理`.
- Center `接入系统清单` loses the sixth row `异常队列 Webhook`.
- Any source-visible content requires page-level or internal scrolling.
