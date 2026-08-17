# Flyway 受控发布运行手册

## 不可变历史与发布边界

- `V2_87`、`V2_89`、`V2_94`–`V2_101`、`V2_104`、`V2_106`–`V2_110` 的历史源文件保留原字节内容和既有 checksum，绝不在仓库或已部署环境中静默改写。
- 应用配置将 `spring.flyway.enabled` 固定为 `false`、Hibernate DDL 为 `none`，也不自动 baseline。普通应用环境变量不能开启 Flyway；生产启动不是数据库变更入口。
- `prepare-fresh-flyway-chain.sh` 仅为**空的新库**生成临时 staged chain：先复制独立的 staged-only `V0_1__menu_prerequisite_schema.sql`，再将不可变的 `schema.sql` 复制为 staged-only `V1_0__baseline_schema.sql` 并仅移除其固定 `CREATE DATABASE/USE ams_db` 前缀；之后只在六个已知 V2 文件的副本中将 `utf4mb4` 改为 `utf8mb4`，只在 `V2_87`、`V2_89` 的副本中引用 MySQL 8.4 保留字列 ``sensitive``，只在 `V2_94`–`V2_101` 的副本中移除 MySQL 不支持的 `CREATE INDEX IF NOT EXISTS`，并生成 source/staged SHA-256 审计清单。
- staged chain 不得复制回 `src/main/resources/migration`、不得用于覆盖 deployed checksum，也不得被用于任何既有库。受控 preflight 会先校验批准的 `MANIFEST.tsv` SHA-256，随后逐项重算每个 staged SQL 的 SHA-256 并要求清单与目录一一对应；校验通过后只对 owner-only、只读临时快照执行，绝不再把原始 staged 路径交给 Flyway。目标 schema 必须没有 `flyway_schema_history` 且没有任何表（包括业务表）。任一条件不满足即拒绝执行。

## 角色、证据与停止条件

数据库管理员（DBA）负责备份、目标确认、Flyway 执行和恢复；应用发布负责人负责版本包与功能 smoke test；独立 database reviewer 在每个 gate 签字。任何一项缺失即停止：

1. 已记录目标实例、库名、变更单、应用版本、Flyway 版本和生成的 `MANIFEST.tsv` 指纹。
2. 已完成可恢复备份，并在变更单中记录备份位置、时间、恢复演练/校验结果；不得把凭据、连接串密码或备份访问令牌写入日志、工单附件或仓库。
3. 已完成只读 `info`、`validate`、schema preflight；`validate` 失败、历史成功 checksum 不匹配、存在未知失败版本或目标库非预期时立即 abort。
4. 任何 repair、migrate、schema 写入都只能由 DBA 在维护窗口内执行；仓库中的 `flyway-dba-migrate.sh` 是唯一受控 migrate 入口，仍不能执行 repair。

## 新库：正确 migration chain

