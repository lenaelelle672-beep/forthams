Edit the selected IMAGE2 reference screen into a real HTML design screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not hide required content behind scroll if the uploaded screenshot shows it.

Preserve the exact top-left IMAGE2 brand mark for the current source screenshot:
white/blue `UNIVIEW`, the visible divider/lockup, and the adjacent subtitle `固定资产管理系统`.
Do not redraw, distort, split, re-space, or replace the UNIVIEW wordmark.
Do not let Stitch generate disconnected letters, generic logos, emoji logos, or a different brand lockup.

Page name: 外部系统配置
Menu id: system-external-systems
Reference image: integration-subpage-01-external-systems-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/integration-subpage-01-external-systems-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-external-systems

Canvas and shell:
- Keep the source canvas exactly 1586 x 992.
- Keep the dark blue top navigation, active tab `系统运营中枢`, top-right notification/help/grid/user controls, and the left sidebar exactly as shown.
- Left sidebar active group is `集成配置`; active item is `外部系统配置`.
- Preserve source white background, pale blue dividers, 6px-8px radius panels, compact table density, and small enterprise typography.
- No page-level scrolling. Every source-visible panel must fit in the viewport.
- Do not use emoji characters anywhere; use simple vector/icon-like glyphs or text blocks.

Top content:
- Title: `外部系统接入配置台`.
- Subtitle: `统一管理 MES、ERP、EHR、PO/合同和未来数据源的系统档案、认证方式、接口端点、同步方向、失败处理和审计留痕。`
- Top action buttons, in this exact order: `新建系统`, `测试连接`, `保存草稿`, `提交校验`, `查看日志`.
- Status strip must show: `MES 设备台账连接测试通过`, `ERP/EHR 回写待补 1 项`, `PO/合同同步规则已启用`.

Main layout:
- Three-column layout below the status strip.
- Left column width about 220px: search input and stacked system cards.
- Center column width about 740px: KPI row, main table, and two bottom panels.
- Right column width about 365px: system property form and publish checklist.
- Keep gutters close to the source: about 14px between columns and about 12px between panels.

Left system list:
- Search placeholder: `搜索系统 / 类型 / 负责人`.
- Cards in this exact order and state:
  1. `MES 设备台账`, tag `已启用`, 类型 `MES`, 负责人 `张三`, 状态 `在线`, 最近同步 `2 分钟前`; selected card with blue outline.
  2. `ERP 固资总账`, tag `已启用`, 类型 `ERP`, 负责人 `李四`, 状态 `在线`, 最近同步 `5 分钟前`.
  3. `EHR 人员组织`, tag `待认证`, 类型 `EHR`, 负责人 `王五`, 状态 `待认证`, 最近同步 `--`.
  4. `PO/合同平台`, tag `已启用`, 类型 `PO/合同`, 负责人 `赵六`, 状态 `在线`, 最近同步 `8 分钟前`.
  5. `供应商门户`, tag `试运行`, 类型 `门户`, 负责人 `钱七`, 状态 `试运行`, 最近同步 `15 分钟前`.
  6. `新建外部系统`, 类型 `--`, 负责人 `--`, 状态 `未创建`, 最近同步 `--`.

Center KPI cards:
- Four cards in one row:
  1. `接入系统` value `5`
  2. `已启用` value `4`
  3. `待认证` value `1`
  4. `今日同步` value `1260`
- Preserve colored icon blocks and the spacing from the source, but do not use emoji.

Main table:
- Panel title `接入系统清单`.
- Table columns: `系统名称`, `类型`, `认证方式`, `同步方向`, `接口端点`, `最近同步`, `成功率`, `状态`, `操作`.
- Six visible rows, same order:
  1. `MES 设备台账`, `MES`, `OAuth2`, `读入`, `/api/v1/devices`, `2 分钟前`, `99.52%`, `在线`, `编辑 复制 更多`
  2. `ERP 固资总账`, `ERP`, `JWT`, `双向`, `/api/v1/assets`, `5 分钟前`, `98.21%`, `在线`, `编辑 复制 更多`
  3. `EHR 人员组织`, `EHR`, `Basic Auth`, `读入`, `/api/v1/employees`, `--`, `--`, `待认证`, `编辑 复制 更多`
  4. `PO/合同平台`, `PO/合同`, `OAuth2`, `双向`, `/api/v1/po`, `8 分钟前`, `97.86%`, `在线`, `编辑 复制 更多`
  5. `供应商门户`, `门户`, `API Key`, `读入`, `/api/v1/suppliers`, `15 分钟前`, `96.75%`, `试运行`, `编辑 复制 更多`
  6. `异常队列 Webhook`, `Webhook`, `签名认证`, `推送`, `/webhook/exception`, `1 分钟前`, `92.13%`, `异常`, `编辑 复制 更多`
- Footer shows `共 6 条`, pagination `1`, and `10 条/页`.
- The table must fit inside the center panel. Do not push the right form off screen.

Bottom center panels:
- Left bottom panel title `接入链路预览`.
- Show four rows: `MES 设备台账`, `ERP 固资总账`, `EHR 人员组织`, `PO/合同平台`, with arrows and boxes matching the source labels such as `设备运行数据`, `固定资产台账`, `财务总账回写`, `人员和资产字段`, `全部变更同步`.
- Right bottom panel title `同步策略`.
- Four strategy rows: `全量初始化`, `增量同步`, `失败重试`, `审计归档` with their source descriptions.

Right panel:
- Top card title `系统属性`.
- Form fields in exact order:
  `系统名称 *` = `MES 设备台账`
  `系统编码 *` = `MES_ASSET`
  `系统类型 *` = `MES`
  `认证方式 *` = `OAuth2 Client Credential`
  `Base URL *` = `https://mes.uniview.com/api`
  `健康检查路径 *` = `/api/health`
  `同步方向 *` = `读入设备运行/状态`
  `负责人 *` = `张三`
  `数据范围` = `全部组织`
  `失败处理 *` = `重试 3 次后进入人工队列`
- Action buttons at the bottom of this card: `保存系统`, `测试连接`, `查看审计`.
- Publish checklist title: `发布校验 5/6`.
- Checklist rows: `系统编码` 通过, `认证方式` 通过, `接口端点` 通过, `字段映射` 待确认, `失败处理` 通过, `审计留痕` 通过.

Final self-check:
- The result must look like a direct HTML transcription of the screenshot, not a generic admin dashboard.
- All visible Chinese text above must exist in the HTML.
- The right system property panel must stay fully visible.
- The bottom panels must stay fully visible.
- No emoji characters.
