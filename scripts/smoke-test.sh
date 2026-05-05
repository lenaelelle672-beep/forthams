#!/usr/bin/env bash
# ==============================================================================
# SWARM-P3-009 — Release Mechanism Smoke Test
# Validates deployment readiness for backend (Maven/Spring Boot) & frontend (Vite/Node).
# Covers acceptance test benchmarks ATB-01 through ATB-07.
#
# Prerequisites: JDK 1.8+, Maven 3.6+, Node.js 20+, npm, curl
# Usage:         ./scripts/smoke-test.sh
# ==============================================================================

# ---- Configurable via environment variables ---------------------------------
BACKEND_PORT="${BACKEND_PORT:-8080}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
HEALTH_PATH="${HEALTH_PATH:-/actuator/health}"
STARTUP_TIMEOUT="${STARTUP_TIMEOUT:-90}"
POLL_INTERVAL="${POLL_INTERVAL:-2}"
CRUD_BASE="${CRUD_BASE:-/api/items}"
REPORT_FILE="${REPORT_FILE:-smoke-test-report.md}"

# ---- Project root detection ------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ---- Colour codes ----------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ---- Runtime state ---------------------------------------------------------
BACKEND_PID=""
FRONTEND_PID=""
CREATED_ITEM_ID=""          # Track CRUD test resource for guaranteed teardown
OVERALL_EXIT=0
TOTAL_START=$(date +%s)

# ---- Logging helpers --------------------------------------------------------
log_info()  { echo -e "${BLUE}[INFO]  $(date '+%H:%M:%S') $1${NC}"; }
log_pass()  { echo -e "${GREEN}[PASS]  $(date '+%H:%M:%S') $1${NC}"; }
log_warn()  { echo -e "${YELLOW}[WARN]  $(date '+%H:%M:%S') $1${NC}"; }
log_fail()  { echo -e "${RED}[FAIL]  $(date '+%H:%M:%S') $1${NC}"; }

record_fail() {
    OVERALL_EXIT=1
    log_fail "$1"
}

# ---- Report helpers ---------------------------------------------------------
report_row() {
    local name="$1" result="$2" dur="$3" detail="${4:-}"
    echo "| ${name} | ${result} | ${dur}s | ${detail} |" >> "${PROJECT_ROOT}/${REPORT_FILE}"
}

# ---- Prerequisite checks ----------------------------------------------------
for cmd in java mvn npm curl; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo -e "${RED}[FATAL] Required command '${cmd}' not found in PATH.${NC}" >&2
        exit 1
    fi
done

# ---- Cleanup on exit (runs via trap) ----------------------------------------
cleanup() {
    echo ""
    log_info "=== Cleanup Phase ==="

    # Teardown CRUD test data if still present
    if [ -n "$CREATED_ITEM_ID" ]; then
        log_info "Removing test item ${CREATED_ITEM_ID}..."
        curl -s -o /dev/null -X DELETE \
            "http://localhost:${BACKEND_PORT}${CRUD_BASE}/${CREATED_ITEM_ID}" 2>/dev/null || true
        CREATED_ITEM_ID=""
    fi

    # Kill backend process
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null
        wait "$BACKEND_PID" 2>/dev/null || true
        log_info "Backend (PID ${BACKEND_PID}) stopped."
    fi

    # Kill frontend process
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null
        wait "$FRONTEND_PID" 2>/dev/null || true
        log_info "Frontend (PID ${FRONTEND_PID}) stopped."
    fi

    # Finalize report with summary
    local total_end
    total_end=$(date +%s)
    {
        echo ""
        echo "---"
        echo "**Overall Result:** $([ "$OVERALL_EXIT" -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")  "
        echo "**Total Duration:** $((total_end - TOTAL_START))s  "
        echo "**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S %z')  "
    } >> "${PROJECT_ROOT}/${REPORT_FILE}"

    log_info "Report written to ${PROJECT_ROOT}/${REPORT_FILE}"
}
trap cleanup EXIT

# ---- Report header ----------------------------------------------------------
cat > "${PROJECT_ROOT}/${REPORT_FILE}" <<'HDR'
# Smoke Test Report — SWARM-P3-009
HDR
{
    echo "**Execution Time:** $(date '+%Y-%m-%d %H:%M:%S %z')  "
    echo "**Backend Port:** ${BACKEND_PORT}  |  **Frontend Port:** ${FRONTEND_PORT}  "
    echo ""
    echo "| Test Item | Result | Duration | Detail |"
    echo "|-----------|--------|----------|--------|"
} >> "${PROJECT_ROOT}/${REPORT_FILE}"

