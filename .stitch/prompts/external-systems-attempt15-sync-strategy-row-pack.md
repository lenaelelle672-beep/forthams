Refine the selected external systems DESIGN screen into a new persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The selected screen `b091f3de4b6649f089a003462bd39c3a` is the best current visual baseline.
It passes x-band layout, persistent `待认证` text, exact document size, and no-scroll gates.
It fails only because the fourth `同步策略` row is below the viewport:
- `审计归档` is at y≈975..992.
- `同步记录与变更日志长期留存` is at y≈998..1011.

Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.

Hard freeze everything except the inner content of the `同步策略` card:
- Do NOT move the top shell.
- Do NOT move the sidebar.
- Do NOT move the title/status/action/filter/header area.
- Do NOT move the left system list.
- Do NOT move the KPI cards.
- Do NOT move or restyle the center `接入系统清单` table.
- Do NOT move the right `系统属性` / `发布校验 5/6` rail.
- Do NOT move the `接入链路预览` card.
- Do NOT change x-bands.

Only edit the `同步策略` card at x≈823..1181, y≈773..972:
- Keep the card title `同步策略` unchanged.
- Keep four rows:
  1. `全量初始化` / `首次接入或结构变更时执行全量拉取`
  2. `增量同步` / `基于时间戳/ID 增量拉取变更数据`
  3. `失败重试` / `失败自动重试 3 次，间隔 5 分钟`
  4. `审计归档` / `同步记录与变更日志长期留存`
- Pack these four rows inside the existing card:
  - row top targets inside viewport:
    - `全量初始化`: y≈826.
    - `增量同步`: y≈862.
    - `失败重试`: y≈898.
    - `审计归档`: y≈934.
  - description line for `同步记录与变更日志长期留存`: y≈952..965, bottom <= 970.
  - icon tiles 26px.
  - title text 13px, description 11px, line-height 13px.
  - vertical gap between rows <= 4px.
- If needed, reduce the top padding below card header; do not move the card itself.

Required gates after export:
- Browser text includes `待认证`, `同步记录与变更日志长期留存`, `审计归档`, `接入系统清单`, `发布校验 5/6`, `异常队列 Webhook`, `新建外部系统`.
- Browser text does NOT include `待补认证`.
- `同步记录与变更日志长期留存` visible bounding box bottom <= 970.
- `系统属性` remains on far right with x > 1190.
- documentElement/body exactly 1586 x 992.
- real internal scroll container count is 0.
- screenshot must not have a blank center area.
