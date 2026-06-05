-- =============================================================================
-- V3_21__energy_location_index_enhance.sql
-- gai2 W10 增量化落地 — energy_consumption / energy_meter 表强化 location-aware 复合索引
-- (gai2-builder 2026-06-03 实施，AR-6 修正版本号 V3_13 → V3_21；
--  V3_19__energy_location_index.sql 已实装 idx_ec_asset_period / idx_em_asset_date 基础索引，
;  本 migration 补 location-aware 增强)
--
-- 背景：
-- - C1 共识：DB 复合索引 + 查询限制时间窗 + 前端防抖（R2 mitigation）
-- - V3_19 已实装：idx_ec_asset_period(asset_id, period_start) + idx_em_asset_date(asset_id, reading_date)
-- - 增强点：增加 location-aware 复合索引，覆盖 W24 step2 4 端点
--   - /energy/ranking?scope=building|floor|area 走 location.ancestors LIKE 过滤
--   - /energy/locations/{id}/assets?withEnergy=true JOIN asset.location_id 命中
--   - /energy/by-space 空间下钻
-- =============================================================================

-- 1. energy_consumption: 强化 (meter_type, period_type, period_start) — /energy/anomalies 全表扫描兜底
SET @sql = (SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_ec_meter_period_type ON energy_consumption(meter_type, period_type, period_start)',
    'SELECT 1')
FROM information_schema.statistics
WHERE table_schema = DATABASE() AND table_name = 'energy_consumption' AND index_name = 'idx_ec_meter_period_type');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. asset 表：强化 (location_id, deleted) 覆盖 V3_20 floor_plan_location JOIN
-- 注：idx_asset_location 在 V2_0__location_fk.sql 已建 (location_id) 单列索引，本处补 deleted 复合
SET @sql = (SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_asset_location_deleted ON asset(location_id, deleted)',
    'SELECT 1')
FROM information_schema.statistics
WHERE table_schema = DATABASE() AND table_name = 'asset' AND index_name = 'idx_asset_location_deleted');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. location 表：强化 (location_type, deleted) 覆盖 W4 aggregateBySpace 与 W24 rankingByLocation
SET @sql = (SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_location_type_deleted ON location(location_type, deleted)',
    'SELECT 1')
FROM information_schema.statistics
WHERE table_schema = DATABASE() AND table_name = 'location' AND index_name = 'idx_location_type_deleted');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. EXPLAIN 回归（运维参考）：
--    EXPLAIN SELECT * FROM energy_consumption WHERE meter_type='ELECTRICITY' AND period_type='MONTH' ORDER BY period_start DESC;
--    应命中 idx_ec_meter_period_type
--    EXPLAIN SELECT l.id, SUM(ec.consumption) FROM location l LEFT JOIN asset a ON a.location_id=l.id
--             LEFT JOIN energy_consumption ec ON ec.asset_id=a.id
--             WHERE l.location_type='BUILDING' AND l.deleted=0 GROUP BY l.id;
--    应命中 idx_location_type_deleted + idx_asset_location_deleted
