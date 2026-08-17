# 前端依赖安全残余

- **审计日期：** 2026-08-03
- **用户决定：** 记录 SPA 不可达残余。

## 已批准残余

`npm audit --omit=dev` 对 `react-router@7.18.2` 的 `GHSA-qwww-vcr4-c8h2`（RSC Mode CSRF）仍报告 High。此项未修复。

当前应用为 Vite 静态 SPA，使用 `createRoot` 和 `createBrowserRouter`，且未使用 SSR、RSC、React Router Framework、RSC Mode、server actions 或 hydration；因此该 RSC Mode CSRF 在当前运行时不可达。

在引入 SSR、RSC、React Router Framework、RSC Mode 或 server actions 前，必须先迁移至 `react >=19.2.7` 和 `react-router >=8.3.0`，并完成兼容验证。

## 证据文件

- `frontend/package.json`：声明 `react-router@7.18.2` 及 Vite 构建脚本。
- `frontend/package-lock.json`：解析到 `react-router@7.18.2`。
- `frontend/src/main.tsx`：客户端入口使用 `createRoot`。
- `frontend/src/router/index.tsx`：路由使用 `createBrowserRouter`。
- `frontend/vite.config.ts`：Vite 前端构建配置。
