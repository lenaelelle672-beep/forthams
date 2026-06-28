100/100 pixel-fidelity transcription. IMAGE2 v2 screenshot is the only source of truth. Do not redesign, simplify, reinterpret, or change business data. Preserve the exact UNIVIEW top-left brand mark from the source.

Fix only the remaining coordinate failures in the current screen. Use inline CSS or a small `<style>` block. Do not rely on Tailwind generated classes.

Keep viewport and document exactly 1595x986 with no scrolling. Keep all current table rows, field rows, card titles, Chinese text, and colors unchanged.

1) Right editor buttons:
Inside the right editor panel only, the action buttons `保存草稿`, `提交校验`, `试运行` must render at y about 586px and bottom <= 606px.
If moving the existing row is unreliable, hide only the old right-editor row and add a coordinate-locked replacement row:
`position: fixed; left: 1092px; top: 584px; z-index: 30; display:flex; gap:12px;`
Do not hide or move the top toolbar buttons.

2) Bottom links:
Add visible coordinate-locked footer links, matching the IMAGE2 source:
`查看队列详情` at `position: fixed; left: 687px; top: 928px; z-index: 30;`
`查看全部错误（2）` at `position: fixed; left: 1014px; top: 928px; z-index: 30;`
`查看校验报告` at `position: fixed; left: 1372px; top: 928px; z-index: 30;`
Use 12px blue link styling. Hide old offscreen duplicate footer links if needed.

Verifier gates: those five texts must be visible inside x 0..1595, y 640..946 for bottom links, and y 520..606 for right-editor buttons. No page scroll.
