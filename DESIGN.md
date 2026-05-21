# forthAMS Frontend Design System

本规范基于 forthAMS 现有前端视觉语言整理，适用于 `frontend/src/app/**` 下的 React + Tailwind 页面、组件和业务流程。目标是保持企业资产管理系统的专业、清晰、可信，同时允许登录页、关键引导页和运营看板具备更高级的品牌表达。

## Design Positioning

forthAMS 是企业资产管理系统，不是营销型 SaaS 官网。默认界面应服务于高频后台操作、数据录入、审批判断和资产状态追踪。

- Narrative role: 业务页面以效率和可读性为主，登录页和空状态页承担品牌入口与信任建立。
- Viewing distance: 主要面向 13-27 英寸桌面办公屏，同时保证平板和移动端可登录、可查看关键状态。
- Visual temperature: 冷静、可靠、企业化；避免娱乐化、过度炫技和高饱和渐变。
- Capacity check: 每屏优先呈现任务状态、关键数据和下一步动作，不为填满页面添加假数据或装饰内容。

## Core Principles

- 信息优先：标题、状态、数据、动作按钮的层级必须一眼可辨。
- 企业可信：蓝白灰为基础，使用稳定圆角、轻边框和克制阴影。
- 操作明确：主操作使用蓝色，次操作使用白底边框或 ghost，危险操作只用红色。
- 真实内容：禁止伪造统计、客户评价、Logo 墙或不存在的数据。
- 统一密度：后台页面保持紧凑但不拥挤，卡片内边距和表格行高必须稳定。
- 适度高级：品牌入口可使用玻璃态、动态低饱和背景和柔和扫光，业务页面不滥用动效。

## Color System

基础色来自现有代码中的 `gray-*`、`blue-*`、主题变量和登录页新增品牌背景。

| Role | Token / Class | Usage |
|---|---|---|
| App background | `bg-gray-50`, `#f5f7fa`, `#f3f7fb` | 后台主画布、登录页底色 |
| Surface | `bg-white`, `bg-card`, `bg-white/90` | 页面卡片、顶栏、弹层、登录卡片 |
| Primary action | `bg-blue-600`, `text-blue-600` | 主按钮、Logo 底、当前导航、关键图标 |
| Primary hover | `hover:bg-blue-700`, `hover:text-blue-700` | 主操作 hover |
| Primary soft | `bg-blue-50`, `border-blue-100`, `text-blue-700` | 导航激活、徽标、提示块、轻强调 |
| Text strong | `text-gray-900`, `text-gray-950` | 页面标题、关键数值、主要字段 |
| Text body | `text-gray-600`, `text-muted-foreground` | 描述、说明、表格辅助信息 |
| Text subtle | `text-gray-500`, `text-gray-400` | 占位、时间、图标弱化 |
| Border | `border-gray-200`, `border-border`, `rgba(0,0,0,0.1)` | 卡片、分割线、输入框 |
| Danger | `text-red-600`, `bg-red-50`, `border-red-200`, `--destructive` | 错误、删除、失败状态 |
| Success | `text-green-600`, `bg-green-50` | 成功反馈 |
| Warning | `text-yellow-700`, `bg-yellow-50` | 待处理、警告 |

Usage rules:

- 蓝色只承担品牌、导航激活和主动作，不要把普通卡片标题全部染蓝。
- 页面背景使用浅灰，卡片使用白色；不要用纯白铺满所有区域导致层级消失。
- 状态色必须有语义：红=错误/危险，绿=完成/成功，黄=警告/待处理，蓝=信息/进行中。
- 登录页可使用 `rgba(37,99,235,0.18)`、`rgba(56,189,248,0.2)` 等低透明蓝色光晕；业务页面只在关键空状态或欢迎区少量使用。

## Typography

现有字体栈定义在 `frontend/src/styles/fonts.css` 和 `theme.css`。

```css
--font-family-sans: "Inter", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", "Helvetica Neue", Arial, sans-serif;
--font-family-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
```

Type scale:

| Element | Class | Usage |
|---|---|---|
| Page title | `text-2xl font-semibold text-gray-900` | 常规页面主标题，如仪表板 |
| Brand hero title | `text-5xl font-semibold tracking-[-0.05em]` | 登录页、大型入口页，仅桌面使用 |
| Card title | `text-lg font-semibold text-gray-900` | 图表卡片、列表区块标题 |
| Metric value | `text-3xl font-semibold text-gray-900` | 统计卡片数值 |
| Body | `text-sm` / `text-base` + `text-gray-600` | 描述、字段、说明 |
| Caption | `text-xs text-gray-500` | 时间、辅助说明、标签描述 |
| Code/account | `font-mono text-sm font-semibold` | 测试账号、ID、编号 |

