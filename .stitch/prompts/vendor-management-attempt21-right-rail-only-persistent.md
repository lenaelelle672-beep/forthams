Refine the selected vendor management DESIGN screen into a fresh persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `master-data-subpage-04-vendor-management-v2.png` is the only source of truth.
The selected screen `263b8326c5524df4a084e052ff9398f7` already has the best source-like left category column, center supplier table, bottom transaction table, supplier matrix, exact 1586 x 992 frame, no page scroll, and no internal scroll containers.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.

ABSOLUTE FREEZE ZONE:
- Do not change anything with x < 1326.
- Preserve the exact current geometry, row heights, text, colors, and positions for:
  - left sidebar
  - vertical `供应商分类` column
  - center title/action/status/table card
  - `交易反查台`
  - `供应商引用矩阵`
- Preserve current document/body size: exactly 1586 x 992.
- Preserve `realScrollerCount=0`.
- Preserve matrix values `45` and `126` inside x <= 1326.
- Preserve all six bottom transaction rows: `CT-CIP-2026-09`, `PO-2026-0318`, `WO-SSE-2307`, `REIM-8842`, `INV-2026-0318-07`, `JE-2026-0318-07`.
- Preserve evidence links: `合同.pdf`, `PO.pdf`, `工单.pdf`, `报销单.pdf`, `发票.pdf`, `入账单.pdf`.

ONLY REPAIR THE RIGHT RAIL:
- Current selected screen accidentally places the right-rail publish gate offscreen around x≈1811..1859.
- Delete every offscreen right-rail duplicate and rebuild the right rail entirely inside x=1344..1586.
- No text, card, icon, or checklist item may have x > 1586.
- Do not widen body, do not move the center, do not move the matrix, do not move the bottom table.

Right rail target inside x=1344..1586:
- Container: x=1344..1586, y=50..992, white background, source-like border-left.
- `供应商详情` header y≈68 with collapse chevron on the right.
- Details form compact y≈105..500:
  `供应商名称 *`, `供应商编码 *`, `认证状态 *`, `复核周期 *`, `交易范围 *`, `合同PO策略 *`, `维保范围`, `报销策略`, `停用策略`, `审计策略`.
- Use the exact values:
  `宇视认证供应商 A`, `SUP-A-0001`, `已认证`, `12 个月`, `安防设备、系统集成`, `需合同/PO 才可下单`, `设备维保、系统运维`, `按合同额度报销`, `停用后禁止新引用`, `标准审计策略`.
- `风险提示` card x≈1356..1574, y≈516..616 with:
  `风险提示`,
  `非长期供应商累计 3 次需转认证`,
  `合同外服务需审批`,
  `停用后历史不删除`.
- `发布门禁 (6/7 通过)` card x≈1356..1574, y≈630..895 with:
  `发布门禁`,
  `基本信息 通过`,
  `认证材料 通过`,
  `合同/PO策略 通过`,
  `风险评估 通过`,
  `报销策略 通过`,
  `历史交易保留 通过`,
  `审计策略 待完善`.
- `待完善` must be visible around x≈1530 and y<895.

Hard viewport gates:
- `documentElement.scrollWidth=1586`, `documentElement.scrollHeight=992`.
- `body.scrollWidth=1586`, `body.scrollHeight=992`.
- No page scroll.
- No internal scrollbars.
- Required right rail text must be visible inside the 1586 x 992 viewport, not merely present in DOM.

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
