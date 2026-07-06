Edit the selected department-organization DESIGN screen into a new persistent Stitch DESIGN screen.

This is a surgical density repair, not a redesign.
The IMAGE2 v2 source `org-permission-subpage-06-dept-org-v2.png` is the only source of truth.
Use the selected attempt9 screen as the visual baseline because its shell, sidebar, header, and bottom section are closer to the source than attempt11.

Create a NEW persistent DESIGN screen. Do not return only DOM operations.

Freeze these areas exactly as in the selected baseline unless needed to remove clipping:
- Top nav and UNIVIEW brand lockup.
- Sidebar and active `部门组织`.
- Header title/buttons.
- Filter bar horizontal position and source-like visual style.
- Bottom `审批影响链路与发布检查` section, warning bar, release checklist, and hint card.

Only repair:
1. center `部门列表` table density and internal scroll
2. right `部门详情` form density and internal scroll
3. exact source text `8/12`

Hard frame:
- CSS viewport: exactly 1586 x 992.
- documentElement.scrollHeight: exactly 992.
- No page-level scroll.
- No internal scroll container in the center table or right detail panel.
- No clipped source-visible content.

Counter repair:
- Show exact `8/12`.
- Do not show `8 / 12`.

Center table repair:
- Keep table card at the same x/y as the selected baseline.
- Remove table body vertical scrolling. All eight rows must be visible at once.
- Use source-like compact density:
  - toolbar/header row about 36px
  - table header about 32px
  - each body row 33px to 36px
  - footer about 40px
  - table text 11px to 12px
- Keep all rows visible:
  `设备管理部`, `工程技术中心`, `资产会计组`, `CIP项目组`, `信息技术部`, `财务共享中心`, `物流管理组`, `运维支持组`.
- Keep all codes visible:
  `DM-0010`, `ET-0020`, `FA-0031`, `CIP-0032`, `IT-0040`, `FC-0050`, `MM-0051`, `OS-0052`.
- Keep all names visible:
  `张伟`, `李强`, `王芳`, `赵敏`, `陈磊`, `刘洋`, `孙超`, `周俊`.
- Keep all source statuses visible:
  `正常`, `负责人变更`, `同步差异`.
- Keep action text visible: `编辑`, `影响预览`.
- Footer visible: `共 8 条`, `20 条/页`, `跳至`, `1`, `页`.
- Use ellipsis only on long `父级路径` cells, like the source. Do not wrap table text into two lines except where the source row visually wraps very slightly.

Right detail repair:
- Keep right detail card at the same x/y as the selected baseline.
- Remove internal vertical scrolling.
- All fields and bottom buttons must be visible simultaneously.
- Use compact field rows:
  - label/control combined row height 28px to 30px
  - vertical gap 5px to 6px
  - text 11px to 12px
  - input height 28px to 30px
- Required visible fields and values in order:
  `部门名称` `设备管理部`
  `部门编码` `DM-0010`
  `父级路径` `总部 / A厂区 / 资产管理中心`
  `成本中心` `CC-410100`
  `部门负责人` `张伟`
  `同步来源` `ERP`
  `同步策略` `每日增量同步`
  `部门状态` `正常`
  `审批影响` `中（4 条待办，2 条审批）`
  `交接规则` `按组织规则执行`
  `是否启用`
- Bottom buttons visible and not clipped: `保存部门`, `差异确认`, `查看审计`.

Source-visible bottom section must remain visible:
- `CIP立项`, `费用归集`, `转固验收`, `工作交接`.
- `负责人变更会影响待办和审批节点，请先生成影响快照。`
- `生成影响快照`.
- `发布检查清单`.
- `父级路径有效`, `成本中心已绑定`, `负责人已确认`, `同步差异已处理`, `审批影响已预览`, `交接规则已配置`.
- `提示说明`, `查看差异详情`.

Visual fidelity:
- Preserve dark navy shell and white work surface from the source.
- Preserve pale blue selected row and compact enterprise density.
- No emoji icons.
- No generic admin layout.
- No vertical Chinese text stacking.

Final self-check:
- The center table has 8 visible body rows and no internal scroll.
- The right detail card shows `中（4 条待办，2 条审批）`, `交接规则`, `是否启用`, and all three buttons without scrolling.
- `8/12` is exact.
- Document stays 1586 x 992.
