Create a fresh persistent complete DESIGN/HTML screen from the uploaded IMAGE screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot `master-data-subpage-04-vendor-management-v2.png` is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.

Page name: 供应商档案与交易反查
Menu id: system-vendor-management
Reference image: master-data-subpage-04-vendor-management-v2.png
Uploaded IMAGE screen id: 1529431951037838797
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-vendor-management
Canvas: exactly 1586 x 992 CSS px. No page scroll. No internal scrollbars.

Top shell:
- x=0..1586, y=0..50, dark navy.
- left brand: blue rounded-square icon plus white `固定资产管理系统`.
- do NOT use `UNIVIEW`.
- nav labels in order: `资产作业台`, `资产管理中枢`, `风险预警中心`, `数据分析中心`, `系统运营中枢`.
- `系统运营中枢` active with blue underline.
- right icons and `管理员`.

Left navigation:
- x=0..186, y=50..992, white/light sidebar.
- top title `系统运营中枢`.
- active group `基础资料`.
- active item `供应商管理` with blue active background/bar.
- visible items: `流程平台`, `组织权限`, `基础资料`, `资产分类`, `位置管理`, `资产编码规则`, `计量单位`, `资产状态`, `字典管理`, `供应商管理`, `集成配置`, `消息与通知`, `系统参数`.

Source layout is three-column plus bottom band:
- Supplier category column: x=202..397, y=68..590.
- Main center header/table: x=428..1326, y=68..624.
- Right detail rail: x=1344..1586, y=50..992.
- Bottom transaction band spans under the left category and center: x=202..1326, y=626..958.

Supplier category column:
- header `供应商分类` at x≈202 y≈68 and small gear icon at x≈388.
- four vertical cards, not horizontal KPI cards:
  1. `认证供应商`, value `72`, text `合同/PO/维保可引用`, green icon.
  2. `非长期供应商`, value `18`, text `报销留痕/超阈值转认证`, orange icon.
  3. `维保供应商`, value `11`, text `SSE/工单/SLA`, blue icon.
  4. `停用/黑名单`, value `3`, text `禁止新增引用`, red icon.

Main center:
- title `供应商档案与交易反查` at x≈428 y≈70.
- subtitle: `认证供应商、非长期供应商、SSE 维保供应商和历史交易统一维护，支撑合同、PO、报销、维保与后续反查。`
- action buttons at top right: `新建供应商`, `保存草稿`, `提交校验`, `交易反查`, `导入供应商`.
- status bar y≈157..201 with `草稿已保存 09:51`, `认证资料待复核 2 项`, `历史交易保留 126 单`, `黑名单命中 0`.
- filter/table card y≈222..624.
- search placeholder `搜索供应商、编码、认证状态、服务范围、合同/PO 或交易记录`.
- tabs/buttons: `全部供应商`, `认证`, `非长期`, `维保`, `停用/黑名单`.
- toolbar icons on the right.
- supplier table columns: checkbox, `供应商名称`, `编码`, `认证状态`, `服务范围`, `合同/PO`, `交易记录`, `风险`, `状态`, `操作`.
- four rows:
  - `宇视认证供应商 A`, `SUP-A-0001`, `已认证`, `安防设备、系统集成`, `12 / 38`, `156`, `低风险`, `启用`, `编辑 反查 停用`.
  - `临时采购供应商 B`, `SUP-B-0321`, `非长期`, `通用设备、备品备件`, `0 / 5`, `23`, `中风险`, `启用`, `编辑 反查 停用`.
  - `SSE 维保供应商 C`, `SUP-C-0009`, `维保供应商`, `维保服务、工单支持`, `1 / 3`, `89`, `低风险`, `启用`, `编辑 反查 停用`.
  - `CIP 设备维保备用供应商`, `SUP-D-0198`, `非长期`, `CIP 设备维保`, `0 / 2`, `14`, `中风险`, `启用`, `编辑 反查 停用`.
- table footer `共 4 条`, `20 条/页`, page `1`, `前往 1 页`.

