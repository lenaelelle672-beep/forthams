Edit the selected Stitch DESIGN screen into a new persistent DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot `system-params-subpage-03-file-storage-v2.png` is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not change business data.

Preserve the exact top-left IMAGE2 brand mark from the source screenshot.

Current candidate is close. Repair only these defects:
1. Remove the main content internal scrollbar. The main content must be a fixed 1595 x 986 frame, not `overflow-y-auto`.
2. Remove the table internal scrollbar in `文件存储策略列表`.
3. The bottom four cards must be visible in the viewport, not hidden below an internal scroll area.

Hard gates:
- html/body/documentElement: width 1595, height 986, scrollWidth 1595, scrollHeight 986, overflow hidden.
- No visible element uses overflow auto/scroll with real overflow.
- Keep the existing dark top shell, dark sidebar, KPI cards, left table, right editor, and four bottom cards.

Vertical placement:
- Header and KPI cards stay as close as possible to the current candidate/source.
- Left table and right editor fit in y=246..606.
- Bottom four cards start at y=620 and end by y=960.
- Bottom links must be visible above y=970:
  `查看全部队列`
  `查看更多格式配置`
  `查看失败明细`

Keep these current passing items unchanged:
- All five table rows remain visible above y=595:
  `资产附件主桶`, `CIP 验收附件归档桶`, `缩略图生成策略`, `Office 预览策略`, `安全扫描规则`.
- Right editor title remains exactly `文件存储策略编排`.
- Right editor values remain visible:
  `对象存储（OSS）- 阿里云`
  `缩略图生成策略（THUMBNAIL_POLICY）`
  `启用（病毒扫描 + 敏感内容识别）`
  `回退到本地临时存储（7 天）`

Use compact lower-card rows if needed:
`diagram_v2.png`, `设备铭牌.jpg`, `plan_floor3.dwg`, `DWG`, `EXE`.
