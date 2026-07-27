# Workbench V3 Style Guide

## 目标

Workbench V3 是独立的后端管理壳，入口为 `/fixed-assets/workbenchv3`。它借鉴 Vector Engine 的浅蓝白科技控制台风格，但不复制目标站业务文案、资源、Logo 或全局主题覆盖。

## 固定架构

- 路由入口：`/fixed-assets/workbenchv3`。
- 默认菜单：`?menu=system-user-management`。
- 页面壳文件：`frontend/src/pages/workbench-v3/WorkbenchV3Page.tsx`。
- 系统真实页面承载：继续使用 `SystemPageHost activeMenu`。
- 右侧详情面板：继续使用 `SystemInspectorSlotProvider` 接收真实系统页提供的 inspector。
- 旧工作台：不得改动 `/fixed-assets/workbench`、旧 `WorkspacePreviewPage` 的 base path 或旧默认跳转。
- 权限：当前阶段不在 `routePermissions.ts` 中加入 `/fixed-assets/workbenchv3`，后续权限专项再做。

## 页面布局

- 顶层背景使用浅蓝白底：`#F5F9FF`，叠加柔和蓝色 radial gradient。
- 顶部栏是悬浮玻璃胶囊：圆角 `20px`、半透明白、白色弱边框、内高光阴影、`backdrop-blur-2xl`。
- 主体为两列 grid：侧栏 + 内容区。
- 侧栏展开宽度固定为 `224px`，折叠宽度固定为 `72px`。
- 内容区在有 inspector 时分为主内容 + `360px` 详情列；无 inspector 时为单列。
- 中小屏允许主 grid 退化为单列，避免横向溢出。

## 侧边栏

- 侧边栏使用玻璃卡片：圆角 `20px`、半透明白、白色弱边框、内高光阴影、`backdrop-blur-2xl`。
- 侧边栏支持折叠，状态字段固定为 `isSidebarCollapsed`。
- 折叠按钮的可访问标签固定使用：`展开侧边栏` / `折叠侧边栏`。
- 展开态显示分组标题、分组说明、菜单 label 和菜单说明。
- 折叠态隐藏分组说明和菜单说明，只保留菜单首字短标签，并通过 `title` 保留完整菜单名。
- 侧栏顶部品牌卡展开态显示“系统后台管理”，折叠态显示“V3”。

## 菜单视觉

- 菜单项圆角使用 `12px` 量级，保持轻量后台感。
- 普通态：透明背景、文字 `slate-600`。
- Hover 态：弱蓝背景 `#0084FF/10`，文字 `#0084FF`。
- 选中态：蓝色渐变 `#59B0FF -> #2E8BFF`，白字，柔和蓝色阴影。
- 不使用厚重深色侧栏，不使用营销型闪光动画。

## 顶部栏内容

- 左侧保留折叠按钮和品牌信息。
- 品牌小标题：`Workbench V3`。
- 页面标题：`后端管理 V3`。
- 说明文案：`Vector Engine 风格的独立后台管理壳，复用现有系统真组件页面。`
- 右侧显示当前模块：`当前模块：{group} / {label}`。
- 保留返回旧工作台链接：`/fixed-assets/workbench?menu=home`。

## 内容区

- 内容卡片使用半透明白、圆角 `20px`、弱边框、弱阴影和轻 blur。
- 内容区顶部显示当前菜单分组、菜单标题和 active menu id。
- 内容主体只通过 `SystemPageHost` 渲染现有真实系统页面，不在 V3 壳内复制业务页面逻辑。
- 有 inspector 节点时右侧显示独立详情面板，视觉规则与主内容卡片一致。

## 菜单范围

Workbench V3 当前只承载已经登记在 `systemRealPageRegistry` 的真实系统页面。当前分组固定为：

- 组织权限：用户管理、角色权限、菜单权限、部门组织、岗位管理、租户管理、数据权限、交接管理。
- 基础资料：资产分类、位置管理、供应商管理、自定义字段、字段集管理。
- 流程平台：SLA 策略、表单中心、表单设计器。

新增菜单前必须先确认对应 `menuId` 已被 `isSystemRealPageMenuId` 识别，避免 V3 壳进入空页面。

## 禁止项

- 不复用或嵌套旧 `WorkspacePreviewPage`。
- 不把 V3 的菜单切换跳回 `/fixed-assets/workbench`。
- 不复制 Vector Engine 的 Logo、业务菜单、外部图片、外部噪声纹理或运行时配置。
- 不做全局 Semi UI 或 `body` 主题覆盖，V3 风格必须局部封装在 V3 页面内。
- 不在本阶段加入 `/fixed-assets/workbenchv3` 权限规则。
- 不为视觉效果引入新依赖。

## 合同测试基线

V3 风格和架构由 `frontend/src/__tests__/workbenchPlatformEntry.contract.test.ts` 锁定：

- `adds Workbench V3 as an independent protected system management shell` 确认 V3 独立路由、复用 `SystemPageHost`、不引用旧 `WorkspacePreviewPage`、不新增权限规则。
- `locks Workbench V3 to the approved Vector Engine inspired collapsible shell architecture` 确认折叠状态、折叠按钮、224px/72px grid、玻璃 blur、20px 圆角和蓝色渐变菜单。

后续改 V3 壳时，应先更新或补充这些合同测试，再改页面实现。
