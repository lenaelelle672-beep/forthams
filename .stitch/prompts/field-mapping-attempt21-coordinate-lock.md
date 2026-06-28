Edit the selected uploaded IMAGE screen into a new persistent Stitch DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Preserve the exact top-left IMAGE2 brand mark for this source: white `UNIVIEW`, source-visible divider, and `固定资产管理系统`.
Do not redraw, distort, split, re-space, lowercase, or replace the UNIVIEW wordmark.

Page name: 字段映射
Menu id: `system-field-mapping`
Reference image: `integration-subpage-03-field-mapping-v2.png`
Reference URL: `http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/integration-subpage-03-field-mapping-v2.png`
Workbench URL: `http://127.0.0.1:5173/fixed-assets/workbench?menu=system-field-mapping`
Canvas: exactly `1586 x 992` CSS pixels.

Critical implementation rule:
- Use a fixed 1586x992 root with `overflow:hidden`.
- Use coordinate-locked panels with exact heights. Do not let content decide panel height.
- Prefer absolute/fixed-position layout for the main workbench.
- Use small 9px-12px text in dense tables. The source is compact; do not enlarge row heights.
- Do not create any page-level or internal scrollbar.

Coordinate map from IMAGE2 source:
- Top navy shell: x=0 y=0 w=1586 h=48.
- Left sidebar: x=0 y=48 w=178 h=944, white.
- Main content canvas: x=195 y=63 w=1377 h=901.
- Header/title/actions: x=195 y=63 w=1377 h=58.
- Filter row: x=195 y=123 w=1377 h=48.
- Summary cards row: x=195 y=183 w=1377 h=63.
- Middle three-column row: y=256 to y=704, height exactly 448.
  - Left table panel `字段映射视图`: x=195 y=256 w=527 h=448.
  - Center canvas panel `映射关系画布`: x=736 y=256 w=449 h=448.
  - Right editor panel `字段映射配置编辑区`: x=1193 y=256 w=379 h=448.
- Bottom diagnostic row: y=713 to y=964, height exactly 251.
  - `样例数据预览（前 5 行）`: x=195 y=713 w=553 h=251.
  - `缺失字段异常（共 2 条）`: x=762 y=713 w=287 h=251.
  - `冲突检测（共 1 条）`: x=1063 y=713 w=259 h=251.
  - `发布门禁`: x=1336 y=713 w=237 h=251.

Main content that must be visible:
- Title `字段映射工作台` and subtitle `把 MES、ERP、EHR、PO/合同等源字段映射到资产、CIP、流程和财务字段，异常进入统一队列。`
- Buttons: `维护映射`, `样例校验`, `冲突检测`, `保存草稿`, `提交校验`.
- Filters: `源字段`, `目标字段`, `外部系统`, `业务对象`, `发布状态`, `重置`, `查询`.
- Summary cards: `MES 设备绑定`, `ERP 转固回写`, `EHR 人员同步`, `PO/合同金额变更`, dashed `+ 新建映射配置`.

Left middle panel:
- Header exactly `字段映射视图`.
- Table columns: `源字段`, `目标字段`, `字段类型`, `转换规则`, `必填策略`, `异常处理`, `状态`, `操作`.
- Show 10 visible rows with compact 33px row height: `asset_class`, `asset_no`, `asset_name`, `amount`, `currency`, `emp_no`, `dept_code`, `purchase_date`, `supplier_id`, `contract_no`.
- Footer pagination inside the 448px panel: `共 32 条`, `20 条/页`, page `1`, `2`, `前往`, `1`, `页`.
- Do not make the table taller than the panel.

Center middle panel:
- Header exactly `映射关系画布`; toolbar at top right with zoom buttons.
- Two columns of nodes:
  left nodes `asset_class`, `asset_no`, `asset_name`, `amount`, `currency`, `emp_no`, `dept_code`, `purchase_date`.
  right nodes `资产小类`, `资产编码`, `资产名称`, `原值`, `币种`, `工号`, `部门编码`, `取得日期`.
- Draw at least 8 curved connector paths. They must visibly cross and arc like the source, not lie flat.
- Preserve green and orange status dots, circular endpoints, and legend `通过 / 警告 / 错误 / 未映射` at bottom.

Right middle panel:
- Header exactly `字段映射配置编辑区`.
- All fields must fit above y=704; no internal scroll.
- Use readable custom dropdown-look divs, not native selects if native widgets clip values.
- Exact visible labels and values:
  `配置名称 *` -> `MES 设备绑定`
  `外部系统 *` -> `MES`
  `接口端点 *` -> `/api/asset/bind`
  `源字段 *` -> `asset_class`
  `目标字段 *` -> `资产小类`
  `转换规则 *` -> `映射表` plus button `配置`
  green note `A: 电子设备，B: 机械设备，C: 办公设备，D: 其他` and `规则有效`
  `默认值` -> `请输入默认值`
  `必填策略 *` -> `必填校验`
  `异常处理 *` -> `进入数据异常队列`
  `审计要求 *` -> `记录变更明细`
  footer buttons `保存草稿`, `提交校验`, `样例校验`
- The footer buttons are at y≈666-696, not below the panel.

Bottom diagnostic row:
- The four bottom cards must not be compressed or clipped. They must all fit inside y=713-964.
- `样例数据预览（前 5 行）` shows a full table with 5 rows. Use tiny text if needed. No ellipsis.
  Row 1: `A`, `M2024050001`, `设备 A`, `12000.00`, `CNY`, `电子设备`, `ZC2024050001`, `设备 A`, `12000.00`, `人民币`.
  Row 2: `B`, `M2024050002`, `设备 B`, `35000.00`, `CNY`, `机械设备`, `ZC2024050002`, `设备 B`, `35000.00`, `人民币`.
  Row 3: `A`, `M2024050003`, `设备 C`, `8800.00`, `CNY`, `电子设备`, `ZC2024050003`, `设备 C`, `8800.00`, `人民币`.
  Row 4: `C`, `M2024050004`, `设备 D`, `2200.00`, `CNY`, `办公设备`, `ZC2024050004`, `设备 D`, `2200.00`, `人民币`.
  Row 5: `D`, `M2024050005`, `设备 E`, `1500.00`, `CNY`, `其他`, `ZC2024050005`, `设备 E`, `1500.00`, `人民币`.
- `缺失字段异常（共 2 条）` rows:
  `emp_no`, `18`, `56`, `补全工号字段或设置默认值`.
  `dept_code`, `12`, `34`, `补全部门编码或映射规则`.
  Link `进入异常队列` at bottom right.
- `冲突检测（共 1 条）` row:
  `asset_no`, `重复值`, `资产编码 M2024050002 在 2 条记录中重复`, badge `高`.
  Link `查看冲突详情` at bottom right.
- `发布门禁` checklist:
  `字段映射校验 通过`
  `转换规则校验 通过`
  `样例数据校验 通过`
  `缺失字段处理 警告（2）`
  `冲突检测 失败（1）`
  Disabled button `发布`.

Hard failures:
- viewport screenshot is not exactly 1586x992;
- page-level scroll or internal scroll appears;
- right editor fields extend below y=704;
- bottom row starts below y=713 or content is clipped;
- table cells show vertical stacked words, ellipsis, or missing row 5;
- connector paths are all straight or nearly horizontal;
- punctuation in `警告（2）` or `失败（1）` changes.
