Edit the selected Stitch DESIGN screen into a new persistent DESIGN/HTML screen.

This is a strict 100/100 transcription repair for `system-params-subpage-03-file-storage-v2.png`.
Do not redesign. Preserve the current shell, sidebar, title, KPI cards, table, right editor, and four bottom cards.

Repair only vertical overflow and clipped lower content.

Required canvas:
- Viewport/document/body exactly 1595 x 986.
- documentElement scrollWidth=1595 and scrollHeight=986.
- body scrollWidth=1595 and scrollHeight=986.
- No page scroll. No internal scroll containers.

Vertical compression targets:
- The main strategy table must show all five rows above y=595:
  `资产附件主桶`
  `CIP 验收附件归档桶`
  `缩略图生成策略`
  `Office 预览策略`
  `安全扫描规则`
- The right title must be exactly `文件存储策略编排`, not `文件存储策略编辑`.
- The right editor buttons `保存草稿`, `提交校验`, `测试连接` must fit inside y=540..635.
- The bottom cards must remain visible:
  `存储拓扑`, `缩略图队列`, `预览格式与安全扫描`, `归档与失败回退`.
- Bottom links must be visible above y=970:
  `查看全部队列`, `查看更多格式配置`, `查看失败明细`.

How to fit:
- Reduce vertical padding in the KPI cards, strategy table rows, and right editor rows.
- Move the bottom card row slightly upward if needed.
- Use compact 11-12px type for lower card table rows.
- Do not remove source-visible rows or business data.

Required text to preserve:
`对象存储（OSS）- 阿里云`
`缩略图生成策略（THUMBNAIL_POLICY）`
`启用（病毒扫描 + 敏感内容识别）`
`回退到本地临时存储（7 天）`
`diagram_v2.png`
`设备铭牌.jpg`
`plan_floor3.dwg`
`DWG`
`EXE`

Forbidden:
- `文件存储策略编辑`
- page scroll
- internal scrollbars
- hiding bottom links
- placeholder square icons
