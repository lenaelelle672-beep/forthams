-- Immutable published workflow definition snapshots.
-- The workflow_definition table remains the editable design head; runtime
-- approval uses the latest PUBLISH/ROLLBACK snapshot so draft saves do not
-- invalidate already published business entry points.

CREATE TABLE IF NOT EXISTS workflow_definition_version (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    definition_id BIGINT NOT NULL,
    business_type VARCHAR(64) NOT NULL,
    version INT NOT NULL,
    action_type VARCHAR(32) NOT NULL DEFAULT 'PUBLISH',
    status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED',
    name VARCHAR(128) NOT NULL,
    description TEXT,
    definition_json LONGTEXT NOT NULL,
    publish_note VARCHAR(512),
    impact_scope VARCHAR(512),
    rollback_plan VARCHAR(512),
    rollback_source_version BIGINT,
    operator_id BIGINT,
    published_at DATETIME NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_workflow_version_tenant_business_version (tenant_id, business_type, version),
    INDEX idx_workflow_version_definition (definition_id),
    INDEX idx_workflow_version_tenant_business_time (tenant_id, business_type, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工作流定义发布版本快照';

INSERT INTO workflow_definition_version (
    tenant_id,
    definition_id,
    business_type,
    version,
    action_type,
    status,
    name,
    description,
    definition_json,
    publish_note,
    impact_scope,
    rollback_plan,
    rollback_source_version,
    operator_id,
    published_at,
    create_time
)
SELECT
    wd.tenant_id,
    wd.id,
    wd.business_type,
    wd.version,
    'PUBLISH',
    'PUBLISHED',
    wd.name,
    wd.description,
    wd.definition_json,
    '历史发布版本自动回填',
    '迁移既有发布头记录',
    '可回滚至该迁移快照',
    NULL,
    wd.published_by,
    COALESCE(wd.published_at, wd.update_time, wd.create_time, CURRENT_TIMESTAMP),
    COALESCE(wd.published_at, wd.update_time, wd.create_time, CURRENT_TIMESTAMP)
FROM workflow_definition wd
LEFT JOIN workflow_definition_version wdv
    ON wdv.tenant_id = wd.tenant_id
   AND wdv.business_type = wd.business_type
   AND wdv.version = wd.version
WHERE wd.version > 0
  AND wd.definition_json IS NOT NULL
  AND wd.definition_json <> ''
  AND wdv.id IS NULL;