Rules:

- 中文页面标题使用 `font-semibold`，避免过重字重导致办公系统笨重。
- 正文优先 `text-sm` 和 `text-base`，行高保持 `leading-6` 或 `leading-7`。
- 大型品牌标题允许负字距，但只用于登录页、欢迎页、演示页。
- 表格、图表和卡片内不得混用超过 3 个字号层级。

## Layout

Application shell:

- 顶栏高度固定为 `h-16`，白底、底部 `border-gray-200`。
- 左侧导航宽度固定为 `w-64`，白底、右侧 `border-gray-200`。
- 主内容区使用 `ml-64 mt-16 p-6`，页面内部使用 `space-y-6`。
- 页面画布默认为 `bg-gray-50`，卡片之间使用 `gap-6`。

Page layout patterns:

| Pattern | Class baseline | Usage |
|---|---|---|
| Page stack | `space-y-6` | 常规业务页 |
| KPI grid | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6` | 仪表板统计卡 |
| Two-column analytics | `grid grid-cols-1 lg:grid-cols-2 gap-6` | 图表、待办、动态 |
| Card | `bg-white rounded-lg border border-gray-200 p-6` | 默认内容容器 |
| Compact item | `p-4 bg-gray-50 rounded-lg` | 待审批项、列表内卡片 |
| Login shell | `max-w-7xl`, desktop two-column, mobile single-column | 登录页品牌入口 |

Spacing rules:

- 页面外边距以 `p-6` 为默认。
- 卡片内边距以 `p-6` 为默认，紧凑列表项使用 `p-4`。
- 组件内部间距优先使用 `gap-2`、`gap-3`、`gap-4`。
- 区块之间使用 `gap-6` 或 `space-y-6`，避免临时 `mt-*` 叠加过多。

## Radius And Elevation

Default radius:

- App cards: `rounded-lg`。
- UI primitives: `rounded-md` 或 `rounded-lg`，遵循现有 shadcn 风格。
- Brand/login cards: `rounded-2xl` 到 `rounded-[2rem]`。
- Pills/badges: `rounded-full`。

Elevation:

- 后台业务卡片默认无大阴影，只用边框分层。
- 登录页、浮层和品牌容器可使用 `shadow-xl`、`shadow-2xl`，颜色建议 `shadow-blue-950/10`。
- hover 阴影必须轻：如 `hover:shadow-lg hover:shadow-blue-950/5`。
- 不要在每个普通卡片上叠加大阴影，避免界面变成营销模板。

## Components

### Navigation

- Logo 使用蓝色方形或圆角矩形底：`bg-blue-600 rounded-lg`。
- 当前导航项使用 `bg-blue-50 text-blue-700`。
- 非当前导航项使用 `text-gray-700 hover:bg-gray-50`。
- 导航 icon 使用 `w-5 h-5`，保持与文字 12px gap。

### Buttons

- Primary: `bg-blue-600 text-white hover:bg-blue-700`。
- Secondary: `bg-white border border-gray-300 text-gray-700 hover:bg-gray-50`。
- Ghost: `variant="ghost"` 或 `hover:bg-gray-50`。
- Danger: 使用 destructive token 或红色语义类，不和蓝色混用。
- Disabled: 保持 `disabled:opacity-50/60`，不要只改变 cursor。

### Inputs

- 默认高度 `h-9`，登录页和关键表单可使用 `h-12`。
- 边框 `border-gray-200` 或 `border-gray-300`，focus 使用 `ring-blue-500`。
- 输入框 icon 使用 `text-gray-400`，左内边距与 icon 对齐。
- 错误状态使用红色边框和浅红背景提示，不只靠文字颜色。

### Cards

- 默认卡片：`bg-white rounded-lg border border-gray-200 p-6`。
- 卡片标题：`text-lg font-semibold text-gray-900 mb-4`。
- 统计卡右侧 icon 容器：`w-12 h-12 bg-blue-50 rounded-lg text-blue-600`。
- 空状态使用虚线边框：`border-dashed border-gray-200 text-gray-500`。

### Badges And Status

- 信息：`bg-blue-100 text-blue-800`。
- 待处理/危险计数：`bg-red-100 text-red-800`，只用于需要强提醒的数量。
- 成功：`bg-green-100 text-green-800`。
- 警告：`bg-yellow-100 text-yellow-800`。
- Badge 文案必须短，不超过 6 个汉字为宜。

### Charts

- 图表文字必须使用中文字体 fallback，参考 `CHINESE_FONT_FAMILY`。
- 图表色优先使用 `--color-chart-1` 到 `--color-chart-5`。
- 网格线使用 `var(--color-border)`，不要高对比黑线。
- 空数据必须显示真实空状态，不填充假图表。

## Login And Brand Entry

登录页是 forthAMS 当前最高级的品牌表达基准。

- 允许使用低饱和蓝灰动态背景、柔和光晕、移动网格和玻璃态卡片。
- 动效必须慢，主要周期建议 12-30 秒，避免干扰登录输入。
- 必须支持 `prefers-reduced-motion: reduce`。
- 登录卡片保持白色半透明、强可读性和明确 focus 状态。
- 测试账号只作为开发/测试环境提示；若用于生产构建，应通过环境开关隐藏。

Recommended login visual tokens:

| Role | Value |
|---|---|
| Background base | `#f3f7fb` |
| Brand blue | `#2563eb` / Tailwind `blue-600` |
| Soft cyan | `rgba(56, 189, 248, 0.2)` |
| Glass card | `bg-white/90 border-white/80 backdrop-blur-xl` |
| Brand shadow | `shadow-blue-950/10` |

