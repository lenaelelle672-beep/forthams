Refine the selected mail templates DESIGN screen into a new persistent complete DESIGN/HTML screen.

This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The IMAGE2 v2 screenshot `notification-subpage-03-mail-templates-v2.png` is the only source of truth.
The selected screen `de5700cf305d4930b16ca5610b9f437b` already passes the main content geometry gates:
- `documentElement.scrollWidth=1586`, `documentElement.scrollHeight=992`.
- `body.scrollWidth=1586`, `body.scrollHeight=992`.
- no real internal scroll containers.
- required body text is present.
- search placeholder is visible.
- `共 5 条`, `共 3 条`, and `重新校验` are visible above y=956.

Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Return a NEW complete DESIGN screen with full HTML. Do not return only DOM operations.

ONLY repair the global shell and left sidebar to match the IMAGE2 source exactly.
Do not move, resize, delete, or restyle the main work area from x>=218 and y>=50 except where the source top shell requires the content to start at y=50.

Hard lock the already-correct main content:
- Keep title `邮件模板配置台`, subtitle, actions, status strip, filter row, `邮件模板列表`, `模板编辑区`, `变量字典`, `引用流程`, and `发布校验清单`.
- Keep upper table exactly 4 rows and footer `共 4 条`.
- Keep bottom-left footer `共 5 条` at approximately y=925.5..938.5.
- Keep bottom-middle footer `共 3 条` at approximately y=925.5..938.5.
- Keep `重新校验` at approximately x=1500, y=918..933.
- Keep `erp_receipt_no` visible.
- Keep document/body exactly 1586 x 992.
- Keep zero real internal scroll containers.

Source shell repair:
1. Top shell:
   - x=0..1586, y=0..50, dark navy `#031b33` / `#041f3a`.
   - Top-left brand must match IMAGE2: white `UNIVIEW` followed by `固定资产管理系统`.
   - Do NOT insert a vertical divider between `UNIVIEW` and `固定资产管理系统`.
   - Do NOT split or distort the UNIVIEW wordmark.
   - The source-visible top nav labels and order must be:
     `资产管理`, `财务管理`, `报表中心`, `系统设置`, `系统运营中枢`.
   - Each top nav item has a small white line icon before the label.
   - `系统运营中枢` is active with a blue rectangular tab and a small gear-like icon before the label.
   - Top-right source controls must be present: notification bell with red `12` badge, help icon, divider, circular avatar, `平台运维`, and chevron.
   - Keep the top shell height exactly 50px.

2. Left sidebar:
   - x=0..218, y=50..992.
   - Dark navy vertical sidebar matching IMAGE2, not the short generic menu.
   - Header row includes a network/system icon and `系统运营中枢`.
   - Use compact 14px Chinese labels and small line icons for leaf items.
   - Keep the source section hierarchy and visible labels:
     `流程平台`
     `流程设计`
     `流程监控`
     `流程日志`
     `流程委托`
     `组织权限`
     `组织管理`
     `角色管理`
     `权限管理`
     `用户管理`
     `基础资料`
     `资产分类`
     `资产属性`
     `编码规则`
     `枚举值管理`
     `集成配置`
     `系统集成`
     `接口管理`
     `数据映射`
     `调度任务`
     `消息与通知`
     `通知渠道`
     `消息模板`
     `邮件模板`
     `短信模板`
     `消息日志`
     `系统参数`
     `全局参数`
     `业务参数`
     `参数日志`
   - `消息与通知` section is expanded and has a darker selected section band.
   - `邮件模板` child item is the active leaf. It must have a bright blue active rectangle, a mail/envelope icon, and white text, at the same source-like vertical position.
   - Do not make the sidebar a short six-item generic menu.
   - Do not omit the source child items before `消息与通知`.

3. Avoid these regressions:
   - No page scroll.
   - No internal scroll containers.
   - Do not change main content y positions.
   - Do not move the bottom three cards down.
   - Do not change `共 4 条`, `共 5 条`, `共 3 条`.
   - Do not introduce emoji icons. Use simple inline SVG-style line icons.
   - Do not use the generic top nav `资产管理 财务管理 报表中心 系统设置` without icons; source has icons.

Final self-check before returning:
- Browser-visible text includes `流程设计`, `流程监控`, `流程日志`, `流程委托`, `组织管理`, `角色管理`, `权限管理`, `用户管理`, `资产属性`, `枚举值管理`, `系统集成`, `接口管理`, `数据映射`, `调度任务`, `邮件模板`, `全局参数`, `业务参数`, `参数日志`.
- `邮件模板` sidebar item is active.
- Top-left brand is `UNIVIEW 固定资产管理系统`, without a divider.
- Main content still passes: `邮件模板列表`, `共 4 条`, `变量字典`, `erp_receipt_no`, `共 5 条`, `引用流程`, `共 3 条`, `发布校验清单`, `合规签名`, `重新校验`.
- All three strings `共 5 条`, `共 3 条`, `重新校验` have bounding boxes with bottom <= 956.
- document/body exactly 1586 x 992.
