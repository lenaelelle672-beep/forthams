# Testing Rules (ECC distilled)

## Coverage

- Minimum 80% line coverage on service/domain logic
- Skip trivial getters/config classes; focus effort on critical paths and complex logic
- Three levels, all expected for real features: unit, integration, E2E (critical flows)

## TDD loop (used with the `tdd` skill)

1. Write the failing test first (RED) — confirm it fails
2. Write minimal implementation (GREEN) — confirm it passes
3. Refactor belongs to the review stage, not the red-green cycle
4. One seam, one test, one minimal implementation per cycle — vertical slices,
   never "all tests first, then all code"

## What a good test is

- Verifies behavior through public interfaces, not implementation details
- Expected values come from an independent source of truth (spec, worked example),
  never recomputed the same way the code computes them
- Survives refactors: if a test breaks when behavior didn't change, it's coupled
  to implementation — fix the test

## Structure and naming

- Arrange-Act-Assert structure
- Names describe behavior: `returns empty array when no markets match query`,
  `throws error when API key is missing`

## When tests fail

- Check test isolation and mock correctness first
- Fix the implementation, not the test — unless the test itself is wrong
- Never delete or skip a failing test to make the suite green

## Start the stack (do not wait for the human)

See `.trellis/spec/dwk/dev-runtime.md`. Probe health, start missing frontend/backend from README, then test. Browser visual paths may use Browser Harness; Playwright stays the CI contract.

## Playwright E2E (forthAMS)

- `frontend/playwright.config.ts` collects `src/e2e` and `tests/e2e`. Loadability (`playwright test --list`) is not the same as a green suite.
- Specs that cannot parse, mix vitest with Playwright, or import missing/Graphify modules go in `testIgnore`. Do not add fake modules to satisfy imports.
- Anchor selectors to routed pages (`src/router/index.tsx` → `src/pages/**`), not unmounted `src/app/pages/**`.
- Auth seed must write `auth_token` / `user_info` (`src/utils/auth.ts`). Seeding only `ams_auth_token` leaves the guard on `/login`.
- Login: heading `欢迎回来` (desktop) / `登录系统` (narrow); username `#username`; submit `登录系统`. Never `getByLabel('用户名')`.
- Post-login land is `/fixed-assets/workbench?menu=home`, not `/dashboard`. Approval list is `/approvals` with h1 `审批中心`. Asset list h1 is `资产台账`.
- Workbench 真页 heading 合同（`workbench-platform-entry.browser-regression-smoke.spec.ts`）：home `运营首页`、todo `审批中心`、asset `/资产/`、device `重要设备管理`、orders `资产处置管理`、inspection `检验/年检管理`、spares `备品备件管理`、energy `能耗管理`、report `报表中心`、alarm `通知中心`、policy `风险矩阵`、settings `资产分类管理`。禁止再断言 mock 列表/抽屉文案。
- 该 spec 用 `--workers=1`。多 worker 会触发 Vite `Failed to fetch dynamically imported module`（尤其 `EnergyDashboardPage`）。
- `mockApi` 默认 `paged([])` 不能喂给：`/energy/dashboard`（对象 `{byType,trend,assetRanking,total}`）、`/risk-assessments/matrix`（数组）、`/categories/tree`（数组）。否则真页无 heading 或 `forEach` 崩溃。
- AppLayout 列表补测 `src/e2e/app-pages-smoke.spec.ts`：下列路径必须是 **数组** 不是 paged：`/contracts/expiring`、`/stocktaking/cycles`、`/menus/admin/tree`、`/fault-codes/tree`、`/reliability/trend|ranking`、`/asset-health/unhealthy`、`/gis/assets`、`/manufacturers/options`、`/system/custom-fieldsets/all`、`/maintenance/upcoming`。`/reliability/summary`、`/gis/stats` 必须是对象。
- 空态/403/失败态：`src/e2e/app-pages-empty-error.spec.ts`。失败态只测页面会渲染「加载失败」的路径；Dashboard KPI 失败不显示该文案，不要硬断言。
- 登录变体：`src/e2e/login-variants-smoke.spec.ts`。`/login5` 走 `Login4Page` 且 h1 可能不是 role=heading，用 `region` landmark「UNIVIEW 固定资产平台登录」。
- `locations`/`departments` 树展平必须 `Array.isArray` 再 `for...of`（`InventoryDetailPage`）；`paged({})` 当树会 `items is not iterable`。
