Repair the current 外部系统配置 generated screen against the IMAGE2 source.

This is a strict 100/100 pixel-fidelity repair, not a redesign.
Keep all text and business data unchanged. Do not add emoji. Do not change the selected page.

Observed mismatch to fix:
- The current screen places the right `系统属性` panel too low, starting around the KPI row.
- In the IMAGE2 source, the right `系统属性` panel begins at the same vertical band as the status strip, around y=141, immediately under the header actions.
- In the IMAGE2 source, the status strip does NOT span under the right column; it spans only the left/center content width and stops before the right panel.

Required coordinate structure at 1586 x 992:
- Top shell height 56px.
- Main header/title/action row y=56 to y=131.
- Main grid starts at y=141.
- Use three columns:
  - left list column x≈211 w≈218
  - center column x≈441 w≈731
  - right column x≈1196 w≈365
- Status strip: x≈211, y≈141, w≈962, h≈39. It must stop before the right column.
- Right `系统属性` card: x≈1196, y≈141, w≈365, h≈491.
- Right `发布校验 5/6` card: x≈1196, y≈646, w≈365, h≈276.
- Left list, KPI cards, and center table work area still start around y≈193.

Center/left area:
- KPI row remains y≈193 to y≈270.
- `接入系统清单` y≈282 to y≈676, all six rows and footer visible.
- Bottom cards `接入链路预览` and `同步策略` y≈690 to y≈922, fully visible.

Right panel contents:
- `系统属性` title remains at the top of the right card.
- Keep all 10 fields visible, compact, and in order:
  系统名称, 系统编码, 系统类型, 认证方式, Base URL, 健康检查路径, 同步方向, 负责人, 数据范围, 失败处理.
- Keep buttons `保存系统`, `测试连接`, `查看审计` visible at the bottom of the right card.
- Keep `发布校验 5/6` fully visible with six rows and the `字段映射` row showing `待确认`.

Source fidelity constraints:
- Keep the top-left `UNIVIEW | 固定资产管理系统` brand lockup.
- Keep left sidebar active group `集成配置` and active item `外部系统配置`.
- Keep source-like white/pale blue panel styling.
- No page-level scrollbars and no internal scroll hiding required content.