Bottom transaction band:
- starts immediately around y=626, not y=700.
- `交易反查台` card x=202..970, y=626..958.
- tabs: `全部`, `合同`, `PO`, `SSE 维保`, `报销`, `发票`, `入账单`.
- transaction table columns: `交易类型`, `单号`, `关联对象`, `金额（元）`, `证据`, `风险标签`, `更新时间`.
- all six rows visible without scrolling:
  1. `合同`, `CT-CIP-2026-09`, `CIP 设备维保合同`, `1,260,000.00`, `合同.pdf`, `中风险`, `2026-05-12 15:22`.
  2. `PO`, `PO-2026-0318`, `安防摄像机采购`, `88,540.00`, `PO.pdf`, `低风险`, `2026-03-18 10:31`.
  3. `SSE 维保`, `WO-SSE-2307`, `2026 年度维保工单`, `36,800.00`, `工单.pdf`, `低风险`, `2026-02-28 17:05`.
  4. `报销`, `REIM-8842`, `差旅及备件采购`, `3,260.00`, `报销单.pdf`, `中风险`, `2026-02-20 09:14`.
  5. `发票`, `INV-2026-0318-07`, `增值税专用发票`, `88,540.00`, `发票.pdf`, `低风险`, `2026-03-19 13:47`.
  6. `入账单`, `JE-2026-0318-07`, `固定资产入账`, `88,540.00`, `入账单.pdf`, `低风险`, `2026-03-20 11:23`.
- footer `共 6 条`, `20 条/页`, page `1`, `前往 1 页`.

Supplier reference matrix:
- x=996..1326, y=626..958.
- title `供应商引用矩阵`.
- 2 rows x 3 columns:
  - `合同引用` value `12`, `PO 引用` value `38`, `维保工单` value `45`.
  - `报销记录` value `23`, `发票入账` value `67`, `历史留痕` value `126`.
- source-like small trend text below each value: `较上月 ↑ 2`, `较上月 ↑ 5`, `较上月 ↑ 3`, `较上月 ↑ 1`, `较上月 ↑ 6`, `较上月 ↑ 8`.
- footer `数据截止：2026-05-15 09:51:22`.
- all six value right edges must be <= x=1326. Do not clip `45` or `126`.

Right detail rail:
- x=1344..1586, y=50..992, white panel.
- section `供应商详情` with collapse caret.
- form fields and values:
  `供应商名称 *` = `宇视认证供应商 A`;
  `供应商编码 *` = `SUP-A-0001`;
  `认证状态 *` = `已认证`;
  `复核周期 *` = `12 个月`;
  `交易范围 *` = `安防设备、系统集成`;
  `合同PO策略 *` = `需合同/PO 才可下单`;
  `维保范围` = `设备维保、系统运维`;
  `报销策略` = `按合同额度报销`;
  `停用策略` = `停用后禁止新引用`;
  `审计策略` = `标准审计策略`.
- `风险提示` card with three warning lines:
  `非长期供应商累计 3 次需转认证`, `合同外服务需审批`, `停用后历史不删除`.
- `发布门禁 (6/7 通过)` card with checklist:
  `基本信息 通过`, `认证材料 通过`, `合同/PO策略 通过`, `风险评估 通过`, `报销策略 通过`, `历史交易保留 通过`, `审计策略 待完善`.

Pixel and text constraints:
- Use compact 11px-14px Chinese enterprise typography.
- Borders, backgrounds, status chips, blue primary buttons, green/orange/red risk chips match the source.
- No text may be hidden below y=992 or outside x=1586.
- No horizontal scroll.
- No internal scrollbars.
- Required strings present: `供应商分类`, `供应商档案与交易反查`, `交易反查台`, `供应商引用矩阵`, `CT-CIP-2026-09`, `INV-2026-0318-07`, `JE-2026-0318-07`, `发票.pdf`, `入账单.pdf`, `数据截止：2026-05-15 09:51:22`, `发布门禁`, `审计策略`, `待完善`.
- Forbidden strings absent: `UNIVIEW`, `数据截止: 2026-05-15 09:51:22`.
