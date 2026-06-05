-- =============================================================================
-- Migration V3.6: Webhook 集成配置
-- =============================================================================
CREATE TABLE IF NOT EXISTS sys_webhook_config (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL COMMENT 'Webhook名称',
    url         VARCHAR(500) NOT NULL COMMENT 'Webhook URL',
    secret      VARCHAR(200) COMMENT 'HMAC-SHA256签名密钥',
    events      JSON COMMENT '订阅事件类型(JSON数组,如["CONTRACT_EXPIRING","WORK_ORDER_CREATED"])',
    enabled     TINYINT DEFAULT 1 COMMENT '是否启用 0-禁用 1-启用',
    description VARCHAR(500) COMMENT '描述',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_whc_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Webhook配置';
