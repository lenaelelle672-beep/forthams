-- V2_118__migrate_legacy_workflow_definition_drafts
-- 将历史 workflow_definition 中的 DRAFT 行前向复制到独立草稿表；已发布 projection 不参与本迁移。
-- 目标表已有草稿时保留目标表记录，重复执行不会覆盖用户后续编辑。
SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'workflow_definition_draft')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'workflow_definition_draft' AND column_name = 'revision'),
    'ALTER TABLE workflow_definition_draft ADD COLUMN revision INT NOT NULL DEFAULT 0 AFTER definition_json', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO workflow_definition_draft (
    tenant_id, business_type, name, description, definition_json, revision, updated_by,
    create_time, update_time, deleted
)
SELECT
    tenant_id, business_type, name, description, definition_json, COALESCE(version, 0), updated_by,
    create_time, update_time, 0
FROM workflow_definition
WHERE status = 'DRAFT'
  AND COALESCE(deleted, 0) = 0;
