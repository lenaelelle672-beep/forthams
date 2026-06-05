-- T3.3 工单挂起/恢复记录表
CREATE TABLE IF NOT EXISTS work_order_hold_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    work_order_id BIGINT NOT NULL COMMENT '工单ID',
    hold_reason VARCHAR(500) NOT NULL COMMENT '挂起原因',
    held_by BIGINT NOT NULL COMMENT '挂起人ID',
    held_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '挂起时间',
    hold_end_time DATETIME COMMENT '计划恢复时间（用于超时提醒）',
    resumed_by BIGINT COMMENT '恢复人ID',
    resumed_at DATETIME COMMENT '恢复时间',
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID（多租户隔离）',
    last_notification_time DATETIME COMMENT '最后通知时间',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除标识（0-未删除，1-已删除）',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_work_order_id (work_order_id),
    INDEX idx_tenant_hold_end (tenant_id, hold_end_time, deleted) COMMENT '用于定时任务扫描超时记录',
    INDEX idx_tenant_last_notify (tenant_id, last_notification_time, deleted) COMMENT '用于定时任务通知去重'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工单挂起记录表';