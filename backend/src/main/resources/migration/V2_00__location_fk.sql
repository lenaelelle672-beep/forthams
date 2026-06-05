-- =============================================================================
-- Migration V2.0: Asset.location String → FK（Long）
-- 将 asset.location VARCHAR(256) 迁移为 asset.location_id BIGINT FK → location.id
-- 
-- 迁移策略（debate.json 方案A — 全表扫描一次性迁移）：
-- 1. 新增 location_id BIGINT 可空列
-- 2. 将现有 location 文本按名称匹配回填到 location_id（未匹配保留 NULL）
-- 3. 删除旧 location 列
-- 4. 添加 FK 约束和索引
-- 
-- 注意：未匹配到 Location 名称的旧记录，location_id 保留 NULL，
-- 需用户在前端手动选择正确位置后更新。
-- =============================================================================

-- Step 1: 新增 location_id 列（幂等，列已存在则跳过）
SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset ADD COLUMN location_id BIGINT DEFAULT NULL AFTER user_id',
    'SELECT 1')
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'asset' AND column_name = 'location_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 2: 数据迁移 — 将现有 location 文本按名称匹配回填 location_id
-- 匹配规则：TRIM 去除前后空格后与 location.name 做精确匹配
-- 未匹配到的记录（如自定义文本或空值）保留 NULL，后续人工补填
UPDATE asset a
LEFT JOIN location l ON TRIM(a.location) = TRIM(l.name)
SET a.location_id = l.id
WHERE a.location IS NOT NULL AND a.location != '';

-- Step 3: 删除旧 location 列（幂等，列不存在则跳过）
SET @sql = (SELECT IF(COUNT(*) > 0,
    'ALTER TABLE asset DROP COLUMN location',
    'SELECT 1')
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'asset' AND column_name = 'location');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 4: 添加索引
SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset ADD INDEX idx_asset_location (location_id)',
    'SELECT 1')
FROM information_schema.statistics
WHERE table_schema = DATABASE() AND table_name = 'asset' AND index_name = 'idx_asset_location');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
