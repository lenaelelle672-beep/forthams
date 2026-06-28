# 后台设置 / 资产运营中枢验证 Runbook

本文配合以下文件使用：

- `docs/superpowers/specs/2026-06-21-system-hub-operations-redesign.md`
- `docs/superpowers/specs/2026-06-21-system-hub-operations-inspection-results.json`

目标是把“每个后台设置导航页都看过”转化为可复查证据，而不是只依赖主观印象。

## 验证前提

验证范围仅限桌面后台设置 / 资产运营中枢：

- 包含：系统模式后台设置页、资产运营中枢导航页、`admin-workbench / configurator / console / large-page` 布局。
- 不包含：移动端页面、后端接口改造、菜单增删、非后台设置视觉重构。

## 推荐执行顺序

1. 构建验证。

```bash
npm --prefix frontend run build
```

2. 系统中枢静态校验。

```bash
npm --prefix frontend run verify:system-hub
```

3. 系统中枢浏览器交互回归。

```bash
npm --prefix frontend run verify:system-hub-interactions
```

4. 人工或浏览器逐页巡检。

- 按 `system-hub-operations-inspection-results.json` 的六个 `navigation_groups` 回填。
- 每类至少确认一个代表页。
- 组织权限类必须重点看用户、角色、菜单、部门。

## JSON 回填规则

### 命令结果

更新 `commands`：

```json
"build": {
  "command": "npm --prefix frontend run build",
  "status": "passed | failed | not_run",
  "evidence": "关键输出摘要或失败原因"
}
```

状态含义：

- `passed`: 命令成功退出，且输出不包含相关失败。
- `failed`: 命令失败或输出显示相关失败。
- `not_run`: 尚未执行。

### 验收项

更新 `acceptance_checks[].status`：

- `passed`: 已有直接证据证明该 AC 达标。
- `partial`: 有部分证据，但未覆盖完整范围。
- `failed`: 证据显示未达标。
- `pending`: 尚无证据。

建议增加字段：

```json
"evidence": [
  "命令结果、截图路径、页面观察摘要或失败定位"
]
```

### 逐页巡检

对 `navigation_groups[].pages[]` 的每个页面，建议补充：

```json
{
  "index": 1,
  "page": "用户管理",
  "route_key": "system-user-management",
  "focus": "用户授权搜索",
  "status": "passed | partial | failed | pending",
  "checks": {
    "low_noise_structure": "passed | partial | failed | pending",
    "primary_actions_visible": "passed | partial | failed | pending",
    "data_region_scrolls": "passed | partial | failed | pending",
    "secondary_context_muted": "passed | partial | failed | pending"
  },
  "evidence": [
    "搜索用户授权任务输入框可见并可输入",
    "用户表格横向承载未挤压"
  ],
  "repair_needed": []
}
```

## 页面观察标准

### 低噪声结构

通过标准：

- 页面主视觉不再是多层卡片套卡片。
- header、说明、证据、预览没有占满首屏。
- 主要区域通过表格、树、列表、表单承载。

失败信号：

- 卡片阴影/大圆角层层嵌套。
- 说明文字、推荐、故事化内容比主操作更突出。
- 用户需要先滚动一大段说明才能看到操作入口。

### 主操作首屏可见

通过标准：

- 搜索、筛选、保存、发布、批量、分页等关键操作首屏可见。
- 组织权限页尤其要确认搜索与筛选不被隐藏。

失败信号：

- 搜索框不可见、不可输入、被 CSS 隐藏。
- 按钮被压缩到不可读或被横向溢出遮挡。

### 数据区可滚动或横向承载

通过标准：

- 表格、树、队列、日志有自己的滚动区域。
- 长列通过横向滚动承载，不把页面整体撑爆。
- 部门树和组织面板可滚动。

失败信号：

- 整页无限拉长。
- 主表格列被挤到不可读。
- 树列表展开后覆盖或挤压详情区。

### 辅助信息未抢占主区

通过标准：

- 审计、证据、预览、推荐、runbook 可见但弱化。
- 辅助区限制高度或滚动承载。

失败信号：

- 辅助说明完全消失，影响配置判断。
- 辅助内容比主表格/主表单更突出。

## 失败处置策略

优先级从高到低：

1. 恢复关键控件可见性。

- 搜索、筛选、保存、发布、分页、批量操作不能被隐藏。

2. 收紧 CSS 选择器。

- 如果误伤非后台设置页，优先缩小到具体页面类或 `is-system-mode` 子范围。

3. 修局部布局边界。

- 窄屏或复杂设计器失败时，优先补局部 `min-width`、`min-height`、单列规则。

4. 降低辅助信息权重。

- 优先弱化、限制高度、滚动承载，不直接 `display: none`。

5. 记录无法覆盖项。

- 如果某个导航页需要真实后端分页/API 支持，记录为本次范围外，不用 CSS 假装解决。

## 完成声明要求

只有当以下证据齐备时，才能把目标标记完成：

- `build` 通过。
- `verify:system-hub` 通过。
- `verify:system-hub-interactions` 通过，或剩余失败被证明不属于本目标范围。
- JSON 中 AC-1 到 AC-6 均为 `passed`，或有充分解释的范围外项。
- 六类导航页均有代表页检查结果。
- 组织权限类核心页有具体证据证明支持 7000+ 人员和 200+ 部门的操作方式。
