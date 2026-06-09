# 数据库迁移说明

## 技术选型

本目录使用 **Flyway 风格** 的增量 SQL 迁移文件保存数据库变更顺序。当前应用默认关闭 Spring Boot SQL init 与 Flyway 自动迁移，迁移执行由部署流程、DBA 或 CI 手动编排。

## 命名约定

版本号采用 `V{大版本}_{小版本}__{描述}.sql` 格式：

- `V1_x` — 核心基础表（RBAC、审计、帖子等）
- `V2_x` — 业务模块基础表（通知、维保、自定义字段等）
- `V3_x` — 扩展业务表（资产、盘点、审批、工单等）

示例：

- `V1_1__core_ams_tables.sql`
- `V2_1__mail_template.sql`
- `V3_10__floorplan.sql`

## schema.sql

`schema.sql` 是完整的 DDL 快照，**仅用于全新安装**。首次部署时可直接执行 `schema.sql` 初始化全部表结构；Docker Compose 中的 MySQL 服务通过 `/docker-entrypoint-initdb.d/01-schema.sql` 挂载完成首次初始化。后续增量更新使用本目录下的迁移文件。

## 执行方式

- **全新 Docker/MySQL 安装**：由 MySQL 容器首次创建数据目录时执行挂载的 `schema.sql`。
- **已有环境升级**：在 MySQL 客户端中按文件名顺序执行本目录迁移文件，或由外部迁移工具按相同顺序编排。
- **本地一次性 Spring SQL init**：仅在明确需要时设置 `SQL_INIT_MODE=always`；默认值为 `never`，避免运行态反复执行完整 DDL。

## 注意事项

1. 迁移文件一旦执行（已写入 `flyway_schema_history` 表），**禁止修改**已提交的脚本。如需变更，请新建更高版本的迁移文件。
2. 版本号必须严格递增，不能跳号或重复。
3. 所有迁移文件应保持幂等性（同一环境重复执行不报错），推荐使用 `IF NOT EXISTS` / `IF EXISTS` 子句。

## 其他迁移目录

`backend/migrations/versions/` 是早期使用过的备用迁移目录（包含 `001_create_tickets_table.sql` 等文件）。该目录自 V1_x 起已被 `src/main/resources/migration/` 取代，**当前为废弃状态**。新环境部署应只使用 `src/main/resources/migration/`。如有遗留文件需要合并到主迁移目录，请参照上方"版本号规范"小节重新命名并按顺序追加。
