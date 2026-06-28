Edit the uploaded IMAGE2 v2 screenshot into a NEW persistent Stitch DESIGN screen with real HTML/CSS.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 操作审计
Menu id: `system-audit-log`
Reference image: `system-params-subpage-06-audit-log-v2.png`
Reference URL: `http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-params-subpage-06-audit-log-v2.png`
Workbench URL: `http://127.0.0.1:5173/fixed-assets/workbench?menu=system-audit-log`
Canvas: exactly `1595 x 986` CSS pixels.

Hard technical output requirements:
- Generate real HTML elements and CSS, not a blank body or MISSING_IMAGES placeholder.
- Do not use emoji glyphs anywhere.
- Do not use screenshot-as-background output.
- Do not use page-level scrollbars or internal scrolling for source-visible content.
- Browser-rendered screenshot must be exactly `1595 x 986`.

Critical source locks:
- Top-left brand must match the IMAGE2 source: white `UNIVÉW` wordmark shape, adjacent `固定资产管理系统`, and the source divider/spacing.
- Top navigation active module: `系统运营中枢`.
- Left sidebar active group: `系统参数`; active item: `操作审计`.
- Main title: exact `系统操作审计配置台`.
- Header buttons, source order: `新建审计策略`, `保存草稿`, `提交校验`, `审计查询`, `导出取证包`.

KPI row:
- Four cards with exact labels/values:
  - `审计事件` `9,842`
  - `高危操作` `42`
  - `取证包` `18`
  - `留存策略` `3年`

Main left card:
- Title: exact `审计事件查询工作台`.
- Keep filters source-like:
  `操作人` `请选择操作人`, `对象范围` `请选择对象范围`, `风险等级` `请选择风险等级`,
  `时间范围` `2025-05-15 00:00:00` `~` `2025-05-21 23:59:59`,
  button `审计查询`, status `已查询 1/4 条命中`, button `重置`.
- Table header exact columns:
  `时间`, `操作人`, `操作对象`, `操作类型`, `来源模块`, `风险等级`, `结果`, `操作`.
- The 4 body rows must be visible and compact. Use `white-space: nowrap` for table cells and source-like 12px table text. Do not stack characters vertically.
- Row 1:
  `2025-05-21 10:23:45`, `张三`, `资产CIP-2025-000123`, `CIP 转固发布`, `CIP管理`, `高危`, `成功`, `查看详情`, `追溯链路`, `下载取证包`.
- Row 2:
  `2025-05-21 09:58:12`, `李四`, `ERP凭证VCH-20250521-001`, `ERP 回执归档`, `集成中心`, `中危`, `成功`, `查看详情`, `追溯链路`, `下载取证包`.
- Row 3:
  `2025-05-20 18:14:33`, `王五`, `资产权限策略-AdminRole`, `权限策略变更`, `权限管理`, `高危`, `警告`, `查看详情`, `追溯链路`, `下载取证包`.
- Row 4:
  `2025-05-20 17:42:08`, `赵六`, `缓存键：AssetCacheAll`, `缓存刷新回滚`, `系统运维`, `中危`, `成功`, `查看详情`, `追溯链路`, `下载取证包`.
- Pagination visible: `共 4 条`, `10 条/页`, `上一页`, `1`, `下一页`, `前往`, `1`, `页`.

Main right card:
- Title must be exact source text `审计策略编辑`.
- Forbidden title: `审计策略编排`.
- Show these rows without clipping:
  `策略名称` -> `CIP 转固高危操作审计`
  `采集范围` -> `CIP管理、资产管理、集成中心、权限管理`
  `留存周期` -> `3年`
  `高危标记` -> `勾选的操作类型判定为高危`
  `导出水印` -> `启用水印：公司全称 + 时间戳 + 用户`
  `脱敏规则` -> `默认脱敏规则-管理员（部分字段脱敏）`
  `不可删除策略` -> `启用（普通管理员不可删除）`
  `取证审批` -> `启用（需审计管理员审批）`
  `告警通知` -> `高危操作实时告警（邮件 + 短信）`
- Use source-like blue/red toggles and small line edit icons, never emoji.

Bottom row:
- Four source cards in one horizontal row, all visible:
  1. `导出取证包预览` with `EVP-20250521-102345-001`, `事件数量 4 条`, `完整性哈希（SHA256）`, `水印信息`, `下载审批状态`, button `下载取证包`.
  2. `留存保护策略` with `在线存储（热存） 180天`, `归档存储（冷存） 3年`, `普通管理员不可删除 已启用`, `强制留存策略 启用（不可覆盖）`.
  3. `风险事件趋势（近 7 天）` with `高危事件`, `中危事件`, final values `32` and `14`.
  4. `审计链路追溯（示例）` with numbered items `作业台发起操作`, `工作流审批通过`, `系统回执（ERP/EHR/MES）`, `审计归档入库`.

Visual geometry:
- Match the IMAGE2 source: compact enterprise UI, dark navy shell, white cards, 1px borders.
- Avoid the attempt9 failure where table cells wrap into multiple tall lines.
- Avoid the attempt9 failure where the right card title becomes `审计策略编排`.
- Keep all visible content inside the first viewport; bottom cards should not be cut off.

Required exact text in exported HTML:
`系统操作审计配置台`
`审计策略编辑`
`2025-05-21 10:23:45`
`ERP凭证VCH-20250521-001`
`缓存键：AssetCacheAll`
`导出取证包预览`
`留存保护策略`
`风险事件趋势（近 7 天）`
`审计链路追溯（示例）`

Forbidden exact text:
`审计策略编排`
