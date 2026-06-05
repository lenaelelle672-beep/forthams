-- T3.4 故障代码表（三级树形结构：现象→原因→措施）
CREATE TABLE IF NOT EXISTS fault_code (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(64) NOT NULL COMMENT '故障编码',
    fault_phenomenon VARCHAR(255) COMMENT '故障现象（level=1）',
    fault_cause VARCHAR(255) COMMENT '故障原因（level=2）',
    solution TEXT COMMENT '解决措施（level=3）',
    parent_id BIGINT COMMENT '父节点ID',
    level INT DEFAULT 1 COMMENT '层级：1-现象，2-原因，3-措施',
    category_ids VARCHAR(500) COMMENT '关联分类ID列表（逗号分隔）',
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    status VARCHAR(16) DEFAULT 'ENABLED' COMMENT '状态：ENABLED/DISABLED',
    sort_order INT DEFAULT 0 COMMENT '排序号',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标志',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_parent (parent_id),
    INDEX idx_level (level),
    INDEX idx_tenant (tenant_id),
    INDEX idx_deleted (deleted)
) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='故障代码表';