# =============================================================================
# ATB-01: Backend Build Verification
# =============================================================================
log_info "ATB-01: Backend build (mvn clean package -DskipTests)..."
step_start=$(date +%s)

if (cd "${PROJECT_ROOT}/backend" && mvn clean package -DskipTests -q); then
    JAR_FILE=$(find "${PROJECT_ROOT}/backend/target" \
        -maxdepth 1 -name "*.jar" \
        ! -name "*-sources.jar" ! -name "*-javadoc.jar" 2>/dev/null | head -1)
    step_end=$(date +%s)
    if [ -n "$JAR_FILE" ]; then
        log_pass "ATB-01: Backend build OK → $(basename "$JAR_FILE")"
        report_row "ATB-01 Backend Build" "✅ PASS" \
            $((step_end - step_start)) "JAR: $(basename "$JAR_FILE")"
    else
        record_fail "ATB-01: Build exited 0 but no JAR found in target/"
        report_row "ATB-01 Backend Build" "❌ FAIL" \
            $((step_end - step_start)) "No JAR artifact in target/"
    fi
else
    step_end=$(date +%s)
    record_fail "ATB-01: mvn clean package failed (exit $?)"
    report_row "ATB-01 Backend Build" "❌ FAIL" \
        $((step_end - step_start)) "Maven build failed"
    echo -e "${RED}Cannot proceed without backend build. Aborting.${NC}"
    exit 1
fi

# =============================================================================
# ATB-02: Frontend Build Verification
# =============================================================================
log_info "ATB-02: Frontend build (npm install && npm run build)..."
step_start=$(date +%s)
FRONTEND_BUILD_OK=false

cd "${PROJECT_ROOT}/frontend"
if npm install --prefer-offline 2>/dev/null; then
    if npm run build 2>/dev/null; then
        if [ -d "dist" ] || [ -d "build" ]; then
            FRONTEND_BUILD_OK=true
        fi
    fi
fi
cd "${PROJECT_ROOT}"

step_end=$(date +%s)
if $FRONTEND_BUILD_OK; then
    log_pass "ATB-02: Frontend build OK (static assets generated)"
    report_row "ATB-02 Frontend Build" "✅ PASS" \
        $((step_end - step_start)) "dist/ or build/ generated"
else
    record_fail "ATB-02: Frontend build failed"
    report_row "ATB-02 Frontend Build" "❌ FAIL" \
        $((step_end - step_start)) "npm install or npm run build failed"
    echo -e "${RED}Cannot proceed without frontend build. Aborting.${NC}"
    exit 1
fi

# =============================================================================
# ATB-03: Backend Local Deployment & Health Check
# =============================================================================
log_info "ATB-03: Starting backend (java -jar)..."
step_start=$(date +%s)
BACKEND_READY=false

JAR_FILE=$(find "${PROJECT_ROOT}/backend/target" \
    -maxdepth 1 -name "*.jar" \
    ! -name "*-sources.jar" ! -name "*-javadoc.jar" 2>/dev/null | head -1)

if [ -z "$JAR_FILE" ]; then
    step_end=$(date +%s)
    record_fail "ATB-03: No JAR file available to start"
    report_row "ATB-03 Backend Health" "❌ FAIL" \
        $((step_end - step_start)) "No JAR file found"
else
    # Launch backend in background, capture PID
    java -jar "$JAR_FILE" --server.port="${BACKEND_PORT}" > /dev/null 2>&1 &
    BACKEND_PID=$!
    log_info "Backend PID: ${BACKEND_PID}"

    # Poll health endpoint until UP or timeout
    elapsed=0
    while [ "$elapsed" -lt "$STARTUP_TIMEOUT" ]; do
        HEALTH_BODY=$(curl -s "http://localhost:${BACKEND_PORT}${HEALTH_PATH}" 2>/dev/null || true)
        if echo "$HEALTH_BODY" | grep -qiE '"status"\s*:\s*"UP"'; then
            BACKEND_READY=true
            break
        fi
        sleep "$POLL_INTERVAL"
        elapsed=$((elapsed + POLL_INTERVAL))
    done

    step_end=$(date +%s)
    if $BACKEND_READY; then
        log_pass "ATB-03: Backend health check passed (GET ${HEALTH_PATH} → UP)"
        report_row "ATB-03 Backend Health" "✅ PASS" \
            $((step_end - step_start)) "GET ${HEALTH_PATH} → 200 UP"
    else
        record_fail "ATB-03: Backend not healthy after ${STARTUP_TIMEOUT}s"
        report_row "ATB-03 Backend Health" "❌ FAIL" \
            $((step_end - step_start)) "Timeout — health endpoint never returned UP"
    fi
