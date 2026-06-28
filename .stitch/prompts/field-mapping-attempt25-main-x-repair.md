Repair the selected generated DESIGN screen. Do not redesign and do not change data.

The current version has good density, visible 10 mapping rows, visible 5 sample rows, and usable curved connectors. Preserve those improvements.
Critical regression to fix: the middle and bottom panels are shifted too far left and overlap the sidebar. Move them back to the IMAGE2 source coordinates.

Source coordinate repair:
- Left sidebar must occupy x=0..178.
- Main content must start at x=195. No panel may start before x=195 except top shell and sidebar.
- Middle row y=256..704:
  - `字段映射视图`: x=195, y=256, w=527, h=448.
  - `映射关系画布`: x=736, y=256, w=449, h=448.
  - `字段映射配置编辑区`: x=1193, y=256, w=379, h=448.
- Bottom row y=713..964:
  - `样例数据预览（前 5 行）`: x=195, y=713, w=553, h=251.
  - `缺失字段异常（共 2 条）`: x=762, y=713, w=287, h=251.
  - `冲突检测（共 1 条）`: x=1063, y=713, w=259, h=251.
  - `发布门禁`: x=1336, y=713, w=237, h=251.

Preserve these current good fixes:
- 10 visible mapping rows from `asset_class` to `contract_no`.
- 5 visible sample rows including `M2024050005` and `ZC2024050005`.
- No native select widgets.
- No scrollbars.
- Curved SVG connectors.
- Exact strings `警告（2）` and `失败（1）`.

Right editor must be at x≈1193 and still show:
`字段映射配置编辑区`, `MES 设备绑定`, `MES`, `/api/asset/bind`, `asset_class`, `资产小类`, `映射表`, `配置`, `A: 电子设备，B: 机械设备，C: 办公设备，D: 其他`, `规则有效`, `必填校验`, `进入数据异常队列`, `保存草稿`, `提交校验`, `样例校验`.

Do not let the left table widen into the canvas. Do not let the bottom sample card cover the exception card.
Keep root exactly 1586 x 992 and body overflow hidden.
