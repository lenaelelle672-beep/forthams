-- V3_54__business_comment_like_record.sql
-- Phase 6 T6.1: 评论点赞记录表 — 支持防重复点赞

CREATE TABLE IF NOT EXISTS business_comment_like_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    comment_id BIGINT NOT NULL COMMENT '评论ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted INT DEFAULT 0 COMMENT '逻辑删除 0-未删除 1-已删除',
    
    -- 唯一索引：同一用户对同一评论只能点赞一次
    UNIQUE KEY uk_comment_user (comment_id, user_id, tenant_id),
    INDEX idx_comment_id (comment_id),
    INDEX idx_user_id (user_id),
    INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论点赞记录表';

-- 幂等设计：使用 IF NOT EXISTS 和 ON DUPLICATE KEY UPDATE
-- 插入时如果已存在，则更新 deleted = 0（相当于恢复点赞）
