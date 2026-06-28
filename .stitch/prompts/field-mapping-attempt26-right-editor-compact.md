Repair the selected generated DESIGN screen. Do not change the left table, center canvas, bottom cards, top shell, or summary cards.

Keep the current good state:
- 10 mapping rows visible.
- 5 sample rows visible.
- Curved Bezier connectors.
- Main panels start at the correct x=195 content area.
- No native select widgets.

Only repair these two issues:
1. Right editor has an internal scrolling form and lower fields are below the panel.
2. Sidebar uses overflow auto and becomes a real internal scroller.

Sidebar repair:
- Keep the current sidebar labels and active `集成配置 > 字段映射`.
- Set sidebar/list overflow to hidden. Do not use `overflow:auto` or `overflow-y:auto`.
- Keep visible menu items within the 992px viewport.

Right editor compact repair:
- Panel remains `字段映射配置编辑区`, x≈1193 y≈256 w≈379 h≈448.
- Remove the form wrapper `overflow-y-auto`; no internal scroll.
- Use compact 20px field height, 4px vertical gaps, 10px label font, 11px value font.
- All labels and values must fit above y=704.
- Build all dropdowns as div/span boxes, not native select.

The right editor must visibly contain, in order:
- `配置名称 *` value `MES 设备绑定`
- `外部系统 *` value `MES`
- `接口端点 *` value `/api/asset/bind`
- `源字段 *` value `asset_class`
- `目标字段 *` value `资产小类`
- `转换规则 *` value `映射表` and button `配置`
- note text exactly `A: 电子设备，B: 机械设备，C: 办公设备，D: 其他`
- `规则有效`
- `默认值` placeholder `请输入默认值`
- `必填策略 *` value `必填校验`
- `异常处理 *` value `进入数据异常队列`
- `审计要求 *` value `记录变更明细`
- footer buttons `保存草稿`, `提交校验`, `样例校验`

Hard fail if:
- the editor introduces a scrollbar;
- `进入数据异常队列` or `记录变更明细` is below y=704;
- bottom cards are moved or clipped;
- left table row count regresses;
- main content shifts left into the sidebar.
