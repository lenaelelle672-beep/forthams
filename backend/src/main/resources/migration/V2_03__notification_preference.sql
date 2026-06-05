-- =============================================================================
-- Migration V2.3: 通知偏好 — notification_preference 表
--
-- 1. notification_preference — 用户通知偏好表
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. notification_preference 用户通知偏好表
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_preference (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id        VARCHAR(64) DEFAULT 'GLOBAL' COMMENT '租户ID',
    user_id          BIGINT NOT NULL COMMENT '用户ID',
    category         VARCHAR(64) NOT NULL COMMENT '通知分类（retirement/maintenance/approval/system）',
    in_app           TINYINT DEFAULT 1 COMMENT '站内信通知（0-关闭 1-开启）',
    email            TINYINT DEFAULT 1 COMMENT '邮件通知（0-关闭 1-开启）',
    quiet_start      VARCHAR(8) COMMENT '免打扰开始时间（如 22:00）',
    quiet_end        VARCHAR(8) COMMENT '免打扰结束时间（如 08:00）',
    create_time      DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_np_user_category (user_id, category),
    INDEX idx_np_user_id (user_id),
    INDEX idx_np_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户通知偏好表';
