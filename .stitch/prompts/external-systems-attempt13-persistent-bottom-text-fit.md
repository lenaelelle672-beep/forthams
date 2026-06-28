Refine the selected external systems DESIGN screen into a fresh persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `integration-subpage-01-external-systems-v2.png` is the only source of truth.
The selected screen `3eda2bbf931e4e5abc3f1c1097939a2b` is the best current baseline: it already has exact `1586 x 992` document size, source-like shell/sidebar/main layout, table rows, right `系统属性` panel, and bottom cards. It fails only on persistent text and bottom/overflow density.

Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data except the exact source text corrections listed below.

Page name: 外部系统接入配置台
Menu id: system-external-systems
Reference image: integration-subpage-01-external-systems-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/integration-subpage-01-external-systems-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-external-systems

Hard preserve:
- Top shell, left sidebar, title, subtitle, action buttons, status bar, left system cards, KPI cards, center `接入系统清单`, right `系统属性`, bottom `接入链路预览`, and bottom `同步策略`.
- Keep exact viewport and document/body size: 1586 x 992.
- Keep source-visible text and business values:
  `外部系统接入配置台`, `MES 设备台账`, `ERP 固资总账`, `EHR 人员组织`, `PO/合同平台`, `供应商门户`, `异常队列 Webhook`, `接入系统清单`, `系统属性`, `发布校验 5/6`, `接入链路预览`, `同步策略`, `全量初始化`, `增量同步`, `失败重试`, `审计归档`.

Critical persistent text repair:
- Replace every visible and DOM occurrence of `待补认证` with the source text `待认证`.
- After export, `document.body.innerText` must include `待认证` and must NOT include `待补认证`.
- Do not implement this as a non-persistent DOM operation; generate a new DESIGN screen whose exported HTML contains the corrected text.

Critical bottom fit repair:
- In the bottom middle/right `同步策略` card, all four strategy rows must be fully visible:
  1. `全量初始化` with description `首次接入或结构变更时执行全量拉取`
  2. `增量同步` with description `基于时间戳/ID 增量拉取变更数据`
  3. `失败重试` with description `失败自动重试 3 次，间隔 5 分钟`
  4. `审计归档` with description `同步记录与变更日志长期留存`
- In the current baseline, `审计归档` is at y≈968.5 and the description is below viewport at y≈992.5..1009.
- Move the `同步策略` card content upward and compact rows so the `同步记录与变更日志长期留存` text is visible with bottom <= 958.
- Suggested target:
  - bottom cards top y≈690 (not y≈741).
  - `同步策略` row height about 44px.
  - `审计归档` label y≈892..910.
  - `同步记录与变更日志长期留存` y≈916..934.

Critical overflow repair:
- Remove the real overflow container currently measured as `DIV.center-col` with `scrollHeight=831` and `clientHeight=777`.
- No internal scroll containers anywhere: no `overflow-y-auto`, no `overflow-auto`, no element with scrollHeight > clientHeight and overflow auto/scroll.
- No page scroll: document/body scrollHeight must remain 992.
- No horizontal scroll in center table/card.

Density instructions:
- To fit, reduce only vertical padding in the bottom `同步策略` card and center column lower gap.
- Do not reduce source-readable font below 11px.
- Do not hide any of the six center table rows.
- Keep the center table footer `共 6 条`, pagination `1`, and `10 条/页`.
- Keep the right `系统属性` panel and `发布校验 5/6` fully visible.
- Keep the left `新建外部系统` card visible.

Do not regress:
- Do not rename `外部系统接入配置台`.
- Do not remove `同步记录与变更日志长期留存`.
- Do not clip the right `发布校验 5/6` list.
- Do not introduce a sidebar or main-content scrollbar.
- Do not create document/body height > 992.

Final self-check:
- Browser text includes `待认证`, `同步记录与变更日志长期留存`, `审计归档`, `接入系统清单`, `发布校验 5/6`, `异常队列 Webhook`, `新建外部系统`.
- Browser text does NOT include `待补认证`.
- `同步记录与变更日志长期留存` has a visible bounding box with bottom <= 958.
- documentElement and body are exactly 1586 x 992.
- real internal scroll container count is 0.
