#!/usr/bin/env bash
# ==============================================================================
# CI Gate Script — 全栈健康验证
# 顺序执行：前端构建 → TypeScript 检查 → 前端单元测试 → 浏览器回归 smoke →
#          后端部署/workflow 靶向门禁 → 后端全量测试 → Git 变更检查
# 任何步骤失败则退出非零，用于 CI pipeline 或开发提交流程。
#
# 依赖: Node.js >=20, npm, JDK 17+, Maven 3.6+
# 无外部服务依赖（后端测试使用 H2 内嵌数据库）
# 预计耗时: 约 180-240 秒
#
# Usage:
#   ./scripts/ci-gate.sh                    # 正常执行
#   SKIP_BUILD=1 ./scripts/ci-gate.sh       # 跳过前端构建（仅测试）
#   SKIP_BROWSER_SMOKE=1 ./scripts/ci-gate.sh
#   SKIP_TARGETED_GATES=1 ./scripts/ci-gate.sh
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"
START_TIME="$(date +%s)"
PASS_COUNT=0
FAIL_COUNT=0

# ---- Colors ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[CI]${NC} $1"; }
log_pass()  { echo -e "${GREEN}[CI] ✓ PASS${NC} $1"; }
log_fail()  { echo -e "${RED}[CI] ✗ FAIL${NC} $1"; }

record_pass() { PASS_COUNT=$((PASS_COUNT + 1)); log_pass "$1"; }
record_fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); log_fail "$1"; }

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  CI Gate — ${TIMESTAMP}${NC}"
echo -e "${BLUE}  项目: $(basename "${PROJECT_ROOT}")${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# =============================================================================
# Step 1: 前端生产构建
# =============================================================================
TOTAL_STEPS=7

if [ "${SKIP_BUILD:-}" != "1" ]; then
    log_info "Step 1/${TOTAL_STEPS}: 前端生产构建 (npm run build)..."
    STEP_START="$(date +%s)"
    if (cd "${PROJECT_ROOT}/frontend" && npm run build 2>&1); then
        STEP_DURATION="$(( $(date +%s) - STEP_START ))"
        record_pass "前端构建完成 (${STEP_DURATION}s)"
    else
        record_fail "前端构建失败"
        echo -e "${RED}CI Gate 终止: 前端构建失败${NC}"
        exit 1
    fi
else
    log_info "Step 1/${TOTAL_STEPS}: 跳过前端构建 (SKIP_BUILD=1)"
fi

# =============================================================================
# Step 2: TypeScript 类型检查
# =============================================================================
log_info "Step 2/${TOTAL_STEPS}: TypeScript 类型检查 (npx tsc -p tsconfig.json --noEmit --pretty false)..."
STEP_START="$(date +%s)"
if (cd "${PROJECT_ROOT}/frontend" && npx tsc -p tsconfig.json --noEmit --pretty false 2>&1); then
    STEP_DURATION="$(( $(date +%s) - STEP_START ))"
    record_pass "TypeScript 检查通过 (${STEP_DURATION}s)"
else
    record_fail "TypeScript 检查失败"
    echo -e "${RED}CI Gate 终止: TypeScript 检查失败${NC}"
    exit 1
fi

# =============================================================================
# Step 3: 前端单元测试
# =============================================================================
log_info "Step 3/${TOTAL_STEPS}: 前端单元测试 (npx vitest run)..."
STEP_START="$(date +%s)"
if (cd "${PROJECT_ROOT}/frontend" && npx vitest run 2>&1); then
    STEP_DURATION="$(( $(date +%s) - STEP_START ))"
    record_pass "前端单元测试通过 (${STEP_DURATION}s)"
else
    record_fail "前端单元测试失败"
    echo -e "${RED}CI Gate 终止: 前端单元测试失败${NC}"
    exit 1
fi

