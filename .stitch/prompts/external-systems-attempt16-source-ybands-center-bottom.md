Refine the selected external systems DESIGN screen into a new persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The selected screen `78dc195c279541edb290462992307518` has correct x-bands, persistent `待认证`, no scroll containers, and all required text. It still fails visual source fidelity because the center `接入系统清单` table is too tall and pushes the bottom cards down.

Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.

Hard freeze x-bands and right rail:
- Sidebar x=0..193 unchanged.
- Left system list x≈216..435 unchanged.
- Center column x≈451..1181 unchanged.
- Right rail x≈1198..1562 unchanged.
- Do not move `系统属性` from the far right.
- Do not blank or rebuild the main work area.

Only recalibrate the center-column y-bands to match the IMAGE2 source:

1. KPI row:
- Keep KPI cards at y≈194..271.

2. Center table card `接入系统清单`:
- Source target card y≈284..678, not y≈284..760.
- Keep all six rows visible:
  `MES 设备台账`, `ERP 固资总账`, `EHR 人员组织`, `PO/合同平台`, `供应商门户`, `异常队列 Webhook`.
- Compact table:
  - header height about 38px.
  - body row height about 41px.
  - text size 12px, line-height 16px.
  - allow only source-like two-line cells where the source uses wrap; avoid excessive vertical stacking.
- Footer `共 6 条`, `1`, `10 条/页` must be visible around y≈650..670.

3. Bottom card row:
- Move both bottom cards up to source target y≈690..922.
- `接入链路预览` at x≈451..810, y≈690..922.
- `同步策略` at x≈823..1181, y≈690..922.
- In `同步策略`, all four rows must be visible:
  `全量初始化`, `增量同步`, `失败重试`, `审计归档`.
- Description `同步记录与变更日志长期留存` must be fully visible with bottom <= 930.
- Leave comfortable blank background below the cards like the source, not a card clipped at the viewport edge.

4. Left and right columns:
- Keep left list card positions and `新建外部系统` visible.
- Keep right `系统属性` and `发布校验 5/6` exactly visible.
- Right rail must not overlap the center bottom cards.

Persistent text gates:
- Use `待认证` everywhere.
- `待补认证` is forbidden.
- Keep `同步记录与变更日志长期留存`.
- Keep `发布校验 5/6`.
- Keep `异常队列 Webhook`.

No-scroll gates:
- documentElement/body exactly 1586 x 992.
- no page scroll.
- no internal scroll containers.
- no `overflow-y-auto`, `overflow-auto`, or real element overflow.

Final self-check:
- Screenshot visually matches the source 3-column layout and y-bands: table ends near y≈678, bottom cards start near y≈690.
- Browser text includes `待认证`, `同步记录与变更日志长期留存`, `审计归档`, `接入系统清单`, `发布校验 5/6`, `异常队列 Webhook`, `新建外部系统`.
- Browser text does NOT include `待补认证`.
- `同步记录与变更日志长期留存` has visible bounding box bottom <= 930.
- `系统属性` bounding box x > 1190.
