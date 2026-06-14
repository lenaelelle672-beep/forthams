# 浏览器冒烟测试报告

## 目标

代码查缺补漏后，进入真实浏览器验证阶段，确认核心页面不会白屏、不会出现浏览器运行时错误，并且关键入口可点击、可输入、可打开。

## 测试文件

- `frontend/src/e2e/browser-regression-smoke.spec.ts`
- `frontend/src/e2e/core-routes-smoke.spec.ts`

## 执行命令

```bash
cd frontend
npx playwright test --project=browser-regression-smoke
```

## 执行结果

```text
26 tests in 2 files
```

当前清单由 `npx playwright test --project=browser-regression-smoke --list` 确认；最近桌面浏览器回归通过结果记录在 `docs/testing/test-coverage-summary.md`。

## 覆盖项

| 测试项 | 覆盖内容 | 结果 |
|---|---|---:|
| 登录页冒烟 | 登录页渲染、输入用户名/密码、调用登录接口、跳转仪表板 | 通过 |
| 未登录保护 | 未登录访问受保护页面会重定向到 `/login` | 通过 |
| 退出登录 | 点击退出后清理本地会话并回到登录页 | 通过 |
| 核心页面渲染 | `/`、`/assets`、`/equipment`、`/depreciation`、`/inventory`、`/idle`、`/disposals`、`/approvals`、`/workflows`、`/analytics`、`/audit`、`/settings` | 通过 |
| 运行时错误 | 监听 `console.error` 与 `pageerror`，核心页面加载后不允许红色错误 | 通过 |
| 搜索框交互 | 资产台账搜索框输入并保持值 | 通过 |
| 按钮交互 | 新增资产、创建盘点任务、流程管理/流程设计器入口 | 通过 |
| API 可控性 | 使用 Playwright route mock `/api/**`，隔离本地 MySQL 是否启动对前端冒烟的影响 | 通过 |
| 工作流新建保存 | `/workflows` 新建模板流程会保存草稿并进入设计器 | 通过 |
| 工作流保存失败提示 | `/workflows` 草稿后端保存失败时只提示“本地草稿未同步”，不误报后端保存成功 | 通过 |
| 工作流只读权限 | `/workflows` 仅查询权限账号禁用新建/发布/设计器写入口；`/workflow-designer` 直达时保持只读且不保存 | 通过 |
| 空态/拒绝态 | `/approvals`、`/reports` 的空态和 403 权限拒绝态可解释且不崩溃 | 通过 |
| 审批详情权限 | `/approvals/:id` 只有当前节点审批人可见审批操作 | 通过 |
| 大屏降级 | `/bigscreen-3d` 在无 WebGL 时展示安全降级且不加载 3D chunk | 通过 |

## 本轮发现并处理的问题

| 问题 | 处理 |
|---|---|
| Dashboard 标题预期写成“资产管理驾驶舱”，真实页面为“仪表板” | 已修正测试定位 |
| 流程设计器文本出现多个匹配导致 strict mode 失败 | 已改为定位“审批流程可视化设计器” |
| `/maintenance/upcoming` mock 被通用 `/maintenance` 分支截获，触发页面运行时错误 | 已调整 mock 顺序，确保 upcoming 返回数组 |
| 退出后 URL 已到 `/login` 但旧布局仍渲染 | `logout()` 直接 `window.location.replace` 抢在 React auth state 重渲染前改变地址 | 移除直接跳转，改为清理 auth state 后由 `ProtectedRoute` 执行 `<Navigate to="/login">` |
| `core-routes-smoke` 未被桌面回归项目收集 | 已加入 `browser-regression-smoke` 的 `testMatch` |
| `core-routes-smoke` mock 误拦截 Vite 动态模块请求 | 非 `/api/` 请求直接 `route.continue()` |
| `/analytics` 显示 i18n 裸 key | 已补 `analytics` 中英文 namespace 并注册到 i18n |
| 折旧与审计主路径缺少桌面 smoke | 已新增 `/depreciation`、`/audit` 的路由断言与 API mock |

## 结论

当前前端在浏览器层面的核心冒烟、认证闭环和受保护路由测试均通过。下一步若要继续提升直观验证质量，应继续扩展真实后端业务闭环 E2E：创建资产、创建盘点、提交审批、审批通过。
