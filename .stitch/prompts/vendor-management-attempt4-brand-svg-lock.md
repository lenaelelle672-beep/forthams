Edit only the top-left brand icon of the selected Stitch DESIGN screen.

This remains a 100/100 pixel-fidelity transcription of the IMAGE2 v2 source:
`master-data-subpage-04-vendor-management-v2.png`.

Keep every other visible element unchanged:
- no layout movement
- no table row/column changes
- no text changes
- no right-panel changes
- no bottom `交易反查台` or `供应商引用矩阵` changes
- no page scrollbars or internal overflow changes

Only fix the brand icon mismatch:

Current bad state:
- The top-left icon is a generic white circle/exclamation symbol.

Required source-like state:
- A small blue rounded-square product icon at the far left of the dark navy top bar.
- Size about 26px by 26px.
- Rounded square blue background, matching source.
- Inside it are four small white rounded-dot / petal shapes arranged like a compact clover/asset mark.
- It is followed immediately by the white text `固定资产管理系统`.
- Do not add `UNIVIEW` because the source page does not show it.
- Keep the vertical divider after the brand lockup exactly where it is.

If you need a concrete markup target, replace only the current first brand SVG with an inline SVG shaped like this:
- outer `<rect x="2" y="2" width="20" height="20" rx="4" fill="#ffffff">` is NOT acceptable.
- use blue rounded square background `#2f7df6` or source-like blue.
- add four white small rounded circles/leaf dots at approximate centers `(8,8)`, `(16,8)`, `(8,16)`, `(16,16)`.

Important:
- Produce a persistent exported HTML result.
- Do not merely describe the change.
- Do not replace the brand with a generic alert, shield, gear, cube, or letter icon.
