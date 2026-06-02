-- =============================================================================
-- Migration V2.1: 邮件模板引擎 — sys_mail_template + sys_mail_log 表
--
-- 1. sys_mail_template — 邮件模板定义（Thymeleaf 渲染）
-- 2. sys_mail_log    — 邮件发送日志（含重试追踪）
-- 3. 预置 5 个内置邮件模板
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. sys_mail_template 邮件模板表
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_mail_template (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id        VARCHAR(64) DEFAULT 'GLOBAL' COMMENT '租户ID',
    template_code    VARCHAR(64) NOT NULL COMMENT '模板编码',
    template_name    VARCHAR(128) NOT NULL COMMENT '模板名称',
    category         VARCHAR(64) DEFAULT 'general' COMMENT '模板分类',
    subject_template VARCHAR(256) NOT NULL COMMENT '邮件主题模板（支持 ${} 变量）',
    content_template TEXT NOT NULL COMMENT '邮件正文 HTML（Thymeleaf 模板）',
    content_type     VARCHAR(32) DEFAULT 'text/html' COMMENT '内容类型',
    variables        TEXT COMMENT '变量定义 JSON，如 ["applicantName","assetCode"]',
    is_builtin       TINYINT DEFAULT 0 COMMENT '是否内置模板（0-否 1-是）',
    status           TINYINT DEFAULT 1 COMMENT '状态（0-停用 1-启用）',
    create_by        VARCHAR(64) COMMENT '创建人',
    create_time      DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by        VARCHAR(64) COMMENT '更新人',
    update_time      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted          TINYINT DEFAULT 0 COMMENT '逻辑删除标记',
    UNIQUE INDEX idx_mt_code (template_code),
    INDEX idx_mt_status (status),
    INDEX idx_mt_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邮件模板表';

-- ---------------------------------------------------------------------------
-- 2. sys_mail_log 邮件发送日志表
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_mail_log (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id        VARCHAR(64) DEFAULT 'GLOBAL' COMMENT '租户ID',
    template_code    VARCHAR(64) COMMENT '模板编码',
    mail_from        VARCHAR(128) COMMENT '发件人',
    mail_to          VARCHAR(512) NOT NULL COMMENT '收件人（多个用逗号分隔）',
    mail_cc          VARCHAR(512) COMMENT '抄送',
    mail_bcc         VARCHAR(512) COMMENT '密送',
    subject          VARCHAR(256) COMMENT '邮件主题',
    content          TEXT COMMENT '邮件正文（渲染后 HTML）',
    send_status      VARCHAR(16) DEFAULT 'PENDING' COMMENT '发送状态 PENDING/SUCCESS/FAILED',
    error_message    VARCHAR(1024) COMMENT '失败原因',
    retry_count      TINYINT DEFAULT 0 COMMENT '已重试次数',
    max_retry        TINYINT DEFAULT 3 COMMENT '最大重试次数',
    biz_type         VARCHAR(64) COMMENT '业务类型',
    biz_id           BIGINT COMMENT '业务ID',
    send_time        DATETIME COMMENT '发送时间',
    create_time      DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ml_status (send_status),
    INDEX idx_ml_send_time (send_time),
    INDEX idx_ml_biz (biz_type, biz_id),
    INDEX idx_ml_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邮件发送日志表';

-- ---------------------------------------------------------------------------
-- 3. 预置 5 个内置邮件模板
-- ---------------------------------------------------------------------------
INSERT INTO sys_mail_template (template_code, template_name, category, subject_template, content_template, content_type, variables, is_builtin, status, create_by) VALUES
('retirement_submitted', '资产报废申请提交通知', 'retirement',
 '【资产管理】新的报废申请 - ${assetCode}',
 '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>报废申请提交</title></head><body style="margin:0;padding:20px;font-family:\"Microsoft YaHei\",sans-serif;background:#f5f5f5;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:30px;box-shadow:0 2px 8px rgba(0,0,0,.1);"><h2 style="color:#1a1a1a;border-bottom:2px solid #3b82f6;padding-bottom:12px;">新的报废申请</h2><p style="color:#555;line-height:1.8;">申请人：<strong style="color:#1a1a1a;">${applicantName}</strong></p><p style="color:#555;line-height:1.8;">资产编码：<strong style="color:#1a1a1a;">${assetCode}</strong></p><p style="color:#555;line-height:1.8;">资产名称：<strong style="color:#1a1a1a;">${assetName}</strong></p><p style="color:#555;line-height:1.8;">申请时间：<strong style="color:#1a1a1a;">${applyTime}</strong></p><p style="color:#555;line-height:1.8;">请登录系统审批。</p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;">本邮件由系统自动发送，请勿回复。</div></div></body></html>',
 'text/html', '["applicantName","assetCode","assetName","applyTime"]', 1, 1, 'SYSTEM'),

('retirement_approved', '资产报废申请审批通过', 'retirement',
 '【资产管理】报废申请已通过 - ${assetCode}',
 '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>报废申请通过</title></head><body style="margin:0;padding:20px;font-family:\"Microsoft YaHei\",sans-serif;background:#f5f5f5;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:30px;box-shadow:0 2px 8px rgba(0,0,0,.1);"><h2 style="color:#1a1a1a;border-bottom:2px solid #22c55e;padding-bottom:12px;">报废申请已审批通过</h2><p style="color:#555;line-height:1.8;">您的资产 <strong style="color:#1a1a1a;">${assetCode}</strong>（${assetName}）的报废申请已通过。</p><p style="color:#555;line-height:1.8;">审批人：<strong style="color:#1a1a1a;">${approverName}</strong></p><p style="color:#555;line-height:1.8;">审批时间：<strong style="color:#1a1a1a;">${approveTime}</strong></p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;">本邮件由系统自动发送，请勿回复。</div></div></body></html>',
 'text/html', '["assetCode","assetName","approverName","approveTime"]', 1, 1, 'SYSTEM'),

('retirement_rejected', '资产报废申请审批驳回', 'retirement',
 '【资产管理】报废申请已驳回 - ${assetCode}',
 '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>报废申请驳回</title></head><body style="margin:0;padding:20px;font-family:\"Microsoft YaHei\",sans-serif;background:#f5f5f5;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:30px;box-shadow:0 2px 8px rgba(0,0,0,.1);"><h2 style="color:#1a1a1a;border-bottom:2px solid #ef4444;padding-bottom:12px;">报废申请已驳回</h2><p style="color:#555;line-height:1.8;">您的资产 <strong style="color:#1a1a1a;">${assetCode}</strong>（${assetName}）的报废申请被驳回。</p><p style="color:#555;line-height:1.8;">驳回原因：<strong style="color:#dc2626;">${rejectReason}</strong></p><p style="color:#555;line-height:1.8;">审批人：<strong style="color:#1a1a1a;">${approverName}</strong></p><p style="color:#555;line-height:1.8;">审批时间：<strong style="color:#1a1a1a;">${approveTime}</strong></p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;">本邮件由系统自动发送，请勿回复。</div></div></body></html>',
 'text/html', '["assetCode","assetName","rejectReason","approverName","approveTime"]', 1, 1, 'SYSTEM'),

('approval_reminder', '资产报废申请审批催办', 'retirement',
 '【资产管理】审批催办 - ${assetCode}',
 '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>审批催办</title></head><body style="margin:0;padding:20px;font-family:\"Microsoft YaHei\",sans-serif;background:#f5f5f5;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:30px;box-shadow:0 2px 8px rgba(0,0,0,.1);"><h2 style="color:#1a1a1a;border-bottom:2px solid #f59e0b;padding-bottom:12px;">审批催办提醒</h2><p style="color:#555;line-height:1.8;">资产 <strong style="color:#1a1a1a;">${assetCode}</strong>（${assetName}）的报废申请已等待审批超过 <strong style="color:#dc2626;">${hours}</strong> 小时。</p><p style="color:#555;line-height:1.8;">请尽快登录系统处理。</p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;">本邮件由系统自动发送，请勿回复。</div></div></body></html>',
 'text/html', '["assetCode","assetName","hours"]', 1, 1, 'SYSTEM'),

('maintenance_reminder', '维保到期预警通知', 'maintenance',
 '【资产管理】维保到期预警 - ${assetCode}',
 '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>维保到期预警</title></head><body style="margin:0;padding:20px;font-family:\"Microsoft YaHei\",sans-serif;background:#f5f5f5;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:30px;box-shadow:0 2px 8px rgba(0,0,0,.1);"><h2 style="color:#1a1a1a;border-bottom:2px solid #f59e0b;padding-bottom:12px;">维保到期预警</h2><p style="color:#555;line-height:1.8;">资产 <strong style="color:#1a1a1a;">${assetCode}</strong>（${assetName}）的维保计划将于 <strong style="color:#dc2626;">${dueDate}</strong> 到期。</p><p style="color:#555;line-height:1.8;">计划类型：<strong style="color:#1a1a1a;">${planType}</strong></p><p style="color:#555;line-height:1.8;">距到期还有 <strong style="color:#f59e0b;">${daysLeft}</strong> 天，请提前安排维保。</p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;">本邮件由系统自动发送，请勿回复。</div></div></body></html>',
 'text/html', '["assetCode","assetName","dueDate","planType","daysLeft"]', 1, 1, 'SYSTEM');
