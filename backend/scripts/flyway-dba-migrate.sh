#!/usr/bin/env bash

set -euo pipefail
set +x

if [ "${DBA_RELEASE_AUTHORIZATION:-}" != "approved-fresh-schema-migrate" ]; then
    printf '%s\n' "缺少 DBA 明确执行授权，拒绝执行 Flyway migrate" >&2
    exit 64
fi
if [ -z "${DBA_CHANGE_TICKET:-}" ]; then
    printf '%s\n' "缺少 DBA_CHANGE_TICKET，拒绝执行 Flyway migrate" >&2
    exit 64
fi

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=flyway-approved-target.sh
source "$script_dir/flyway-approved-target.sh"

# migrate 与 preflight 都从同一批准 Flyway 配置解析目标，并将 host/port/schema/TLS
# 与 DBA defaults 强制比较。同一进程的 preflight 和 migrate 共用同一只读快照，避免
# 两阶段之间原始配置或 staged 文件被替换。
trap approved_release_cleanup EXIT HUP INT TERM
initialize_approved_release_workspace
load_approved_flyway_target
verify_mysql_defaults_target
verify_fresh_schema_target
verify_staged_manifest

mysql_bin="$(resolve_approved_command "${MYSQL_BIN:-mysql}" "mysql")"
flyway_bin="$(resolve_approved_command "${FLYWAY_BIN:-flyway}" "Flyway")"
run_approved_fresh_schema_preflight "$mysql_bin" "$flyway_bin"
run_approved_flyway "$flyway_bin" migrate

printf '%s\n' "DBA 受控 Flyway migrate 已返回；迁移和 preflight 均使用同一白名单临时配置和受保护 staged 快照，并强制 sslMode=VERIFY_IDENTITY。请由 DBA 使用只读 info/validate 和 schema 查询归档变更单证据。"
