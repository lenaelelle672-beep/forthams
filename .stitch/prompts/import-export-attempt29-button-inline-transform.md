Edit the selected Stitch DESIGN screen into a NEW persistent DESIGN/HTML screen with its own downloadable `htmlCode.downloadUrl`.

This is the final verifier-gate repair for `system-params-subpage-04-import-export-v2.png`.
Do not redesign. Do not change business data.

Current selected screen already passes every gate except right editor button vertical position:
- 1595 x 986 viewport/document/body
- zero scrollers
- missing text []
- all left table rows visible
- all right field values visible
- right panel title visible with bottom <= 310
- bottom card titles visible
- bottom links visible with bottom <= 946

Preserve all of those passing gates exactly.

Only change:
In the right `导入导出策略编排` editor panel, find the footer row containing the three buttons:
`保存草稿`, `提交校验`, `试运行`.

Remove the unreliable Tailwind negative margin approach (`-mt-2`) and set an inline style on that exact row:
`style="transform: translateY(-8px);"`

Do not move or alter the top toolbar buttons with the same labels.
Do not change the fixed bottom footer links.
Do not add scrollbars.

Required final rendered text boxes for the right-editor buttons:
- x >= 972
- y >= 520
- bottom <= 606
