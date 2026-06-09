-- System todo table for approval notification tasks.

CREATE TABLE IF NOT EXISTS sys_todo (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键 ID',
    user_id BIGINT NOT NULL COMMENT '用户 ID',
    title VARCHAR(255) NOT NULL COMMENT '标题',
    content TEXT NULL COMMENT '内容',
    ref_type VARCHAR(64) NULL COMMENT '引用类型',
    ref_id VARCHAR(64) NULL COMMENT '引用 ID',
    priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM' COMMENT '优先级: LOW/MEDIUM/HIGH',
    due_at DATETIME NULL COMMENT '截止时间',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/READ/COMPLETED',
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户 ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    read_at DATETIME NULL COMMENT '读取时间',
    completed_at DATETIME NULL COMMENT '完成时间',
    INDEX idx_todo_user_status (tenant_id, user_id, status),
    INDEX idx_todo_ref (tenant_id, ref_type, ref_id),
    INDEX idx_todo_due_at (tenant_id, due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统待办表';
