# 浏览器冒烟测试报告

## 目标

代码查缺补漏后，进入真实浏览器验证阶段，确认核心页面不会白屏、不会出现浏览器运行时错误，并且关键入口可点击、可输入、可打开。

## 测试文件

- `frontend/src/e2e/browser-smoke.spec.ts`
- `frontend/src/e2e/core-routes-smoke.spec.ts`

## 执行命令

```bash
cd frontend
npm run e2e -- --reporter=line
```

## 执行结果

```text
15 passed (13.0s)
```

## 覆盖项

| 测试项 | 覆盖内容 | 结果 |
|---|---|---:|
| 登录页冒烟 | 登录页渲染、输入用户名/密码、调用登录接口、跳转仪表板 | 通过 |
| 未登录保护 | 未登录访问受保护页面会重定向到 `/login` | 通过 |
| 退出登录 | 点击退出后清理本地会话并回到登录页 | 通过 |
| 核心页面渲染 | `/`、`/assets`、`/equipment`、`/inventory`、`/idle`、`/disposals`、`/approval`、`/analytics`、`/settings`、`/workflows`、`/workflow-designer` | 通过 |
| 运行时错误 | 监听 `console.error` 与 `pageerror`，核心页面加载后不允许红色错误 | 通过 |
| 搜索框交互 | 资产台账搜索框输入并保持值 | 通过 |
| 按钮交互 | 新增资产、创建盘点任务、流程管理/流程设计器入口 | 通过 |
| API 可控性 | 使用 Playwright route mock `/api/**`，隔离本地 MySQL 是否启动对前端冒烟的影响 | 通过 |

## 本轮发现并处理的问题

| 问题 | 处理 |
|---|---|
| Dashboard 标题预期写成“资产管理驾驶舱”，真实页面为“仪表板” | 已修正测试定位 |
| 流程设计器文本出现多个匹配导致 strict mode 失败 | 已改为定位“审批流程可视化设计器” |
| `/maintenance/upcoming` mock 被通用 `/maintenance` 分支截获，触发页面运行时错误 | 已调整 mock 顺序，确保 upcoming 返回数组 |
| 退出后 URL 已到 `/login` 但旧布局仍渲染 | `logout()` 直接 `window.location.replace` 抢在 React auth state 重渲染前改变地址 | 移除直接跳转，改为清理 auth state 后由 `ProtectedRoute` 执行 `<Navigate to="/login">` |

## 结论

当前前端在浏览器层面的核心冒烟、认证闭环和受保护路由测试均通过。下一步若要继续提升直观验证质量，应继续扩展真实后端业务闭环 E2E：创建资产、创建盘点、提交审批、审批通过。
