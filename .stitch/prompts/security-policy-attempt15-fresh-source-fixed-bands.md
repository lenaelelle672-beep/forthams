Create a new persistent Stitch DESIGN/HTML screen from the selected uploaded IMAGE2 source screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot `system-params-subpage-02-security-policy-v2.png` is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not return only DOM operations; return a new persistent DESIGN screen with HTML.

Page name: 安全策略
Menu id: system-security-policy
Canvas: exactly 1609 x 977 CSS pixels.

Hard CSS/layout rules:
- html, body, root must be width:1609px; height:977px; margin:0; overflow:hidden.
- Do not create a 2048px tall page.
- No document scroll. No internal visible scroll containers. No `overflow-y-auto`, `overflow-auto`, or scrollable panels.
- Use absolute/fixed bands so every source-visible section fits in y=0..977.
- All Chinese table cells must remain horizontal. No stacked/vertical text.
- Use compact source-like table rows and form controls. If space is tight, reduce font size or row height, never push content below y=977.

Source shell:
- Top nav: x=0 y=0 w=1609 h=60, dark navy.
- Top-left brand exactly like IMAGE2: white `UNIVIEW`, vertical divider, `固定资产管理系统`.
- Top tabs: `资产管理`, `CIP 转固管理`, `盘点管理`, `报表中心`, active `系统运营中枢`.
- Left sidebar: x=0 y=60 w=226 h=917, light sidebar. `系统参数` expanded and `安全策略` active.

Main fixed bands:
- Main content starts x=249.
- Title row y=80..124: title `登录会话与敏感字段策略`; buttons `新建策略`, `保存草稿`, `提交校验`, `安全演练`.
- KPI row y=132..218: four cards:
  `安全策略` value `12`;
  `高危操作` value `7`;
  `脱敏字段` value `18`;
  `异常登录` value `3`.
- Upper work row y=230..660:
  - Left table card x=249 y=230 w=818 h=430, title `安全策略列表`.
  - Right editor card x=1082 y=230 w=503 h=430, title exactly `安全策略编排`.
- Bottom card row y=672..922:
  - `安全策略地图` x=249 y=672 w=313 h=250.
  - `高危操作清单` x=577 y=672 w=303 h=250.
  - `发布复核门禁` x=895 y=672 w=253 h=250.
  - `异常登录趋势（最近 7 天）` x=1162 y=672 w=423 h=250.

Left table content:
- Filter row labels/controls: `安全域`, `全部`, `状态`, `全部`, `风险`, `全部`, search placeholder/value `搜索策略名称/策略键`.
- Columns: `策略名称`, `策略键`, `安全域`, `策略值`, `风险等级`, `状态`, `操作`.
- Exactly five visible rows, compact and horizontal:
  1. `会话与敏感字段策略` / `session.sensitive.policy` / `会话安全` / `见策略详情` / `高` / `已发布`
  2. `钉钉 H5 入口校验` / `dingtalk.h5.verify` / `身份校验` / `强校验（跳转校验+签名）` / `中` / `待复核`
  3. `高危操作确认` / `high.risk.confirm` / `操作安全` / `二次确认 + 短信通知` / `高` / `已发布`
  4. `接口密钥轮换` / `api.key.rotate` / `接口安全` / `90天轮换` / `中` / `草稿`
  5. `CIP 转固敏感字段策略` / `cip.sensitive.policy` / `数据脱敏` / `按角色脱敏（3级）` / `低` / `已发布`
- Pagination/footer visible inside card: `共 5 条`, `10 条/页`, `1`, `前往`, `页`.

Right editor content:
- Title exactly `安全策略编排`. Never use `安全策略编辑`.
- Show all labels and values inside x=1082..1585, y=230..660:
  `策略名称 *` = `会话与敏感字段策略`
  `策略键 *` = `session.sensitive.policy`
  `会话策略` = `会话超时 30 分钟，空闲 15分钟强制下线`
  `登录限制` = `单账号多地登录限制：最多 2 处`
  `敏感字段脱敏` = `按角色分级脱敏（3级）`
  `H5 身份校验` = `启用（签名校验 + 时间戳校验）`
  `高危操作确认` = `启用二次确认 + 短信通知`
  `审计留痕` = `全量记录（含请求参数与结果）`
  `应急解锁` = `需双人审批 + 动态口令验证`
- Bottom buttons inside this editor card: `保存草稿`, `提交校验`.

Bottom row:
- `安全策略地图`: include nodes `登录会话`, `H5 身份`, `安全策略`, `敏感字段`, `高危确认`, `审计留痕`.
- `高危操作清单`: compact table rows `越权访问`, `批量导出`, `删除附件`, `修改系统配置`; statuses `启用`; link `查看全部高危操作` visible above y=922.
- `发布复核门禁`: rows `策略完整性`, `脱敏覆盖`, `审计链路`, `应急回滚`, `异常登录演练`; statuses `通过`, `警告`; link `查看复核详情` visible above y=922.
- Trend card title must be exactly one visible line: `异常登录趋势（最近 7 天）`. Do not split it into ASCII parentheses or two lines.
- Trend card includes legend `异常登录次数`, `阻断次数`, x labels `06-10`, `06-11`, `06-12`, `06-13`, `06-14`, `06-15`, `06-16`, and link `查看全部趋势` above y=922.

Forbidden text:
- `Security Policy Console`
- `安全策略编辑`
- `异常登录趋势 (最近7天)`
- `异常登录趋势
(最近7天)`
- `undefined`
- `NaN`
- `Lorem`

Final self-check:
- Browser viewport/document/body must be exactly 1609 x 977.
- Required text exists exactly, including `异常登录趋势（最近 7 天）`.
- Five left-table rows are visible and horizontal.
- Right editor lower fields `审计留痕`, `应急解锁`, `保存草稿`, `提交校验` are visible.
- Bottom links `查看全部高危操作`, `查看复核详情`, `查看全部趋势` are visible inside the cards.
