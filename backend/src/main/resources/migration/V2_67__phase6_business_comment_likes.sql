-- V3_53__phase6_business_comment_likes.sql
-- Phase 6 T6.1: 评论点赞功能 — 添加 likes 字段到 business_comment 表
-- 幂等设计（ALTER TABLE ... ADD COLUMN IF NOT EXISTS），可重复执行

-- 添加 likes 字段（默认值为 0）
ALTER TABLE business_comment ADD COLUMN IF NOT EXISTS likes INT DEFAULT 0 COMMENT '点赞数' AFTER parent_comment_id;

-- 添加索引（如果不存在）
-- CREATE INDEX IF NOT EXISTS idx_bc_likes ON business_comment(likes);