-- SAM 合规扫描记录表
CREATE TABLE IF NOT EXISTS sam_compliance_scan (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    scan_date DATETIME NOT NULL COMMENT '扫描时间',
    total_licenses INT DEFAULT 0 COMMENT '总许可数',
    compliant_count INT DEFAULT 0 COMMENT '合规数',
    overused_count INT DEFAULT 0 COMMENT '超用数',
    underused_count INT DEFAULT 0 COMMENT '闲置数',
    expired_count INT DEFAULT 0 COMMENT '过期数',
    compliance_rate DECIMAL(5,2) COMMENT '合规率(%)',
    status VARCHAR(20) DEFAULT 'COMPLETED' COMMENT '扫描状态',
    report_url VARCHAR(500) COMMENT '报告文件URL',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SAM合规扫描记录';

-- SAM 合规详情表
CREATE TABLE IF NOT EXISTS sam_compliance_detail (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    scan_id BIGINT NOT NULL COMMENT '扫描ID',
    license_id BIGINT NOT NULL COMMENT '许可ID',
    software_name VARCHAR(200) COMMENT '软件名称',
    license_type VARCHAR(50) COMMENT '许可类型',
    total_seats INT COMMENT '总席位数',
    used_seats INT COMMENT '已用席位数',
    compliance_status VARCHAR(20) NOT NULL COMMENT 'COMPLIANT/OVERUSED/UNDERUSED/EXPIRED',
    risk_level VARCHAR(10) COMMENT 'HIGH/MEDIUM/LOW',
    recommendation TEXT COMMENT '建议',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_scd_scan (scan_id),
    INDEX idx_scd_status (compliance_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SAM合规详情';
