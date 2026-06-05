-- GIS 地理位置字段
ALTER TABLE asset ADD COLUMN location_lat DECIMAL(10,7) COMMENT '纬度' AFTER rfid_tag;
ALTER TABLE asset ADD COLUMN location_lng DECIMAL(10,7) COMMENT '经度' AFTER location_lat;
CREATE INDEX idx_asset_location ON asset(location_lat, location_lng);