## Motion

Default motion:

- Micro interactions: `transition-all duration-200/300`。
- Hover lift only for brand cards or action cards: `hover:-translate-y-0.5`。
- Business table rows should prefer color feedback over movement。
- Loading indicator can use subtle pulse；不要使用大面积旋转或跳动动画。

Motion rules:

- 登录页背景可动态，业务页面背景默认静态。
- 动效必须不阻塞输入、不改变布局、不造成 CLS。
- 所有持续动画必须提供 `prefers-reduced-motion` fallback。

## Responsive Rules

- 桌面后台以固定左侧导航为主。
- `lg` 以下页面应避免强依赖两栏布局；登录页左侧品牌面板隐藏，保留紧凑品牌头。
- KPI 卡片使用 `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`。
- 图表区使用 `grid-cols-1 lg:grid-cols-2`。
- 可点击区域不小于 44px，高频按钮建议 `h-9` 到 `h-10`，登录主按钮可 `h-12`。

## Accessibility

- 表单必须使用 `Label htmlFor` 绑定输入框。
- 错误提示使用 `role="alert"`。
- 图标不能单独表达关键语义，必须有文字说明。
- Focus ring 必须保留，主色使用 `focus-visible:ring-blue-500/20` 或项目 token。
- 颜色不能作为唯一状态表达，状态必须配合文字。
- 动态背景应设置 `aria-hidden="true"`。

## Content Voice

- 语气：专业、明确、克制。
- 按钮文案使用动词加目标，如“登录并进入仪表板”、“批准”、“驳回”。
- 空状态说明真实原因，不用营销口号。
- 错误文案给出下一步，如“请输入用户名和密码”。
- 避免“极致、革命性、全新升级”等营销词。

## Anti-Patterns

- 禁止紫粉蓝高饱和 AI 渐变，除非明确做活动页。
- 禁止把 emoji 当 icon 使用。
- 禁止伪造统计数量、测试客户、Logo 墙。
- 禁止普通后台卡片大量使用玻璃态和大阴影。
- 禁止页面内同时出现多个主按钮争抢注意力。
- 禁止在业务页面引入与现有蓝白灰体系无关的新主色。
- 禁止为了“高级”牺牲表格密度、可读性和操作路径。

## Implementation Checklist

- 使用现有 Tailwind、shadcn UI primitives 和 lucide-react icon。
- 新页面先确认是否属于业务页、品牌入口页、数据看板或表单页，再选择对应布局密度。
- 页面背景默认 `bg-gray-50`，卡片默认白底灰边。
- 主动作使用蓝色，危险动作使用红色，状态色保持语义一致。
- 新增动效必须包含 reduced-motion 降级。
- 所有新增页面在桌面和移动宽度下检查溢出。
- 不引入外部设计模板覆盖当前系统；本规范优先级高于通用设计灵感。

## Reference Files

