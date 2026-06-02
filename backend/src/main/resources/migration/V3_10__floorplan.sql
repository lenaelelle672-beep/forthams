-- 平面图表
CREATE TABLE IF NOT EXISTS floor_plan (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '平面图名称',
    building VARCHAR(100) COMMENT '楼栋',
    floor VARCHAR(50) COMMENT '楼层',
    image_url VARCHAR(500) NOT NULL COMMENT '平面图图片URL',
    image_width INT COMMENT '图片宽度px',
    image_height INT COMMENT '图片高度px',
    description VARCHAR(500),
    created_by BIGINT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平面图';

-- 平面图资产坐标映射表
CREATE TABLE IF NOT EXISTS floor_plan_asset (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    plan_id BIGINT NOT NULL COMMENT '平面图ID',
    asset_id BIGINT NOT NULL COMMENT '资产ID',
    pos_x DECIMAL(10,4) NOT NULL COMMENT 'X坐标(百分比0-100)',
    pos_y DECIMAL(10,4) NOT NULL COMMENT 'Y坐标(百分比0-100)',
    label VARCHAR(100) COMMENT '标注文字',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_fpa_plan (plan_id),
    INDEX idx_fpa_asset (asset_id),
    FOREIGN KEY (plan_id) REFERENCES floor_plan(id),
    FOREIGN KEY (asset_id) REFERENCES asset(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平面图资产坐标映射';
