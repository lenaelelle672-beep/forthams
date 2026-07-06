This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

IMPORTANT PERSISTENCE REQUIREMENT:
- Do NOT return DOM operations only.
- Create a new persistent Stitch DESIGN screen with exported HTML containing the fixes.

Base candidate:
- Start from generated screen `4bb2b18a22694ed1849022fdb52a9ee4` only.
- Do NOT use attempt28 or attempt29 geometry as the visual base.
- Attempt25 already has the correct global x-band and canvas geometry; preserve it.

Freeze these attempt25 structures exactly:
- `#middle-panels` page x-band and width.
- `#mapping-table-panel` x/y/width/height.
- `#canvas-panel` x/y/width/height.
- Every mapping node position and all SVG connector paths.
- Bottom card x/y/width/height and all five sample rows.
- Top shell, brand, active sidebar item, filters, KPI cards.

Do NOT move the right editor card horizontally.
Do NOT set the editor to `left: 1194px` relative to `#middle-panels`.
Do NOT place canvas target nodes inside or over the editor card.

Repair only two things from attempt25:

1. Remove real scrolling
- Sidebar must not be a real internal scroller.
- Right editor form must not be a real internal scroller.
- Remove `overflow-y-auto`, `overflow-auto`, `overflow-scroll`, and `max-h-*`.
- Use fixed compact rows instead of scroll containers.

2. Compact only the INSIDE of the existing right editor card
- Keep the existing right editor card x/y/width/height from attempt25.
- Header `字段映射配置编辑区` remains in the card.
- Replace the editor form content with a compact fixed one-column source-like form that fits inside y=300..690:
  `配置名称`, `外部系统`, `接口端点`, `源字段`, `目标字段`, `转换规则`, `默认值`, `必填策略`, `异常处理`, `审计要求`.
- Required visible values:
  `MES 设备绑定`
  `MES`
  `/api/asset/bind`
  `asset_class`
  `资产小类`
  `映射表`
  `A: 电子设备，B: 机械设备，C: 办公设备，D: 其他`
  `规则有效`
  `进入数据异常队列`
  `记录变更明细`
- Use compact CSS:
  label width 78px,
  row height 30px to 32px,
  control height 25px to 28px,
  vertical gap <= 3px,
  explanatory text 10px to 11px.
- Button row visible at the bottom of the existing editor card:
  `保存草稿`, `提交校验`, `样例校验`.

Sample/bottom preservation:
- Keep source sample rows exactly:
  `M2024050001`, `M2024050002`, `M2024050003`, `M2024050004`, `M2024050005`,
  `ZC2024050001`, `ZC2024050002`, `ZC2024050003`, `ZC2024050004`, `ZC2024050005`.
- Keep `缺失字段异常`, `进入异常队列`, `冲突检测`, `查看冲突详情`, `发布门禁`, `警告（2）`, `失败（1）`.

Technical constraints:
- Browser viewport 1586 x 992.
- Document scrollWidth <= 1586 and scrollHeight <= 992.
- No internal real scrollbar.
- No native HTML `<select>` elements.
- No `overflow-y-auto`, no `overflow-auto`, no `overflow-scroll`, no `max-h-`.
- No vertical or squeezed text.
- Forbidden text: `undefined`, `NaN`, `Lorem`, `lorem`, `待补认证`.

Final acceptance:
- It must look like attempt25 plus a non-scrolling compact right editor.
- The canvas target nodes must remain left of the editor and must not overlap the right editor card.
