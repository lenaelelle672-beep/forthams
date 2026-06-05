-- =============================================================================
-- Migration V2.8: 资产使用率/利用率统计
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. asset_usage_log 资产使用记录表
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_usage_log (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    asset_id        BIGINT NOT NULL COMMENT '资产 ID',
    user_id         BIGINT DEFAULT NULL COMMENT '使用者 ID',
    action          VARCHAR(32) NOT NULL COMMENT '动作：CHECKOUT/CHECKIN/USE/RETURN',
    usage_date      DATE NOT NULL COMMENT '使用日期',
    duration_hours  DECIMAL(8,2) DEFAULT 0.00 COMMENT '使用时长（小时）',
    remark          VARCHAR(512) DEFAULT NULL COMMENT '备注',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_aul_asset (asset_id),
    INDEX idx_aul_user (user_id),
    INDEX idx_aul_date (usage_date),
    INDEX idx_aul_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产使用记录表';

-- ---------------------------------------------------------------------------
-- 2. asset_utilization_snapshot 利用率快照表
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_utilization_snapshot (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    asset_id        BIGINT NOT NULL COMMENT '资产 ID',
    period_type     VARCHAR(16) NOT NULL COMMENT '周期类型：DAILY/WEEKLY/MONTHLY',
    period_start    DATE NOT NULL COMMENT '周期开始日期',
    period_end      DATE NOT NULL COMMENT '周期结束日期',
    total_hours     DECIMAL(8,2) DEFAULT 0.00 COMMENT '应工作时长（小时）',
    used_hours      DECIMAL(8,2) DEFAULT 0.00 COMMENT '实际使用时长（小时）',
    utilization_rate DECIMAL(5,2) DEFAULT 0.00 COMMENT '利用率（百分比）',
    idle_hours      DECIMAL(8,2) DEFAULT 0.00 COMMENT '闲置时长（小时）',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_aus_asset (asset_id),
    INDEX idx_aus_period (period_type, period_start),
    INDEX idx_aus_asset_period (asset_id, period_type, period_start),
    UNIQUE KEY uk_aus_asset_period (asset_id, period_type, period_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产利用率快照表';

-- ---------------------------------------------------------------------------
-- 3. 初始化一些使用记录样本（方便测试）
-- ---------------------------------------------------------------------------
INSERT INTO asset_usage_log (asset_id, user_id, action, usage_date, duration_hours, remark)
SELECT a.id, 1, 'USE', CURDATE() - INTERVAL seq.n DAY, ROUND(RAND() * 8 + 1, 1), '日常使用'
FROM asset a
CROSS JOIN (
    SELECT 0 AS n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
    UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
    UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14
) seq
WHERE a.deleted = 0 AND a.status = 'IN_USE'
  AND (SELECT COUNT(*) FROM asset_usage_log) = 0
LIMIT 200;
