-- =============================================================================
-- Migration V2.9: Location Tree Hierarchy Support
-- 扩展 location 表以支持四级位置模型（省/市/区/楼栋/楼层/房间）
-- 参考 OpenMAINT 的四级位置模型设计
-- =============================================================================

-- Step 1: 添加 ancestors 字段（祖先ID链）
SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE location ADD COLUMN ancestors VARCHAR(500) DEFAULT '''' AFTER parent_id',
    'SELECT 1')
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'location' AND column_name = 'ancestors');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 2: 添加 level 字段（层级 1/2/3/4）
SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE location ADD COLUMN level INT DEFAULT 1 AFTER ancestors',
    'SELECT 1')
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'location' AND column_name = 'level');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 3: 添加 location_type 字段（类型: PROVINCE/CITY/DISTRICT/BUILDING/FLOOR/ROOM）
SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE location ADD COLUMN location_type VARCHAR(20) DEFAULT NULL AFTER level',
    'SELECT 1')
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'location' AND column_name = 'location_type');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 4: 为 sort_order 添加索引（辅助排序查询）
SET @sql = (SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_location_sort ON location(sort_order)',
    'SELECT 1')
FROM information_schema.statistics
WHERE table_schema = DATABASE() AND table_name = 'location' AND index_name = 'idx_location_sort');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 5: 为 ancestors 添加索引（加速 LIKE 查询）
SET @sql = (SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_location_ancestors ON location(ancestors(255))',
    'SELECT 1')
FROM information_schema.statistics
WHERE table_schema = DATABASE() AND table_name = 'location' AND index_name = 'idx_location_ancestors');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
