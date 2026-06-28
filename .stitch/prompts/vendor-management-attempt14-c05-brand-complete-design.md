Create a fresh persistent complete DESIGN/HTML screen from the selected vendor management candidate.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `master-data-subpage-04-vendor-management-v2.png` is the only source of truth.
The selected `c05bb3a96f50484baae712fde0e1d4a5` candidate is the baseline because it already passes the required content, no-scroll, right checklist, bottom six rows, and matrix visibility gates.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Important persistence requirement:
- Return a NEW complete DESIGN screen with full HTML.
- Do not return only DOM operations.
- Do not only describe the change.

Only required visual repair:
- Replace the current generic circular/exclamation top-left brand icon.
- The source IMAGE2 v2 brand icon is a blue rounded-square product mark followed by white `固定资产管理系统`.
- Keep the brand text `固定资产管理系统`.
- Do not add `UNIVIEW`.
- Do not use a shield, gear, alert, exclamation, cube, or letter logo.
- Use a compact blue rounded square around 26px by 26px.
- Inside the blue square, render four small white rounded dot / petal shapes arranged like a source-like asset mark.
- Keep the icon aligned at the far left of the dark navy header and keep the divider after the brand lockup.

Preserve everything else exactly from the selected baseline:
- Document and body remain exactly 1586 x 992 in browser.
- No page-level scroll, no horizontal overflow, no real internal scrollbars.
- Top nav, selected `系统运营中枢`, left sidebar, active `基础资料 / 供应商管理`.
- Header title `供应商档案与交易反查`.
- Top action buttons `新建供应商`, `保存草稿`, `提交校验`, `交易反查`, `导入供应商`.
- Four supplier rows including `宇视认证供应商 A`, `SUP-A-0001`, `CIP 设备维保备用供应商`, `SUP-D-0198`.
- Bottom `交易反查台` six rows including `INV-2026-0318-07`, `JE-2026-0318-07`, `发票.pdf`, `入账单.pdf`.
- `供应商引用矩阵` with all six values `12`, `38`, `45`, `23`, `67`, `126`.
- Footer text exactly `数据截止：2026-05-15 09:51:22`.
- Right `供应商详情`, `风险提示`, `发布门禁`, `审计策略`, `待完善`.

Final self-check before returning:
- `documentElement.scrollWidth=1586`, `documentElement.scrollHeight=992`, `body.scrollWidth=1586`, `body.scrollHeight=992`.
- Required strings remain present.
- Forbidden strings absent: `UNIVIEW`, `数据截止: 2026-05-15 09:51:22`.
- The top-left icon is not circular and not an exclamation/alert mark.