- `frontend/src/styles/theme.css`: 全局主题 token、radius、chart 色、字体基础。
- `frontend/src/styles/fonts.css`: 中文字体 fallback。
- `frontend/src/app/layouts/SidebarLayout.tsx`: 顶栏、侧边栏、导航激活态。
- `frontend/src/app/pages/Dashboard.tsx`: 卡片、图表、KPI、待办密度。
- `frontend/src/app/pages/Login.tsx`: 品牌入口、动态背景、登录卡片规范。
- `frontend/src/app/components/ui/*`: shadcn 风格基础组件。

---

## Interaction Patterns

> 以下章节基于对标参考系统（企业设备管理 SaaS 截图）的 GLM-4V 视觉识别分析，结合 forthAMS 技术栈（`react-resizable-panels` / TanStack Table / shadcn/ui / Recharts）提炼的企业后台核心交互规范。所有尺寸单位为像素，Tailwind class 以 v4 语法为准。

### Three-Panel Layout

参考截图中的"图标导航 + 文字菜单 + 主内容"模式，forthAMS 在资产列表、工单列表、盘点等高密度页面可扩展为**三栏布局**：

```
┌──────┬──────────────────────┬─────────────────────────────────────┐
│ 图标  │   分类 / 二级导航      │   主内容区（数据表格 / 详情）          │
│  栏  │                      │                                     │
│ 48px │  220px（可拖拽）       │   flex-1（剩余宽度）                  │
└──────┴──────────────────────┴─────────────────────────────────────┘
```

实现规范：

- 使用 `react-resizable-panels`（已安装 v2.1.7），`<PanelGroup direction="horizontal">` 嵌套三个 `<Panel>`。
- **图标栏**（Panel 1）：固定宽度 `48px`，`collapsible={false}`，不可拖拽。背景 `bg-gray-900`，图标 `text-gray-400 hover:text-white`，当前模块图标 `text-white`。
- **分类面板**（Panel 2）：默认宽度 `220px`，`minSize={160}` `maxSize={320}`，`defaultSize={220}`。背景 `bg-white border-r border-gray-200`。可通过双击分隔线或折叠按钮收起至 `0px`（`collapsible={true}`）。
- **主内容区**（Panel 3）：`flex-1`，内部包含工具栏 + 数据表格。
- 分隔线（`<PanelResizeHandle>`）样式：`w-1 bg-gray-100 hover:bg-blue-300 transition-colors cursor-col-resize`。
- 分类面板折叠状态用 `localStorage` 持久化，key 格式：`panel-{pageKey}-category-collapsed`。
- 响应式：`lg` 以下（< 1024px）分类面板默认折叠，通过顶部"分类"按钮展开为 Drawer 覆盖层。

分类面板内部结构：

```tsx
// CategoryPanel — 资产分类树示例
<div className="flex flex-col h-full">
  <div className="px-3 py-2 border-b border-gray-100">
    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">资产分类</span>
  </div>
  <div className="flex-1 overflow-y-auto py-1">
    <CategoryTreeItem /> {/* 递归，参考 LocationTree.tsx 结构 */}
  </div>
</div>
```

分类树节点状态：

| 状态 | 样式 |
|------|------|
| 默认 | `text-gray-700 hover:bg-gray-50` |
| 选中 | `bg-blue-50 text-blue-700 font-medium` |
| 展开 | `ChevronDown w-3.5 h-3.5 text-gray-400` |
| 折叠 | `ChevronRight w-3.5 h-3.5 text-gray-400` |
| 叶节点 | 无展开图标，`pl-7`（补偿图标宽度） |

---

### Navigation Groups

侧边栏（Panel 1 + 现有 `SidebarLayout`）支持**分组菜单**，对应截图中的"设备维修"、"保养维护"等分组标签。

分组规范：

- 分组标题：`text-xs font-medium text-gray-400 uppercase tracking-wider px-3 py-2 mt-4 mb-1`。
- 分组内菜单项继承现有导航样式（`text-gray-700 hover:bg-gray-50`）。
- 分组之间用 `border-t border-gray-100 mt-2` 分隔。
- 最多支持 4 个分组，超过时考虑折叠展开。

