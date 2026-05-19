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
