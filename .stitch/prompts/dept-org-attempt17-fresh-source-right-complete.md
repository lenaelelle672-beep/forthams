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

Recreate this exact IMAGE2 v2 product screenshot as HTML.
Preserve the exact top-left IMAGE2 brand mark for this source: white `UNIVIEW`, source-visible divider/lockup, and adjacent subtitle only when the IMAGE2 source shows it.
Do not use any existing Stitch reference draft as the visual source.

Canvas and shell:
- Fixed viewport and layout: 1586 x 992.
- Top dark header height about 58 px.
- Left dark sidebar width about 173 px.
- Main content begins at x=173 and y=58.
- No page-level scrollbars. Do not use hidden overflow to conceal required content.

Source y-bands that must fit in one viewport:
- Header: y=0-58.
- Title/action band: y=58-141, white background, no floating card look.
- Filter/search band: y=142-209.
- Main three-column workspace: y=210-694.
- Bottom approval/publish band: y=705-958.

Main workspace geometry:
- Left `组织架构树` panel: x=187-428, y=210-694.
- Center `部门列表` panel: x=432-1247, y=210-694.
- Right `部门详情` panel: x=1263-1572, y=142-694.

Right `部门详情` panel is a hard acceptance gate:
The right panel must visibly include every source field and the bottom button row in the 1586 x 992 screenshot:
`部门名称`, `部门编码`, `父级路径`, `成本中心`, `部门负责人`, `同步来源`, `同步策略`, `部门状态`, `审批影响`, `交接规则`, `是否启用`, toggle enabled, `保存部门`, `差异确认`, `查看审计`.
Use compact 29-32 px input heights and 6-8 px vertical spacing, matching the source.
Never clip after `交接规则`; never put the button row below the fold.

Center table acceptance gate:
- `部门列表` shows all 8 rows in one viewport.
- Rows: `设备管理部`, `工程技术中心`, `资产会计组`, `CIP项目组`, `信息技术部`, `财务共享中心`, `物资管理组`, `运维支持组`.
- Show pagination/footer `共 8 条`, page `1`, `20 条/页`, `跳至 1 页`.
- Show the top count exactly as `8/12`, not `8 / 12`.

Left tree acceptance gate:
- `组织架构树` contains `全部`, `A厂区`, `资产管理中心`, selected `设备管理部`, `工程技术中心`, `财务共享中心`, `信息技术部`.
- Same hierarchy chevrons, blue folder icons, EHR/钉钉/ERP badges, selected row background.

Bottom band acceptance gate:
- Left title `审批影响链路与发布检查`.
- Four cards in order: `CIP立项`, `费用归集`, `转固验收`, `工作交接`.
- Arrows between cards.
- Orange warning row with button `生成影响快照`.
- Right `发布检查清单` with six checks and `提示说明`, including `查看差异详情`.

Use source-like light UI: white panels, pale gray-blue background, 1px #d8e5f5 borders, compact PingFang/Inter typography, no heavy shadow, no decorative gradients.
