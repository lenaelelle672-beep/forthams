-- T3.1 工单工时登记表
CREATE TABLE IF NOT EXISTS work_order_time_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    work_order_id BIGINT NOT NULL COMMENT '工单ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    user_name VARCHAR(64) COMMENT '用户姓名',
    start_time DATETIME NOT NULL COMMENT '开始时间',
    end_time DATETIME NULL COMMENT '结束时间',
    duration_minutes INT COMMENT '时长（分钟）',
    description VARCHAR(500) COMMENT '工作描述',
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标志',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_work_order (work_order_id),
    INDEX idx_user (user_id),
    INDEX idx_tenant_deleted (tenant_id, deleted)
) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工单工时登记表';
