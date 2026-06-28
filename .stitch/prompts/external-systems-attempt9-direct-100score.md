Edit the selected uploaded IMAGE2 v2 reference screen into HTML.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not hide required content behind scroll if the uploaded screenshot shows it.

Preserve the exact top-left IMAGE2 brand mark for this source screenshot: white `UNIVIEW`, the source-visible divider/lockup, and adjacent product subtitle only if that subtitle is visible in the IMAGE2 source.
Do not redraw, distort, split, re-space, lowercase, or replace the UNIVIEW wordmark.

Page name: 外部系统配置
Menu id: system-external-systems
Reference image: integration-subpage-01-external-systems-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/integration-subpage-01-external-systems-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-external-systems
Canvas: exactly 1586 x 992.

Recreate this exact IMAGE2 v2 product screenshot as HTML.
Use one fixed desktop frame. No page-level scroll. No internal scrollbars or hidden-overflow clipping for source-visible content.

Critical shell facts:
- Top nav is dark navy, active module is `系统运营中枢`.
- Left sidebar is white system-hub navigation. Active item is `外部系统配置` under `集成配置`.
- Do not use a dark system-params sidebar.
- Main title is `外部系统接入配置台`.
- Header action buttons are `新建系统`, `测试连接`, `保存草稿`, `提交校验`, `查看日志`.
- Status strip text includes `MES 设备台账连接测试通过`, `ERP/EHR 回写待补 1 项`, `PO/合同同步规则已启用`.

Left system list:
- Search placeholder: `搜索系统 / 类型 / 负责人`.
- Show cards in this order: `MES 设备台账`, `ERP 固资总账`, `EHR 人员组织`, `PO/合同平台`, `供应商门户`, `新建外部系统`.
- Exact statuses:
  - `EHR 人员组织` status must be `待认证`.
  - Forbidden text: never render `待补认证`.

Top KPI cards:
- `接入系统 5`
- `已启用 4`
- `待认证 1`
- `今日同步 1260`

Center table:
- Title: `接入系统清单`.
- Show all 6 visible rows:
  `MES 设备台账`, `ERP 固资总账`, `EHR 人员组织`, `PO/合同平台`, `供应商门户`, `异常队列 Webhook`.
- Preserve row data:
  `OAuth2`, `JWT`, `Basic Auth`, `API Key`, `签名认证`;
  `/api/v1/devices`, `/api/v1/assets`, `/api/v1/employees`, `/api/v1/po`, `/api/v1/suppliers`, `/webhook/exception`;
  success rates `99.52%`, `98.21%`, `97.86%`, `96.75%`, `92.13%`;
  statuses `在线`, `待认证`, `试运行`, `异常`.
- Do not reduce the table to two rows. Do not hide later rows below an internal scroll area.

Right property panel:
- Title: `系统属性`.
- Selected system is `MES 设备台账`.
- Show all fields down through `失效处理`.
- Buttons: `保存系统`, `测试连接`, `查看审计`.
- Below it show `发布校验 5/6` checklist with all six rows visible:
  `系统编码`, `认证方式`, `接口端点`, `字段映射`, `失效处理`, `审计留痕`.
- `字段映射` row status is orange `待确认`; the others are `通过`.
- Required visible rows: `失效处理` and `审计留痕` must be visible inside the 992px frame.

Bottom band:
- Bottom left card title: `接入链路预览`.
- Show five rows: `MES 设备台账`, `ERP 固资总账`, `EHR 人员组织`, `PO/合同平台`, and the visible source flow labels.
- Exact text required: `人员加载字段`.
- Forbidden text: never render `人员扣款字段`.
- Bottom middle/right card title: `同步策略`.
- Show all four strategy rows: `全量初始化`, `增量同步`, `失败重试`, `审计归档`.
- Exact visible text required: `审计归档`.

Important previous failure corrections:
- Do not render `待补认证`; use exact `待认证`.
- Do not render `人员扣款字段`; use exact `人员加载字段`.
- Keep all six center table rows visible.
- Keep `审计归档`, `失效处理`, and `审计留痕` visible without clipping.
- Avoid vertical stacked text in the bottom flow labels.
- Avoid internal `overflow-y-auto`, `overflow-auto`, or hidden clipping containers for the center table, bottom cards, or right property panel.
