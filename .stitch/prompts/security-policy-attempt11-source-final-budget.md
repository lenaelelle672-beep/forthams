This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot `system-params-subpage-02-security-policy-v2.png` is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.

Page name: 安全策略
Menu id: system-security-policy
Reference image: system-params-subpage-02-security-policy-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-params-subpage-02-security-policy-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-security-policy

Create a new persistent Stitch DESIGN screen from the selected IMAGE2 source screen. Do not return only DOM operations.

Hard canvas rules:
- Exact viewport: 1609 x 977 CSS pixels.
- No document scroll. No internal scroll containers. No `overflow-y:auto`, `overflow:auto`, or hidden scrollable panels.
- Everything visible in the IMAGE2 source must fit inside y=0..977.
- Preserve the exact top-left IMAGE2 brand mark: white uppercase `UNIVIEW`, the divider, and `固定资产管理系统`. Do not lowercase, redraw, split, or replace it.

Source geometry to follow:
- Top dark nav: x=0..1609, y=0..60.
- Left sidebar: x=0..226, y=60..977; `系统参数` expanded and `安全策略` active.
- Main content: x=249..1585, y=80..922, white/light gray work surface.
- Page title row: y=84..124, title `登录会话与敏感字段策略`, buttons `新建策略`, `保存草稿`, `提交校验`, `安全演练`.
- KPI row: y=132..218, four cards: `安全策略 12`, `高危操作 7`, `脱敏字段 18`, `异常登录 3`.
- Upper work row: y=230..660.
  - Left table card x=249..1067, title `安全策略列表`.
  - Right editor card x=1082..1585, title must be exactly `安全策略编排` (not `安全策略编辑`).
- Bottom card row: y=672..922.
  - Card 1 x=249..562: `安全策略地图`.
  - Card 2 x=577..880: `高危操作清单`.
  - Card 3 x=895..1148: `发布复核门禁`.
  - Card 4 x=1162..1585: title must be exactly `异常登录趋势（最近 7 天）`.

Upper left table content must be source-dense and fully visible:
- Filter row: labels `安全域`, `状态`, `风险`, search placeholder `搜索策略名称/策略键`.
- Columns: `策略名称`, `策略键`, `安全域`, `策略值`, `风险等级`, `状态`, `操作`.
- Five rows must be visible:
  1. `会话与敏感字段策略` / `session.sensitive.policy` / `会话安全` / `见策略详情` / `高` / `已发布`
  2. `钉钉 H5 入口校验` / `dingtalk.h5.verify` / `身份校验` / `强校验（跳转校验+签名）` / `中` / `待复核`
  3. `高危操作确认` / `high.risk.confirm` / `操作安全` / `二次确认 + 短信通知` / `高` / `已发布`
  4. `接口密钥轮换` / `api.key.rotate` / `接口安全` / `90天轮换` / `中` / `草稿`
  5. `CIP 转固敏感字段策略` / `cip.sensitive.policy` / `数据脱敏` / `按角色脱敏（3级）` / `低` / `已发布`
- Footer visible inside the table card: `共 5 条`, `10 条/页`, `1`, `前往`, `页`.

Right editor content must be fully visible inside y=230..660:
- Title exactly `安全策略编排`.
- Fields in order: `策略名称 *`, `策略键 *`, `会话策略`, `登录限制`, `敏感字段脱敏`, `H5 身份校验`, `高危操作确认`, `审计留痕`, `应急解锁`.
- Values:
  - `会话与敏感字段策略`
  - `session.sensitive.policy`
  - `会话超时 30 分钟，空闲 15 分钟强制下线`
  - `单账号多地登录限制：最多 2 处`
  - `按角色分级脱敏（3级）`
  - `启用（签名校验 + 时间戳校验）`
  - `启用二次确认 + 短信通知`
  - `全量记录（含请求参数与结果）`
  - `需双人审批 + 动态口令验证`
- Bottom buttons visible inside the editor card: `保存草稿`, `提交校验`.

Bottom row content must be fully visible:
- `安全策略地图`: nodes `登录会话`, `H5 身份`, `安全策略`, `敏感字段`, `高危确认`, `审计留痕`.
- `高危操作清单`: columns `操作名称`, `触发条件`, `风险等级`, `状态`; rows `越权访问`, `批量导出`, `删除附件`, `修改系统配置`; link `查看全部高危操作` must be visible inside the card, not below the viewport.
- `发布复核门禁`: `策略完整性`, `脱敏覆盖`, `审计链路`, `应急回滚`, `异常登录演练`, with statuses `通过` / `警告`; link `查看复核详情`.
- Trend card title must be one exact text node or visually one line: `异常登录趋势（最近 7 天）`. Do not split it into `异常登录趋势` and `(最近7天)`. Use the full-width Chinese parentheses and spaces around `7`: `（最近 7 天）`.
- Trend legend: `异常登录次数`, `阻断次数`; x labels `06-10`, `06-11`, `06-12`, `06-13`, `06-14`, `06-15`, `06-16`; link `查看全部趋势`.

Density guardrails:
- Use compact source-like rows. Do not make table rows taller than the source.
- Do not allow bottom cards to overlap the upper work row.
- Do not use emoji-style icons; use simple source-like line/filled UI icons.
- No decorative shadows, no marketing composition, no dark cards inside content.