# =============================================================================
# Step 4: 浏览器回归 smoke
# =============================================================================
if [ "${SKIP_BROWSER_SMOKE:-${SKIP_BROWSER_LIST:-}}" != "1" ]; then
    log_info "Step 4/${TOTAL_STEPS}: 浏览器回归 smoke 执行 (npm run e2e:browser-regression)..."
    STEP_START="$(date +%s)"
    if (cd "${PROJECT_ROOT}/frontend" && npm run e2e:browser-regression 2>&1); then
        STEP_DURATION="$(( $(date +%s) - STEP_START ))"
        record_pass "浏览器回归 smoke 通过 (${STEP_DURATION}s)"
    else
        record_fail "浏览器回归 smoke 失败"
        echo -e "${RED}CI Gate 终止: browser-regression-smoke 执行失败${NC}"
        exit 1
    fi
else
    log_info "Step 4/${TOTAL_STEPS}: 跳过浏览器回归 smoke (SKIP_BROWSER_SMOKE=1)"
fi

# =============================================================================
# Step 5: 后端部署/workflow 靶向门禁
# =============================================================================
if [ "${SKIP_TARGETED_GATES:-}" != "1" ]; then
    log_info "Step 5/${TOTAL_STEPS}: 后端部署/workflow 靶向门禁..."
    STEP_START="$(date +%s)"
    if (cd "${PROJECT_ROOT}/backend" && mvn -q -Dtest=DeploymentConfigConsistencyTest,TenantSchemaConsistencyTest,PermissionSeedSchemaTest,WorkflowDefinitionControllerTest,WorkflowDefinitionServiceTest test 2>&1); then
        STEP_DURATION="$(( $(date +%s) - STEP_START ))"
        record_pass "后端部署/workflow 靶向门禁通过 (${STEP_DURATION}s)"
    else
        record_fail "后端部署/workflow 靶向门禁失败"
        echo -e "${RED}CI Gate 终止: 靶向门禁失败${NC}"
        exit 1
    fi
else
    log_info "Step 5/${TOTAL_STEPS}: 跳过后端部署/workflow 靶向门禁 (SKIP_TARGETED_GATES=1)"
fi

# =============================================================================
# Step 6: 后端单元测试
# =============================================================================
log_info "Step 6/${TOTAL_STEPS}: 后端单元测试 (mvn test -q)..."
STEP_START="$(date +%s)"
if (cd "${PROJECT_ROOT}/backend" && mvn test -q 2>&1); then
    STEP_DURATION="$(( $(date +%s) - STEP_START ))"
    record_pass "后端单元测试通过 (${STEP_DURATION}s)"
else
    record_fail "后端单元测试失败"
    echo -e "${RED}CI Gate 终止: 后端单元测试失败${NC}"
    exit 1
fi

# =============================================================================
# Step 7: Git 变更检查
# =============================================================================
log_info "Step 7/${TOTAL_STEPS}: Git 变更检查 (git status --short)..."
STEP_START="$(date +%s)"
DIRTY=$(cd "${PROJECT_ROOT}" && git status --short)
STEP_DURATION="$(( $(date +%s) - STEP_START ))"
if [ -z "${DIRTY}" ]; then
    record_pass "Git 工作区干净 (${STEP_DURATION}s)"
else
    echo "${DIRTY}"
    record_pass "Git 变更已记录 (${STEP_DURATION}s)"
fi

# =============================================================================
# Summary
# =============================================================================
TOTAL_DURATION="$(( $(date +%s) - START_TIME ))"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ "${FAIL_COUNT}" -eq 0 ]; then
    echo -e "${GREEN}  ✅ CI Gate PASSED (${PASS_COUNT} passed, ${FAIL_COUNT} failed, ${TOTAL_DURATION}s)${NC}"
else
    echo -e "${RED}  ❌ CI Gate FAILED (${PASS_COUNT} passed, ${FAIL_COUNT} failed, ${TOTAL_DURATION}s)${NC}"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

exit ${FAIL_COUNT}
