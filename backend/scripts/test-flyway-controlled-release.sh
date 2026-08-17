#!/usr/bin/env bash

set -euo pipefail
set +x

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/forthams-flyway-test.XXXXXX")"

cleanup() {
    local status="$?"
    chmod -R u+w "$test_root" >/dev/null 2>&1 || true
    rm -rf -- "$test_root"
    trap - EXIT
    exit "$status"
}
trap cleanup EXIT HUP INT TERM

python3 - "$test_root" <<'PY'
import hashlib
import os
import sys
from pathlib import Path


root = Path(sys.argv[1])
staged = root / "staged"
bin_dir = root / "bin"
records = root / "records"
staged.mkdir(mode=0o700)
bin_dir.mkdir(mode=0o700)
records.mkdir(mode=0o700)

sql_name = "V1_0__baseline.sql"
sql = b"CREATE TABLE test_table (id INT);\n"
(staged / sql_name).write_bytes(sql)
manifest = (
    "source_file\tstaged_file\tsource_sha256\tstaged_sha256\tstaged_correction\n"
    f"schema.sql\t{sql_name}\t{'0' * 64}\t{hashlib.sha256(sql).hexdigest()}\tnone\n"
).encode("utf-8")
(staged / "MANIFEST.tsv").write_bytes(manifest)
for path in (staged, staged / sql_name, staged / "MANIFEST.tsv"):
    os.chmod(path, 0o700 if path == staged else 0o600)

flyway_config = root / "flyway-source.conf"
flyway_config.write_text(
    "flyway.url=jdbc:mysql://db.example.test:3306/ams_test?sslMode=VERIFY_IDENTITY\n"
    "flyway.user=test-user\n"
    "flyway.password=test-password\n",
    encoding="utf-8",
)
mysql_defaults = root / "mysql-source.cnf"
mysql_defaults.write_text(
    "[client]\n"
    "host=db.example.test\n"
    "port=3306\n"
    "database=ams_test\n"
    "ssl-mode=VERIFY_IDENTITY\n"
    "user=test-user\n"
    "password=test-password\n",
    encoding="utf-8",
)
os.chmod(flyway_config, 0o600)
os.chmod(mysql_defaults, 0o600)

mysql_record = records / "mysql.args"
flyway_record = records / "flyway.args"
mysql = bin_dir / "mysql"
mysql.write_text(
    "#!/usr/bin/env bash\n"
    "set -eu\n"
    "case \"${1:-}\" in --defaults-file=*) ;; *) exit 91 ;; esac\n"
    f"printf '%s\\n' \"$@\" >> {str(mysql_record)!r}\n"
    f"printf '%s\\n' '--END--' >> {str(mysql_record)!r}\n"
    "printf '%s\\n' 0\n",
    encoding="utf-8",
)
flyway = bin_dir / "flyway"
flyway.write_text(
    "#!/usr/bin/env bash\n"
    "set -eu\n"
    f"printf '%s\\n' \"$@\" >> {str(flyway_record)!r}\n"
    f"printf '%s\\n' '--END--' >> {str(flyway_record)!r}\n",
    encoding="utf-8",
)
os.chmod(mysql, 0o700)
os.chmod(flyway, 0o700)

(root / "manifest.sha256").write_text(hashlib.sha256(manifest).hexdigest(), encoding="utf-8")
PY

approved_manifest_hash="$(python3 - "$test_root/manifest.sha256" <<'PY'
import sys
from pathlib import Path
print(Path(sys.argv[1]).read_text(encoding="utf-8"), end="")
PY
)"

run_preflight() {
    APPROVED_FLYWAY_CONFIG="$test_root/flyway-source.conf" \
    MYSQL_DEFAULTS_FILE="$test_root/mysql-source.cnf" \
    STAGED_MIGRATION_DIR="$test_root/staged" \
    APPROVED_STAGED_MANIFEST_SHA256="$approved_manifest_hash" \
    FRESH_SCHEMA_NAME="ams_test" \
    MYSQL_BIN="$test_root/bin/mysql" \
    FLYWAY_BIN="$test_root/bin/flyway" \
    bash "$script_dir/flyway-readonly-preflight.sh"
}

