# 迭代14 边界推演文档

## 场景 1：Cmd+K 全局搜索组件 — 极限场景推演

### 1.1 大量路由条目
- **场景**：路由从当前的 25+ 条目增长到 100+
- **风险**：CommandList 滚动性能下降，搜索结果分组过多导致视觉过载
- **缓解措施**：
  - cmdk 内置虚拟列表，100 条目仍在合理范围
  - 搜索过滤（输入文字后）自动缩小结果集
  - 分组折叠 — 当前 7 个分组，视觉可管理
- **上限**：超过 200 条目应考虑分组懒加载或虚拟滚动

### 1.2 无匹配搜索
- **场景**：用户输入不存在的页面名（如「xyzzy」）
- **行为**：cmdk 内置 `CommandEmpty` 组件显示「未找到匹配的页面」
- **验证**：搜索过滤由 cmdk 内部处理，按 `value` 属性匹配。需要确保每个 `CommandItem` 的 `value` 设为目标项的唯一标识

### 1.3 键盘导航冲突
- **场景**：Cmd+K 快捷键与其他浏览器插件或系统快捷键冲突
- **风险点**：
  - Chrome DevTools 在 macOS 上默认 Cmd+K 为「清空控制台」
  - 页面内其他组件注册了 Cmd+K 事件
- **缓解措施**：
  - `e.preventDefault()` 已调用，阻止浏览器默认行为
  - 键盘事件绑定在 `document` 级别，优先级高于组件级
  - `useEffect` cleanup 函数移除事件监听器，避免内存泄漏

### 1.4 跨模块权限
- **场景**：当前阶段搜索组件展示所有页面路由，后续加入角色权限后需要过滤
- **影响**：SEARCHABLE_PAGES 是静态数组，无法感知用户角色
- **建议**：后续阶段将 SEARCHABLE_PAGES 改为动态生成（根据用户权限过滤），或统一从 NAV_GROUPS 提取

---

## 场景 2：报表中心 — 极限场景推演

### 2.1 空数据态
- **场景**：系统中无资产数据（初始化状态）
- **表现**：
  - 资产汇总卡片显示全部为 0（通过 `summary.totalAssets.toLocaleString()` 显示 "0"）
  - 分类统计饼图显示「暂无分类数据」EmptyState
  - 部门分布显示「暂无部门数据」EmptyState
  - 趋势图显示「暂无趋势数据」EmptyState
  - 折旧报表显示"资产总数 0"，"在用资产 0"
- **风险**：空数据态 UI 不应破裂或报错，所有布局应保持完整

### 2.2 后端超时
- **场景**：4 个并行 API 查询中 1-2 个超时（getDeptDistribution, getAssetValueTrends）
- **行为**：React Query 的 `retry: false` 未配置，使用默认 3 次重试。每个重试间隔递增
- **影响**：部分卡片显示 EmptyState，不影响其他卡片渲染
- **用户感知**：非阻塞，用户可看到已加载的卡片内容
- **优化建议**：可设置 `staleTime: 5*60*1000` 减少不必要刷新

### 2.3 图表 Render 失败
- **场景**：Recharts 在特殊数据组合下渲染失败（如所有值为 0、NaN）
- **预防**：
  - 所有图表组件使用 `data.length > 0` 守卫条件
  - PieChart 内层 `innerRadius={35}` 和 `outerRadius={55}` 在数据点为 0 时不渲染异常
  - 空数据和 0 值展示 EmptyState 而非零值图表
- **回退**：如果图表组件 throw，React Error Boundary 可捕获，现阶段精简组件无 Error Boundary

### 2.4 并发导出
- **场景**：用户快速连续点击多个卡片的「导出」
- **行为**：`exportingId` 状态变量控制每个卡片的导出状态，支持并发导出（`setExportingId` 独立管理）
- **限制**：当前导出是模拟延迟（800ms），实际导出需后端实现并发控制
- **风险**：内存泄漏 — 组件卸载后 `setTimeout` 仍执行。已使用 `async/await`，组件卸载后状态更新会被 React 忽略（仅在 dev 模式下 warning）

### 2.5 Viewport 响应式
- **场景**：在平板（iPad 11"）和手机（iPhone 14）上查看
- **布局策略**：
  - `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` — 手机 1 列，平板 2 列，桌面 3 列
  - 迷你图表区域 `h-40` 在手机上自动缩小
  - 卡片 `flex flex-col` 确保卡片内容不溢出
  - KPI 摘要使用 `grid-cols-2` 在手机上自动折行

---

## 场景 3：路由与导航边界

### 3.1 非法路由
- **场景**：用户手动输入 `/reports/nonexistent` 或 `/reports/123`
- **行为**：路由精确匹配 `/reports` 不存在则 fallthrough 到 `path: '*'` → 重定向到 `/404`
- **风险**：`/reports` 路径无子路由配置，所有子路径都会 404
- **建议**：如果后续需要子路由（如 `/reports/preview/1`），需在路由配置中添加

### 3.2 重复点击
- **场景**：用户已在报表中心页面，侧边栏再次点击「报表中心」
- **行为**：react-router 检测到路径未变化，不触发页面重渲染
- **影响**：无影响，React Query 的 staleTime 避免不必要的 API 重新请求

### 3.3 侧边栏折叠状态搜索
- **场景**：侧边栏折叠（collapse = true）后通过 Cmd+K 搜索跳转到新页面
- **行为**：跳转后侧边栏保持折叠状态，内容区正常渲染新页面
- **验证**：`collapsed` 状态是 AppLayout 的本地 state，路由跳转不影响其值

### 3.4 搜索后导航的边界
- **场景**：Cmd+K 搜索「审计日志」 → 跳转到 `/audit` → 按 Esc 键
- **风险**：Esc 键在跳转后由 CommandDialog 监听器响应，但 GlobalSearch 组件已关闭（`handleSelect` 调用了 `setOpen(false)`），此时 Esc 键不应触发任何操作
- **验证**：`useEffect` 的 cleanup 已移除键盘事件监听

### 3.5 路由懒加载 Loading
- **场景**：首次访问 `/reports`，ReportPage 尚未加载
- **行为**：`React.lazy` + `<Suspense>` 显示旋转加载动画（PageLoader）
- **回退**：如果 ReportPage chunk 加载失败（网络断开），React Suspense 无内置错误回退。建议后续增加 Error Boundary