```tsx
// 分组菜单结构示例
<nav>
  <NavItem icon={LayoutDashboard} label="首页" href="/dashboard" />
  <NavItem icon={CheckSquare} label="待办" href="/todos" badge={3} />

  <NavGroup label="设备管理">
    <NavItem icon={Monitor} label="设备列表" href="/assets" />
    <NavItem icon={PackagePlus} label="设备入库" href="/assets/intake" />
    <NavItem icon={BarChart2} label="分析报表" href="/reports/assets" />
  </NavGroup>

  <NavGroup label="维修管理">
    <NavItem icon={Wrench} label="维修工单" href="/work-orders" />
    <NavItem icon={PauseCircle} label="维修挂起" href="/work-orders/hold" />
    <NavItem icon={ClipboardCheck} label="维修验收" href="/work-orders/accept" />
  </NavGroup>

  <NavGroup label="保养维护">
    <NavItem icon={CalendarCheck} label="保养方案" href="/maintenance/plans" />
    <NavItem icon={ListTodo} label="保养任务" href="/maintenance/tasks" />
  </NavGroup>
</nav>
```

Badge 规范：导航项右侧数量徽标使用 `bg-red-100 text-red-700 text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center`，数量 > 99 显示 `99+`。

---

### Toolbar

业务列表页工具栏固定在主内容区顶部，位于数据表格上方，高度 `h-12`，`bg-white border-b border-gray-200 px-4`。

