-- =============================================================================
-- Migration V1.3: Audit Log + Post Tables
-- 幂等脚本：所有 CREATE 均使用 IF NOT EXISTS，可重复执行
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys_operate_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    module VARCHAR(128),
    operation VARCHAR(128),
    business_type VARCHAR(64),
    method VARCHAR(256),
    request_method VARCHAR(16),
    request_uri VARCHAR(512),
    operator_id BIGINT,
    operator_name VARCHAR(128),
    operator_ip VARCHAR(64),
    request_params LONGTEXT,
    response_data LONGTEXT,
    status TINYINT DEFAULT 0,
    error_message TEXT,
    cost_time BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_operate_log_time (create_time),
    INDEX idx_operate_log_operator (operator_id),
    INDEX idx_operate_log_business (business_type),
    INDEX idx_operate_log_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_post (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_code VARCHAR(64) NOT NULL COMMENT '岗位编码',
    post_name VARCHAR(128) NOT NULL COMMENT '岗位名称',
    sort_order INT DEFAULT 0,
    status TINYINT DEFAULT 1,
    remark VARCHAR(512),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_post_code (post_code),
    INDEX idx_status_deleted (status, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='岗位表';

CREATE TABLE IF NOT EXISTS sys_user_post (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    post_id BIGINT NOT NULL COMMENT '岗位ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_post (user_id, post_id),
    INDEX idx_user_id (user_id),
    INDEX idx_post_id (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户岗位关联表';
