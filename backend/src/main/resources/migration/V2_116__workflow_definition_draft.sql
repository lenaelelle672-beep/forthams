-- V2_116__workflow_definition_draft
-- 将可变设计器草稿与已发布 workflow_definition projection 分离。
-- 仅追加新表和索引；不修改历史 migration，不写入用户、角色或默认审批人。
CREATE TABLE IF NOT EXISTS workflow_definition_draft (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    business_type VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    definition_json LONGTEXT NOT NULL,
    updated_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_workflow_draft_tenant_business (tenant_id, business_type),
    INDEX idx_workflow_draft_tenant_updated (tenant_id, update_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