工具栏按钮分区：

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [切换视图 ▾]  [快速处理 ▾]  [+ 新建]  [编辑 ▾]  [导入/导出 ▾]  [打印 ▾]  │  [搜索框]  [高级搜索]  │
│ ← 左区（操作按钮，gap-2）                                                │  右区（搜索，gap-2） →  │
└─────────────────────────────────────────────────────────────────────────┘
```

各按钮规范：

| 按钮 | 变体 | 图标 | 说明 |
|------|------|------|------|
| 切换视图 | `outline` + `DropdownMenu` | `LayoutList` | 表格 / 卡片 / 甘特，选中项加 `✓` |
| 快速处理 | `outline` + `DropdownMenu` | `Zap` | 批量状态变更、批量分配等 |
| + 新建 | `default`（蓝色主按钮） | `Plus` | 单页跳转或弹层创建 |
| 编辑 ▾ | `outline` + `DropdownMenu` | `Pencil` | 编辑选中项，无选中时 `disabled` |
| 导入/导出 ▾ | `outline` + `DropdownMenu` | `ArrowUpDown` | 导入模板下载、CSV/Excel 导出 |
| 打印 ▾ | `outline` + `DropdownMenu` | `Printer` | 打印预览、列表打印、二维码批打 |

规则：

- 工具栏按钮统一高度 `h-8`，字号 `text-sm`，图标 `w-4 h-4`。
- 主按钮（新建）始终可用，其余批量操作按钮在"零选中"时 `disabled`（`opacity-50 cursor-not-allowed`）。
- 批量选中时工具栏出现"已选 N 条"徽标：`bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded`，并可点击"清除选择"。
- Dropdown 菜单最大宽度 `200px`，使用 shadcn `<DropdownMenu>`，危险操作（删除）用 `text-red-600`。
- 工具栏右侧搜索框宽度 `w-56`，`h-8`，placeholder "搜索..."，`SearchIcon` 居左，`Cmd+K` 快捷键支持。
- 汇总行（如"金额合计: 69,873"）紧贴工具栏下方，`text-sm text-gray-500 px-4 py-1 bg-gray-50 border-b border-gray-100`。

---

### Data Table

forthAMS 数据表格基于 **TanStack Table v8**（`@tanstack/react-table`）实现，样式层使用 Tailwind。高密度场景（资产编码 / 工单 / 盘点）可降级至 `@mui/material DataGrid`。

#### 行与列基准

| 属性 | 默认值 | 说明 |
|------|--------|------|
| 行高 | `h-10`（40px） | 标准密度；紧凑模式 `h-8`（32px） |
| 表头高 | `h-10` | 背景 `bg-gray-50`，字体 `text-xs font-medium text-gray-500 uppercase tracking-wider` |
| 单元格内边距 | `px-4` | 首列（checkbox）`px-3` |
| 边框 | `divide-y divide-gray-200` | 行间分割线，不用外框 |
| hover 行 | `hover:bg-gray-50` | 不用蓝色，避免与选中态混淆 |
| 选中行 | `bg-blue-50` | checkbox 列勾选后整行高亮 |
| 斑马纹 | 不启用 | 依赖 hover + 分割线区分行，不用 `even:bg-gray-50` |

#### Checkbox 列

- 宽度固定 `w-10`（40px），`shrink-0`，不可拖拽。
- 表头 checkbox 为"全选/取消全选"；半选态（部分选中）使用 `indeterminate`。
- 选中后左边显示 `border-l-2 border-blue-500`（4px 蓝色指示条）。

#### 列宽拖拽

- 每列表头右侧有 `resize handle`：`w-1 h-4 bg-gray-300 hover:bg-blue-400 cursor-col-resize rounded-full absolute right-0 top-1/2 -translate-y-1/2`。
- 使用 TanStack Table `columnResizeMode="onChange"`，最小列宽 `60px`，无最大值。
- 列宽变更实时写入 `localStorage`，key：`table-{tableId}-column-widths`，格式 `{columnId: width}`。

#### 列配置面板

通过工具栏右侧"列设置"图标（`SlidersHorizontal`）触发 `Sheet`（右侧抽屉）：

```
列设置
─────────────────────
☑ 状态              （固定，不可隐藏）
☑ 资产编码          （固定，不可隐藏）
☑ 资产名称
☐ 照片
☑ 主资产编码
☑ 主附状态
☑ RFID
☐ 资产类别
☑ 签字状态
─────────────────────
[拖拽调整顺序]  [重置默认]
```

- 列可见性：`boolean`，开关切换，`opacity-50` 表示隐藏列（不删除数据）。
- 列顺序：支持拖拽排序（`react-dnd`，已安装），拖拽手柄 `GripVertical` 图标居左。
- 持久化：`localStorage` key `table-{tableId}-column-config`，存储 `{id, visible, order}[]`。
- "重置默认"清除 localStorage 并刷新列配置。

#### 状态徽标

| 状态值 | 样式 | 语义 |
|--------|------|------|
| `ACTIVE` / 在用 | `bg-green-100 text-green-800` | 正常使用中 |
| `IDLE` / 闲置 | `bg-blue-100 text-blue-700` | 暂未分配 |
| `MAINTENANCE` / 维保中 | `bg-yellow-100 text-yellow-800` | 维修或保养 |
| `RETIRED` / 已退役 | `bg-gray-100 text-gray-600` | 已报废 |
| `LOST` / 丢失 | `bg-red-100 text-red-700` | 异常 |

徽标尺寸：`text-xs px-2 py-0.5 rounded-full font-medium`，宽度由内容决定，不固定。

#### 分页

```
┌──────────────────────────────────────────────────────────────────┐
│ ← 首页  ‹ 上页  [1] [2] [3] ... [20]  › 下页  尾页 →            │  每页 [50 ▾]  共 1,234 条 │
└──────────────────────────────────────────────────────────────────┘
```

- 分页区固定在表格底部，`h-12 px-4 border-t border-gray-200 bg-white flex items-center justify-between`。
- 每页条数选项：`[10, 20, 50, 100]`，默认 `50`，使用 `<Select>`。
- 总条数显示格式：`共 {total.toLocaleString()} 条`。
- 页码展示：当总页 ≤ 7 时全显；超出时两端固定 + 省略号。

#### 空状态

无数据时表格区域显示：

```tsx
<div className="flex flex-col items-center justify-center py-16 text-gray-400">
  <Inbox className="w-12 h-12 mb-3 text-gray-300" />
  <p className="text-sm">暂无数据</p>
  <p className="text-xs mt-1">尝试调整筛选条件或新建记录</p>
</div>
```

---

### Filter System

筛选系统分为**基础搜索**、**快速筛选标签**和**高级搜索面板**三层，支持保存视图和 URL 状态同步。

#### 基础搜索

- 位置：工具栏右区，`w-56 h-8`，回车或 300ms debounce 触发查询。
- 清空：输入框右侧 `×` 图标，点击清空并触发查询。
- 快捷键：`Cmd+K`（Mac）/ `Ctrl+K`（Win）聚焦搜索框。

#### 快速筛选标签

紧贴工具栏下方，横向滚动标签栏，高度 `h-9 px-4 border-b border-gray-100 bg-white flex items-center gap-2 overflow-x-auto`：

```
[全部] [在用 ✓] [闲置] [维保中] [本部门] [本月入库] [+ 更多筛选]
```

- 选中标签：`bg-blue-50 text-blue-700 border border-blue-200`。
- 未选中：`bg-gray-100 text-gray-600 hover:bg-gray-200`。
- 多选标签时，标签之间关系为 AND（取交集）。
- `+ 更多筛选` 按钮触发高级搜索面板（Drawer）。

#### 高级搜索面板

通过"高级搜索"链接或 `+ 更多筛选` 触发右侧 `Sheet`（`side="right" size="md"`，宽 `400px`）：

```
高级搜索                                           ✕
────────────────────────────────────────────────
资产状态        [在用 ▾] [闲置 ▾]（多选 Combobox）
所属部门        [下拉选择部门]
资产类别        [分类树选择器]
入库日期        [开始日期] 至 [结束日期]（DateRangePicker）
价值范围        [¥ 最小值] 至 [¥ 最大值]
负责人          [人员选择器]
RFID 编号       [输入框，精确匹配]
────────────────────────────────────────────────
                         [重置]  [查询]
