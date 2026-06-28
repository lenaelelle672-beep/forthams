Refine the selected notification channels DESIGN screen into a fresh persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `notification-subpage-06-notification-channels-v2.png` is the only source of truth.
The selected screen `5c0566b927a945e38b79e677c485f421` already passes the real browser gates for:
- exact 1585 x 992 frame,
- no document scroll,
- no internal scroll containers,
- right `渠道参数编辑区` completeness,
- bottom `发布校验清单（12 项）` visibility,
- forbidden text absence.

Make only this one persistent text/layout repair:
- In the bottom `渠道健康矩阵` card, change the split timestamp `2025-05-21` + `09:12:11` into the exact visible one-line text `2025-05-21 09:12:11`.
- The text must appear in the exported HTML body as the exact string `2025-05-21 09:12:11`.
- Keep the timestamp visible within the 1585 x 992 viewport.
- If needed, widen that timestamp cell or reduce the timestamp font size slightly; do not move or resize any major panel.

Absolute freeze:
- Do not change the top shell, sidebar, page title, action buttons, status bars, left `通知渠道列表`, `渠道参数编辑区`, bottom cards, `发布校验清单（12 项）`, `短信备用未配置`, or `查看全部 12 项校验详情`.
- Do not change any business data other than joining the existing timestamp into the source-exact one-line value.
- Do not introduce `NGTALK_H5`, `张三（资产管理部）`, `发布校验清单 (12 项)`, `undefined`, or `NaN`.
- Do not add page scroll or internal scrollbars.
- Do not return DOM operations only; return a new persistent DESIGN screen with full exportable HTML.

Final gates:
- document/body size remains exactly 1585 x 992.
- `DINGTALK_H5`, `签名密钥（HMAC-SHA256）`, `降级到站内消息`, `张三（资产管理员）`, `审计要求`, `必达`, `普通` remain visible.
- `2025-05-21 09:12:11` is present and visible.
- `发布校验清单（12 项）`, `短信备用未配置`, `查看全部 12 项校验详情` remain visible.
