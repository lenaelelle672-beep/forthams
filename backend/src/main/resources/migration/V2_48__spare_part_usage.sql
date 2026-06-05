-- T3.6 备件领用记录表
CREATE TABLE IF NOT EXISTS spare_part_usage (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    spare_part_id BIGINT NOT NULL COMMENT '备件ID',
    work_order_id BIGINT NOT NULL COMMENT '工单ID',
    quantity DECIMAL(12,2) NOT NULL COMMENT '领用数量',
    usage_date DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '领用日期',
    user_id BIGINT COMMENT '领用人ID',
    note VARCHAR(500) COMMENT '备注',
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标志',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_spare_part (spare_part_id),
    INDEX idx_work_order (work_order_id),
    INDEX idx_usage_date (usage_date),
    INDEX idx_tenant_deleted (tenant_id, deleted)
) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='备件领用记录表';