```

- 每个筛选条件占一行，label 宽 `80px`（`text-sm text-gray-600`），控件 `flex-1`。
- "查询"触发请求，参数序列化到 URL（`?status=ACTIVE&departmentId=3&...`），支持分享链接。
- "重置"清除所有条件，URL 清空，触发无条件查询。
- 活跃筛选数量在"高级搜索"按钮旁显示徽标：`bg-blue-600 text-white text-xs rounded-full w-4 h-4`。

#### 保存视图

用户可将当前筛选条件 + 列配置保存为命名视图：

- 入口：工具栏"切换视图"下拉底部"保存当前视图..."。
- 视图数据结构：
  ```ts
  interface SavedView {
    id: string;
    name: string;          // 用户自定义名称
    filters: FilterState;  // 筛选条件
    columns: ColumnConfig[]; // 列可见性 + 顺序
    sortBy?: { column: string; direction: 'asc' | 'desc' };
    createdAt: string;
  }
  ```
- 持久化：`localStorage` key `table-{tableId}-saved-views`，存储 `SavedView[]`。
- 视图列表展示在"切换视图"下拉顶部，最多 10 个；超出提示"已达上限，请删除旧视图"。
- 视图可重命名和删除，不可覆盖系统内置视图（如"全部"、"本部门"）。

#### URL 状态同步

- 筛选参数、页码、排序字段均映射到 URL query string。
- 使用 `useSearchParams`（React Router v6），避免 `history.pushState` 手动操作。
- 参数命名规范：`page`、`pageSize`、`sortBy`、`sortDir`、`keyword`，业务参数使用驼峰：`categoryId`、`departmentId`、`status`。
- 页面加载时从 URL 读取初始参数，保证刷新后状态恢复。

---

### Dashboard Layout

仪表板页面（`Dashboard.tsx`）采用**可配置卡片网格**布局，用户可调整卡片可见性和排列顺序。

#### 固定区 vs 可配置区

- **固定区（顶部 KPI 卡片）**：4 列统计卡，不可移动，只可选择显示/隐藏。布局使用 `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6`。
- **可配置区（图表 / 列表卡片）**：基于 `react-grid-layout`（若引入）或简单 `grid-cols-1 lg:grid-cols-2` 两列，卡片可拖拽换位。

#### KPI 卡片规范

```
┌─────────────────────────────┐
│  图标容器（右上角）           │
│  w-12 h-12 bg-blue-50        │
│  rounded-lg text-blue-600    │
│                              │
│  标题: text-sm text-gray-500 │
│  数值: text-3xl font-bold    │
│  同比: text-xs text-green-600│
│        ↑ 12.5%               │
└─────────────────────────────┘
```

- 卡片背景 `bg-white rounded-lg border border-gray-200 p-6`。
- 图标容器颜色按语义区分：资产总量=蓝、活跃=绿、待处理=黄、告警=红。
- 同比变化：上涨 `text-green-600`（`TrendingUp`）、下跌 `text-red-500`（`TrendingDown`）、持平 `text-gray-400`（`Minus`）。
- KPI 数值超过 6 位使用 `toLocaleString()` 格式化，超过 100 万显示为 `1.2M`。

#### 图表卡片规范

- 卡片标题区：`flex items-center justify-between mb-4`，右侧放时间范围切换（`本周 / 本月 / 本季`）。
- 图表区高度 `h-64`（256px），使用 Recharts，空数据时显示 `text-gray-400 text-sm` 空状态提示。
- 图表 tooltip 背景 `bg-white border border-gray-200 shadow-md rounded-md p-2 text-sm`。
- 图例字体继承 `CHINESE_FONT_FAMILY`（已定义于 `theme.css`）。

#### 待办 / 动态卡片

- 紧凑列表项高度 `h-12`（`px-4 py-3`），分割线 `divide-y divide-gray-100`。
- 待处理项右侧显示时间 `text-xs text-gray-400`，紧急项 `text-red-500`。
- "查看全部"链接：`text-sm text-blue-600 hover:underline`，固定在卡片底部。

#### 仪表板配置面板

通过右上角"自定义"按钮（`LayoutDashboard` 图标）触发 `Sheet`（右侧抽屉）：

```
仪表板配置                                          ✕
──────────────────────────────────────────────────
KPI 卡片
  ☑ 资产总量          ☑ 在用资产
  ☑ 维保中            ☑ 本月新增

