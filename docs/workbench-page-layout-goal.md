# Workbench 左侧页面承载修复冲刺

[$gai] 继续 forthAMS Workbench 左侧导航页面完善目标。本轮聚焦“页面承载、滚动、设计稿复刻和按钮闭环”修复，不新增导航，不重做顶部主框架。

## 基准

- 分支：`codex/workbench-platform-entry`
- 推送：`origin/codex/workbench-platform-entry`
- 禁止：切 main、重建分支、触碰 `frontend/src/pages/mobile/**`
- 设计稿路径：`/Users/feigao/.codex/generated_images/019ec575-b605-73d1-9af7-84fd18289067`

## 本轮目标

先扫描目标页面，但只选择问题最明显、价值最高的 2-3 个页面修复。未选页面只记录缺口，不做代码改动。

优先扫描：
- 资产总览
- 设备管理
- 工单管理
- 报表分析
- 告警中心
- 组织策略
- 基础维护

可顺带检查：
- 流程待办
- 备件管理
- 数据监控
- 巡检管理

## 修复重点

重点找并修：
- 内容被压缩、卡住、底部有空白但信息不能展开
- 滚动不合理，表格、列表、右侧详情抽屉显示不完整
- 与 IMAGE2/Stitch 设计稿布局、比例、颜色、密度明显不一致
- 关键按钮不能发起、新建、查询、展示、打开或处理
- 缺少预填上下文、空态、异常态、无权限态反馈

保持不动：
- Workbench 顶部主框架
- 顶部页签
- 左侧一级导航结构
- 已经复刻较好的页面

## 执行顺序

1. `git fetch origin --prune`，确认当前分支是 `codex/workbench-platform-entry`
2. 按 AGENTS.md 对将改的组件/页面跑 GitNexus impact
3. 浏览器逐页打开实际 URL，截图并记录问题
4. 对照设计稿路径，形成页面问题清单
5. 只选择 2-3 个最高价值页面修复
6. 修 CSS/React 内容区、表格区、详情区、滚动区、按钮闭环
7. 用 Playwright 截图和 DOM 指标验证
8. 新增或更新关键 Playwright 回归
9. 跑必要 Vitest/Playwright/build
10. `gitnexus_detect_changes(scope=staged)`
11. GAI2 reviewer PASS 后提交推送

## 修复策略

参考运营首页修复方式：
- 不用“整体放大”解决问题
- 先定位真实限制点：`height`、`max-height`、`overflow`、`grid-template-rows`、`flex`
- 让主业务区吃到剩余高度
- 表格、列表、详情抽屉必须可见、可滚动、可操作
- 用回归测试防止再次被固定高度截断

## 验证硬约束

每个修复页必须有：
- 页面 URL
- 修复前截图或 DOM 指标
- 修复后截图
- 指标：`productHeight`、`bottomGap`、`tableHeight`、`detailHeight`、`overflow`、`maxHeight` 等
- 按钮闭环验证
- 空态、异常态、无权限态检查结果

没有 Playwright 截图和指标证据，不允许提交。
没有 React/CSS 源码改动，不允许提交。
不允许 docs-only、test-only、manifest-only 提交。

## 最低交付

- 至少完成 2 个左侧页面真实修复
- 每个修复页都有截图和指标证据
- 至少新增或更新 1 条 Playwright 回归
- 必要 Vitest/Playwright/build 通过
- GitNexus staged 审计低风险，或风险已解释
- reviewer verdict 必须 PASS

## 提交

- commit message: `Improve workbench page layout fidelity`
- push 到 `origin/codex/workbench-platform-entry`

## Closeout

必须包含：
- PASS/PARTIAL/FAIL
- 扫描页面、选中修复页面、未修页面及原因
- 修改文件
- 截图/指标证据
- Playwright/Vitest/build/GitNexus 结果
- reviewer verdict
- 剩余缺口和下一轮建议
