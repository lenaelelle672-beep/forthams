-- GIS 地理位置字段
SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset ADD COLUMN location_lat DECIMAL(10,7) COMMENT ''纬度'' AFTER rfid_tag',
    'SELECT 1')
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'asset' AND column_name = 'location_lat');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset ADD COLUMN location_lng DECIMAL(10,7) COMMENT ''经度'' AFTER location_lat',
    'SELECT 1')
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'asset' AND column_name = 'location_lng');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_asset_location ON asset(location_lat, location_lng)',
    'SELECT 1')
FROM information_schema.statistics
WHERE table_schema = DATABASE() AND table_name = 'asset' AND index_name = 'idx_asset_location');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
