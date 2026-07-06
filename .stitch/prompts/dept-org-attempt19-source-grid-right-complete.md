This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 部门组织与负责人配置
Menu id: system-dept-org
Reference image: org-permission-subpage-06-dept-org-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/org-permission-subpage-06-dept-org-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-dept-org

Preserve the exact top-left IMAGE2 brand mark for the current source screenshot: white `UNIVIEW`, the source-visible divider/lockup, and adjacent `固定资产管理系统`.
Do not redraw, distort, split, re-space, lowercase, or replace the UNIVIEW wordmark.
Do not let Stitch generate disconnected letters, generic logos, or a different brand lockup.

Return a persistent full DESIGN screen with downloadable HTML and screenshot. Do not return only DOM operation suggestions.
The generated HTML document and body must be exactly 1586 x 992 CSS px in Chrome:
- `window.innerWidth=1586`, `window.innerHeight=992`
- `documentElement.scrollWidth=1586`, `documentElement.scrollHeight=992`
- `body.scrollWidth=1586`, `body.scrollHeight=992`
- no page-level scrollbars, no internal scrollbars, no `overflow-y-auto`, no `overflow-auto`
- do not create an internal 3172 x 2048 artboard or any horizontal offscreen canvas

Use this source-like fixed grid:
- top nav: x=0..1586, y=0..58, dark navy
- left sidebar: x=0..173, y=58..992, active `组织权限 > 部门组织`
- main title/action row: x=173..1586, y=58..141
- filter strip: x=188..1248, y=142..209, right counter text exactly `8/12`
- left tree panel: x=188..428, y=210..694
- center table panel: x=432..1248, y=210..694
- right detail panel: x=1263..1572, y=142..694
- bottom approval/check band: x=188..1572, y=706..958

Header and actions must match the source:
`部门组织与负责人配置`, subtitle `维护部门树、负责人、成本中心、外部组织同步和交接影响，发布前确认审批影响范围。`
Buttons: `新建部门`, `同步组织`, `差异确认`, `保存草稿`, `提交校验`.

Filter strip must be separate from the left tree, not squeezed into the tree panel:
- search placeholder visible: `搜索部门、编码、负责人、成本中心、同步来源`
- tabs: `全部部门`, `正常`, `负责人变更`, `同步差异`
- counter exact visible text: `8/12`, never `8 / 12`

Left tree must show:
`组织架构树`, `总部`, `A厂区`, `资产管理中心`, selected `设备管理部`, `工程技术中心`, `财务共享中心`, `信息技术部`.
Keep source badges `EHR`, `钉钉`, `ERP` and source-like folder icons.

Center table must show all eight rows, no hidden table body, no vertical stacked text:
1. `设备管理部` `DM-0010` `张伟` `CC-410100` `ERP` `正常`
2. `工程技术中心` `ET-0020` `李强` `CC-420100` `钉钉` `负责人变更`
3. `资产会计组` `FA-0031` `王芳` `CC-410110` `ERP` `正常`
4. `CIP项目组` `CIP-0032` `赵敏` `CC-410120` `ERP` `同步差异`
5. `信息技术部` `IT-0040` `陈磊` `CC-430100` `EHR` `正常`
6. `财务共享中心` `FC-0050` `刘洋` `CC-440100` `ERP` `正常`
7. `物流管理组` `MM-0051` `孙超` `CC-410130` `ERP` `负责人变更`
8. `运维支持组` `OS-0052` `周俊` `CC-410140` `钉钉` `正常`
Footer: `共 8 条`, page `1`, `20 条/页`, `跳至 1 页`.
Forbidden text: `物资管理组`.

Right `部门详情` is the hard gate. It must visibly fit all fields and buttons inside x=1263..1572, y=142..694.
Use a fixed compact CSS grid, not a scroll panel:
- title area height 54 px
- form has exactly 11 rows of 29 px each, gap 3 px
- label column 70 px, control column fills the rest
- controls height 26 px, font 12 px, no label wrapping
- button row inside panel bottom, height 32 px

Right panel exact visible field order and values:
1. `部门名称` = `设备管理部`
2. `部门编码` = `DM-0010`
3. `父级路径` = `总部 / A厂区 / 资产管理中心`
4. `成本中心` = `CC-410100`
5. `部门负责人` = `张伟`
6. `同步来源` = `ERP`
7. `同步策略` = `每日增量同步`
8. `部门状态` = `正常`
9. `审批影响` = `中（4 条待办，2 条审批）`
10. `交接规则` = `按组织规则执行`
11. `是否启用` = blue enabled toggle
Buttons: primary `保存部门`, outline `差异确认`, outline `查看审计`.
Do not omit `交接规则` or `是否启用`. Do not hide them as non-visible select options.

Bottom band must remain fully visible:
- title `审批影响链路与发布检查`
- four cards: `CIP立项`, `费用归集`, `转固验收`, `工作交接`
- warning: `负责人变更会影响待办和审批节点，请先生成影响快照。`
- button `生成影响快照`
- checklist `发布检查清单`: `父级路径有效`, `成本中心已绑定`, `负责人已确认`, `同步差异已处理`, `审批影响已预览`, `交接规则已配置`
- info card `提示说明` and button `查看差异详情`

Final self-check before returning:
- Real Chrome 1586 x 992 screenshot shows all 8 table rows, all 11 right fields, the 3 right buttons, all 4 bottom cards, all 6 checklist rows, orange warning, and info card.
- No internal scroll containers exist.
- Exact strings `8/12`, `物流管理组`, `中（4 条待办，2 条审批）`, `按组织规则执行`, `是否启用`, `保存部门`, `查看审计` are visible.
