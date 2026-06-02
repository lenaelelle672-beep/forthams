#!/bin/bash
# =====================================================
# forthAMS 全量 API 测试脚本
# 用法: bash scripts/api-test.sh [选项]
#   无参数  = 跑全部测试
#   --crud  = 只跑增删改查
#   --biz   = 只跑业务逻辑
#   --quick = 只跑快速冒烟（20项）
# =====================================================

MODE=${1:-all}
BASE="http://localhost:8080/api"
PASS=0 FAIL=0 TOTAL=0 ERRORS=""

# ── 获取 token ──
echo ">>> 登录获取 token..."
LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])" 2>/dev/null)
AUTH="Authorization: Bearer $TOKEN"
if [ -z "$TOKEN" ] || [ "$TOKEN" = "None" ]; then
    echo "  ❌ Token 获取失败，无法继续测试"
    exit 1
fi
echo "  TOKEN: ${TOKEN:0:20}..."
echo ""

# 数据准备完成后等待，降低突发速率避免触发限流
sleep 0.3

# ── 工具函数 ──
wait_a_bit() {
    sleep 0.3
}

# ── 测试函数 ──
t() {
  local desc=$1 method=$2 url=$3 data=$4 expect=${5:-200}
  TOTAL=$((TOTAL+1))
  sleep 1.3
  local resp=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
    -H "$AUTH" -H "Content-Type: application/json" ${data:+-d "$data"})
  local code=$(echo "$resp" | tail -1)
  local body=$(echo "$resp" | sed '$d')
  echo "$body" > /tmp/_atest.json
  if [ "$code" = "$expect" ]; then
    echo "  ✅ $desc"
    PASS=$((PASS+1))
  else
    local msg=$(echo "$body" | python3 -c "import sys,json;print(json.load(sys.stdin).get('message',''))" 2>/dev/null)
    echo "  ❌ $desc → 状态$code (期望$expect) | $msg"
    FAIL=$((FAIL+1))
    ERRORS="$ERRORS| $desc | $code | $msg |\n"
  fi
}

check_text() {
  local desc=$1 keyword=$2
  TOTAL=$((TOTAL+1))
  if grep -q "$keyword" /tmp/_atest.json 2>/dev/null; then
    echo "  ✅ $desc"
    PASS=$((PASS+1))
  else
    echo "  ❌ $desc → 响应中未包含'$keyword'"
    FAIL=$((FAIL+1))
    ERRORS="$ERRORS| $desc | MISSING | 未包含关键词'$keyword' |\n"
  fi
}

echo "╔══════════════════════════════════════════════════╗"
echo "║   forthAMS 全量 API 测试                        ║"
echo "║   时间: $(date '+%Y-%m-%d %H:%M')                ║"
echo "║   模式: $MODE                                    ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# 数据准备完成后等待，降低突发速率避免触发限流
sleep 0.3

# ====================================================================
# 第一部分：基础数据准备（创建测试用数据）
# ====================================================================
echo "━━━━ 准备测试数据 ━━━━"

TS=$(date +%s)
AID=""; WOID=""; VID=""; LID=""; DID=""; CATID=""; IID=""; MID=""; USERID=""

wait_a_bit
resp=$(curl -s -X POST "$BASE/categories" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"categoryName":"测试分类","categoryCode":"TEST-CAT-'$TS'"}')
CATID=$(echo "$resp" | python3 -c "import sys,json;d=json.load(sys.stdin).get('data',{});print(d.get('id',''))" 2>/dev/null)
echo "  分类ID: $CATID"

wait_a_bit
resp=$(curl -s -X POST "$BASE/assets" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"assetName":"测试资产","assetNo":"TEST-'"$TS"'","categoryId":1,"status":"IN_USE","deptId":1,"originalValue":50000,"useDate":"2026-01-01"}')
AID=$(echo "$resp" | python3 -c "import sys,json;d=json.load(sys.stdin).get('data',{});print(d.get('id',''))" 2>/dev/null)
echo "  资产ID: $AID"

