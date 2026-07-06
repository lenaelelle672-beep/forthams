Edit the selected uploaded IMAGE screen into a new persistent Stitch DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page: 字段映射工作台
Source image: integration-subpage-03-field-mapping-v2.png
Viewport: exactly 1586 x 992.
Root: fixed 1586x992, overflow hidden, no page scroll, no internal scroll.

Preserve:
- dark navy top shell with white `UNIVIEW | 固定资产管理系统`;
- active top tab `系统运营中枢`;
- white left sidebar with `集成配置` and active `字段映射`;
- title, filters, five summary cards, middle three panels, bottom four cards.

Use fixed coordinate bands:
- top shell h=48.
- sidebar w=178, y=48.
- main content x=195, y=63, w=1377.
- header y=63..121.
- filters y=123..171.
- summary cards y=183..246.
- middle row y=256..704.
- bottom row y=713..964.

Important: draw dense tables as DIV/CSS-grid visual rows, not auto HTML tables.
Auto table layout is forbidden because it makes rows too tall.

Middle left panel `字段映射视图`:
- x=195 y=256 w=527 h=448.
- Use a fixed div grid with header height 28 and body row height 31.
- Display all 10 rows inside the panel:
  `asset_class`, `asset_no`, `asset_name`, `amount`, `currency`, `emp_no`, `dept_code`, `purchase_date`, `supplier_id`, `contract_no`.
- Columns: `源字段`, `目标字段`, `字段类型`, `转换规则`, `必填策略`, `异常处理`, `状态`, `操作`.
- Footer visible: `共 32 条`, `20 条/页`, `1`, `2`, `前往`, `1`, `页`.
- Use 10px-11px text, horizontal labels, nowrap.

Middle center panel `映射关系画布`:
- x=736 y=256 w=449 h=448.
- Use 8 left nodes and 8 right nodes:
  left `asset_class`, `asset_no`, `asset_name`, `amount`, `currency`, `emp_no`, `dept_code`, `purchase_date`;
  right `资产小类`, `资产编码`, `资产名称`, `原值`, `币种`, `工号`, `部门编码`, `取得日期`.
- Draw at least 8 SVG cubic Bezier paths using `C` commands.
- At least 6 connectors must visibly arc/cross with vertical displacement, not horizontal lines.
- Legend at bottom: `通过`, `警告`, `错误`, `未映射`.

Middle right panel `字段映射配置编辑区`:
- x=1193 y=256 w=379 h=448.
- Use custom div dropdowns, not native select widgets.
- All fields must fit above y=704.
- Required exact visible values:
  `MES 设备绑定`, `MES`, `/api/asset/bind`, `asset_class`, `资产小类`, `映射表`, `配置`,
  `A: 电子设备，B: 机械设备，C: 办公设备，D: 其他`, `规则有效`,
  `请输入默认值`, `必填校验`, `进入数据异常队列`, `记录变更明细`,
  buttons `保存草稿`, `提交校验`, `样例校验`.

Bottom sample card `样例数据预览（前 5 行）`:
- x=195 y=713 w=553 h=251.
- Use a fixed div grid, not an auto table.
- Use 9px text, 24px row height, compact columns.
- Show all 5 rows, no ellipsis:
  `A`, `M2024050001`, `设备 A`, `12000.00`, `CNY`, `电子设备`, `ZC2024050001`, `设备 A`, `12000.00`, `人民币`
  `B`, `M2024050002`, `设备 B`, `35000.00`, `CNY`, `机械设备`, `ZC2024050002`, `设备 B`, `35000.00`, `人民币`
  `A`, `M2024050003`, `设备 C`, `8800.00`, `CNY`, `电子设备`, `ZC2024050003`, `设备 C`, `8800.00`, `人民币`
  `C`, `M2024050004`, `设备 D`, `2200.00`, `CNY`, `办公设备`, `ZC2024050004`, `设备 D`, `2200.00`, `人民币`
  `D`, `M2024050005`, `设备 E`, `1500.00`, `CNY`, `其他`, `ZC2024050005`, `设备 E`, `1500.00`, `人民币`
- Link `查看全部样例` visible bottom right.

Other bottom cards:
- `缺失字段异常（共 2 条）`: rows `emp_no`, `dept_code`, link `进入异常队列`.
- `冲突检测（共 1 条）`: row `asset_no`, `重复值`, `资产编码 M2024050002 在 2 条记录中重复`, badge `高`, link `查看冲突详情`.
- `发布门禁`: rows `字段映射校验 通过`, `转换规则校验 通过`, `样例数据校验 通过`, `缺失字段处理 警告（2）`, `冲突检测 失败（1）`, disabled `发布`.

Hard failures:
- HTML table auto-layout expands rows;
- any of the 10 mapping rows is hidden;
- sample row 5 is hidden;
- native select widgets appear;
- internal scrollbars appear;
- connectors are flat horizontal lines;
- `警告（2）` or `失败（1）` punctuation changes.
