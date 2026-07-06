Edit the selected uploaded IMAGE2 v2 source screenshot into a new Stitch DESIGN screen.

Page name: 部门组织与负责人配置
Menu id: system-dept-org
Reference image: org-permission-subpage-06-dept-org-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/org-permission-subpage-06-dept-org-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-dept-org

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Do not use previous Stitch drafts or generic admin templates.
Canvas must be exactly 1586 x 992 CSS px. No document scroll. No internal scroll containers.

Top shell and brand:
- Preserve the exact source top-left brand: white `UNIVIEW`, adjacent `固定资产管理系统`, and dark navy shell.
- Keep `系统运营中枢` active in the top nav.
- Keep left sidebar `组织权限` active and expanded, with `部门组织` active.

Hard coordinate budget:
- Top nav y=0..58.
- Left sidebar x=0..172, y=58..992.
- Content title/action row x=190..1568, y=72..127.
- Search/filter strip x=188..1248, y=142..213; the small counter `8/12` sits at the far right of this strip.
- Top three-column workspace y=222..692:
  - Left `组织架构树` x=188..428, y=222..692.
  - Center `部门列表` x=432..1248, y=222..692.
  - Right `部门详情` x=1264..1572, y=142..692.
- Bottom workspace y=706..948:
  - Left `审批影响链路与发布检查` x=188..1050.
  - Middle `发布检查清单` x=1082..1275.
  - Right blue `提示说明` x=1328..1546.

Critical source visibility:
- Center `部门列表` must show all 8 source rows in the first viewport:
  `设备管理部`, `工程技术中心`, `资产会计组`, `CIP项目组`, `信息技术部`, `财务共享中心`, `物资管理组`, `运维支持组`.
- Table row height must be about 42px or less. Keep cells horizontal; do not stack Chinese characters vertically.
- Right `部门详情` must show all source fields and bottom buttons:
  `部门名称`, `部门编码`, `父级路径`, `成本中心`, `部门负责人`, `同步来源`, `同步策略`, `部门状态`, `审批影响`, `交接规则`, `是否启用`, `保存部门`, `差异确认`, `查看审计`.
- Do not clip the right panel after `部门状态`; source-visible lower fields and buttons must remain visible.
- Bottom impact chain must show four cards: `CIP立项`, `费用归集`, `转固验收`, `工作交接`, and the orange warning bar with `生成影响快照`.
- Publish checklist must show: `父级路径有效`, `成本中心已绑定`, `负责人已确认`, `同步差异已处理`, `审批影响已预览`, `交接规则已配置`.

Exact source text:
- `部门组织与负责人配置`
- `组织架构树`
- `部门列表`
- `部门详情`
- `审批影响链路与发布检查`
- `发布检查清单`
- `提示说明`
- `搜索部门、编码、负责人、成本中心、同步来源`
- `8/12` exactly, not `8 / 12`.
- `中（4 条待办，2 条审批）`
- `负责人变更会影响待办和审批节点，请先生成影响快照。`

Forbidden patterns:
- Do not use `8 / 12`.
- Do not add page-level or internal scrollbars.
- Do not use `overflow-y-auto`, `overflow-auto`, hidden scroll panels, or clipped custom scrollbars.
- Do not hide rows by using `overflow:hidden` on the center table or right detail body.

Density rules:
- Use compact enterprise UI: 11-12px table text, 28-30px inputs/selects, tight 6-8px row gaps, thin blue-gray borders, small 4-6px radius.
- If space is tight, reduce top title/search vertical padding before sacrificing table rows or right detail fields.

Final self-check:
- In a real 1586 x 992 browser screenshot, all 8 center table rows, all right detail fields/buttons, all four bottom cards, checklist, and warning bar are visible.
- The page visually matches the uploaded IMAGE2 screenshot, not a redesigned admin page.
