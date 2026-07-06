This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 外部系统接入配置台
Menu id: system-external-systems
Reference image: integration-subpage-01-external-systems-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/integration-subpage-01-external-systems-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-external-systems

Preserve the exact top-left IMAGE2 brand mark for this source: white `UNIVIEW`, source-visible divider/lockup, and adjacent subtitle only when the IMAGE2 source shows it.
Do not redraw, distort, split, re-space, or replace the UNIVIEW wordmark.
Do not let Stitch generate disconnected letters, generic logos, or a different brand lockup.

Canvas:
- Fixed browser viewport: 1586 x 992.
- Top dark header y=0..58.
- Left sidebar x=0..193.
- Main work area x=193..1586.
- No page-level scroll. No internal scroll containers that hide source-visible content.

Source layout bands:
- Title/actions: y=58..142, white.
- Status strip: y=142..186, only spans the center content, not under the right form.
- Main upper content: y=194..677.
- Bottom content: y=692..923.

Header actions:
`新建系统`, `测试连接`, `保存草稿`, `提交校验`, `查看日志`.

Left system cards, all visible:
`MES 设备台账`, `ERP 固资总账`, `EHR 人员组织`, `PO/合同平台`, `供应商门户`, `新建外部系统`.
Use the exact source status label `待认证`. Do not write `待补认证`.

Top KPI cards:
`接入系统 5`, `已启用 4`, `待认证 1`, `今日同步 1260`.

Center table:
Title `接入系统清单`.
Show all 6 rows in one viewport:
1. `MES 设备台账`
2. `ERP 固资总账`
3. `EHR 人员组织`
4. `PO/合同平台`
5. `供应商门户`
6. `异常队列 Webhook`
Columns include `系统名称`, `类型`, `认证方式`, `同步方向`, `接口端点`, `最近同步`, `成功率`, `状态`, `操作`.
Keep row height compact enough to show the sixth row and footer `共 6 条`, page `1`, `10 条/页`.

Right panel:
Title `系统属性`, starts near y=142 and ends near y=636.
Show fields: `系统名称`, `系统编码`, `系统类型`, `认证方式`, `Base URL`, `健康检查路径`, `同步方向`, `负责人`, `数据范围`, `失败处理`.
Show buttons `保存系统`, `测试连接`, `查看审计`.
Below it show `发布校验 5/6` with all checklist rows:
`系统编码`, `认证方式`, `接口端点`, `字段映射`, `失败处理`, `审计留痕`.

Bottom left panel:
Title `接入链路预览`.
Rows: `MES 设备台账`, `ERP 固资总账`, `EHR 人员组织`, `PO/合同平台`.
Keep arrows and link labels as in source.

Bottom middle panel:
Title `同步策略`.
Hard gate: show all four source rows fully visible, not clipped:
1. `全量初始化` - `首次接入或结构变更时执行全量拉取`
2. `增量同步` - `基于时间戳/ID 增量拉取变更数据`
3. `失败重试` - `失败自动重试 3 次，间隔 5 分钟`
4. `审计归档` - `同步记录与变更日志长期留存`
The fourth row `审计归档` must be visible in the real 1586 x 992 screenshot. Do not sacrifice the main table sixth row to show it.

Visual style:
- Match IMAGE2 source: white panels, pale blue borders, #1677ff primary action, green/orange/red status accents, compact Chinese enterprise typography.
- Use source-like icons, not emoji. No generic oversized illustrations.
- Do not use forbidden text `待补认证`.
