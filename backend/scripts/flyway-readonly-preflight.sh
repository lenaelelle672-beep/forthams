#!/usr/bin/env bash

set -euo pipefail
set +x

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=flyway-approved-target.sh
source "$script_dir/flyway-approved-target.sh"
trap approved_release_cleanup EXIT HUP INT TERM

initialize_approved_release_workspace
load_approved_flyway_target
verify_mysql_defaults_target
verify_fresh_schema_target
verify_staged_manifest

mysql_bin="$(resolve_approved_command "${MYSQL_BIN:-mysql}" "mysql")"
flyway_bin="$(resolve_approved_command "${FLYWAY_BIN:-flyway}" "Flyway")"
run_approved_fresh_schema_preflight "$mysql_bin" "$flyway_bin"

printf '%s\n' "只读 Flyway 新库 preflight 完成；已用白名单临时配置和只读受保护 staged 快照校验 host/port/schema/TLS、无 history 且无业务表。本脚本从不执行 migrate、repair 或任何 DDL。"