1. DBA 在隔离发布主机执行 `backend/scripts/prepare-fresh-flyway-chain.sh <新的空输出目录>`。输出目录必须此前不存在。
2. 审核 `MANIFEST.tsv`：`fresh-baseline/V0_1__menu_prerequisite_schema.sql` 及 `schema.sql` 只能分别对应 staged-only `V0_1` 与 `V1_0`；后者必须标记 `remove-fixed-schema-selection`。仅 `V2_104`、`V2_106`–`V2_110` 标记 `utf4mb4-to-utf8mb4`，仅 `V2_87`、`V2_89` 标记 `quote-sensitive-identifier`，仅 `V2_94`–`V2_101` 标记 `remove-create-index-if-not-exists`，其余 V2 条目 source/staged SHA-256 必须相同，且没有 `.INCOMPLETE`。
3. 对新建、空白、隔离的 MySQL schema 使用 secret-manager 注入的批准 Flyway 配置和不入库的 MySQL defaults 文件。两者都必须解析为**绝对、执行 DBA 所有、无符号链接的规范路径、不可被组/其他用户写入且权限为 `0600`**。批准 Flyway 配置只能包含唯一的 `flyway.url`（或 `url`）、`flyway.user`（或 `user`）、`flyway.password`（或 `password`）；URL 必须是 `jdbc:mysql://host:port/schema?sslMode=VERIFY_IDENTITY`，不得含其他查询参数、内嵌凭据、旧 TLS 参数或 Flyway 行为键。MySQL defaults 只能有一个 `[client]` 段，显式给出同一 `host`、`port`、`database`、`ssl-mode=VERIFY_IDENTITY`、`user`、`password`，以及白名单中的 TLS 证书参数；不得包含 `!include`、`init-command`、`defaults-extra-file` 或其他任意 MySQL 选项。脚本会从这些输入生成 owner-only 白名单临时配置，mysql 只通过 `--defaults-file` 读取该临时文件，Flyway 在清空 `FLYWAY_*` 环境与临时 `HOME` 后只读取临时配置。`STAGED_MIGRATION_DIR` 也必须解析为绝对、执行 DBA 所有、无符号链接且不可被组/其他用户写入的规范目录；`MYSQL_BIN` 和 `FLYWAY_BIN`（若覆写）也必须解析为所有者或 root 所有、无符号链接且不可被组/其他用户写入的常规可执行文件。先设置批准的 `APPROVED_STAGED_MANIFEST_SHA256`、`FRESH_SCHEMA_NAME`、`MYSQL_DEFAULTS_FILE`，再运行 `backend/scripts/flyway-readonly-preflight.sh`；它在 `info`/`validate` 前强制比较 host/port/schema/TLS、确认目标完全为空，且从不执行 DDL。
4. 仅在 reviewer 审核 preflight 输出、备份和清单后，DBA 才能使用 `backend/scripts/flyway-dba-migrate.sh`。该工具要求显式 `DBA_RELEASE_AUTHORIZATION=approved-fresh-schema-migrate`、变更单号和前述所有 hard gate；其 `info`、`validate` 与 `migrate` 在同一进程中复用同一受保护快照，禁止将密码作为命令行参数或输出到日志。
5. 代码发布 gate 必须先运行 `bash backend/scripts/test-flyway-controlled-release.sh` 和三个受控脚本的 `bash -n`。该脚本使用伪 mysql/Flyway 验证临时白名单配置、快照复用、`init-command` 拒绝、路径权限拒绝和密码不输出；它不连接真实数据库。
6. 迁移后不再运行仅允许空 schema 的 preflight；DBA 必须重新从同一已批准 manifest 创建独立、受保护、只读的 snapshot，并只用同一临时白名单配置和该 snapshot 执行只读 `flyway info`、`flyway validate`。随后核对 `flyway_schema_history` 至少覆盖 `V2_112__tenant_data_permission_authority.sql`、`V2_113__tenant_admin_business_permission_package.sql`、`V2_114__security_workflow_concurrency.sql` 与 `V2_115__approval_node_assignment.sql`，全部为成功状态，并核验 `sys_user_tenant`、`sys_role_data_scope`、`sys_role_dept`、`approval_node_assignment`、`idx_asset_tenant_dept`、`idx_asset_tenant_user`、V2_113/V2_114 的受控动作权限库存及 V2_114 的 token/version/处置申请对象。
7. 仅在上述证据齐全后，按正常应用发布流程以外部 `DB_URL`、`DB_USERNAME`、`DB_PASSWORD`、`JWT_SECRET` 启动应用；MySQL 默认 TLS，loopback 开发例外必须显式双开关。

## 已部署库：preflight 与受控 repair 人工 gate

DBA 先用只读查询导出并审阅 `flyway_schema_history` 中版本、脚本名、checksum、安装时间和 `success`，重点检查 104、106–110、112、113、114、115；同时核验下列对象的存在性和定义：

```sql
SELECT installed_rank, version, description, script, checksum, installed_on, success
FROM flyway_schema_history
WHERE version IN ('104', '106', '107', '108', '109', '110', '112', '113', '114', '115')
ORDER BY installed_rank;

SELECT table_name, table_collation
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
    'sys_tenant', 'import_export_task', 'handover', 'workflow_mail_config',
    'doc_article', 'support_ticket', 'sys_user_tenant', 'sys_role_data_scope',
     'sys_role_dept', 'approval_node_assignment'
  )
ORDER BY table_name;

SELECT table_name, index_name, column_name, seq_in_index
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND (table_name = 'asset' AND index_name IN ('idx_asset_tenant_dept', 'idx_asset_tenant_user'))
ORDER BY table_name, index_name, seq_in_index;
```

