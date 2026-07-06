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

Preserve the exact top-left IMAGE2 brand mark for the current source screenshot: white `UNIVIEW`, the source-visible divider/lockup, and any adjacent product subtitle only if that subtitle is visible in the IMAGE2 source.
Do not redraw, distort, split, re-space, or replace the UNIVIEW wordmark.
Do not let Stitch generate disconnected letters, generic logos, or a different brand lockup.

Repair target:
Use the current candidate as the structural base, but match the IMAGE2 source screenshot exactly. The current candidate is close in the center table and bottom cards; do not regress those areas.

Critical visible mismatch to fix:
In the right panel `部门详情`, the IMAGE2 source shows the complete panel inside the first viewport: all fields down to `是否启用`, plus the bottom button row `保存部门`, `差异确认`, `查看审计`. The current candidate clips after `交接规则`, hiding `是否启用` and the buttons. This must be fixed.

Right panel requirements:
- Keep the right panel top aligned with the table area at x about 1263 and y about 143.
- Keep the panel width about 310 px and bottom at about y=693, matching the source.
- Make the field rows compact enough to show, in order:
  `部门名称`, `部门编码`, `父级路径`, `成本中心`, `部门负责人`, `同步来源`, `同步策略`, `部门状态`, `审批影响`, `交接规则`, `是否启用`.
- Show the blue enabled toggle for `是否启用`.
- Show the bottom button row inside the panel:
  primary blue `保存部门`, outline `差异确认`, outline `查看审计`.
- Do not use internal vertical scrolling, hidden overflow, or clipping to fake the fit. All right-panel content must be actually visible in a 1586 x 992 browser screenshot.
- Use tighter label/input heights and smaller vertical gaps if needed. Do not enlarge the panel beyond the source geometry.

Keep these current-good areas stable:
- Top dark shell and active `系统运营中枢`.
- Left dark sidebar active `部门组织`.
- Title `部门组织与负责人配置`.
- Search/filter row with `8/12`.
- Left `组织架构树` panel.
- Center `部门列表` table with all 8 rows visible.
- Bottom `审批影响链路与发布检查` region, including four impact cards, orange warning row, and `发布检查清单`.

Exact text that must remain visible:
`部门组织与负责人配置`, `新建部门`, `同步组织`, `差异确认`, `保存草稿`, `提交校验`,
`组织架构树`, `部门列表`, `设备管理部`, `工程技术中心`, `资产会计组`, `CIP项目组`, `信息技术部`, `财务共享中心`, `物资管理组`, `运维支持组`,
`部门详情`, `当前对象：设备管理部`, `是否启用`, `保存部门`, `查看审计`,
`审批影响链路与发布检查`, `CIP立项`, `费用归集`, `转固验收`, `工作交接`, `生成影响快照`,
`发布检查清单`, `父级路径有效`, `成本中心已绑定`, `负责人已确认`, `同步差异已处理`, `审批影响已预览`, `交接规则已配置`, `查看差异详情`.

Output must fit the exact source viewport, 1586 x 992, with no page-level scrollbars and no hidden required content.
