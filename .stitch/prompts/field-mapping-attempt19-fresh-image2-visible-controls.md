Edit the selected uploaded IMAGE screen into a new persistent Stitch DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Preserve the exact top-left IMAGE2 brand mark for the current source screenshot: white `UNIVIEW`, the source-visible divider/lockup, and adjacent `固定资产管理系统`.
Do not redraw, distort, split, re-space, or replace the UNIVIEW wordmark.
Do not let Stitch generate disconnected letters, generic logos, or a different brand lockup.

Page name: 字段映射
Menu id: `system-field-mapping`
Reference image: `integration-subpage-03-field-mapping-v2.png`
Reference URL: `http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/integration-subpage-03-field-mapping-v2.png`
Workbench URL: `http://127.0.0.1:5173/fixed-assets/workbench?menu=system-field-mapping`
Canvas: exactly `1586 x 992` CSS pixels.

Recreate this exact IMAGE2 v2 product screenshot as HTML:

Overall structure:
- Dark navy top shell, white UNIVIEW lockup on the far left, top active tab `系统运营中枢`.
- White left sidebar with active group `集成配置` and active child `字段映射`.
- Main title `字段映射工作台`, subtitle about MES/ERP/EHR/PO fields, action buttons `维护映射`, `样例校验`, `冲突检测`, `保存草稿`, `提交校验`.
- Filter row: `源字段`, `目标字段`, `外部系统`, `业务对象`, `发布状态`, `重置`, `查询`.
- Four mapping summary cards plus dashed `+ 新建映射配置` card.

Middle row:
- Left card `字段映射视图`: table with columns `源字段`, `目标字段`, `类型`, `规则`, `策略`, `异常`, `状态`, `操作`, 10 visible rows from `asset_class` to `contract_no`, source-like row heights.
- Center card `映射关系画布`: source-like two-column mapping with curved crossing connector paths, not a flat horizontal line template.
  Left nodes: `asset_class`, `asset_no`, `asset_name`, `amount`, `currency`, `emp_no`, `dept_code`, `purchase_date`.
  Right nodes: `资产小类`, `资产编码`, `资产名称`, `原值`, `币种`, `工号`, `部门编码`, `取得日期`.
  Preserve green and orange status dots, circular endpoints, zoom toolbar, and legend `通过 / 警告 / 错误 / 未映射`.
- Right card `字段映射配置编辑区`: source-like compact editor.

Critical right editor rule:
- Do not use native HTML select widgets if they render as dots, dashes, blank placeholders, or clipped text in Chrome.
- Use visually identical dropdown-look boxes made from `div`/`span` text with a chevron icon so every value is readable.
- Visible labels and values must be exactly readable:
  `配置名称 *` -> `MES 设备绑定`
  `外部系统 *` -> `MES`
  `接口端点 *` -> `/api/asset/bind`
  `源字段 *` -> `asset_class`
  `目标字段 *` -> `资产小类`
  `转换规则 *` -> `映射表` plus `配置`
  green note `A: 电子设备，B: 机械设备，C: 办公设备，D: 其他` plus `规则有效`
  `默认值` -> `请输入默认值`
  `必填策略 *` -> `必填校验`
  `异常处理 *` -> `进入数据异常队列`
  `审计要求 *` -> `记录变更明细`
  footer buttons `保存草稿`, `提交校验`, `样例校验`.
- No internal scrollbar in this editor; all source-visible fields must fit above y=712.

Bottom row:
- Four cards aligned in one row from y≈716 to bottom:
  `样例数据预览（前 5 行）`, `缺失字段异常（共 2 条）`, `冲突检测（共 1 条）`, `发布门禁`.
- Sample table must have five visible rows with full codes, no ellipsis:
  `M2024050001` ... `M2024050005`
  `ZC2024050001` ... `ZC2024050005`
  Row 5 must visibly show `D`, `M2024050005`, `设备 E`, `1500.00`, `CNY`, `其他`, `ZC2024050005`, `设备 E`, `1500.00`, `人民币`.
- Missing field card rows: `emp_no`, `dept_code`, link `进入异常队列`.
- Conflict card row: `asset_no`, `重复值`, detail with `M2024050002`, high badge `高`, link `查看冲突详情`.
- Publish gate checklist: `字段映射校验 通过`, `转换规则校验 通过`, `样例数据校验 通过`, `缺失字段处理 警告（2）`, `冲突检测 失败（1）`, disabled `发布`.

Hard failures:
- screenshot is not exactly `1586 x 992`;
- page-level scroll appears;
- right editor values are dots, dashes, blank, or clipped;
- mapping canvas connectors are all straight horizontal lines;
- sample codes are clipped or abbreviated;
- full-width punctuation in `警告（2）` or `失败（1）` is changed.
