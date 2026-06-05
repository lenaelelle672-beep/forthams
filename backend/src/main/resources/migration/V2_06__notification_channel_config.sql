-- =============================================================================
-- Migration V2.6: 通知渠道配置 — sys_channel_config 表
--
-- 1. sys_channel_config — 通知渠道配置（钉钉/企业微信/邮件）
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. sys_channel_config 通知渠道配置表
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_channel_config (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    channel_type     VARCHAR(32) NOT NULL COMMENT '渠道类型（DINGTALK/WECHAT/EMAIL）',
    config_name      VARCHAR(128) NOT NULL COMMENT '配置名称',
    webhook_url      VARCHAR(512) NOT NULL COMMENT 'Webhook 地址',
    secret           VARCHAR(256) DEFAULT NULL COMMENT '签名密钥（钉钉签名模式需要）',
    enabled          TINYINT DEFAULT 1 COMMENT '是否启用（0-停用 1-启用）',
    description      VARCHAR(512) DEFAULT NULL COMMENT '配置描述',
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_cc_type (channel_type),
    INDEX idx_cc_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知渠道配置表';
