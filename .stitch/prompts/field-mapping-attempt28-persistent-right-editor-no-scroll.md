This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

IMPORTANT PERSISTENCE REQUIREMENT:
- Do NOT return DOM operations only.
- Do NOT use temporary project.file_update patches.
- Create a new persistent Stitch DESIGN screen with exported HTML containing the repaired layout.

Base candidate:
- Use the current generated screen `4bb2b18a22694ed1849022fdb52a9ee4` as geometry baseline.
- Keep its successful global x-bands, dense left field table, curved mapping connectors, sample table, exception card, conflict card, and publish gate.
- Do NOT regenerate the center mapping canvas or the bottom cards.

Repair only:
1. left sidebar overflow,
2. right editor internal overflow,
3. right editor vertical density.

Left sidebar:
- Remove real internal scrolling from the sidebar.
- The sidebar must stay visually like the IMAGE2 source, with the `字段映射` active item visible.
- Do not add `overflow-y-auto`, `overflow-auto`, `overflow-scroll`, or `max-h-*`.
- Sidebar content may be compacted only enough to avoid a real scrollbar; do not change active menu semantics.

Right editor source geometry:
- Right editor card x=1194..1572, y=256..704.
- Header `字段映射配置编辑区` at y≈275.
- All fields must be visible inside the same card with no internal scroll:
  `配置名称`, `外部系统`, `接口端点`, `源字段`, `目标字段`, `转换规则`, `默认值`, `必填策略`, `异常处理`, `审计要求`.
- Required values visible:
  `MES 设备绑定`
  `MES`
  `/api/asset/bind`
  `asset_class`
  `资产小类`
  `映射表`
  `A: 电子设备，B: 机械设备，C: 办公设备，D: 其他`
  `进入数据异常队列`
  `记录变更明细`
- Use fixed exported CSS, not a scroll container:
  row height 32px to 34px,
  label font 12px,
  control height 27px to 30px,
  vertical gap 4px or less.
- Keep the green `规则有效` status visible below conversion rule.
- Button row must remain visible inside the card at y=660..690:
  `保存草稿`, `提交校验`, `样例校验`.

Bottom/sample preservation:
- Preserve current sample table five-row data exactly:
  `M2024050001`, `M2024050002`, `M2024050003`, `M2024050004`, `M2024050005`,
  `ZC2024050001`, `ZC2024050002`, `ZC2024050003`, `ZC2024050004`, `ZC2024050005`.
- Preserve `缺失字段异常`, `进入异常队列`, `冲突检测`, `查看冲突详情`, `发布门禁`, `警告（2）`, `失败（1）`.
- Do not move the bottom row upward or leftward; keep the current global layout bands.

Connector preservation:
- Preserve curved connector paths.
- At least 8 paths must remain, and at least 4 curved paths must be non-horizontal.
- Do not replace the mapping canvas with flat straight horizontal lines.

Top brand:
- Preserve the source-like white `UNIVIEW | 固定资产管理系统` lockup in the top-left.
- Do not add a blue square app icon.

Technical constraints:
- Browser viewport remains 1586 x 992.
- Document scrollWidth <= 1586 and scrollHeight <= 992.
- No internal real scrollbar.
- No native HTML select elements; keep source-like custom dropdown controls.
- No `overflow-y-auto`, no `overflow-auto`, no `overflow-scroll`, no `max-h-`.
- No vertical or squeezed text.
- Forbidden text: `undefined`, `NaN`, `Lorem`, `lorem`, `待补认证`.

Final acceptance:
- Exported HTML at 1586 x 992 shows all right editor fields and buttons without internal scroll.
- Left sidebar has no real scrollbar.
- Center mapping canvas and bottom cards remain visually the same as the current good candidate.
