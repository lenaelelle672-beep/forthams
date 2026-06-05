-- V3_22: SLA 持久化与配置
-- 1. work_order 表增加 sla_deadline 和 sla_status 列（原为 transient 字段）
-- 2. 新建 sla_config 表：按优先级配置 SLA 响应/解决时限

-- ── work_order 表增加 SLA 持久列 ──────────────────────────

ALTER TABLE work_order
    ADD COLUMN sla_deadline DATETIME NULL COMMENT 'SLA 截止时间（服务端根据优先级计算）',
    ADD COLUMN sla_status VARCHAR(32) NULL DEFAULT 'NORMAL' COMMENT 'SLA 状态: NORMAL/WARNING/BREACHED';

-- 为 SLA 监控定时任务创建索引
CREATE INDEX idx_work_order_sla ON work_order (tenant_id, sla_status, sla_deadline);

-- ── SLA 配置表 ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sla_config (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id       VARCHAR(64)  NOT NULL COMMENT '租户 ID',
    priority        VARCHAR(32)  NOT NULL COMMENT '工单优先级: LOW/MEDIUM/HIGH/CRITICAL',
    response_hours  INT          NOT NULL DEFAULT 48 COMMENT '响应时限（小时）',
    resolve_hours   INT          NOT NULL DEFAULT 168 COMMENT '解决时限（小时）',
    warning_ratio   DECIMAL(3,2) NOT NULL DEFAULT 0.80 COMMENT '预警阈值比例（如 0.80 = 80% 时间消耗时告警）',
    status          TINYINT      NOT NULL DEFAULT 1 COMMENT '状态: 1=启用 0=禁用',
    create_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tenant_priority (tenant_id, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SLA 配置表（按工单优先级设定响应/解决时限）';

-- ── 插入默认 SLA 配置（全局租户） ──────────────────────────

INSERT INTO sla_config (tenant_id, priority, response_hours, resolve_hours, warning_ratio) VALUES
('0', 'LOW',      72, 336, 0.80),
('0', 'MEDIUM',   48, 168, 0.80),
('0', 'HIGH',     24,  72, 0.80),
('0', 'CRITICAL',  8,  24, 0.80);
