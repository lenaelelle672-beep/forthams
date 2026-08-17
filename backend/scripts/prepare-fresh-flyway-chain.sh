#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -ne 1 ]; then
    printf '%s\n' "用法: $0 <不存在的输出目录>" >&2
    exit 64
fi

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
source_dir="$script_dir/../src/main/resources/migration"
baseline_schema="$script_dir/../src/main/resources/schema.sql"
fresh_baseline_dir="$script_dir/../src/main/resources/fresh-baseline"
output_dir="$1"

if [ ! -d "$source_dir" ]; then
    printf '%s\n' "未找到受控迁移源目录" >&2
    exit 65
fi
if [ ! -f "$baseline_schema" ]; then
    printf '%s\n' "未找到新库受控 baseline schema" >&2
    exit 65
fi
if [ ! -f "$fresh_baseline_dir/V0_1__menu_prerequisite_schema.sql" ]; then
    printf '%s\n' "未找到新库菜单基础表 prerequisite migration" >&2
    exit 65
fi
if [ -e "$output_dir" ]; then
    printf '%s\n' "输出目录必须不存在，拒绝覆盖已有内容" >&2
    exit 66
fi
if ! command -v python3 >/dev/null 2>&1; then
    printf '%s\n' "需要 Python 3 以生成并校验受控新库 migration chain" >&2
    exit 67
fi

mkdir -p "$output_dir"
touch "$output_dir/.INCOMPLETE"

python3 - "$source_dir" "$baseline_schema" "$fresh_baseline_dir" "$output_dir" <<'PY'
from pathlib import Path
import hashlib
import sys

source_dir = Path(sys.argv[1])
baseline_schema = Path(sys.argv[2])
fresh_baseline_dir = Path(sys.argv[3])
output_dir = Path(sys.argv[4])
charset_affected = {
    "V2_104__sys_tenant_append_only.sql",
    "V2_106__import_export_task_append_only.sql",
    "V2_107__handover_append_only.sql",
    "V2_108__workflow_mail_append_only.sql",
    "V2_109__doc_center_append_only.sql",
    "V2_110__tech_support_append_only.sql",
}
reserved_identifier_affected = {
    "V2_87__form_storage_append_only.sql": (
        b"    sensitive TINYINT DEFAULT 0,",
        b"    `sensitive` TINYINT DEFAULT 0,",
    ),
    "V2_89__todo_field_config_append_only.sql": (
        b"    sensitive TINYINT DEFAULT 0,",
        b"    `sensitive` TINYINT DEFAULT 0,",
    ),
}
unsupported_create_index_affected = {
    "V2_94__notification_template_append_only.sql": 2,
    "V2_95__mail_template_append_only.sql": 3,
    "V2_96__mail_log_append_only.sql": 3,
    "V2_97__custom_field_append_only.sql": 3,
    "V2_98__custom_fieldset_append_only.sql": 5,
    "V2_99__notification_preference_append_only.sql": 2,
    "V2_100__channel_config_append_only.sql": 2,
    "V2_101__notification_switch_append_only.sql": 2,
}
files = sorted(source_dir.glob("V*.sql"))
if not files:
    raise SystemExit("未找到版本化迁移文件")
source_names = {path.name for path in files}
if charset_affected - source_names:
    raise SystemExit("历史 utf4mb4 修复目标不完整")
if set(reserved_identifier_affected) - source_names:
    raise SystemExit("历史 sensitive 保留字修复目标不完整")
if set(unsupported_create_index_affected) - source_names:
    raise SystemExit("历史 CREATE INDEX IF NOT EXISTS 修复目标不完整")

baseline = baseline_schema.read_bytes()
menu_prerequisite = fresh_baseline_dir.joinpath("V0_1__menu_prerequisite_schema.sql")
menu_prerequisite_bytes = menu_prerequisite.read_bytes()
fixed_schema_prefix = (
    b"CREATE DATABASE IF NOT EXISTS ams_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n"
    b"USE ams_db;\n"
)
if not baseline.startswith(fixed_schema_prefix):
    raise SystemExit("schema.sql 的固定 database selection 前缀发生变化，拒绝生成 staged baseline")