wait_a_bit
resp=$(curl -s -X POST "$BASE/vendors" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"name":"测试供应商","vendorCode":"TEST-VEN-'$TS'","contactPerson":"张三","contactPhone":"13800138000"}')
VID=$(echo "$resp" | python3 -c "import sys,json;d=json.load(sys.stdin).get('data',{});print(d.get('id',''))" 2>/dev/null)
echo "  供应商ID: $VID"

wait_a_bit
resp=$(curl -s -X POST "$BASE/locations" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"name":"测试地点","locationCode":"TEST-LOC-'$TS'"}')
LID=$(echo "$resp" | python3 -c "import sys,json;d=json.load(sys.stdin).get('data',{});print(d.get('id',''))" 2>/dev/null)
echo "  地点ID: $LID"

wait_a_bit
resp=$(curl -s -X POST "$BASE/depts" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"name":"测试部门","deptCode":"TEST-DEPT-'$TS'"}')
DID=$(echo "$resp" | python3 -c "import sys,json;d=json.load(sys.stdin).get('data',{});print(d.get('id',''))" 2>/dev/null)
echo "  部门ID: $DID"

wait_a_bit
resp=$(curl -s -X POST "$BASE/roles" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"roleName":"测试角色","roleCode":"TEST-ROLE-'$TS'"}')
RID=$(echo "$resp" | python3 -c "import sys,json;d=json.load(sys.stdin).get('data',{});print(d.get('id',''))" 2>/dev/null)
echo "  角色ID: $RID"

wait_a_bit
resp=$(curl -s -X POST "$BASE/user-management" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"username":"tester_'"$TS"'","realName":"测试用户","password":"123456","deptId":1}')
USERID=$(echo "$resp" | python3 -c "import sys,json;d=json.load(sys.stdin).get('data',{});print(d.get('id',''))" 2>/dev/null)
echo "  用户ID: $USERID"

wait_a_bit
resp=$(curl -s -X POST "$BASE/maintenance" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"assetId":'"$AID"',"maintenanceType":"REGULAR","maintenanceDate":"2026-06-01","content":"测试维保"}')
MID=$(echo "$resp" | python3 -c "import sys,json;d=json.load(sys.stdin).get('data',{});print(d.get('id',''))" 2>/dev/null)
echo "  维保ID: $MID"

resp=$(curl -s -X POST "$BASE/workorders" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"title":"测试工单","type":"MAINTENANCE","priority":"HIGH","assetId":'"$AID"'}')
WOID=$(echo "$resp" | python3 -c "import sys,json;d=json.load(sys.stdin).get('data',{});print(d.get('id',''))" 2>/dev/null)
echo "  工单ID: $WOID"

# 为闲置测试单独创建一个 IDLE 状态资产
resp=$(curl -s -X POST "$BASE/assets" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"assetName":"闲置测试资产","assetNo":"IDLE-'"$TS"'","categoryId":1,"status":"IDLE","deptId":1,"originalValue":10000,"useDate":"2026-01-01"}')
IDLE_AID=$(echo "$resp" | python3 -c "import sys,json;d=json.load(sys.stdin).get('data',{});print(d.get('id',''))" 2>/dev/null)
echo "  闲置资产ID: $IDLE_AID"

wait_a_bit
resp=$(curl -s -X POST "$BASE/idle-assets" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"assetId":'"$IDLE_AID"',"reason":"测试闲置"}')
IID=$(echo "$resp" | python3 -c "import sys,json;d=json.load(sys.stdin).get('data',{});print(d.get('id',''))" 2>/dev/null)
echo "  闲置ID: $IID"

echo ""

# 数据准备完成后等待，降低突发速率避免触发限流
sleep 0.3

# ====================================================================
# 第二部分：测试用例
# ====================================================================

# ── A. 认证模块 ──
if [ "$MODE" = "all" ] || [ "$MODE" = "--crud" ] || [ "$MODE" = "--quick" ]; then
echo "━━━ A. 认证 ━━━"
t "A1 登录成功" POST "$BASE/auth/login" '{"username":"admin","password":"admin123"}'
t "A2 登出" POST "$BASE/auth/logout"
fi

