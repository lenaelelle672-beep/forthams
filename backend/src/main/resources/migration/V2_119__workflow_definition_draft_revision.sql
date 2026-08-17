-- V2_119__workflow_definition_draft_revision
-- 为 V2_116 创建的独立流程设计器草稿补齐实体/保存逻辑所需的 revision。
-- 默认值使已有草稿可安全读取；NOT NULL 防止实体映射得到空 revision。
SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'workflow_definition_draft')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'workflow_definition_draft' AND column_name = 'revision'),
    'ALTER TABLE workflow_definition_draft ADD COLUMN revision INT NOT NULL DEFAULT 0 AFTER definition_json', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