run_dba_migrate() {
    APPROVED_FLYWAY_CONFIG="$test_root/flyway-source.conf" \
    MYSQL_DEFAULTS_FILE="$test_root/mysql-source.cnf" \
    STAGED_MIGRATION_DIR="$test_root/staged" \
    APPROVED_STAGED_MANIFEST_SHA256="$approved_manifest_hash" \
    FRESH_SCHEMA_NAME="ams_test" \
    MYSQL_BIN="$test_root/bin/mysql" \
    FLYWAY_BIN="$test_root/bin/flyway" \
    DBA_RELEASE_AUTHORIZATION="approved-fresh-schema-migrate" \
    DBA_CHANGE_TICKET="TEST-1" \
    bash "$script_dir/flyway-dba-migrate.sh"
}

run_preflight >"$test_root/preflight.out" 2>"$test_root/preflight.err"
run_dba_migrate >"$test_root/migrate.out" 2>"$test_root/migrate.err"

python3 - "$test_root" <<'PY'
import sys
from pathlib import Path


root = Path(sys.argv[1])
raw_defaults = str(root / "mysql-source.cnf")
raw_config = str(root / "flyway-source.conf")
raw_staged = str(root / "staged")
password = "test-password"

for output in (root / "preflight.out", root / "preflight.err", root / "migrate.out", root / "migrate.err"):
    if password in output.read_text(encoding="utf-8"):
        raise SystemExit("脚本输出泄露了测试密码")

mysql_arguments = (root / "records" / "mysql.args").read_text(encoding="utf-8")
if raw_defaults in mysql_arguments or "--defaults-extra-file" in mysql_arguments:
    raise SystemExit("mysql 未使用受控临时 defaults")
if "--defaults-file=" not in mysql_arguments:
    raise SystemExit("mysql 未显式使用受控 defaults-file")

chunks = (root / "records" / "flyway.args").read_text(encoding="utf-8").split("--END--\n")
invocations = [chunk.splitlines() for chunk in chunks if chunk]
if len(invocations) != 5:
    raise SystemExit("预检和 migrate 未执行预期的 Flyway 调用数")
locations = []
commands = []
for invocation in invocations:
    if any(raw_config in argument or raw_staged in argument for argument in invocation):
        raise SystemExit("Flyway 接收了原始配置或 staged 目录")
    config = [argument for argument in invocation if argument.startswith("-configFiles=")]
    location = [argument for argument in invocation if argument.startswith("-locations=filesystem:")]
    if len(config) != 1 or len(location) != 1:
        raise SystemExit("Flyway 未使用受控临时配置和快照")
    locations.append(location[0])
    commands.append(invocation[-1])
if commands != ["info", "validate", "info", "validate", "migrate"]:
    raise SystemExit("Flyway 命令顺序不符合预检后迁移要求")
if len(set(locations[2:])) != 1:
    raise SystemExit("DBA preflight 与 migrate 没有复用同一受保护快照")
PY

python3 - "$test_root/mysql-source.cnf" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
path.write_text(path.read_text(encoding="utf-8") + "init-command=SELECT 1\n", encoding="utf-8")
PY
if run_preflight >"$test_root/rejected.out" 2>"$test_root/rejected.err"; then
    printf '%s\n' "含 init-command 的 MySQL defaults 未被拒绝" >&2
    exit 1
fi
if ! python3 - "$test_root/rejected.out" "$test_root/rejected.err" <<'PY'
import sys
from pathlib import Path
if any("test-password" in Path(name).read_text(encoding="utf-8") for name in sys.argv[1:]):
    raise SystemExit(1)
PY
then
    printf '%s\n' "拒绝未批准 defaults 时泄露了测试密码" >&2
    exit 1
fi

python3 - "$test_root/mysql-source.cnf" <<'PY'
import sys
from pathlib import Path

Path(sys.argv[1]).write_text(
    "[client]\nhost=db.example.test\nport=3306\ndatabase=ams_test\nssl-mode=VERIFY_IDENTITY\n"
    "user=test-user\npassword=test-password\n",
    encoding="utf-8",
)
PY
chmod 777 "$test_root/staged"
if run_preflight >"$test_root/unsafe-path.out" 2>"$test_root/unsafe-path.err"; then
    printf '%s\n' "组/其他用户可写的 staged 目录未被拒绝" >&2
    exit 1
fi
if ! python3 - "$test_root/unsafe-path.out" "$test_root/unsafe-path.err" <<'PY'
import sys
from pathlib import Path
if any("test-password" in Path(name).read_text(encoding="utf-8") for name in sys.argv[1:]):
    raise SystemExit(1)
PY
then
    printf '%s\n' "拒绝不安全 staged 路径时泄露了测试密码" >&2
    exit 1
fi

printf '%s\n' "Flyway 受控发布脚本测试通过"