# ── B. 仪表板 ──
if [ "$MODE" = "all" ] || [ "$MODE" = "--crud" ] || [ "$MODE" = "--quick" ]; then
echo "━━━ B. 仪表板 ━━━"
t "B1 统计概览" GET "$BASE/dashboard/stats"
t "B2 趋势图" GET "$BASE/dashboard/trends"
t "B3 部门分布" GET "$BASE/dashboard/dept-distribution"
t "B4 维保统计" GET "$BASE/dashboard/maintenance-stats"
t "B5 待审批数" GET "$BASE/dashboard/pending-approvals"
fi

# ── C. 分类 CRUD ──
if [ "$MODE" = "all" ] || [ "$MODE" = "--crud" ]; then
echo "━━━ C. 分类管理 CRUD ━━━"
t "C1 创建分类" POST "$BASE/categories" '{"categoryName":"CRUD分类","categoryCode":"CRUD-CAT-'"$TS"'"}'
CID=$(python3 -c "import json;d=json.load(open('/tmp/_atest.json'));print(d.get('data',{}).get('id',''))" 2>/dev/null)
t "C2 分类树" GET "$BASE/categories/tree"
t "C3 分类列表" GET "$BASE/categories/list"
t "C4 分类详情" GET "$BASE/categories/$CID"
t "C5 更新分类" PUT "$BASE/categories/$CID" '{"categoryName":"分类-已更新"}'
t "C6 删除分类" DELETE "$BASE/categories/$CID"
fi

# ── D. 资产 CRUD ──
if [ "$MODE" = "all" ] || [ "$MODE" = "--crud" ] || [ "$MODE" = "--quick" ]; then
echo "━━━ D. 资产管理 CRUD ━━━"
t "D1 资产列表" GET "$BASE/assets"
t "D2 资产列表(/list)" GET "$BASE/assets/list"
t "D3 资产详情" GET "$BASE/assets/$AID"
t "D4 更新资产" PUT "$BASE/assets/$AID" '{"assetName":"资产-已更新"}'
t "D5 报表汇总" GET "$BASE/reports/summary"
t "D6 按分类统计" GET "$BASE/reports/by-category"
fi

# ── E. 工单 CRUD + 流程 ──
if [ "$MODE" = "all" ] || [ "$MODE" = "--crud" ] || [ "$MODE" = "--quick" ]; then
echo "━━━ E. 工单管理 CRUD + 审批流程 ━━━"
t "E1 工单列表" GET "$BASE/workorders"
t "E2 工单详情" GET "$BASE/workorders/$WOID"
t "E3 更新工单" PUT "$BASE/workorders/$WOID" '{"title":"工单-已更新"}'
t "E4 提交工单" POST "$BASE/workorders/$WOID/submit"
t "E5 审批通过" POST "$BASE/workorders/$WOID/approve" '{"comment":"测试通过"}'
t "E6 审批列表" GET "$BASE/approvals/list"
t "E7 待审批" GET "$BASE/approvals/pending"
t "E8 待审批数" GET "$BASE/approvals/pending/count"
fi

# ── F. 盘点/退役/处置 ──
if [ "$MODE" = "all" ] || [ "$MODE" = "--crud" ]; then
echo "━━━ F. 盘点 · 退役 · 处置 ━━━"
t "F1 盘点任务" GET "$BASE/inventory/tasks"
t "F2 退役列表" GET "$BASE/retirement/list"
t "F3 我的申请" GET "$BASE/retirement/my-applications"
t "F4 处置历史" GET "$BASE/disposals/history"
fi

# ── G. 闲置资产 CRUD ──
if [ "$MODE" = "all" ] || [ "$MODE" = "--crud" ]; then
echo "━━━ G. 闲置资产 CRUD ━━━"
t "G1 闲置列表" GET "$BASE/idle-assets/list"
t "G2 取消公告" PUT "$BASE/idle-assets/$IID/cancel"
t "G3 删除公告" DELETE "$BASE/idle-assets/$IID"
fi

