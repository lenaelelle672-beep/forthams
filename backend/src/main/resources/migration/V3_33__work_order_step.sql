-- T3.1 工单执行步骤 Checklist 表
CREATE TABLE IF NOT EXISTS work_order_step (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    work_order_id BIGINT NOT NULL COMMENT '工单ID',
    step_name VARCHAR(200) NOT NULL COMMENT '步骤名称',
    step_order INT DEFAULT 0 COMMENT '步骤顺序',
    is_completed TINYINT DEFAULT 0 COMMENT '是否完成：0-未完成，1-已完成',
    completed_by BIGINT COMMENT '完成人ID',
    completed_at DATETIME COMMENT '完成时间',
    note VARCHAR(500) COMMENT '步骤备注',
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标志',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_work_order (work_order_id),
    INDEX idx_completed (is_completed),
    INDEX idx_tenant_deleted (tenant_id, deleted)
) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工单执行步骤表';
