Edit the selected Stitch DESIGN screen into a new persistent DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription repair for `system-params-subpage-03-file-storage-v2.png`.
Do not redesign and do not change business data.

Current screen already has correct viewport size and zero real scrollers. Preserve that.

Make only these coordinate fixes:
1. Move the right-editor button row up by 40px so `保存草稿`, `提交校验`, `测试连接` sit within y=540..635.
2. Keep the bottom four card containers at y=620..960, but move their internal rows and footer links up by about 220px so all required lower-card text is visible inside the viewport.
3. Do not add scrollbars or hidden overflow content below y=986.

Required bottom card content must be visible:
`diagram_v2.png`
`设备铭牌.jpg`
`plan_floor3.dwg`
`DWG`
`EXE`
`查看全部队列`
`查看更多格式配置`
`查看失败明细`

Keep unchanged:
- `文件存储与缩略图配置台`
- all five table rows
- `文件存储策略编排`
- right editor values and green validation dots
- source dark top shell, source dark sidebar, and exact UNIVIEW brand lockup

Hard gates:
- html/body/documentElement remain exactly 1595 x 986.
- realScrollerCount must stay 0.
- No page scroll. No internal scrollbars.