staged_baseline = baseline[len(fixed_schema_prefix):]
(output_dir / menu_prerequisite.name).write_bytes(menu_prerequisite_bytes)
(output_dir / "V1_0__baseline_schema.sql").write_bytes(staged_baseline)
manifest_rows = ["source_file\tstaged_file\tsource_sha256\tstaged_sha256\tstaged_correction"]
manifest_rows.append("\t".join((
    "fresh-baseline/" + menu_prerequisite.name,
    menu_prerequisite.name,
    hashlib.sha256(menu_prerequisite_bytes).hexdigest(),
    hashlib.sha256(menu_prerequisite_bytes).hexdigest(),
    "none",
)))
manifest_rows.append("\t".join((
    baseline_schema.name,
    "V1_0__baseline_schema.sql",
    hashlib.sha256(baseline).hexdigest(),
    hashlib.sha256(staged_baseline).hexdigest(),
    "remove-fixed-schema-selection",
)))
for source in files:
    original = source.read_bytes()
    typo_count = original.count(b"utf4mb4")
    corrections = []
    if source.name in charset_affected:
        if typo_count != 1:
            raise SystemExit(f"{source.name} 的预期 utf4mb4 数量异常: {typo_count}")
        staged = original.replace(b"utf4mb4", b"utf8mb4")
        corrections.append("utf4mb4-to-utf8mb4")
    else:
        if typo_count != 0:
            raise SystemExit(f"未经批准的 utf4mb4 出现在 {source.name}")
        staged = original
    reserved_identifier = reserved_identifier_affected.get(source.name)
    unquoted_sensitive_count = original.count(b"\n    sensitive TINYINT DEFAULT 0,")
    if reserved_identifier:
        unquoted, quoted = reserved_identifier
        if unquoted_sensitive_count != 1 or original.count(unquoted) != 1:
            raise SystemExit(f"{source.name} 的预期 sensitive 保留字数量异常: {unquoted_sensitive_count}")
        if original.count(quoted) != 0:
            raise SystemExit(f"{source.name} 已包含预期之外的 quoted sensitive 列")
        staged = staged.replace(unquoted, quoted)
        corrections.append("quote-sensitive-identifier")
    elif unquoted_sensitive_count != 0:
        raise SystemExit(f"未经批准的 sensitive 保留字出现在 {source.name}")
    create_index_if_not_exists_count = original.count(b"CREATE INDEX IF NOT EXISTS ")
    expected_create_index_count = unsupported_create_index_affected.get(source.name)
    if expected_create_index_count is not None:
        if create_index_if_not_exists_count != expected_create_index_count:
            raise SystemExit(
                f"{source.name} 的预期 CREATE INDEX IF NOT EXISTS 数量异常: {create_index_if_not_exists_count}")
        staged = staged.replace(b"CREATE INDEX IF NOT EXISTS ", b"CREATE INDEX ")
        corrections.append("remove-create-index-if-not-exists")
    elif create_index_if_not_exists_count != 0:
        raise SystemExit(f"未经批准的 CREATE INDEX IF NOT EXISTS 出现在 {source.name}")
    correction = ";".join(corrections) if corrections else "none"
    if b"utf4mb4" in staged:
        raise SystemExit(f"staged chain 仍包含 utf4mb4: {source.name}")
    if source.name in reserved_identifier_affected and b"\n    sensitive TINYINT DEFAULT 0," in staged:
        raise SystemExit(f"staged chain 仍包含未引用 sensitive 保留字: {source.name}")
    if source.name in unsupported_create_index_affected and b"CREATE INDEX IF NOT EXISTS " in staged:
        raise SystemExit(f"staged chain 仍包含 MySQL 不支持的 CREATE INDEX IF NOT EXISTS: {source.name}")
    (output_dir / source.name).write_bytes(staged)
    manifest_rows.append("\t".join((
        source.name,
        source.name,
        hashlib.sha256(original).hexdigest(),
        hashlib.sha256(staged).hexdigest(),
        correction,
    )))

(output_dir / "MANIFEST.tsv").write_text(
    "# 仅供空新库的受控 staged Flyway chain；不得替换已部署 migration 文件或 checksum。\n"
    + "\n".join(manifest_rows) + "\n",
    encoding="utf-8",
)
PY

rm "$output_dir/.INCOMPLETE"
printf '%s\n' "已生成经校验的新库 staged migration chain；请由 DBA 审核 MANIFEST.tsv 后执行只读 preflight。"
