#!/usr/bin/env bash

# 受控 Flyway 发布脚本共用的目标解析与 fail-closed 校验。不得单独执行。
# 仅在私有临时快照中保存已清洗的连接配置和 staged SQL；不得把原始配置或 staged
# 目录交给 mysql/Flyway，避免 defaults、init command 或路径替换改变实际执行内容。

APPROVED_RELEASE_WORKSPACE=""
APPROVED_FLYWAY_CONTROLLED_CONFIG=""
APPROVED_MYSQL_CONTROLLED_DEFAULTS_FILE=""
APPROVED_STAGED_SNAPSHOT_DIR=""
APPROVED_FLYWAY_HOST=""
APPROVED_FLYWAY_PORT=""
APPROVED_FLYWAY_SCHEMA=""
APPROVED_FLYWAY_TLS=""

approved_target_fail() {
    printf '%s\n' "$1" >&2
    exit "${2:-66}"
}

require_approved_env() {
    local name="$1"
    if [ -z "${!name:-}" ]; then
        approved_target_fail "缺少必需环境变量: ${name}" 64
    fi
}

require_approved_command() {
    local command_name="$1"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        approved_target_fail "未找到必需命令: ${command_name}" 67
    fi
}

canonicalize_approved_path() {
    local path="$1"
    require_approved_command python3
    if ! python3 - "$path" <<'PY'
import os
import sys
from pathlib import Path


path = Path(sys.argv[1])
if not path.is_absolute():
    raise SystemExit(2)
try:
    print(path.resolve(strict=True))
except OSError:
    raise SystemExit(2)
PY
    then
        approved_target_fail "路径必须存在且可解析为绝对受控路径" 66
    fi
}

verify_owned_path() {
    local path="$1"
    local expected_type="$2"
    local private_mode="$3"
    local label="$4"

    require_approved_command python3
    if ! python3 - "$path" "$expected_type" "$private_mode" <<'PY'
import os
import stat
import sys
from pathlib import Path


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(2)


path = Path(sys.argv[1])
expected_type = sys.argv[2]
private_mode = sys.argv[3] == "private"
if not path.is_absolute():
    fail("路径必须为绝对路径")

current = Path(path.anchor)
try:
    os.lstat(current)
    for part in path.parts[1:]:
        current /= part
        if stat.S_ISLNK(os.lstat(current).st_mode):
            fail("路径不得包含符号链接")
    st = os.lstat(path)
except OSError:
    fail("路径不存在或无法安全访问")

if st.st_uid != os.geteuid():
    fail("路径必须由执行 DBA 拥有")
if st.st_mode & 0o022:
    fail("路径不得允许组或其他用户写入")
if private_mode and st.st_mode & 0o077:
    fail("敏感配置仅允许所有者访问")
if expected_type == "file" and not stat.S_ISREG(st.st_mode):
    fail("路径必须是常规文件")
if expected_type == "directory" and not stat.S_ISDIR(st.st_mode):
    fail("路径必须是常规目录")
PY
    then
        approved_target_fail "${label} 的所有权、权限或路径不受信任" 66
    fi
}