# ── H. 供应商 CRUD ──
if [ "$MODE" = "all" ] || [ "$MODE" = "--crud" ]; then
echo "━━━ H. 供应商管理 CRUD ━━━"
t "H1 供应商列表" GET "$BASE/vendors/list"
t "H2 供应商详情" GET "$BASE/vendors/$VID"
t "H3 更新供应商" PUT "$BASE/vendors/$VID" '{"name":"供应商-已更新"}'
t "H4 删除供应商" DELETE "$BASE/vendors/$VID"
fi

# ── I. 地点 CRUD ──
if [ "$MODE" = "all" ] || [ "$MODE" = "--crud" ]; then
echo "━━━ I. 存放地点 CRUD ━━━"
t "I1 地点列表" GET "$BASE/locations/list"
t "I2 地点详情" GET "$BASE/locations/$LID"
t "I3 更新地点" PUT "$BASE/locations/$LID" '{"name":"地点-已更新"}'
t "I4 删除地点" DELETE "$BASE/locations/$LID"
fi

# ── J. 部门 CRUD ──
if [ "$MODE" = "all" ] || [ "$MODE" = "--crud" ]; then
echo "━━━ J. 部门管理 CRUD ━━━"
t "J1 部门列表" GET "$BASE/depts/list"
t "J2 部门树" GET "$BASE/depts/tree"
t "J3 部门详情" GET "$BASE/depts/$DID"
t "J4 更新部门" PUT "$BASE/depts/$DID" '{"name":"部门-已更新"}'
t "J5 删除部门" DELETE "$BASE/depts/$DID"
fi

# ── K. 用户 CRUD ──
if [ "$MODE" = "all" ] || [ "$MODE" = "--crud" ] || [ "$MODE" = "--quick" ]; then
echo "━━━ K. 用户管理 CRUD ━━━"
t "K1 用户列表" GET "$BASE/user-management/list"
t "K2 用户搜索" GET "$BASE/user-management/search?keyword=admin"
t "K3 用户详情" GET "$BASE/user-management/1"
t "K4 用户角色" GET "$BASE/user-management/1/roles"
t "K5 更新用户" PUT "$BASE/user-management/$USERID" '{"realName":"用户-已更新"}'
t "K6 删除用户" DELETE "$BASE/user-management/$USERID"
fi

# ── L. 角色 CRUD ──
if [ "$MODE" = "all" ] || [ "$MODE" = "--crud" ]; then
echo "━━━ L. 角色管理 CRUD ━━━"
t "L1 角色列表" GET "$BASE/roles/list"
t "L2 所有角色" GET "$BASE/roles/all"
t "L3 角色详情" GET "$BASE/roles/1"
t "L4 更新角色" PUT "$BASE/roles/$RID" '{"roleName":"角色-已更新"}'
t "L5 删除角色" DELETE "$BASE/roles/$RID"
fi

# ── M. 维保 CRUD ──
if [ "$MODE" = "all" ] || [ "$MODE" = "--crud" ]; then
echo "━━━ M. 维保管理 CRUD ━━━"
t "M1 维保列表" GET "$BASE/maintenance/list"
t "M2 即将维保" GET "$BASE/maintenance/upcoming"
t "M3 维保详情" GET "$BASE/maintenance/$MID"
t "M4 更新维保" PUT "$BASE/maintenance/$MID" '{"content":"维保-已更新"}'
t "M5 删除维保" DELETE "$BASE/maintenance/$MID"
fi

# ── N. 其他模块 ──
if [ "$MODE" = "all" ] || [ "$MODE" = "--crud" ] || [ "$MODE" = "--quick" ]; then
echo "━━━ N. 其他模块 ━━━"
t "N1 折旧计划" GET "$BASE/depreciation/schedules"
t "N2 计算折旧" POST "$BASE/depreciation/calculate" '{"assetIds":[1]}'
t "N3 折旧历史" GET "$BASE/assets/$AID/depreciation-schedule"
t "N4 审计日志" GET "$BASE/audit-logs"
t "N5 审计统计" GET "$BASE/audit-logs/count"
t "N6 审计趋势" GET "$BASE/audit-logs/trends"
t "N7 待处理通知" GET "$BASE/notifications/pending"
t "N8 通知数量" GET "$BASE/notifications/pending/count"
t "N9 工作流列表" GET "$BASE/workflows"
t "N10 赔偿列表" GET "$BASE/compensation/list"
t "N11 统计概览" GET "$BASE/stats/overview"
fi

