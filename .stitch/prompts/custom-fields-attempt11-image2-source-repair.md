Edit the selected uploaded IMAGE2 v2 product screenshot into a DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 自定义字段
Menu id: system-custom-fields
Reference image: master-data-subpage-05-custom-fields-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/master-data-subpage-05-custom-fields-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-custom-fields
Canvas: 1586 x 992 CSS pixels.

Critical source-fidelity rules:
- Recreate the exact IMAGE2 v2 product screenshot as HTML.
- Keep the same top shell, sidebar active state, content layout, tables, forms, cards, buttons, colors, borders, typography, spacing, and visible Chinese text.
- Preserve the exact top-left IMAGE2 brand mark for this source screenshot. Do not replace it with `UM`, disconnected letters, a generic logo, or a different lockup. The source shows the product brand area at the top-left; copy that exact mark and adjacent `固定资产管理系统` text as visible.
- No page-level vertical scroll. `documentElement.scrollWidth` and `scrollHeight` must equal the 1586 x 992 frame.
- Do not hide required content behind internal scrollbars when the source shows it in-frame.
- Keep all Chinese and Latin text horizontal. No vertical stacked table text.

Top and sidebar:
- Top nav labels: `资产作业台`, `资产管理中枢`, `风险预警中心`, `数据分析中心`, active `系统运营中枢`.
- Left sidebar title `系统运营中枢`; active group `基础资料`; active child `自定义字段`.
- Business object column title `业务对象`; cards include `资产台账 48 字段 已发布`, `待建资产池 22 字段 已发布`, `CIP 项目 16 字段 已发布`, `转固申请 12 字段 已发布`, `盘点任务 18 字段 已发布`, `维修工单 15 字段 草稿`, `供应商档案 20 字段 已发布`, plus `+ 新增业务对象`.

Main content:
- Title `自定义字段治理台`.
- Subtitle must match the source meaning: unified maintenance of assets, CIP, inventory, maintenance, workflow form fields, types, required rules, dictionaries, layouts, import/export, integration mapping, and history impact.
- Header buttons: `新建字段`, `保存草稿`, `提交校验`, `影响校验`, `导入字段`. Keep them in one horizontal row.
- Status strip items: `草稿已保存 10:08`, `历史影响待确认 1 项`, `发布影响 12 个表单`, `H5 布局待同步 2 项`.
- Filter/search row placeholder: `搜索字段名称 / 编码 / 业务对象 / 字典 / 集成映射`.
- Chips: `全部字段`, `必填`, `桌面显示`, `H5显示`, `待校验`, `停用`.

Field table:
- Show the source 11-column table with 5 visible rows.
- Column headers: checkbox, `字段名称`, `字段编码`, `业务对象`, `字段类型`, `必填策略`, `字典来源`, `桌面布局`, `H5布局`, `集成映射`, `状态`, `操作`.
- Required rows and values:
  1. `转固批次号`, `cip_cap_batch_no`, `CIP 项目`, `文本 / 唯一编码`, `业务必填`, `—`, `资产卡片-基础信息`, `H5-基础信息`, `ERP.CIP_BATCH_NO`, `已发布`, `编辑 影响 停用`.
  2. `设备序列号`, `device_serial_no`, `资产台账`, `文本`, `建议必填`, `设备序列号`, `资产卡片-基础信息`, `H5-资产信息`, `ERP.SERIAL_NO`, `已发布`, `编辑 影响 停用`.
  3. `MAC地址`, `mac_address`, `资产台账`, `文本`, `可选`, `—`, `资产卡片-网络信息`, `H5-资产信息`, `ERP.MAC_ADDR`, `已发布`, `编辑 影响 停用`.
  4. `保修到期日`, `warranty_expire_date`, `资产台账`, `日期`, `业务必填`, `—`, `资产卡片-维修信息`, `H5-维修信息`, `ERP.WARRANTY_END`, `已发布`, `编辑 影响 停用`.
  5. `发票号`, `invoice_no`, `资产台账`, `文本`, `建议必填`, `发票号字典`, `资产卡片-财务信息`, `H5-财务信息`, `ERP.INVOICE_NO`, `已发布`, `编辑 影响 停用`.
- Footer: `共 5 条`, `20 条/页`, page `1`, `前往`, `页`.

Bottom four-card row:
- Fit all four cards inside the 992px viewport.
- Card 1 title `桌面表单预览（资产卡片-基础信息）`; fields include `资产名称`, `转固批次号 *`, `2025-CIP-0901`, `设备序列号`, `SN20250901001`, `MAC地址`, `00:1A:89:2B:3C:4D`, `保修到期日 *`, `2027-09-01`.
- Card 2 title `钉钉H5预览（资产信息）`; show the same key form values compactly.
- Card 3 title `导入导出模板`; include `下载模板`, table headers `列名`, `字段编码`, `必填`, `示例`, bottom `导入记录`, `最近导入：2025-05-15 09:58:21`, `查看详情`.
- Card 4 title `字段影响矩阵`; include rows for `CIP 转固表单`, `资产卡片`, `导入模板`, `ERP 映射`, `历史实例`; bottom link `查看全部影响 12 项`.

Right property panel:
- Title `字段属性`.
- Full source field sequence must stay visible: `字段名称`, `字段编码`, `业务对象`, `字段类型`, `默认值`, `必填策略`, `字典来源`, `校验表达式`, `桌面布局绑定`, `H5 布局绑定`, `导入导出绑定`, `集成映射`, `权限策略`, `历史影响`, `审计策略`.
- Values include `转固批次号`, `cip_cap_batch_no`, `CIP 项目`, `文本 / 唯一编码`, `请输入默认值`, `业务必填`, `—`, `^[A-Z0-9-]{1,20}$`, `资产卡片-基础信息`, `H5-基础信息`, `导入模板-第1列`, `ERP.CIP_BATCH_NO`, `按业务对象控制`, `查看 236 条实例`, `标准审计策略`.
- The orange `风险提示` card is critical. It must be a full visible orange warning card, not a collapsed strip. It appears below the field list and above the release gate, with title `风险提示` and exactly these three horizontal lines:
  - `发布后历史实例保持原字段版本`
  - `ERP 回执冻结不允许无痕修改`
  - `H5 与桌面布局需同步`
- The `发布门禁（7/8 通过）` checklist must start below the orange risk card and remain fully visible in the 992px viewport.
- Release gate rows:
  - `编码唯一` `通过`
  - `类型合法` `通过`
  - `必填策略` `通过`
  - `字典来源` `通过`
  - `布局绑定` `通过`
  - `导入导出` `通过`
  - `集成映射` `通过`
  - `历史影响` `待确认`

Prior failed Stitch attempts to avoid:
- Do not output `UM` in the brand area.
- Do not collapse the orange `风险提示` card to a 1-row strip.
- Do not push `发布门禁` below the viewport.
- Do not wrap header buttons vertically.
- Do not create internal scroll containers in the main table or right property panel.
- Do not make the field table cells vertical or stacked.

Final self-check before completion:
- The screenshot should look like a direct HTML transcription of `master-data-subpage-05-custom-fields-v2.png`.
- Browser screenshot at 1586 x 992 must show the full right `风险提示` card and all `发布门禁` rows.
- The top-left source brand mark must not contain `UM`.
