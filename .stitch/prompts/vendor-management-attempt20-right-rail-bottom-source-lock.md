Refine the selected vendor management DESIGN screen into a fresh persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `master-data-subpage-04-vendor-management-v2.png` is the only source of truth.
The selected screen `263b8326c5524df4a084e052ff9398f7` fixed the main structure, no-scroll frame, and visible bottom transaction data, but it still has two strict failures.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.

Preserve successes from the selected screen:
- `html`, `body`, and root frame fit 1586 x 992 with no page scroll.
- Left sidebar and vertical `供应商分类` column are present.
- Center supplier table has four rows.
- `交易反查台` includes all six transaction rows.
- `供应商引用矩阵` includes all six values and values `45`/`126` are not clipped horizontally.
- No `UNIVIEW`.

Critical failures to repair:
1. Right rail offscreen bug:
   - Current candidate placed `发布门禁`, second `审计策略`, and `待完善` around x≈1811..1859, outside the 1586px viewport.
   - Delete/replace every offscreen right-rail duplicate.
   - All right-rail sections must be inside x=1344..1586.
   - No text, card, icon, or checklist item may have x>1586.
2. Bottom band y-position:
   - Current candidate starts `交易反查台` around y≈583.
   - Source image starts bottom band around y≈626.
   - Move bottom `交易反查台` and `供应商引用矩阵` down to source y≈626 while compressing them to end around y≈958.

Hard viewport rules:
- `documentElement.scrollWidth=1586`, `documentElement.scrollHeight=992`.
- `body.scrollWidth=1586`, `body.scrollHeight=992`.
- No internal scrollbars.
- All required content visible; do not hide content with overflow clipping.

Right rail target:
- Right rail container x=1344..1586, y=50..992.
- `供应商详情` header y≈68.
- Details form compact y≈105..490:
  `供应商名称 *`, `供应商编码 *`, `认证状态 *`, `复核周期 *`, `交易范围 *`, `合同PO策略 *`, `维保范围`, `报销策略`, `停用策略`, `审计策略`.
- `风险提示` card x≈1356..1574, y≈516..616 with:
  `非长期供应商累计 3 次需转认证`,
  `合同外服务需审批`,
  `停用后历史不删除`.
- `发布门禁 (6/7 通过)` card x≈1356..1574, y≈630..895 with:
  `基本信息 通过`,
  `认证材料 通过`,
  `合同/PO策略 通过`,
  `风险评估 通过`,
  `报销策略 通过`,
  `历史交易保留 通过`,
  `审计策略 待完善`.
- `待完善` must be visible around x≈1530, y<895, not offscreen.

Bottom band target:
- `交易反查台` card x=202..970, y=626..958.
- `供应商引用矩阵` card x=996..1326, y=626..958.
- Use compact 11px-12px table text.
- Transaction rows must remain fully visible:
  `CT-CIP-2026-09`, `PO-2026-0318`, `WO-SSE-2307`, `REIM-8842`, `INV-2026-0318-07`, `JE-2026-0318-07`.
- Evidence links visible: `合同.pdf`, `PO.pdf`, `工单.pdf`, `报销单.pdf`, `发票.pdf`, `入账单.pdf`.
- Footer `共 6 条`, `20 条/页`, page `1`, and `前往 1 页` visible before y=958.
- Matrix footer `数据截止：2026-05-15 09:51:22` visible before y=958.

Keep main supplier table and supplier category column source-like:
- `供应商分类` around x=202..397, y≈68.
- center title `供应商档案与交易反查` around x≈428, y≈70.
- status bar around y≈157..201.
- center table/filter card around y≈222..624.

Required strings present:
- `供应商分类`
- `供应商档案与交易反查`
- `交易反查台`
- `供应商引用矩阵`
- `INV-2026-0318-07`
- `JE-2026-0318-07`
- `发票.pdf`
- `入账单.pdf`
- `数据截止：2026-05-15 09:51:22`
- `供应商详情`
- `风险提示`
- `发布门禁`
- `审计策略`
- `待完善`

Forbidden strings absent:
- `UNIVIEW`
- `数据截止: 2026-05-15 09:51:22`