图表模块
  ☑ 资产类别分布（饼图）
  ☑ 月度入库趋势（折线图）
  ☐ 部门资产占比（柱状图）
  ☐ 折旧金额走势（面积图）

列表模块
  ☑ 待审批工单         ☑ 最近操作记录
  ☐ 即将到期保养       ☑ 资产告警
──────────────────────────────────────────────────
                              [重置默认]  [保存]
```

- 配置持久化：`localStorage` key `dashboard-config`，格式 `{kpi: string[], charts: string[], lists: string[]}`。
- "重置默认"恢复初始配置，不清除其他页面的配置。

---

### Theme Configuration

forthAMS 的主题配置向用户暴露有限的 token，通过**配置面板**实现运行时切换，不依赖构建工具重新编译。

#### 可配置 Token 范围

| Token 分类 | 可配置项 | 实现方式 |
|-----------|---------|---------|
| 主色调 | Primary（蓝）、Accent（可选橙/绿/紫） | CSS 变量 `--color-primary` 覆盖 |
| 圆角 | Sharp（0px）/ Default（6-8px）/ Rounded（12px） | CSS 变量 `--radius` |
| 密度 | Comfortable（40px行高）/ Compact（32px）/ Spacious（48px） | 全局 class `data-density="compact"` |
| 配色方案 | Light（默认）/ Dark（预留，不强制实现） | `<html class="dark">` |
| 字体大小 | 小（13px）/ 默认（14px）/ 大（16px） | CSS 变量 `--font-size-base` |

#### 主题配置面板入口

- 位置：顶栏右侧"设置"图标（`Settings2`），或路径 `/settings/appearance`。
- 面板形式：独立页面（`AppearancePage.tsx`），不用 Drawer（参数较多）。

#### 实时预览

- 更改任意 token 后立即更新 CSS 变量，无需刷新。
- 实现：`document.documentElement.style.setProperty('--color-primary', value)`。
- 预设方案：
  - **企业标准**（默认）：`blue-600` 主色，`rounded-lg`，Comfortable 密度。
  - **极简**：`gray-900` 主色，Sharp 圆角，Compact 密度。
  - **轻松**：`teal-600` 主色，Rounded 圆角，Spacious 密度。

#### 持久化

- 保存时写入 `localStorage` key `theme-config`，格式：
  ```ts
  interface ThemeConfig {
    primaryColor: string;   // CSS 颜色值
    radius: 'sharp' | 'default' | 'rounded';
    density: 'compact' | 'comfortable' | 'spacious';
    fontSize: 'sm' | 'md' | 'lg';
    preset?: string;        // 预设名称
  }
  ```
- 应用启动时（`main.tsx`）读取并应用 `theme-config`，在 `<html>` 元素上设置 CSS 变量。

---

## Updated Reference Files

新增交互规范相关参考文件（待创建）：

- `frontend/src/app/layouts/ThreePanelLayout.tsx`: 三栏可拖拽布局 shell。
- `frontend/src/app/components/CategoryPanel.tsx`: 分类树侧边栏面板。
- `frontend/src/app/components/DataTable/`: TanStack Table 封装，含列配置、分页、选择。
- `frontend/src/app/components/FilterSheet.tsx`: 高级搜索 Sheet 面板。
- `frontend/src/app/components/ToolBar.tsx`: 业务列表页工具栏。
- `frontend/src/app/pages/settings/AppearancePage.tsx`: 主题配置页面。
- `frontend/src/hooks/useTableConfig.ts`: 列配置 + 列宽持久化 hook。
- `frontend/src/hooks/useFilterState.ts`: 筛选状态 + URL 同步 hook。
- `frontend/src/hooks/useTheme.ts`: 主题 token 读写 hook。
