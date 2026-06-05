-- V3_20__floorplan_location.sql
-- gai2 W9 (R7 配套) — FloorPlan 新增 location_id 关联 Location.id
-- 替代/补充 building/floor 字符串匹配，为 /floor-plans/{id}/energy 与 /locations/{id}/assets 提供 JOIN 基础。
-- 历史数据兼容：building/floor 字符串无法匹配 location.name 时 locationId 保留 NULL（数据质量降级，不 fail-fast）。

-- 1. floor_plan: 添加 location_id 列
ALTER TABLE floor_plan ADD COLUMN location_id BIGINT NULL COMMENT '关联 Location.id（gai2 W8 FK）';

-- 2. 复合索引：GIS / 能耗 join 高频路径
CREATE INDEX idx_fp_location ON floor_plan(location_id);

-- 3. 历史数据回填（尽力而为，匹配失败保留 NULL）
-- 假设 location 表至少有 name + level 字段；loc.building/loc.floor/loc.area 等冗余字段（可选）
UPDATE floor_plan fp
LEFT JOIN location loc_b ON loc_b.location_type = 'BUILDING' AND loc_b.name = fp.building AND loc_b.deleted = 0
SET fp.location_id = loc_b.id
WHERE fp.location_id IS NULL AND fp.building IS NOT NULL AND fp.building <> '';

-- 注：FLOOR/ROOM 层级需要 parent 关系才能精确匹配，本 migration 仅做 BUILDING 级回填；
-- 如需全层级匹配，可扩展 join condition 关联 loc_b.id = loc_f.parent_id AND loc_f.location_type = 'FLOOR'。
