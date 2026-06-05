-- =============================================================================
-- Migration V2.4: 维保计划扩展 — maintenance_plan 表
--
-- 1. maintenance_plan — 维保计划表
-- 2. maintenance_record 增加 next_maintenance_date 索引
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. maintenance_plan 维保计划表
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_plan (
    id                   BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id            VARCHAR(64) NOT NULL COMMENT '租户ID',
    plan_name            VARCHAR(256) NOT NULL COMMENT '计划名称',
    asset_id             BIGINT NOT NULL COMMENT '关联资产ID',
    trigger_type         VARCHAR(32) NOT NULL DEFAULT 'manual' COMMENT '触发类型 manual/daily/weekly/monthly/yearly',
    interval_days        INT DEFAULT NULL COMMENT '间隔天数（trigger_type=manual 时使用）',
    day_of_week          INT DEFAULT NULL COMMENT '每周星期几 1-7（trigger_type=weekly）',
    day_of_month         INT DEFAULT NULL COMMENT '每月第几天 1-31（trigger_type=monthly）',
    month_of_year        INT DEFAULT NULL COMMENT '每年第几个月 1-12（trigger_type=yearly）',
    start_date           DATE NOT NULL COMMENT '计划开始日期',
    end_date             DATE DEFAULT NULL COMMENT '结束日期 null=无限制',
    last_generated_date  DATE DEFAULT NULL COMMENT '上次生成日期',
    next_due_date        DATE DEFAULT NULL COMMENT '下次到期日',
    estimated_cost       DECIMAL(10,2) DEFAULT NULL COMMENT '预估费用',
    default_executor     VARCHAR(128) DEFAULT NULL COMMENT '默认执行人',
    default_content      TEXT COMMENT '默认维保内容',
    priority             VARCHAR(32) DEFAULT 'NORMAL' COMMENT '优先级 URGENT/HIGH/NORMAL/LOW',
    status               VARCHAR(32) DEFAULT 'ACTIVE' COMMENT '状态 ACTIVE/PAUSED/COMPLETED/CANCELED',
    vendor_id            BIGINT DEFAULT NULL COMMENT '关联供应商ID',
    remark               TEXT COMMENT '备注',
    create_by            BIGINT COMMENT '创建人ID',
    create_time          DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted              TINYINT DEFAULT 0 COMMENT '逻辑删除标记',
    INDEX idx_mplan_tenant (tenant_id),
    INDEX idx_mplan_asset (asset_id),
    INDEX idx_mplan_next_due (next_due_date),
    INDEX idx_mplan_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='维保计划表';

-- ---------------------------------------------------------------------------
-- 2. 为 maintenance_record.next_maintenance_date 添加索引（幂等）
-- ---------------------------------------------------------------------------
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'maintenance_record' AND index_name = 'idx_mr_next_maintenance_date');
SET @sql = IF(@idx_exists = 0,
    'CREATE INDEX idx_mr_next_maintenance_date ON maintenance_record(next_maintenance_date)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
