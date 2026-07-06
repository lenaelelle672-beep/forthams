This is a 100/100 pixel-fidelity transcription task, not a redesign task.
The uploaded IMAGE2/product screenshot is the only source of truth.
Any visible mismatch loses points.
Do not improve, simplify, reinterpret, modernize, normalize, or redesign the page.
Do not use your own default admin template.
Do not change business data.
Preserve the exact source-visible brand mark and lockup.
Generate a persistent DESIGN/HTML screen with a real downloadable htmlCode output.

Source reference:
- Uploaded reference screen id: 10913876529496336440
- Source file: flow-platform-subpage-05-approval-rules-v2.png
- Exact viewport: 1586 x 992 desktop
- Page/menu: system-approval-rules / 审批规则
- The result must be a full single-screen HTML transcription of the whole screenshot, including the top shell and left sidebar.

Critical frame contract:
- Canvas must be exactly 1586px wide and 992px tall.
- No page-level horizontal or vertical scroll.
- No unwanted internal scrollbars.
- Everything visible in the screenshot must stay visible in the 992px height.
- Compact enterprise density is required; do not enlarge cards or create a generic admin template.

Top shell:
- Dark navy top bar, exact UNIVIEW wordmark at top left.
- Top nav labels in order: 固定资产工作台, 资产全景视图, 大屏态势, 流程协同, 系统运营中枢.
- 系统运营中枢 is active with a blue underline.
- No search field, no search icon, no search button in the top shell.

Left sidebar:
- Dark navy sidebar width and gradient like source.
- Header text: 系统运营中枢.
- 流程平台 section expanded.
- Menu items: 流程定义, 表单管理, 流程监控, 流程授权, 表单存储, 审批规则.
- 审批规则 is active with the blue highlight bar.
- Other groups visible: 组织权限, 基础资料, 集成配置, 消息与通知, 系统参数.
- Bottom text/icon: 收起菜单.
- No sidebar search.

Content header:
- Breadcrumb: 系统运营中枢 / 流程平台 / 审批规则.
- Title: 审批规则配置台.
- Subtitle: 配置重复处理人跳过、高职交接承接、代理审批和节点权限规则，并支持命中模拟、保存草稿和发布校验。
- Action buttons in order: 新建规则, 保存草稿, 模拟命中, 提交校验.
- Green feedback bar: 规则命中模拟已完成 · CIP 转固流程 / 财务审核 · 已生成审计链路.

Main content:
- Three-column layout exactly like source:
  - Left rules column.
  - Center workbench column.
  - Right properties/result column.

Left rules column:
- Title: 规则集.
- Chips: 全部, 跳过规则, 交接规则, 代理审批, 权限规则.
- Four visible rule cards:
  1. 重复处理人跳过, badge 跳过规则, status 草稿已保存, priority P1.
  2. 离职交接承接, badge 交接规则, status 已发布, priority P2.
  3. 财务节点代理, badge 代理审批, status 待复核, priority P3.
  4. 节点权限校验, badge 权限规则, status 已发布, priority P4.
- Footer: 共 4 条, previous arrow, active page 1, next arrow.

Center summary row:
- Four metric cards:
  - 规则总数 4
  - 启用规则 3
  - 待复核 1
  - 发布完成度 100%

Center simulation panel:
- Title: 命中模拟场景.
- Fields: 流程 CIP 转固流程, 节点 财务审核, 处理人 财务负责人 / P016.
- Context input: 请假状态已同步，代理授权有效。
- Blue button: 模拟命中.

Center orchestration panel:
- Title: 规则执行编排.
- Four connected boxes:
  - 入口流程 / CIP 转固流程
  - 命中条件 / 同一用户连续出现在相邻节点
  - 处理路由 / 跳过前置处理人
  - 审计归档 / 记录规则命中与处理人

Lower center panels:
- Left panel title: 优先级队列.
- Queue table rows:
  - P1 重复处理人跳过 当前模拟命中 全部
  - P2 离职交接承接 生产可命中 生产
  - P3 财务节点代理 待复核命中 全部
  - P4 节点权限校验 生产可命中 全部
- Right panel title: 发布门禁矩阵.
- Gates:
  - 规则启用 通过
  - 字段完整 5/5
  - 模拟场景 通过
  - 审计留痕 已配置
  - 冲突检查 存在同优先级规则

Bottom center table:
- Title: 规则明细.
- This is the main known previous gap: all four source rows must be visible inside the 992px viewport, not clipped and not reduced to one row.
- Columns: 规则, 类型, 流程, 启用, 触发条件, 状态.
- Rows:
  1. 重复处理人跳过 / 跳过规则 / CIP 转固流程 / enabled toggle / 同一用户连续出现在相邻节点 / 草稿已保存
  2. 离职交接承接 / 交接规则 / CIP 转固流程 / enabled toggle / 处理人离职或岗位已变更 / 已发布
  3. 财务节点代理 / 代理审批 / CIP 转固流程 / enabled toggle / 代理授权有效且代理人具备权限 / 待复核
  4. 节点权限校验 / 权限规则 / CIP 转固流程 / enabled toggle / 处理人不具备数据或操作权限 / 已发布

Right properties column:
- Top title: 规则属性.
- Fields in order:
  - 规则名称*: 重复处理人跳过
  - 规则类型*: 跳过规则
  - 适用流程*: CIP 转固流程
  - 触发条件*: 同一用户连续出现在相邻节点
  - 处理动作*: 跳过前置处理人
  - 审计要求*: 记录规则命中与处理人
- Toggles: 启用规则, 审计留痕.
- Lower title: 模拟结果.
- Result table:
  - 命中动作: 跳过前置处理人
  - 模拟上下文: 请假状态已同步，代理授权有效。
  - 命中规则: 重复处理人跳过 (P1)
  - 审计记录编号: RULE-AUDIT-20260618-01
  - 模拟时间: 2024-06-18 11:25:36
- Buttons: 保存规则, 查看审计, 提交校验.

Visual fidelity:
- Match the source's dark navy shell, pale blue page background, white cards, 1px borders, compact typography, and 4px-8px radii.
- Icons may be equivalent but must preserve their placement, scale, and status color.
- Do not add decorative orbs, marketing hero sections, gradients unrelated to the screenshot, extra explanatory text, or placeholder/sample data.
- Do not omit any source-visible major panel.
