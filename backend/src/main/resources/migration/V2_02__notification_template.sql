-- =============================================================================
-- Migration V2.2: 通知模板 — notification_template 表
--
-- 1. notification_template — 通知模板定义
-- 2. 预置 5 个内置通知模板（退休/报废 4 个 + 维保到期 1 个）
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. notification_template 通知模板表
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_template (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id        VARCHAR(64) DEFAULT 'GLOBAL' COMMENT '租户ID',
    template_code    VARCHAR(64) NOT NULL COMMENT '模板编码',
    template_name    VARCHAR(128) NOT NULL COMMENT '模板名称',
    category         VARCHAR(64) DEFAULT 'general' COMMENT '模板分类（retirement/maintenance/approval/system）',
    channel_type     VARCHAR(32) DEFAULT 'ALL' COMMENT '默认通知渠道（IN_APP/EMAIL/ALL）',
    title_template   VARCHAR(256) NOT NULL COMMENT '通知标题模板（支持 ${} 变量）',
    content_template TEXT NOT NULL COMMENT '通知内容模板（支持 ${} 变量）',
    variables        TEXT COMMENT '变量定义 JSON',
    is_builtin       TINYINT DEFAULT 0 COMMENT '是否内置（0-否 1-是）',
    status           TINYINT DEFAULT 1 COMMENT '状态（0-停用 1-启用）',
    create_by        VARCHAR(64) COMMENT '创建人',
    create_time      DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by        VARCHAR(64) COMMENT '更新人',
    update_time      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted          TINYINT DEFAULT 0 COMMENT '逻辑删除标记',
    UNIQUE INDEX idx_nt_code (template_code),
    INDEX idx_nt_category (category),
    INDEX idx_nt_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知模板表';

-- ---------------------------------------------------------------------------
-- 2. 预置 5 个内置通知模板
-- ---------------------------------------------------------------------------
INSERT INTO notification_template (template_code, template_name, category, channel_type, title_template, content_template, variables, is_builtin, status, create_by) VALUES
('retirement_submitted', '退休申请提交通知', 'retirement', 'ALL',
 '新的报废申请',
 '申请人 ${applicantName} 提交了资产 ${assetCode}（${assetName}）的报废申请，请审批。',
 '["applicantName","assetCode","assetName","applyTime"]', 1, 1, 'SYSTEM'),

('retirement_approved', '退休申请审批通过通知', 'retirement', 'ALL',
 '报废申请已通过 - ${assetCode}',
 '您的资产 ${assetCode}（${assetName}）的报废申请已审批通过。',
 '["assetCode","assetName","approverName","approveTime"]', 1, 1, 'SYSTEM'),

('retirement_rejected', '退休申请审批驳回通知', 'retirement', 'ALL',
 '报废申请已驳回 - ${assetCode}',
 '您的资产 ${assetCode}（${assetName}）的报废申请被驳回，原因：${rejectReason}。',
 '["assetCode","assetName","rejectReason","approverName","approveTime"]', 1, 1, 'SYSTEM'),

('retirement_reminder', '审批催办通知', 'retirement', 'ALL',
 '审批催办 - ${assetCode}',
 '资产 ${assetCode}（${assetName}）的报废申请已等待审批超过 ${hours} 小时，请尽快处理。',
 '["assetCode","assetName","hours"]', 1, 1, 'SYSTEM'),

('maintenance_due', '维保到期预警通知', 'maintenance', 'ALL',
 '维保到期预警 - ${assetCode}',
 '资产 ${assetCode}（${assetName}）的维保计划「${planName}」将于 ${dueDate} 到期，请提前安排维保。',
 '["assetCode","assetName","planName","dueDate","daysLeft"]', 1, 1, 'SYSTEM')
ON DUPLICATE KEY UPDATE template_name = VALUES(template_name), content_template = VALUES(content_template);
