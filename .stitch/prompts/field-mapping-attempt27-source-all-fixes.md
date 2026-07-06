Edit the selected uploaded IMAGE screen into a new persistent Stitch DESIGN/HTML screen.
Do not return DOM operations only. Create a new persistent DESIGN screen with downloadable HTML.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot `integration-subpage-03-field-mapping-v2.png` is the only source of truth.
Viewport must be exactly 1586 x 992. Body/root overflow hidden. No internal scrollbars.
No emoji characters anywhere.

Preserve exact shell:
- Top navy shell h=48, white `UNIVIEW | 固定资产管理系统`, active `系统运营中枢`.
- Left sidebar x=0 y=48 w=178 h=944, overflow hidden, active `集成配置 > 字段映射`.
- Main content starts at x=195. No workbench panel may overlap the sidebar.

Fixed source coordinates:
- Header/title/actions: x=195 y=63 w=1377 h=58.
- Filter row: x=195 y=123 w=1377 h=48.
- Summary cards: x=195 y=183 w=1377 h=63.
- Middle row y=256..704:
  - `字段映射视图`: x=195 y=256 w=527 h=448.
  - `映射关系画布`: x=736 y=256 w=449 h=448.
  - `字段映射配置编辑区`: x=1193 y=256 w=379 h=448.
- Bottom row y=713..964:
  - `样例数据预览（前 5 行）`: x=195 y=713 w=553 h=251.
  - `缺失字段异常（共 2 条）`: x=762 y=713 w=287 h=251.
  - `冲突检测（共 1 条）`: x=1063 y=713 w=259 h=251.
  - `发布门禁`: x=1336 y=713 w=237 h=251.

Header/filter/cards required text:
`字段映射工作台`, `维护映射`, `样例校验`, `冲突检测`, `保存草稿`, `提交校验`,
`源字段`, `目标字段`, `外部系统`, `业务对象`, `发布状态`, `重置`, `查询`,
`MES 设备绑定`, `ERP 转固回写`, `EHR 人员同步`, `PO/合同金额变更`, `+ 新建映射配置`.

Left table must be a DIV/CSS-grid visual table, not auto HTML table:
- Use 10px text, 30px body row height, nowrap, horizontal text.
- Show all 10 rows inside x=195..722 and y=256..704:
`asset_class`, `asset_no`, `asset_name`, `amount`, `currency`, `emp_no`, `dept_code`, `purchase_date`, `supplier_id`, `contract_no`.
- Footer inside panel: `共 32 条`, `20 条/页`, `1`, `2`, `前往`, `1`, `页`.

Center canvas:
- Show 8 left nodes and 8 right nodes.
- Use SVG cubic Bezier paths with `C` commands. At least 6 connector paths must have visible vertical arc/crossing displacement.
- Node labels:
left `asset_class`, `asset_no`, `asset_name`, `amount`, `currency`, `emp_no`, `dept_code`, `purchase_date`;
right `资产小类`, `资产编码`, `资产名称`, `原值`, `币种`, `工号`, `部门编码`, `取得日期`.
- Legend: `通过`, `警告`, `错误`, `未映射`.

Right editor must fit entirely above y=704 and use no scrolling:
- Use compact div rows, no native select elements.
- Use 20px value box height, 4px gaps, 10px labels, 11px values.
- Required visible content:
`字段映射配置编辑区`
`配置名称 *` `MES 设备绑定`
`外部系统 *` `MES`
`接口端点 *` `/api/asset/bind`
`源字段 *` `asset_class`
`目标字段 *` `资产小类`
`转换规则 *` `映射表` `配置`
`A: 电子设备，B: 机械设备，C: 办公设备，D: 其他`
`规则有效`
`默认值` `请输入默认值`
`必填策略 *` `必填校验`
`异常处理 *` `进入数据异常队列`
`审计要求 *` `记录变更明细`
buttons `保存草稿`, `提交校验`, `样例校验`.

Bottom sample card must be a DIV/CSS-grid visual table, not auto HTML table:
- Use 9px text, 24px row height, no ellipsis.
- Show all 5 rows in x=195..748 and y=713..964:
row1 `A`, `M2024050001`, `设备 A`, `12000.00`, `CNY`, `电子设备`, `ZC2024050001`, `设备 A`, `12000.00`, `人民币`
row2 `B`, `M2024050002`, `设备 B`, `35000.00`, `CNY`, `机械设备`, `ZC2024050002`, `设备 B`, `35000.00`, `人民币`
row3 `A`, `M2024050003`, `设备 C`, `8800.00`, `CNY`, `电子设备`, `ZC2024050003`, `设备 C`, `8800.00`, `人民币`
row4 `C`, `M2024050004`, `设备 D`, `2200.00`, `CNY`, `办公设备`, `ZC2024050004`, `设备 D`, `2200.00`, `人民币`
row5 `D`, `M2024050005`, `设备 E`, `1500.00`, `CNY`, `其他`, `ZC2024050005`, `设备 E`, `1500.00`, `人民币`
link `查看全部样例`.

Other bottom cards:
- `缺失字段异常（共 2 条）`: `emp_no`, `dept_code`, `进入异常队列`.
- `冲突检测（共 1 条）`: `asset_no`, `重复值`, `资产编码 M2024050002 在 2 条记录中重复`, badge `高`, `查看冲突详情`.
- `发布门禁`: `字段映射校验 通过`, `转换规则校验 通过`, `样例数据校验 通过`, `缺失字段处理 警告（2）`, `冲突检测 失败（1）`, disabled `发布`.

Hard fail if:
- workbench panels start before x=195;
- right editor fields fall below y=704;
- any internal scrollbar appears;
- any native select appears;
- any of the 10 mapping rows or 5 sample rows is hidden;
- connectors are flat horizontal lines;
- source punctuation `警告（2）` / `失败（1）` changes.
