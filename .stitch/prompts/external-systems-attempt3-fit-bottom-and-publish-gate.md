Repair the current generated DESIGN screen for the 外部系统配置 IMAGE2 page.

This is still a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 source screenshot remains the only source of truth.
Do not change business data, labels, row order, table text, form text, action labels, or status values.
Do not use a different admin template.
Do not add emoji.

Hard failure to fix:
- At a real browser viewport of 1586 x 992, the current generated page pushes the bottom panels below the fold.
- The current right `系统属性` panel is too tall and hides `发布校验 5/6`.
- The current center `接入系统清单` table is too tall; it delays `接入链路预览` and `同步策略` until y≈840, while the IMAGE2 source shows those bottom panels fully visible in the same viewport.

Required geometry at 1586 x 992:
- Keep body exactly 1586 x 992 and overflow hidden.
- Keep top nav height about 56px.
- Keep left sidebar close to source width, about 193px, not a 220px wide generic sidebar.
- Main content starts near x≈211, with page title y≈74.
- Header/action row must be compact: title/subtitle/actions together no taller than about 64px.
- Status strip y≈141, height about 39px.
- Main three-column work area starts around y≈193.
- Left system list column width about 218px.
- Center column width about 742px.
- Right system panel width about 365px.

Center column vertical plan:
- KPI row: y≈193 to y≈270.
- `接入系统清单` panel: y≈291 to y≈676.
- Table row density must be compact enough to show all six rows plus footer inside that panel.
- `接入链路预览` and `同步策略` panels: y≈690 to y≈922, fully visible.
- Do not let the bottom panels extend below the browser screenshot.

Right column vertical plan:
- `系统属性` card y≈141 to y≈632.
- Use compact 34px field rows; two-line labels are okay only where the source has them, but inputs must not become oversized.
- Keep the three buttons `保存系统`, `测试连接`, `查看审计` visible at the bottom of the system attributes card.
- `发布校验 5/6` card starts around y≈647 and ends around y≈922.
- All six checklist rows must be visible: 系统编码, 认证方式, 接口端点, 字段映射 待确认, 失败处理, 审计留痕.

Top-left brand:
- Preserve source-like `UNIVIEW | 固定资产管理系统` wordmark in the dark nav.
- Do not replace it with a generic logo.

Text that must remain present:
- `外部系统接入配置台`
- `MES 设备台账连接测试通过`
- `ERP/EHR 回写待补 1 项`
- `PO/合同同步规则已启用`
- `接入系统清单`
- `MES 设备台账`
- `异常队列 Webhook`
- `接入链路预览`
- `同步策略`
- `系统属性`
- `发布校验 5/6`
- `字段映射`
- `待确认`

Final self-check:
- Browser screenshot at 1586 x 992 shows the full right publish checklist and both bottom center panels.
- No page-level scrollbars.
- No horizontal overflow.
- No required content hidden behind internal scroll.
