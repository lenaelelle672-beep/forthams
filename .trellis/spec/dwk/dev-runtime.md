# Dev runtime: start, test, browser harness

## 1. Scope / Trigger

Trigger: any task that needs the app running, API correctness, Playwright, or visual browser checks.

Agent **must boot the stack from README facts**. Do not ask the user to `npm run dev` / `mvn spring-boot:run` first.

## 2. Signatures

forthAMS (from repo `README.md`):

| Role | Command | URL |
| --- | --- | --- |
| DB | `mysql -uroot -proot` → `ams_db` + `backend/src/main/resources/schema.sql` | localhost:3306 |
| Backend | `cd backend && mvn spring-boot:run` | http://localhost:8080 (`context-path=/api`) |
| Frontend | `cd frontend && npm run dev` | http://localhost:5173 |
| Vite proxy | `/api` → `http://localhost:8080` | `frontend/vite.config.ts` |

Health:

```bash
curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/api/auth/test
curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/login
```

Tests:

```bash
cd backend && mvn test
cd frontend && npm test -- --run
cd frontend && npx playwright test src/e2e/browser-smoke.spec.ts src/e2e/core-routes-smoke.spec.ts src/e2e/publish-smoke.spec.ts src/e2e/app-pages-smoke.spec.ts
AMS_E2E_REAL_BACKEND=true cd frontend && npx playwright test src/e2e/real-backend-smoke.spec.ts
```

## 3. Contracts

- Frontend `http` `baseURL` = `VITE_API_BASE_URL` or `/api`.
- Backend `Result<T>` `{ code, message, data }`; interceptor unwraps `data`.
- Auth seed for mock e2e: `auth_token` + `user_info` (`src/utils/auth.ts`).
- Real-backend e2e: `AMS_API_BASE` default `http://localhost:8080/api`.
- **Never** edit `.env` or credential files unless the user explicitly asks.

### Browser Harness

Canonical install: [browser-use/browser-harness](https://github.com/browser-use/browser-harness).

```text
Install or upgrade browser-harness to the latest stable version with uv using Python 3.12,
register the skill from `browser-harness skill`, and connect it to my browser.
Default local recordings: no.
Follow https://github.com/browser-use/browser-harness/blob/main/install.md on failure.
```

Use harness for **logged-in visual / click-path** checks that Playwright mock e2e cannot see. Playwright remains the CI contract. If Chrome remote debugging is not enabled, fall back to Playwright headed (`--headed`) and record the skip reason.

## 4. Validation & Error Matrix

| Condition | Action |
| --- | --- |
| Port 5173 already serving this app | `reuseExistingServer` / do not kill |
| Port 8080 down | start backend; if MySQL missing, report and skip real-backend tests |
| `/api/auth/test` not 200 | do not claim “interfaces work” |
| Browser harness cannot attach CDP | Playwright headed fallback; do not block LOOP |
| Test red | fix implementation or the wrong assertion; never `test.skip` to go green |

## 5. Good / Base / Bad

- Good: probe health → start only missing services → run the smallest relevant test set.
- Base: frontend-only mock Playwright when backend cannot start.
- Bad: wait for the user to start servers; skip failing tests; seed only `ams_auth_token`.

## 6. Tests Required

- After boot: `auth/test` HTTP 200 if backend claimed up.
- After UI change on workbench core: `src/e2e` smoke + the menu’s workbench contract test (`npx playwright test src/e2e/workbench-platform-entry.browser-regression-smoke.spec.ts --workers=1`).
- After API path change: `approval-ui-loop` / list pages that fetch that path.

## 7. Wrong vs Correct

#### Wrong
Ask “请先启动前后端”，then idle. Embed `EnergyDashboardPage` in workbench without `SpatialTimeProvider` (`useSpatialTime` 会抛，工作台不在 `AppLayout` 内).

#### Correct
Read README, `curl` health, start missing process, run tests, paste command + result. Workbench 嵌能耗页必须包 `SpatialTimeProvider`（见 `WorkbenchRealEnergyPage`）。
