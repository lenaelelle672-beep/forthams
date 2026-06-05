-- V3_19__energy_location_index.sql
-- S0.5d (R2 治本) — 在 energy_consumption 表新增 location-aware 复合索引，
-- 配合 EnergyService 4 个新方法显式走 WHERE 时间窗 + 空间范围。
-- 注意：energy_consumption 没有 location_id 列，需通过 asset 表 JOIN，
-- idx_asset_location (V2_0__location_fk.sql) 已就位；本 migration 强化
-- energy_consumption 主表的时间/类型索引，使 by-location 聚合更稳定。
--
-- 列顺序依据最高频查询模式：(asset_id, period_start, meter_type, period_type)
--   - /energy/dashboard 按时间窗 + period_type 汇总
--   - /energy/by-location 在 asset_id IN 子集上二次过滤
--   - 唯一约束 idx_ec_period (asset_id, meter_type, period_type, period_start) 已存在
--   - 本次补一个非唯一版本，按 period_start 排序友好

-- 1. energy_consumption: 强化 (asset_id, period_start DESC) 复合索引
CREATE INDEX idx_ec_asset_period ON energy_consumption (asset_id, period_start);

-- 2. energy_meter: 强化 (asset_id, reading_date DESC) 用于读数时间窗查询
CREATE INDEX idx_em_asset_date ON energy_meter (asset_id, reading_date);
