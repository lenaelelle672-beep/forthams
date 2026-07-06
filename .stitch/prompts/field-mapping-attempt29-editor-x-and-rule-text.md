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
- Start from generated screen `f334c1b29227467988ddc197754dec3a`.
- Preserve its no-real-scroll improvement, compact sidebar, dense tables, bottom cards, and curved connectors.

Repair only two defects:

1. Right editor x-position / horizontal overflow
- Current exported HTML places `#editor-panel` as `left:1194px` inside `#middle-panels`, whose page x starts around 195px. This makes the editor render offscreen around x=1389 and creates `scrollWidth=1767`.
- Correct geometry must match IMAGE2 source:
  - right editor visible page x=1194..1572,
  - within `#middle-panels`, set the editor card relative left around `999px`, not `1194px`.
- The exported document must have:
  - documentElement.scrollWidth <= 1586,
  - body.scrollWidth <= 1586.
- Do not move the left table, center canvas, or bottom cards while fixing this.

2. Restore conversion rule explanation text
- Inside the right editor under `转换规则`, include the source-visible explanation:
  `A: 电子设备，B: 机械设备，C: 办公设备，D: 其他`
- Keep the green `规则有效` row visible below it.

Right editor requirements after repair:
- Header `字段映射配置编辑区` visible at x≈1210, y≈275.
- All values visible inside x=1194..1572, y=256..704:
  `MES 设备绑定`
  `MES`
  `/api/asset/bind`
  `asset_class`
  `资产小类`
  `映射表`
  `A: 电子设备，B: 机械设备，C: 办公设备，D: 其他`
  `进入数据异常队列`
  `记录变更明细`
- Buttons visible inside the same card:
  `保存草稿`, `提交校验`, `样例校验`.

Preserve:
- Top-left source brand `UNIVIEW | 固定资产管理系统`.
- Active `字段映射` menu.
- Left field table with 10 source rows.
- Center mapping canvas with at least 8 curved paths, at least 4 non-horizontal.
- Bottom sample table with five rows:
  `M2024050001`..`M2024050005` and `ZC2024050001`..`ZC2024050005`.
- Bottom cards: `缺失字段异常`, `进入异常队列`, `冲突检测`, `查看冲突详情`, `发布门禁`, `警告（2）`, `失败（1）`.

Technical constraints:
- Browser viewport 1586 x 992.
- Document scrollWidth <= 1586 and scrollHeight <= 992.
- No internal real scrollbar.
- No native HTML `<select>` elements.
- No `overflow-y-auto`, no `overflow-auto`, no `overflow-scroll`, no `max-h-`.
- No vertical or squeezed text.
- Forbidden text: `undefined`, `NaN`, `Lorem`, `lorem`, `待补认证`.

Final acceptance:
- Exported HTML at 1586 x 992 shows the right editor fully inside the viewport and all previous center/bottom content intact.
