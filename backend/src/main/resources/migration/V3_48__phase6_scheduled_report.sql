-- V3_44__phase6_scheduled_report.sql
-- Phase 6: T6.7 定时报表+邮件推送 — scheduled_report 表 + 权限种子
-- 幂等设计（IF NOT EXISTS / ON DUPLICATE KEY UPDATE），可重复执行
-- Menu IDs: 252-256

CREATE TABLE IF NOT EXISTS scheduled_report (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    saved_report_id BIGINT COMMENT '关联已保存报表ID',
    cron_expr VARCHAR(128) NOT NULL COMMENT 'CRON表达式, 如 0 0 8 * * MON',
    recipient_emails TEXT COMMENT '收件人邮箱列表(JSON数组)',
    format VARCHAR(16) DEFAULT 'PDF' COMMENT 'PDF/EXCEL',
    status VARCHAR(16) DEFAULT 'ACTIVE' COMMENT 'ACTIVE/PAUSED',
    last_run_at DATETIME COMMENT '上次执行时间',
    next_run_at DATETIME COMMENT '下次执行时间',
    subject VARCHAR(256) COMMENT '邮件主题模板',
    tenant_id VARCHAR(64) NOT NULL,
    created_by BIGINT,
    deleted TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sr_tenant (tenant_id, deleted),
    INDEX idx_sr_status (status),
    INDEX idx_sr_next_run (next_run_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定时报表配置表';

-- 权限种子
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, perms, icon, visible, status) VALUES
    (252, '定时报表', 0, 28, 'M', 'scheduled-report:query', 'clock', 1, 1),
    (253, '定时报表查询', 252, 1, 'F', 'scheduled-report:query', NULL, 1, 1),
    (254, '定时报表新增', 252, 2, 'F', 'scheduled-report:create', NULL, 1, 1),
    (255, '定时报表编辑', 252, 3, 'F', 'scheduled-report:edit', NULL, 1, 1),
    (256, '定时报表删除', 252, 4, 'F', 'scheduled-report:remove', NULL, 1, 1)
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 252), (1, 253), (1, 254), (1, 255), (1, 256)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);