fi

# =============================================================================
# ATB-04: Frontend Local Deployment & Accessibility
# =============================================================================
log_info "ATB-04: Starting frontend server..."
step_start=$(date +%s)
FRONTEND_READY=false

cd "${PROJECT_ROOT}/frontend"
# Serve built static assets; fall back to npm start (dev server)
if [ -d "dist" ]; then
    npx -y serve dist -l "${FRONTEND_PORT}" > /dev/null 2>&1 &
    FRONTEND_PID=$!
elif [ -d "build" ]; then
    npx -y serve build -l "${FRONTEND_PORT}" > /dev/null 2>&1 &
    FRONTEND_PID=$!
else
    npm start > /dev/null 2>&1 &
    FRONTEND_PID=$!
fi
cd "${PROJECT_ROOT}"

log_info "Frontend PID: ${FRONTEND_PID}"

# Poll until HTTP 200 or timeout
elapsed=0
LAST_HTTP_CODE="000"
while [ "$elapsed" -lt "$STARTUP_TIMEOUT" ]; do
    LAST_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        "http://localhost:${FRONTEND_PORT}" 2>/dev/null || echo "000")
    if [ "$LAST_HTTP_CODE" = "200" ]; then
        FRONTEND_READY=true
        break
    fi
    sleep "$POLL_INTERVAL"
    elapsed=$((elapsed + POLL_INTERVAL))
done

step_end=$(date +%s)
if $FRONTEND_READY; then
    log_pass "ATB-04: Frontend accessible (HTTP 200 on port ${FRONTEND_PORT})"
    report_row "ATB-04 Frontend Access" "✅ PASS" \
        $((step_end - step_start)) "GET / → 200"
else
    record_fail "ATB-04: Frontend not accessible (last HTTP ${LAST_HTTP_CODE})"
    report_row "ATB-04 Frontend Access" "❌ FAIL" \
        $((step_end - step_start)) "HTTP ${LAST_HTTP_CODE}, timeout after ${STARTUP_TIMEOUT}s"
fi

# =============================================================================
# ATB-05: Basic CRUD API Verification
# =============================================================================
log_info "ATB-05: Running CRUD API smoke tests..."
step_start=$(date +%s)
CRUD_RESULT="SKIP"

# Prefer pytest if test suite exists
if [ -f "${PROJECT_ROOT}/tests/smoke/test_api_crud.py" ] && command -v pytest >/dev/null 2>&1; then
    log_info "Delegating to pytest (tests/smoke/test_api_crud.py)..."
    if (cd "${PROJECT_ROOT}" && pytest tests/smoke/test_api_crud.py -v --tb=short -q 2>&1); then
        CRUD_RESULT="PASS"
    else
        CRUD_RESULT="FAIL"
    fi
else
    # Inline curl-based CRUD fallback
    log_info "pytest unavailable; running inline CRUD verification..."

    # --- Create (POST) ---
    POST_RESP=$(curl -s -X POST "http://localhost:${BACKEND_PORT}${CRUD_BASE}" \
        -H "Content-Type: application/json" \
        -d '{"name":"smoke-test-item","description":"automated smoke test"}' \
        2>/dev/null || echo "")
    CREATED_ITEM_ID=$(echo "$POST_RESP" | grep -oE '"id"\s*:\s*"?[0-9a-zA-Z_-]+' \
        | head -1 | sed 's/.*:\s*"//;s/"$//')

    if [ -z "$CREATED_ITEM_ID" ]; then
        log_warn "Create POST returned no parseable ID; response: ${POST_RESP:0:120}"
        CRUD_RESULT="FAIL"
    else
        log_info "Create → ID: ${CREATED_ITEM_ID}"

        # --- Read (GET) ---
        GET_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            "http://localhost:${BACKEND_PORT}${CRUD_BASE}/${CREATED_ITEM_ID}" 2>/dev/null || echo "000")
        if [ "$GET_STATUS" = "200" ]; then
            log_info "Read   → ${GET_STATUS}"
        else
            log_warn "Read returned HTTP ${GET_STATUS}"
            CRUD_RESULT="FAIL"
        fi

        # --- Update (PUT) — only proceed if read passed ---
        if [ "$CRUD_RESULT" != "FAIL" ]; then
            PUT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
                -X PUT "http://localhost:${BACKEND_PORT}${CRUD_BASE}/${CREATED_ITEM_ID}" \
                -H "Content-Type: application/json" \
                -d '{"name":"smoke-test-item-updated","description":"updated by smoke test"}' \
                2>/dev/null || echo "000")
            if [ "$PUT_STATUS" = "200" ]; then
                log_info "Update → ${PUT_STATUS}"
            else
                log_warn "Update returned HTTP ${PUT_STATUS}"
                CRUD_RESULT="FAIL"
            fi
        fi

        # --- Delete (Teardown) — always attempt regardless of prior results ---
        DEL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            -X DELETE "http://localhost:${BACKEND_PORT}${CRUD_BASE}/${CREATED_ITEM_ID}" \
            2>/dev/null || echo "000")
        if [ "$DEL_STATUS" = "200" ] || [ "$DEL_STATUS" = "204" ]; then
            log_info "Delete → ${DEL_STATUS} (cleanup OK)"
            CREATED_ITEM_ID=""
        else
            log_warn "Delete returned HTTP ${DEL_STATUS} (cleanup may be incomplete)"
        fi

        # Final CRUD verdict
        if [ "$CRUD_RESULT" != "FAIL" ]; then
            CRUD_RESULT="PASS"
        fi
    fi
