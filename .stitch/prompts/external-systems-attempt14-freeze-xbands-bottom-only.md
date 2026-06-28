Refine the selected external systems DESIGN screen into a fresh persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `integration-subpage-01-external-systems-v2.png` is the only source of truth.
Use selected screen `3eda2bbf931e4e5abc3f1c1097939a2b` as the visual baseline.

The previous attempt `20f65708122542cb95124836cc273777` is REJECTED because it broke the x-bands: the right `系统属性` panel moved into the center/left area and the center work area became blank. Do not repeat that.

Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.
Do not redesign or reinterpret the page.
Do not use your own default admin template.

Hard freeze x-bands from the baseline and source:
- Sidebar: x=0..193.
- Main content begins at x=212.
- Left system list: x≈216..435.
- Center KPI/table/bottom left cards: x≈451..1181.
- Right `系统属性` and `发布校验 5/6` rail: x≈1198..1562.
- The right rail MUST stay on the far right. Never place `系统属性` around x=217.
- The center `接入系统清单` table MUST stay at x≈451..1181 and y≈284..728 with six visible rows.
- Keep the table footer `共 6 条`, `1`, `10 条/页` visible around y≈704.

Only perform these repairs:

1. Persistent text correction:
- Replace every exported HTML/body occurrence of `待补认证` with exact source text `待认证`.
- `document.body.innerText` must contain `待认证`.
- `document.body.innerText` must NOT contain `待补认证`.

2. Remove the current center overflow:
- Current baseline has `DIV.center-col` with `scrollHeight=831`, `clientHeight=777`, overflow auto/hidden.
- Remove that real overflow by reducing bottom-card spacing/row height only.
- No internal scroll containers anywhere.
- document/body remains exactly 1586 x 992.

3. Bottom `同步策略` description fit:
- Preserve the bottom two cards:
  - `接入链路预览`: x≈451..810, y≈740..972.
  - `同步策略`: x≈823..1181, y≈740..972.
- Do NOT move these cards into the right rail.
- Do NOT move the right `系统属性` rail.
- Compact only the inner rows of `同步策略`:
  - reduce row gap.
  - use 11px description text and 13px line-height if needed.
  - reduce icon tile to about 28px.
  - row height about 38px.
- All four rows must be visible inside the `同步策略` card:
  `全量初始化`, `增量同步`, `失败重试`, `审计归档`.
- The description `同步记录与变更日志长期留存` must be fully visible with bottom <= 958.

4. Keep source-visible content:
- Left `新建外部系统` card remains visible near x≈216..435, y≈820..921.
- Right `系统属性` fields remain visible: `系统名称`, `系统编码`, `系统类型`, `认证方式`, `Base URL`, `健康检查路径`, `同步方向`, `负责人`, `数据范围`, `失败处理`.
- Right `发布校验 5/6` remains visible below right form.
- Center table keeps six rows: `MES 设备台账`, `ERP 固资总账`, `EHR 人员组织`, `PO/合同平台`, `供应商门户`, `异常队列 Webhook`.

Strict do-not-regress:
- Do not blank the center area.
- Do not put `系统属性` under the search/list column.
- Do not change document/body width or height.
- Do not introduce page scroll.
- Do not introduce internal scroll containers.
- Do not remove `同步记录与变更日志长期留存`.
- Do not remove `发布校验 5/6`.

Final self-check:
- Screenshot visually keeps the same 3-column source layout: left list, center table/bottom cards, right property rail.
- Browser text includes `待认证`, `同步记录与变更日志长期留存`, `审计归档`, `接入系统清单`, `发布校验 5/6`, `异常队列 Webhook`, `新建外部系统`.
- Browser text does NOT include `待补认证`.
- `同步记录与变更日志长期留存` has visible bounding box bottom <= 958.
- `系统属性` bounding box x is greater than 1190.
- documentElement/body are exactly 1586 x 992.
- real internal scroll container count is 0.
