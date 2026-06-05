-- V3_43: 资产 ABC 分类字段迁移
-- 注意：V3_42__stocktaking_cycle.sql 第 45 行已添加 abc_classification 字段
-- 本脚本确保字段存在并创建索引，使用 IF NOT EXISTS 保证幂等性

-- 确保 abc_classification 字段存在（V3_42 已添加，此处为幂等校验）
ALTER TABLE asset ADD COLUMN IF NOT EXISTS abc_classification VARCHAR(32) DEFAULT 'C' COMMENT 'ABC分类: A-高价值, B-中价值, C-低价值, CATEGORY-分类规则' AFTER category_id;

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_asset_abc_classification ON asset(abc_classification);

-- 幂等性说明：
-- 1. ALTER TABLE ... IF NOT EXISTS 确保字段不会重复添加
-- 2. CREATE INDEX IF NOT EXISTS 确保索引不会重复创建
-- 3. 本脚本可安全重复执行