# ====================================================================
# 第三部分：业务逻辑深度测试
# ====================================================================
if [ "$MODE" = "all" ] || [ "$MODE" = "--biz" ]; then

echo ""

# 数据准备完成后等待，降低突发速率避免触发限流
sleep 0.3
echo "╔════════════════════════════════════════╗"
echo "║  业务逻辑深度测试                      ║"
echo "╚════════════════════════════════════════╝"
echo ""

# 数据准备完成后等待，降低突发速率避免触发限流
sleep 0.3

# ── 测试1: 跨模块数据一致性 ──
echo "━━━ 测试1: 跨模块数据一致性 ━━━"
echo "  场景: A模块创建的数据，在B模块能否查到"

t "1a 创建资产后列表可查" GET "$BASE/assets"
check_text "1a-确认名称可见" "测试资产"
t "1b 创建供应商后列表可查" GET "$BASE/vendors/list"
check_text "1b-确认供应商可见" "测试供应商"
t "1c 创建部门后树可见" GET "$BASE/depts/tree"
check_text "1c-确认部门在树中" "测试部门"
t "1d 创建分类后树可见" GET "$BASE/categories/tree"
check_text "1d-确认分类在树中" "测试分类"
echo ""

# 数据准备完成后等待，降低突发速率避免触发限流
sleep 0.3

# ── 测试2: 数据关联完整性 ──
echo "━━━ 测试2: 数据关联完整性 ━━━"
echo "  场景: 引用关系是否正确（工单引用资产）"

# 创建工单时引用已存在的资产
t "2a 工单引用存在的资产" POST "$BASE/workorders" '{"title":"关联测试工单","type":"MAINTENANCE","priority":"MEDIUM","assetId":'"$AID"'}'
W2ID=$(python3 -c "import sys,json;d=json.load(open('/tmp/_atest.json'));print(d.get('data',{}).get('id','') or d.get('id',''))" 2>/dev/null)
t "2b 工单详情可查到资产ID" GET "$BASE/workorders/$W2ID"
# 工单详情里应该包含 assetId
check_text "2b-确认包含资产ID" "$AID"
echo ""

# 数据准备完成后等待，降低突发速率避免触发限流
sleep 0.3

# ── 测试3: 业务流程闭环 ──
echo "━━━ 测试3: 业务流程闭环 ━━━"
echo "  场景: 创建 → 流转 → 完成，状态正确变迁"

# 闲置资产生命周期
echo "  流程: 闲置发布 → 列表出现 → 取消"
# 为业务流程测试重新创建一个闲置公告（IID 在 CRUD 阶段已被删除）
resp=$(curl -s -X POST "$BASE/assets" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"assetName":"业务流程闲置资产","assetNo":"BIZ-IDLE-'"$TS"'","categoryId":1,"status":"IDLE","deptId":1,"originalValue":5000,"useDate":"2026-01-01"}')
BIZ_IDLE_AID=$(echo "$resp" | python3 -c "import sys,json;d=json.load(sys.stdin).get('data',{});print(d.get('id',''))" 2>/dev/null)
resp=$(curl -s -X POST "$BASE/idle-assets" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"assetId":'"$BIZ_IDLE_AID"',"reason":"业务流程测试闲置"}')
IID2=$(echo "$resp" | python3 -c "import sys,json;d=json.load(sys.stdin).get('data',{});print(d.get('id',''))" 2>/dev/null)
t "3a 闲置列表可见" GET "$BASE/idle-assets/list"
t "3b 闲置取消成功" PUT "$BASE/idle-assets/$IID2/cancel"

