-- 能源读数记录表
CREATE TABLE IF NOT EXISTS energy_meter (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    asset_id BIGINT NOT NULL COMMENT '关联资产ID',
    meter_type VARCHAR(20) NOT NULL COMMENT '表类型 ELECTRICITY/WATER/GAS',
    reading_value DECIMAL(12,2) NOT NULL COMMENT '读数',
    unit VARCHAR(20) DEFAULT 'kWh' COMMENT '单位',
    reading_date DATE NOT NULL COMMENT '读数日期',
    reader VARCHAR(50) COMMENT '抄表人',
    remark VARCHAR(500),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_em_asset (asset_id),
    INDEX idx_em_date (reading_date),
    INDEX idx_em_type (meter_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='能源读数记录';

-- 能耗汇总表
CREATE TABLE IF NOT EXISTS energy_consumption (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    asset_id BIGINT NOT NULL COMMENT '关联资产ID',
    meter_type VARCHAR(20) NOT NULL COMMENT '表类型',
    period_type VARCHAR(10) NOT NULL COMMENT '汇总周期 DAY/MONTH/YEAR',
    period_start DATE NOT NULL COMMENT '周期开始',
    period_end DATE NOT NULL COMMENT '周期结束',
    consumption DECIMAL(12,2) NOT NULL COMMENT '消耗量',
    unit VARCHAR(20) DEFAULT 'kWh',
    cost DECIMAL(12,2) COMMENT '费用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_ec_period (asset_id, meter_type, period_type, period_start),
    INDEX idx_ec_asset (asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='能耗汇总';
