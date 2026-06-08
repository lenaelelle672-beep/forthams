#!/usr/bin/env bash
#
# forthAMS 测试恢复脚本
# 在你本地仓库根目录运行（沙箱因权限/锁无法执行 git mv / rm）。
# 前提：.git/index.lock 已释放（关闭占用 git 的进程，如 IDE/GitNexus/husky）。
#
# 用法：
#   bash scripts/recover-tests-wave1.sh wave1     # 默认：删重复 + 搬迁 20 个 service/enum 测试
#   bash scripts/recover-tests-wave1.sh wave2      # 仅在 wave1 验证通过后再跑：搬迁 27 个 EASY controller
#
set -euo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"   # 仓库根
EX=backend/src/test/java-excluded
DST=backend/src/test/java
[ -d "$EX" ] || { echo "找不到 $EX，请在仓库根运行"; exit 1; }

mv_one() {  # $1 = 相对 com/ams/ 的路径（不含 .java）
  local s="$EX/com/ams/$1.java" d="$DST/com/ams/$1.java"
  if [ -f "$s" ]; then mkdir -p "$(dirname "$d")"; git mv "$s" "$d" && echo "  mv  $1"; \
  else echo "  -- 跳过（不存在）：$1"; fi
}

wave1() {
  echo "== 1) 删除 8 个重复/被取代副本 =="
  for n in SchemaCoverageTest FloorPlanServiceTest LocationServiceTest NotificationServiceTest \
           DoubleDecliningBalanceDepreciationTest JwtUtilTest \
           WorkflowDefinitionControllerTest WorkflowDefinitionServiceTest; do
    f=$(find "$EX" -name "$n.java" 2>/dev/null || true)
    [ -n "$f" ] && git rm -q "$f" && echo "  rm  $f" || true
  done

  echo "== 2) 搬迁 20 个 service/enum 测试（内容已就绪）=="
  for rel in \
    service/AssetCategoryServiceTest service/AssetLifecycleServiceTest service/AuthServiceTest \
    service/CompensationServiceTest service/DashboardServiceTest service/DisposalServiceTest \
    service/GraphifyServiceTest service/IdleAssetServiceTest service/IntakeOrderServiceTest \
    service/MaintenanceExecutionServiceTest service/UserManagementServiceTest \
    service/ABCClassificationServiceTest service/ApprovalServiceTest service/EnergyServiceTest \
    service/TenantServiceTest service/AssetServiceTest service/RetirementApplicationServiceTest \
    service/WorkOrderServiceTest service/impl/BusinessCommentServiceImplTest enums/AssetStatusTest; do
    mv_one "$rel"
  done

  cat <<'EOF'

== 3) 验证（务必跑）==
  cd backend
  mvn -q test-compile
  mvn -q -Dtest='*ServiceTest,AssetStatusTest' test

  绿了再继续 wave2。若个别红：按编译器/失败信息微调；
  service 单测多为运行期问题（缺 mock/断言），照 docs/TEST_RECOVERY_PLAN.md 第 4-5 节处理。
EOF
}

wave2() {
  echo "!! 仅在 Wave 1 编译并通过后再运行 !!  (Ctrl-C 取消，5s 后继续)"; sleep 5
  echo "== A) 去除 27 个 EASY controller 的过时 @Disabled 并搬迁 =="
  for n in Approval AssetCategory Asset AuditDashboard Auth BigScreen BusinessComment Compensation \
           Dashboard Depreciation Dept Disposal Energy FloorPlan IdleAsset Location Maintenance \
           MaintenanceExecution NotificationPreference Report Retirement Role Stats SystemHealth \
           UserManagement Vendor WorkOrder; do
    f="$EX/com/ams/controller/${n}ControllerTest.java"
    if [ -f "$f" ]; then sed -i.bak '/@Disabled(/d' "$f" && rm -f "$f.bak"; mv_one "controller/${n}ControllerTest"; fi
  done

  echo "== B) 移除 surefire 的 controller 排除 =="
  sed -i.bak '/<exclude>\*\*\/controller\/\*\*\/\*Test.java<\/exclude>/d' backend/pom.xml && rm -f backend/pom.xml.bak
  echo "  已移除 **/controller/** 排除"

  cat <<'EOF'

== C) 仍需手工处理（见 docs/TEST_RECOVERY_PLAN.md 第 4 节）==
  · InventoryControllerTest      —— 一行：mock submitTask(7L) 取代 updateTaskStatus(7L,"SUBMITTED")
  · NotificationControllerTest   —— 一行：断言 isRead 用 .value(0) 取代 .value(false)
  · SafetyChecklistControllerTest—— @WebMvcTest 改 @SpringBootTest+addFilters=false
  · UserSearchControllerTest     —— 多租户重构：mock AssetService + 设 TenantContext + verify searchUsersByDepts

== D) 验证 ==
  cd backend && mvn -q test-compile && mvn -q -Dtest='*ControllerTest' test
EOF
}

case "${1:-wave1}" in
  wave1) wave1 ;;
  wave2) wave2 ;;
  *) echo "用法: $0 [wave1|wave2]"; exit 1 ;;
esac