# 工单审批流程
echo "  流程: 创建工单 → 提交 → 待审批 → 审批通过"
t "3c 提交工单" POST "$BASE/workorders/$W2ID/submit"
t "3d 待审批列表出现" GET "$BASE/approvals/pending"
t "3e 审批通过" POST "$BASE/workorders/$W2ID/approve" '{"comment":"业务测试通过"}'

# 用户管理
echo "  流程: 创建用户 → 搜索可查"
T2=$(date +%s)
resp=$(curl -s -X POST "$BASE/user-management" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"username":"biz_'"$T2"'","realName":"业务流程用户","password":"123456","deptId":1}')
UID2=$(echo "$resp" | python3 -c "import sys,json;d=json.load(sys.stdin).get('data',{});print(d.get('id',''))" 2>/dev/null)
t "3f 搜索新创建的用户" GET "$BASE/user-management/search?keyword=biz_$T2"
check_text "3f-确认用户名匹配" "biz_$T2"
echo ""

# 数据准备完成后等待，降低突发速率避免触发限流
sleep 0.3

# ── 测试4: 校验逻辑 ──
echo "━━━ 测试4: 校验逻辑 ━━━"
echo "  场景: 必填缺失 → 拦截; 重复数据 → 拦截; 边界值 → 正常"

echo "  --- 4.1 必填字段校验 ---"
t "4.1a 资产缺assetName" POST "$BASE/assets" '{"categoryId":1}' 400
t "4.1b 供应商缺name" POST "$BASE/vendors" '{"vendorCode":"FAIL"}' 400
t "4.1c 分类缺categoryName" POST "$BASE/categories" '{"categoryCode":"FAIL"}' 400
t "4.1d 用户缺username" POST "$BASE/user-management" '{"realName":"缺名用户","password":"123456"}' 400
t "4.1e 维保缺assetId" POST "$BASE/maintenance" '{"maintenanceType":"REGULAR"}' 400

echo "  --- 4.2 重复数据拦截 ---"
t "4.2a 重复用户名" POST "$BASE/user-management" '{"username":"admin","realName":"同名用户","password":"123456"}' 400

echo "  --- 4.3 边界值 ---"
t "4.3a 不存在的资产ID" GET "$BASE/assets/99999" "" 400
t "4.3b 删除不存在的资产" DELETE "$BASE/assets/99999" "" 400
t "4.3c 超大pageSize" GET "$BASE/assets?pageSize=9999"
t "4.3d 空搜索关键词" GET "$BASE/assets?keyword="

fi # --biz

# ====================================================================
# 汇总
# ====================================================================
echo ""

# 数据准备完成后等待，降低突发速率避免触发限流
sleep 0.3
echo "╔════════════════════════════════════════╗"
echo "║         测试汇总                      ║"
echo "╠════════════════════════════════════════╣"
printf "║ 总测试数 %28d ║\n" $TOTAL
printf "║ ✅ 通过  %28d ║\n" $PASS
printf "║ ❌ 失败  %28d ║\n" $FAIL
if [ $TOTAL -gt 0 ]; then
  pct=$(echo "scale=1; $PASS*100/$TOTAL" | bc)
  printf "║ 通过率   %28s ║\n" "${pct}%"
fi
echo "╚════════════════════════════════════════╝"
echo ""

# 数据准备完成后等待，降低突发速率避免触发限流
sleep 0.3

if [ "$FAIL" -gt 0 ]; then
  echo "──────────────────────────────────────────"
  echo "  失败明细"
  echo "──────────────────────────────────────────"
  echo "| 测试项 | 状态码 | 错误信息 |"
  echo "|--------|--------|---------|"
  printf "$ERRORS"
  echo ""
  echo "  提示: 大多数 500 错误是后端异常，需要看日志排查"
  echo ""
fi

echo "──────────────────────────────────────────"
echo "  测试结束"
echo "  可用参数: --crud(增删改查) --biz(业务逻辑) --quick(快速冒烟)"
echo "  报告路径: /Users/feigao/project/Project/forthAMS/REAL_USER_TEST_REPORT_V3.md"
echo "──────────────────────────────────────────"
