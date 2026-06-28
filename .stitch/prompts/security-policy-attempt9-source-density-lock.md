Edit the selected uploaded IMAGE2 v2 reference screen into a new Stitch DESIGN screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2 v2 screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Do not hide required content behind scroll if the uploaded screenshot shows it.

Preserve the exact top-left IMAGE2 brand mark for the current source screenshot: white `UNIVIEW`, the source-visible divider/lockup, and adjacent `固定资产管理系统`.
Do not lowercase, redraw, distort, split, re-space, or replace the UNIVIEW wordmark.
Do not let Stitch generate disconnected letters, generic logos, emoji icons, or a different brand lockup.

Page name: 安全策略
Visible title: 登录会话与敏感字段策略
Menu id: system-security-policy
Reference image: system-params-subpage-02-security-policy-v2.png
Reference URL: http://127.0.0.1:5173/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-params-subpage-02-security-policy-v2.png
Workbench URL: http://127.0.0.1:5173/fixed-assets/workbench?menu=system-security-policy
Canvas: exactly 1609 x 977 CSS pixels. The browser document must be exactly 1609 x 977 with no page scroll.

Generate a new persistent DESIGN screen, not a temporary DOM operation. The exported HTML must contain the final corrected layout.

Critical source geometry:
- Top shell: x=0..1609, y=0..60, dark navy. Top tab `系统运营中枢` active.
- Left sidebar: x=0..226, y=60..977, light system sidebar. `系统参数` expanded and `安全策略` active.
- Main content: x=249..1585, y=79..923.
- Header: title `登录会话与敏感字段策略`, actions `新建策略`, `保存草稿`, `提交校验`, `安全演练`.
- KPI row: four cards y=133..218, values `12`, `7`, `18`, `3`.
- Middle row:
  - Left `安全策略列表`: x=249..1067, y=230..660. It must show five table rows, not three. Required visible rows:
    `会话与敏感字段策略`, `钉钉 H5 入口校验`, `高危操作确认`, `接口密钥轮换`, `CIP 转固敏感字段策略`.
    Required visible keys: `session.sensitive.policy`, `dingtalk.h5.verify`, `high.risk.confirm`, `api.key.rotate`, `cip.sensitive.policy`.
  - Right `安全策略编辑`: x=1082..1585, y=230..660. It must show all fields from `策略名称` through `应急解锁`, and the bottom buttons `保存草稿`, `提交校验`.
- Bottom row y=672..923:
  - `安全策略地图` x=249..562.
  - `高危操作清单` x=576..883.
  - `发布复核门禁` x=897..1148.
  - `异常登录趋势（最近 7 天）` x=1162..1585.

Hard repair rules from previous failed attempts:
- Do not create any `overflow-y-auto`, `overflow-auto`, internal scrollbars, or hidden scrolling regions in the main content, policy table, right editor, or bottom cards.
- Do not show only three policy rows. All five table rows must be visible in the middle table.
- Do not clip the right editor after `H5 身份校验`; keep `高危操作确认`, `审计留痕`, and `应急解锁` visible.
- Do not let the middle row overlap the bottom diagnostic row. Bottom four cards must start around y=672 and remain fully visible through y=923.
- Preserve fullwidth Chinese punctuation exactly: `强校验（跳转校验+签名）`, `按角色脱敏（3级）`.
- Use exact source strings: `api.key.rotate`, `cip.sensitive.policy`, `应急解锁`, `查看复核详情`, `查看全部高危操作`, `查看全部趋势`.

Density rules:
- Use 12px dense Chinese table text.
- Policy table row height should be about 47px so five rows fit inside the source table.
- Right editor field row height should be about 35px so all eight fields and two buttons fit.
- Keep bottom card charts/tables compact and source-like. Do not enlarge chart labels or cards.
- Keep white/blue-gray surfaces, thin borders, blue buttons, green/orange/red status chips, and 8px-or-smaller radius.

Forbidden output:
- No sparse gray/default admin layout.
- No dark dashboard body.
- No emoji icons.
- No ASCII punctuation replacements for the required fullwidth Chinese strings.
- No generic placeholder rows.

Final self-check:
- documentElement.scrollWidth == 1609 and scrollHeight == 977.
- No internal overflow containers.
- All five policy rows are visible.
- Right editor lower fields through `应急解锁` are visible.
- Bottom four cards are fully visible.
- The screenshot looks like a direct HTML transcription of the IMAGE2 source, not a generic admin template.