initialize_approved_release_workspace() {
    if [ -n "$APPROVED_RELEASE_WORKSPACE" ]; then
        return
    fi
    require_approved_command python3
    local temporary_root="${TMPDIR:-/tmp}"
    case "$temporary_root" in
        /*) ;;
        *) approved_target_fail "TMPDIR 必须为绝对路径" 66 ;;
    esac
    temporary_root="$(canonicalize_approved_path "$temporary_root")"
    if [ ! -d "$temporary_root" ] || [ -L "$temporary_root" ]; then
        approved_target_fail "TMPDIR 不可用或不是常规目录" 66
    fi
    umask 077
    APPROVED_RELEASE_WORKSPACE="$(mktemp -d "${temporary_root%/}/forthams-flyway.XXXXXX")" \
        || approved_target_fail "无法创建受控 Flyway 临时工作目录" 66
    if ! chmod 700 "$APPROVED_RELEASE_WORKSPACE"; then
        approved_target_fail "无法保护 Flyway 临时工作目录" 66
    fi
    verify_owned_path "$APPROVED_RELEASE_WORKSPACE" directory private "Flyway 临时工作目录"
    if ! mkdir "$APPROVED_RELEASE_WORKSPACE/home"; then
        approved_target_fail "无法初始化 Flyway 临时工作目录" 66
    fi
    if ! chmod 700 "$APPROVED_RELEASE_WORKSPACE/home"; then
        approved_target_fail "无法保护 Flyway 临时 home 目录" 66
    fi
}

approved_release_cleanup() {
    if [ -n "$APPROVED_RELEASE_WORKSPACE" ] && [ -d "$APPROVED_RELEASE_WORKSPACE" ]; then
        chmod -R u+w "$APPROVED_RELEASE_WORKSPACE" >/dev/null 2>&1 || true
        rm -rf -- "$APPROVED_RELEASE_WORKSPACE"
    fi
    APPROVED_RELEASE_WORKSPACE=""
    APPROVED_FLYWAY_CONTROLLED_CONFIG=""
    APPROVED_MYSQL_CONTROLLED_DEFAULTS_FILE=""
    APPROVED_STAGED_SNAPSHOT_DIR=""
}

resolve_approved_command() {
    local configured_command="$1"
    local label="$2"
    local resolved_command

    if [ -z "$configured_command" ]; then
        approved_target_fail "${label} 命令不能为空" 67
    fi
    case "$configured_command" in
        /*) resolved_command="$configured_command" ;;
        *) resolved_command="$(command -v "$configured_command" 2>/dev/null || true)" ;;
    esac
    if [ -z "$resolved_command" ]; then
        approved_target_fail "未找到必需命令: ${configured_command}" 67
    fi
    resolved_command="$(canonicalize_approved_path "$resolved_command")"
    if ! python3 - "$resolved_command" <<'PY'
import os
import stat
import sys
from pathlib import Path


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(2)


path = Path(sys.argv[1])
if not path.is_absolute():
    fail("命令必须解析为绝对路径")
current = Path(path.anchor)
try:
    for part in path.parts[1:]:
        current /= part
        if stat.S_ISLNK(os.lstat(current).st_mode):
            fail("命令路径不得包含符号链接")
    st = os.lstat(path)
except OSError:
    fail("命令不存在")
if not stat.S_ISREG(st.st_mode) or not os.access(path, os.X_OK):
    fail("命令不是可执行常规文件")
if st.st_uid not in {0, os.geteuid()} or st.st_mode & 0o022:
    fail("命令的所有权或权限不安全")
PY
    then
        approved_target_fail "${label} 命令的所有权、权限或路径不受信任" 67
    fi
    printf '%s\n' "$resolved_command"
}

# 只接受批准配置中的单一标准 jdbc:mysql URL。源配置中的凭据仅被复制到 owner-only 的
# 临时 Flyway 配置；任何会影响 Flyway 行为的额外键均被拒绝，不能继承 initSql/callbacks。
load_approved_flyway_target() {
    require_approved_env APPROVED_FLYWAY_CONFIG
    initialize_approved_release_workspace
    APPROVED_FLYWAY_CONFIG="$(canonicalize_approved_path "$APPROVED_FLYWAY_CONFIG")"
    verify_owned_path "$APPROVED_FLYWAY_CONFIG" file private "经批准 Flyway 配置"

    local parsed
    if ! parsed="$(python3 - "$APPROVED_FLYWAY_CONFIG" "$APPROVED_RELEASE_WORKSPACE" <<'PY'
import os
import re
import stat
import sys
from pathlib import Path
from urllib.parse import unquote_plus, urlsplit


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(2)


def secure_read(path):
    source = Path(path)
    if not source.is_absolute():
        fail("批准 Flyway 配置路径必须为绝对路径")
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    try:
        fd = os.open(source, flags)
    except OSError:
        fail("无法安全打开批准 Flyway 配置")
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode) or st.st_uid != os.geteuid() or st.st_mode & 0o077:
            fail("批准 Flyway 配置所有权或权限不安全")
        chunks = []
        while True:
            chunk = os.read(fd, 65536)
            if not chunk:
                break
            chunks.append(chunk)
        return b"".join(chunks)
    finally:
        os.close(fd)


def decode_connector_value(value):
    for index, character in enumerate(value):
        if character == "%" and (index + 2 >= len(value) or not re.fullmatch(r"[0-9A-Fa-f]{2}", value[index + 1:index + 3])):
            fail("JDBC URL 含不合法 percent encoding")
    try:
        return unquote_plus(value, encoding="utf-8", errors="strict")
    except UnicodeDecodeError:
        fail("JDBC URL 含不合法 UTF-8 percent encoding")


def parse_connector_query(query):
    if not query or ";" in query or "?" in query:
        fail("批准 Flyway JDBC URL 查询参数不受支持")
    properties = {}
    for part in query.split("&"):
        if not part or part.count("=") != 1:
            fail("批准 Flyway JDBC URL 查询参数不明确")
        key, value = part.split("=", 1)
        key = decode_connector_value(key).strip().lower()
        value = decode_connector_value(value).strip().lower()
        if not key or key in properties:
            fail("批准 Flyway JDBC URL 含重复或空连接参数")
        if key != "sslmode" or value != "verify_identity":
            fail("批准 Flyway JDBC URL 仅允许 sslMode=VERIFY_IDENTITY")
        properties[key] = value
    return properties


def one_of(values, keys, label, required=True):
    configured = [value for key in keys for value in values[key]]
    if required and len(configured) != 1:
        fail(f"批准 Flyway 配置必须且只能包含一个 {label}")
    if len(configured) > 1:
        fail(f"批准 Flyway 配置中的 {label} 不明确")
    return configured[0] if configured else None


raw_config = secure_read(sys.argv[1])
workspace = Path(sys.argv[2])
try:
    lines = raw_config.decode("utf-8").splitlines()
except UnicodeDecodeError:
    fail("批准 Flyway 配置必须为 UTF-8 文本")

allowed = {"flyway.url", "url", "flyway.user", "user", "flyway.password", "password"}
values = {key: [] for key in allowed}
for raw_line in lines:
    line = raw_line.strip()
    if not line or line.startswith("#") or line.startswith(";"):
        continue
    if "=" not in line:
        fail("批准 Flyway 配置含不受支持的指令")
    key, value = line.split("=", 1)
    key = key.strip().lower()
    if key not in allowed:
        fail("批准 Flyway 配置含不在白名单中的键")
    value = value.strip()
    if any(character in value for character in "\r\n\x00"):
        fail("批准 Flyway 配置值不合法")
    values[key].append(value)

jdbc_url = one_of(values, ("flyway.url", "url"), "URL")
username = one_of(values, ("flyway.user", "user"), "用户名")
password = one_of(values, ("flyway.password", "password"), "密码")
if not jdbc_url or any(character in jdbc_url for character in "\r\n\x00#;"):
    fail("批准 Flyway JDBC URL 不合法")
if not jdbc_url.lower().startswith("jdbc:mysql://"):
    fail("批准 Flyway URL 必须是单主机 jdbc:mysql:// URL")
try:
    parsed = urlsplit(jdbc_url[5:])
    port = parsed.port or 3306
except ValueError:
    fail("批准 Flyway JDBC URL 端口不合法")
if parsed.scheme.lower() != "mysql" or not parsed.hostname or parsed.username is not None or parsed.password is not None:
    fail("批准 Flyway JDBC URL 必须显式指定且不得内嵌凭据")
if parsed.fragment:
    fail("批准 Flyway JDBC URL 不得包含 fragment")
host = parsed.hostname.rstrip(".").lower()
if not re.fullmatch(r"[a-z0-9.-]+|[0-9a-f:]+", host) or port < 1 or port > 65535:
    fail("批准 Flyway JDBC URL 的主机或端口不合法")
schema = decode_connector_value(parsed.path.lstrip("/"))
if not re.fullmatch(r"[A-Za-z0-9_]{1,64}", schema):
    fail("批准 Flyway JDBC URL 必须指定单一安全 schema")
parse_connector_query(parsed.query)

controlled_config = workspace / "flyway.conf"
content = ("flyway.url=" + jdbc_url + "\n"
           + "flyway.user=" + username + "\n"
           + "flyway.password=" + password + "\n"
           + "flyway.schemas=" + schema + "\n"
           + "flyway.defaultSchema=" + schema + "\n")
try:
    fd = os.open(controlled_config, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
    with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as output:
        output.write(content)
    os.chmod(controlled_config, 0o600)
except OSError:
    fail("无法创建受控 Flyway 临时配置")

print(host)
print(port)
print(schema)
print("VERIFY_IDENTITY")
PY
)"; then
        approved_target_fail "无法从批准 Flyway 配置创建受控的身份校验连接目标" 66
    fi

    local old_ifs="$IFS"
    IFS=$'\012'
    set -- $parsed
    IFS="$old_ifs"
    if [ "$#" -ne 4 ] || [ "$4" != "VERIFY_IDENTITY" ]; then
        approved_target_fail "批准 Flyway 连接事实不完整或 TLS 不是 VERIFY_IDENTITY" 66
    fi
    APPROVED_FLYWAY_HOST="$1"
    APPROVED_FLYWAY_PORT="$2"
    APPROVED_FLYWAY_SCHEMA="$3"
    APPROVED_FLYWAY_TLS="$4"
    APPROVED_FLYWAY_CONTROLLED_CONFIG="$APPROVED_RELEASE_WORKSPACE/flyway.conf"
    verify_owned_path "$APPROVED_FLYWAY_CONTROLLED_CONFIG" file private "受控 Flyway 临时配置"
}

# 原始 defaults 文件只被作为输入审计；只允许 [client] 中的连接/TLS/凭据键，并重新生成
# owner-only 临时 defaults。mysql 随后仅通过 --defaults-file 读取该临时文件。
verify_mysql_defaults_target() {
    require_approved_env MYSQL_DEFAULTS_FILE
    if [ -z "$APPROVED_FLYWAY_HOST" ] || [ -z "$APPROVED_FLYWAY_PORT" ] || [ -z "$APPROVED_FLYWAY_SCHEMA" ]; then
        approved_target_fail "必须先解析批准 Flyway 连接事实" 70
    fi
    initialize_approved_release_workspace
    MYSQL_DEFAULTS_FILE="$(canonicalize_approved_path "$MYSQL_DEFAULTS_FILE")"
    verify_owned_path "$MYSQL_DEFAULTS_FILE" file private "DBA MySQL defaults 文件"

    if ! python3 - "$MYSQL_DEFAULTS_FILE" "$APPROVED_FLYWAY_HOST" "$APPROVED_FLYWAY_PORT" \
            "$APPROVED_FLYWAY_SCHEMA" "$APPROVED_FLYWAY_TLS" "$APPROVED_RELEASE_WORKSPACE" <<'PY'
import os
import re
import stat
import sys
from pathlib import Path


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(2)


def secure_read(path):
    source = Path(path)
    if not source.is_absolute():
        fail("MySQL defaults 路径必须为绝对路径")
    try:
        fd = os.open(source, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    except OSError:
        fail("无法安全打开 MySQL defaults 文件")
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode) or st.st_uid != os.geteuid() or st.st_mode & 0o077:
            fail("MySQL defaults 所有权或权限不安全")
        content = []
        while True:
            chunk = os.read(fd, 65536)
            if not chunk:
                break
            content.append(chunk)
        return b"".join(content)
    finally:
        os.close(fd)


defaults_path, expected_host, expected_port, expected_schema, expected_tls, workspace = sys.argv[1:]
try:
    lines = secure_read(defaults_path).decode("utf-8").splitlines()
except UnicodeDecodeError:
    fail("MySQL defaults 必须为 UTF-8 文本")

allowed = {
    "host", "port", "database", "ssl-mode", "user", "password",
    "ssl-ca", "ssl-capath", "ssl-cert", "ssl-key", "ssl-crl", "ssl-crlpath",
    "ssl-cipher", "tls-version", "ssl-fips-mode",
}
values = {}
section_seen = False
for raw_line in lines:
    line = raw_line.strip()
    if not line or line.startswith("#") or line.startswith(";"):
        continue
    if line.startswith("[") and line.endswith("]"):
        if section_seen or line[1:-1].strip().lower() != "client":
            fail("MySQL defaults 仅允许单一 [client] 段")
        section_seen = True
        continue
    if not section_seen or "=" not in line:
        fail("MySQL defaults 含不受支持的指令")
    key, value = line.split("=", 1)
    key = key.strip().lower().replace("_", "-")
    value = value.strip()
    if key not in allowed or key in values:
        fail("MySQL defaults 含重复或不在白名单中的键")
    if any(character in value for character in "\r\n\x00"):
        fail("MySQL defaults 值不合法")
    values[key] = value

required = {"host", "port", "database", "ssl-mode", "user", "password"}
if not section_seen or required - values.keys():
    fail("MySQL defaults 必须在 [client] 中显式声明 host、port、database、ssl-mode、user 和 password")
host = values["host"].strip("[]").rstrip(".").lower()
if not re.fullmatch(r"[a-z0-9.-]+|[0-9a-f:]+", host):
    fail("MySQL defaults host 不合法")
if host != expected_host or values["port"] != expected_port or values["database"] != expected_schema:
    fail("MySQL defaults 与批准 Flyway 目标不一致")
if values["ssl-mode"].upper() != expected_tls:
    fail("MySQL defaults 必须使用 ssl-mode=VERIFY_IDENTITY")
if not values["user"]:
    fail("MySQL defaults 用户名不能为空")

controlled_path = Path(workspace) / "mysql.cnf"
ordered = [
    "host", "port", "database", "ssl-mode", "user", "password", "ssl-ca", "ssl-capath",
    "ssl-cert", "ssl-key", "ssl-crl", "ssl-crlpath", "ssl-cipher", "tls-version", "ssl-fips-mode",
]
content = "[client]\n" + "".join(key + "=" + values[key] + "\n" for key in ordered if key in values)
try:
    fd = os.open(controlled_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
    with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as output:
        output.write(content)
    os.chmod(controlled_path, 0o600)
except OSError:
    fail("无法创建受控 MySQL 临时 defaults 文件")
PY
    then
        approved_target_fail "MySQL defaults 与批准 Flyway 连接事实不一致或含未批准指令" 66
    fi
    APPROVED_MYSQL_CONTROLLED_DEFAULTS_FILE="$APPROVED_RELEASE_WORKSPACE/mysql.cnf"
    verify_owned_path "$APPROVED_MYSQL_CONTROLLED_DEFAULTS_FILE" file private "受控 MySQL 临时 defaults"
}

# 将已批准 manifest 与每个 staged SQL 在同一 Python 进程内重新散列、复制到私有快照，
# 再将快照设为只读。后续 Flyway 永不接收 STAGED_MIGRATION_DIR 原路径。
verify_staged_manifest() {
    require_approved_env STAGED_MIGRATION_DIR
    require_approved_env APPROVED_STAGED_MANIFEST_SHA256
    initialize_approved_release_workspace
    STAGED_MIGRATION_DIR="$(canonicalize_approved_path "$STAGED_MIGRATION_DIR")"
    verify_owned_path "$STAGED_MIGRATION_DIR" directory normal "staged migration 目录"
    if ! [[ "$APPROVED_STAGED_MANIFEST_SHA256" =~ ^[[:xdigit:]]{64}$ ]]; then
        approved_target_fail "APPROVED_STAGED_MANIFEST_SHA256 格式不合法" 66
    fi
    if ! python3 - "$STAGED_MIGRATION_DIR" "$APPROVED_STAGED_MANIFEST_SHA256" \
            "$APPROVED_RELEASE_WORKSPACE" <<'PY'
import hashlib
import os
import re
import stat
import sys
from pathlib import Path


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(2)


def open_regular(directory_fd, name, private=False):
    if "/" in name or name in {"", ".", ".."}:
        fail("staged 文件名不合法")
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    try:
        fd = os.open(name, flags, dir_fd=directory_fd)
    except OSError:
        fail("无法安全打开 staged 文件")
    st = os.fstat(fd)
    if not stat.S_ISREG(st.st_mode) or st.st_uid != os.geteuid() or st.st_mode & 0o022:
        os.close(fd)
        fail("staged 文件的所有权或权限不安全")
    if private and st.st_mode & 0o077:
        os.close(fd)
        fail("staged 快照文件权限不安全")
    return fd


def read_all(fd):
    chunks = []
    while True:
        chunk = os.read(fd, 65536)
        if not chunk:
            return b"".join(chunks)
        chunks.append(chunk)


def write_all(path, content):
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o400)
        try:
            offset = 0
            while offset < len(content):
                offset += os.write(fd, content[offset:])
        finally:
            os.close(fd)
        os.chmod(path, 0o400)
    except OSError:
        fail("无法写入受保护 staged 快照")


source = Path(sys.argv[1])
approved_hash = sys.argv[2].lower()
workspace = Path(sys.argv[3])
if not source.is_absolute() or not workspace.is_absolute():
    fail("staged 目录和临时工作目录必须为绝对路径")
try:
    directory_fd = os.open(source, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0))
except OSError:
    fail("无法安全打开 staged migration 目录")
try:
    directory_stat = os.fstat(directory_fd)
    if not stat.S_ISDIR(directory_stat.st_mode) or directory_stat.st_uid != os.geteuid() or directory_stat.st_mode & 0o022:
        fail("staged migration 目录的所有权或权限不安全")
    names = set(os.listdir(directory_fd))
    if ".INCOMPLETE" in names:
        fail("staged migration chain 尚未完成")
    manifest_fd = open_regular(directory_fd, "MANIFEST.tsv")
    try:
        manifest_bytes = read_all(manifest_fd)
    finally:
        os.close(manifest_fd)
    if hashlib.sha256(manifest_bytes).hexdigest() != approved_hash:
        fail("staged MANIFEST.tsv 指纹未获批准")
    try:
        rows = [line for line in manifest_bytes.decode("utf-8").splitlines() if line and not line.startswith("#")]
    except UnicodeDecodeError:
        fail("MANIFEST.tsv 必须为 UTF-8 文本")
    expected_header = "source_file\tstaged_file\tsource_sha256\tstaged_sha256\tstaged_correction"
    if not rows or rows[0] != expected_header:
        fail("MANIFEST.tsv 表头不受支持")
    staged_hashes = {}
    for row in rows[1:]:
        columns = row.split("\t")
        if len(columns) != 5:
            fail("MANIFEST.tsv 行格式不合法")
        _, staged_name, _, staged_hash, _ = columns
        if not re.fullmatch(r"V[0-9][A-Za-z0-9_]*__[A-Za-z0-9_]+\.sql", staged_name):
            fail("MANIFEST.tsv staged 文件名不合法")
        if staged_name in staged_hashes or not re.fullmatch(r"[0-9a-fA-F]{64}", staged_hash):
            fail("MANIFEST.tsv 含重复或不合法 staged SHA-256")
        staged_hashes[staged_name] = staged_hash.lower()
    actual_sql = {name for name in names if name.endswith(".sql")}
    if not staged_hashes or actual_sql != set(staged_hashes):
        fail("staged SQL 与 MANIFEST.tsv 必须逐项一一对应")
    if names != {"MANIFEST.tsv"} | actual_sql:
        fail("staged migration 目录含未批准文件")

    snapshot = workspace / "migrations"
    try:
        os.mkdir(snapshot, 0o700)
    except OSError:
        fail("无法创建受保护 staged 快照目录")
    write_all(snapshot / "MANIFEST.tsv", manifest_bytes)
    for staged_name, expected_file_hash in staged_hashes.items():
        source_fd = open_regular(directory_fd, staged_name)
        target = snapshot / staged_name
        try:
            target_fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o400)
            digest = hashlib.sha256()
            try:
                while True:
                    chunk = os.read(source_fd, 65536)
                    if not chunk:
                        break
                    digest.update(chunk)
                    offset = 0
                    while offset < len(chunk):
                        offset += os.write(target_fd, chunk[offset:])
            finally:
                os.close(target_fd)
            if digest.hexdigest() != expected_file_hash:
                fail("staged SQL SHA-256 与批准 manifest 不一致")
            os.chmod(target, 0o400)
        finally:
            os.close(source_fd)
    os.chmod(snapshot, 0o500)
finally:
    os.close(directory_fd)
PY
    then
        approved_target_fail "staged migration chain 的逐项 SQL hash 校验或快照保护失败" 66
    fi
    APPROVED_STAGED_SNAPSHOT_DIR="$APPROVED_RELEASE_WORKSPACE/migrations"
    verify_owned_path "$APPROVED_STAGED_SNAPSHOT_DIR" directory normal "受保护 staged 快照目录"
}

verify_protected_staged_snapshot() {
    if [ -z "$APPROVED_STAGED_SNAPSHOT_DIR" ] || [ ! -d "$APPROVED_STAGED_SNAPSHOT_DIR" ] \
            || [ -L "$APPROVED_STAGED_SNAPSHOT_DIR" ]; then
        approved_target_fail "受保护 staged 快照不可用" 66
    fi
    if ! python3 - "$APPROVED_STAGED_SNAPSHOT_DIR" "$APPROVED_STAGED_MANIFEST_SHA256" <<'PY'
import hashlib
import os
import re
import stat
import sys
from pathlib import Path


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(2)


snapshot = Path(sys.argv[1])
approved_hash = sys.argv[2].lower()
try:
    directory_fd = os.open(snapshot, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0))
except OSError:
    fail("无法安全打开 staged 快照")
try:
    directory_stat = os.fstat(directory_fd)
    if not stat.S_ISDIR(directory_stat.st_mode) or directory_stat.st_uid != os.geteuid() or directory_stat.st_mode & 0o222:
        fail("staged 快照目录的所有权或权限不安全")
    names = set(os.listdir(directory_fd))
    try:
        manifest_fd = os.open("MANIFEST.tsv", os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0), dir_fd=directory_fd)
    except OSError:
        fail("staged 快照缺少 MANIFEST.tsv")
    try:
        manifest_stat = os.fstat(manifest_fd)
        if not stat.S_ISREG(manifest_stat.st_mode) or manifest_stat.st_uid != os.geteuid() or manifest_stat.st_mode & 0o222:
            fail("staged 快照 MANIFEST.tsv 权限不安全")
        content = b""
        while True:
            chunk = os.read(manifest_fd, 65536)
            if not chunk:
                break
            content += chunk
    finally:
        os.close(manifest_fd)
    if hashlib.sha256(content).hexdigest() != approved_hash:
        fail("staged 快照 MANIFEST.tsv 指纹不匹配")
    try:
        rows = [line for line in content.decode("utf-8").splitlines() if line and not line.startswith("#")]
    except UnicodeDecodeError:
        fail("staged 快照 MANIFEST.tsv 非 UTF-8")
    header = "source_file\tstaged_file\tsource_sha256\tstaged_sha256\tstaged_correction"
    if not rows or rows[0] != header:
        fail("staged 快照 MANIFEST.tsv 表头不受支持")
    staged_hashes = {}
    for row in rows[1:]:
        columns = row.split("\t")
        if len(columns) != 5:
            fail("staged 快照 MANIFEST.tsv 行格式不合法")
        name, expected_hash = columns[1], columns[3].lower()
        if not re.fullmatch(r"V[0-9][A-Za-z0-9_]*__[A-Za-z0-9_]+\.sql", name) \
                or name in staged_hashes or not re.fullmatch(r"[0-9a-f]{64}", expected_hash):
            fail("staged 快照 MANIFEST.tsv 内容不合法")
        staged_hashes[name] = expected_hash
    if {name for name in names if name.endswith(".sql")} != set(staged_hashes):
        fail("staged 快照 SQL 与 manifest 不一致")
    if names != {"MANIFEST.tsv"} | set(staged_hashes):
        fail("staged 快照含未批准文件")
    for name, expected_hash in staged_hashes.items():
        try:
            fd = os.open(name, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0), dir_fd=directory_fd)
        except OSError:
            fail("无法安全打开 staged 快照 SQL")
        try:
            file_stat = os.fstat(fd)
            if not stat.S_ISREG(file_stat.st_mode) or file_stat.st_uid != os.geteuid() or file_stat.st_mode & 0o222:
                fail("staged 快照 SQL 权限不安全")
            digest = hashlib.sha256()
            while True:
                chunk = os.read(fd, 65536)
                if not chunk:
                    break
                digest.update(chunk)
            if digest.hexdigest() != expected_hash:
                fail("staged 快照 SQL 指纹不匹配")
        finally:
            os.close(fd)
finally:
    os.close(directory_fd)
PY
    then
        approved_target_fail "受保护 staged 快照验证失败" 66
    fi
}

verify_fresh_schema_target() {
    require_approved_env FRESH_SCHEMA_NAME
    if ! [[ "$FRESH_SCHEMA_NAME" =~ ^[A-Za-z0-9_]{1,64}$ ]]; then
        approved_target_fail "FRESH_SCHEMA_NAME 只能包含字母、数字和下划线" 66
    fi
    if [ "$FRESH_SCHEMA_NAME" != "$APPROVED_FLYWAY_SCHEMA" ]; then
        approved_target_fail "FRESH_SCHEMA_NAME 与批准 Flyway JDBC schema 不一致" 66
    fi
}

run_approved_mysql_query() {
    local mysql_bin="$1"
    local query="$2"
    if [ -z "$APPROVED_MYSQL_CONTROLLED_DEFAULTS_FILE" ]; then
        approved_target_fail "受控 MySQL 临时 defaults 尚未创建" 70
    fi
    verify_owned_path "$APPROVED_MYSQL_CONTROLLED_DEFAULTS_FILE" file private "受控 MySQL 临时 defaults"
    /usr/bin/env -i PATH="$PATH" HOME="$APPROVED_RELEASE_WORKSPACE/home" TMPDIR="$APPROVED_RELEASE_WORKSPACE" \
        "$mysql_bin" "--defaults-file=$APPROVED_MYSQL_CONTROLLED_DEFAULTS_FILE" \
        --host="$APPROVED_FLYWAY_HOST" --port="$APPROVED_FLYWAY_PORT" --protocol=TCP \
        --ssl-mode=VERIFY_IDENTITY --batch --skip-column-names --raw \
        --database=information_schema --execute="$query"
}

# Flyway 仅加载 owner-only 的临时白名单配置；清空环境和 HOME，避免 FLYWAY_*、用户配置或
# callback/initSql 覆盖已审计参数。每次执行前重新验证只读 snapshot，而不是原 staged 目录。
run_approved_flyway() {
    local flyway_bin="$1"
    shift
    if [ -z "$APPROVED_FLYWAY_CONTROLLED_CONFIG" ]; then
        approved_target_fail "受控 Flyway 临时配置尚未创建" 70
    fi
    verify_owned_path "$APPROVED_FLYWAY_CONTROLLED_CONFIG" file private "受控 Flyway 临时配置"
    verify_protected_staged_snapshot
    /usr/bin/env -i PATH="$PATH" HOME="$APPROVED_RELEASE_WORKSPACE/home" TMPDIR="$APPROVED_RELEASE_WORKSPACE" \
        "$flyway_bin" "-configFiles=$APPROVED_FLYWAY_CONTROLLED_CONFIG" \
        "-locations=filesystem:$APPROVED_STAGED_SNAPSHOT_DIR" "$@"
}

run_approved_fresh_schema_preflight() {
    local mysql_bin="$1"
    local flyway_bin="$2"
    local table_count
    local history_count
    local business_table_count

    table_count="$(run_approved_mysql_query "$mysql_bin" "SELECT COUNT(*) FROM tables WHERE table_schema = '$APPROVED_FLYWAY_SCHEMA'")"
    history_count="$(run_approved_mysql_query "$mysql_bin" "SELECT COUNT(*) FROM tables WHERE table_schema = '$APPROVED_FLYWAY_SCHEMA' AND table_name = 'flyway_schema_history'")"
    business_table_count="$(run_approved_mysql_query "$mysql_bin" "SELECT COUNT(*) FROM tables WHERE table_schema = '$APPROVED_FLYWAY_SCHEMA' AND table_name IN ('asset', 'sys_user', 'sys_dept', 'work_order', 'retirement_application', 'asset_compensation', 'approval_process', 'disposal_application')")"
    if [ "$table_count" != "0" ] || [ "$history_count" != "0" ] || [ "$business_table_count" != "0" ]; then
        approved_target_fail "staged chain 仅允许无 Flyway history、无业务表且完全为空的新 schema，拒绝对既有库执行" 68
    fi

    run_approved_flyway "$flyway_bin" info
    run_approved_flyway "$flyway_bin" validate
}