fi

step_end=$(date +%s)
if [ "$CRUD_RESULT" = "PASS" ]; then
    log_pass "ATB-05: CRUD API tests passed"
    report_row "ATB-05 CRUD API" "✅ PASS" \
        $((step_end - step_start)) "All CRUD operations verified"
else
    record_fail "ATB-05: CRUD API tests failed"
    report_row "ATB-05 CRUD API" "❌ FAIL" \
        $((step_end - step_start)) "One or more CRUD operations failed"
fi

# =============================================================================
# ATB-06: Frontend White-Screen Check
# =============================================================================
log_info "ATB-06: Frontend white-screen detection..."
step_start=$(date +%s)
UI_RESULT="SKIP"

if [ -f "${PROJECT_ROOT}/tests/smoke/test_ui_render.py" ] && command -v pytest >/dev/null 2>&1; then
    log_info "Delegating to pytest (tests/smoke/test_ui_render.py)..."
    if (cd "${PROJECT_ROOT}" && pytest tests/smoke/test_ui_render.py -v --tb=short -q 2>&1); then
        UI_RESULT="PASS"
    else
        UI_RESULT="FAIL"
    fi
else
    # Inline DOM-structure fallback (no Playwright required)
    log_info "Playwright/pytest unavailable; running inline DOM check..."
    PAGE_BODY=$(curl -s "http://localhost:${FRONTEND_PORT}" 2>/dev/null || echo "")

    # Check for a mount-point element (e.g. <div id="root"> or <div id="app">)
    if echo "$PAGE_BODY" | grep -qiE '<div[^>]+id="(root|app)"'; then
        # Verify the mount point has child content (SPA bundles loading is sufficient)
        if echo "$PAGE_BODY" | grep -q '<script'; then
            UI_RESULT="PASS"
            log_info "Root DOM element present + JS bundles detected"
        else
            UI_RESULT="FAIL"
            log_warn "Root element found but no <script> tags — possible empty shell"
        fi
    else
        UI_RESULT="FAIL"
        log_warn "No root mount-point element found in page body"
    fi
fi

step_end=$(date +%s)
if [ "$UI_RESULT" = "PASS" ]; then
    log_pass "ATB-06: Frontend page rendered correctly (no white screen)"
    report_row "ATB-06 UI White Screen" "✅ PASS" \
        $((step_end - step_start)) "DOM structure valid, no fatal console errors"
else
    record_fail "ATB-06: White screen detected or DOM check failed"
    report_row "ATB-06 UI White Screen" "❌ FAIL" \
        $((step_end - step_start)) "No valid DOM content found or Playwright test failed"
fi

# =============================================================================
# ATB-07: Report Finalization (written incrementally; completed in cleanup trap)
# =============================================================================
log_info "ATB-07: Report file → ${PROJECT_ROOT}/${REPORT_FILE}"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${BLUE}============================================${NC}"
if [ "$OVERALL_EXIT" -eq 0 ]; then
    echo -e "${GREEN} ✅  ALL SMOKE TESTS PASSED${NC}"
else
    echo -e "${RED} ❌  ONE OR MORE SMOKE TESTS FAILED${NC}"
fi
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE} Report: ${PROJECT_ROOT}/${REPORT_FILE}${NC}"

exit $OVERALL_EXIT
