Create a complete 100/100 pixel-fidelity HTML transcription of the selected uploaded IMAGE2 v2 screenshot.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 供应商管理
Menu id: system-vendor-management
Reference image: master-data-subpage-04-vendor-management-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/master-data-subpage-04-vendor-management-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-vendor-management
Viewport: exactly 1586 x 992. No document scroll. No internal scrollbars hiding required content.

Hard gates learned from prior pages:
- Do not leave any blank lower half.
- Do not push the right detail panel outside the viewport.
- Do not let the center table overflow horizontally.
- Do not use emoji glyphs anywhere. Use source-like line/vector icons only.
- Preserve the exact source-visible brand area, top nav, sidebar active state, and page density.

Shell:
- Dark navy top bar, source-like `固定资产管理系统` brand lockup at far left, active top module `系统运营中枢`.
- Left white/light sidebar titled `系统运营中枢`; active group `基础资料`; active item `供应商管理`.
- Left sidebar labels visible: 流程平台, 组织权限, 基础资料, 资产分类, 位置管理, 资产编码规则, 计量单位, 资产状态, 字典管理, 供应商管理, 集成配置, 消息与通知, 系统参数.

Main header:
- Title: `供应商档案与交易反查`.
- Subtitle: `认证供应商、非长期供应商、SSE 维保供应商和历史交易统一维护，支持合同、PO、报销、维保与后续复查。`
- Top actions in order: `新建供应商`, `保存草稿`, `提交校验`, `交易反查`, `导入供应商`.

Left category rail:
- Title: `供应商分类`.
- Four vertical cards:
  1. `认证供应商`, value `72`, subtext `合同/PO/维保可引用`.
  2. `非长期供应商`, value `18`, subtext `报销留痕/超期值认证`.
  3. `维保供应商`, value `11`, subtext `SSE/工单/SLA`.
  4. `停用/黑名单`, value `3`, subtext `禁止新增引用`.

Top status strip:
- Must include `草稿已保存 09:51`, `认证材料待复核 2 项`, `历史交易保留 126 单`, `黑名单命中 0`.

Center upper card: supplier table
- Header tools: search placeholder `搜索供应商、编码、认证状态、服务范围、合同/PO 或交易记录`; chips `全部供应商`, `认证`, `非长期`, `维保`, `停用/黑名单`; filter/refresh/list/settings icons.
- Title area not optional; table must be visible and not overflow.
- Table columns: checkbox, `供应商名称`, `编码`, `认证状态`, `服务范围`, `合同/PO`, `交易记录`, `风险`, `状态`, `操作`.
- Must show exactly 4 rows:
  1. `宇视认证供应商 A`, `SUP-A-0001`, `已认证`, `安防设备、系统集成`, `12 / 38`, `156`, `低风险`, `启用`, `编辑`, `反查`, `停用`.
  2. `临时采购供应商 B`, `SUP-B-0321`, `非长期`, `通用设备、备品备件`, `0 / 5`, `23`, `中风险`, `启用`, `编辑`, `反查`, `停用`.
  3. `SSE 维保供应商 C`, `SUP-C-0009`, `维保供应商`, `维保服务、工单支持`, `1 / 3`, `89`, `低风险`, `启用`, `编辑`, `反查`, `停用`.
  4. `CIP 设备维保备用供应商`, `SUP-D-0198`, `非长期`, `CIP 设备维保`, `0 / 2`, `14`, `中风险`, `启用`, `编辑`, `反查`, `停用`.
- Footer: `共 4 条`, `20 条/页`, page `1`, `前往 1 页`.

Right supplier detail panel:
- Title: `供应商详情`.
- It must remain visible within x=1344..1586, not offscreen.
- Fields in order:
  `供应商名称` = `宇视认证供应商 A`
  `供应商编码` = `SUP-A-0001`
  `认证状态` = `已认证`
  `复核周期` = `12 个月`
  `交易范围` = `安防设备、系统集成`
  `合同PO策略` = `需合同/PO 才可下单`
  `维保范围` = `设备维保、系统运维`
  `报销策略` = `按合同额度报销`
  `停用策略` = `停用后禁止新引用`
  `审计策略` = `标准审计策略`
- Risk alert box title `风险提示`, with three warning items.
- Publish checklist title `发布门禁`, progress `6/7 通过`, with seven rows including final `审计策略 待完善`.

Bottom band:
- Left bottom card title: `交易反查台`; tabs `全部`, `合同`, `PO`, `SSE 维保`, `报销`, `发票`, `入账单`; table rows:
  合同 / CT-CIP-2026-09 / CIP 设备维保合同 / 1,260,000.00 / 合同.pdf / 中风险 / 2026-05-12 15:22
  PO / PO-2026-0318 / 安防摄像机采购 / 88,540.00 / PO.pdf / 低风险 / 2026-03-18 10:31
  SSE 维保 / WO-SSE-2307 / 2026 年度维保工单 / 36,800.00 / 工单.pdf / 低风险 / 2026-02-28 17:05
  报销 / REIM-8842 / 差旅及备件采购 / 3,260.00 / 报销单.pdf / 中风险 / 2026-02-20 09:14
  发票 / INV-2026-0318-07 / 增值税专用发票 / 88,540.00 / 发票.pdf / 低风险 / 2026-03-19 13:47
  入账单 / JE-2026-0318-07 / 固定资产入账 / 88,540.00 / 入账单.pdf / 低风险 / 2026-03-20 11:23
- Footer: `共 6 条`, `20 条/页`, page `1`.
- Right bottom card title: `供应商引用矩阵`, with six metric tiles:
  `合同引用 12`, `PO 引用 38`, `维保工单 45`, `报销记录 23`, `发票入账 67`, `历史留痕 126`, plus `数据截止：2026-05-15 09:51:22`.

Final self-check:
- At 1586 x 992, all main panels are visible from top to bottom.
- Required strings visible: `供应商档案与交易反查`, `宇视认证供应商 A`, `SUP-D-0198`, `交易反查台`, `供应商引用矩阵`, `发布门禁`.
- No horizontal page overflow, no right panel offscreen, no emoji.