查询输出是发布证据的一部分，提交 reviewer 前须脱敏连接信息和任何业务数据。

| 版本 | 预期对象 |
| --- | --- |
| V2_104 | `sys_tenant` |
| V2_106 | `import_export_task` |
| V2_107 | `handover` |
| V2_108 | `workflow_mail_config` |
| V2_109 | `doc_article` |
| V2_110 | `support_ticket` |
| V2_112 | tenant authority 表、列和资产范围索引 |
| V2_113 | 受控 tenant-admin 动作权限库存 |
| V2_114 | token/version 列、`disposal_application` 与重置密码权限 |
| V2_115 | `approval_node_assignment` 审批节点处理人快照 |

只有同时满足以下条件，DBA 才能在变更单中批准一次人工 `flyway repair`：

1. 已验证备份可恢复，应用写入已停止，且已记录错误堆栈和失败的**单一**版本。
2. 失败版本仅为 104、106–110 之一，history 中为 `success=false`；其后的版本未成功执行。
3. 对应表不存在，或独立 reviewer 能证明不存在任何部分 DDL/数据副作用；无法证明时 abort，不得猜测。
4. history 中不存在相同版本的成功记录或与原始历史文件不一致的 checksum；存在时绝不 repair checksum，转人工事故处置。
5. DBA、database reviewer 和应用负责人已批准使用本次生成的 staged chain，且 repair 后立即先做只读 `info`/`validate`，再在维护窗口执行 migrate。

repair 后如果任一 validate、schema verification 或应用 smoke test 失败：停止发布、保持应用迁移开关关闭、保存 history/manifest/preflight 证据；由 DBA 通过已验证备份恢复，或在新的变更单中制定前向修复。不得手改 `flyway_schema_history`、不得删除历史 checksum、不得以自动 baseline 掩盖失败。

## database reviewer 签字项

| Gate | DBA | database reviewer | 应用负责人 |
| --- | --- | --- | --- |
| 目标、备份和恢复演练证据 | 执行/记录 | 独立复核 | 确认维护窗口 |
| staged `MANIFEST.tsv` 与历史 checksum | 提供 | 审核显式 allowlist | 确认应用版本 |
| `info`、`validate`、schema 查询 | 执行/归档 | 独立复核 | 功能 smoke test |
| repair（如满足全部条件） | 手工执行 | 事前批准与事后复核 | 事前批准 |
| migrate 与回退/abort 决策 | 手工执行 | 复核 | 发布决策 |

## V2_112/V2_115 实际 MySQL 验证状态

本工作树未执行真实 MySQL 或 Flyway 写入验证，因此不声明任何 MySQL、Flyway 版本兼容性或升级路径已经通过。`V2_112` 会重建唯一索引，先按目标列顺序预检重复值；预检失败时必须在任何索引删除前停止。由于 MySQL DDL 可能隐式提交，若已执行的 DDL 后续失败，DBA 必须停止发布、保存 history/错误证据，并使用已验证备份恢复或在新变更单中制定前向修复。

`V2_114` 增量加入 token version、并发 version 与 `disposal_application`；`V2_115` 加入 `approval_node_assignment` 审批节点处理人快照。它们需要在隔离、一次性 schema 中配合真正的 pre-2.112 fixture 验证；这不代表任何已部署库已验证或可直接发布。DBA 必须在发布前取得目标 MySQL/Flyway 兼容性证据，并按“已部署库”人工 gate 保留 `info`、`validate`、schema 查询、清单、备份和回退演练证据。

## 回退与 abort

数据库变更不可由应用版本回退自动撤销。回退点依次是：迁移前可恢复备份、迁移后 preflight/history 快照、应用包版本。发生异常时先停止新版本写入并禁用 Flyway，再恢复上一应用版本；仅 DBA 可按已验证备份恢复数据库。任何未执行的人工 DBA gate 都表示“代码阶段可复审”，不表示发布或部署已验证。
