-- =============================================================================
-- Migration V3.5: 流程邮件精细化配置
--
-- 1. bpm_mail_config — 流程节点的邮件配置
-- 2. bpm_mail_variable — 邮件变量定义
-- 3. 预置变量和流程配置种子数据
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. bpm_mail_config 流程邮件配置表
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bpm_mail_config (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    process_type      VARCHAR(50) NOT NULL COMMENT '流程类型(RETIREMENT/WORK_ORDER/PURCHASE/MAINTENANCE/INVENTORY)',
    process_name      VARCHAR(100) COMMENT '流程名称',
    node_id           VARCHAR(50) COMMENT '流程节点ID(空=通用配置)',
    node_name         VARCHAR(100) COMMENT '节点名称',
    subject_template  TEXT COMMENT '主题模板(支持${assetName}${processNo}等变量)',
    content_template  TEXT COMMENT '内容模板(支持${assetName}${processNo}等变量)',
    to_recipients     TEXT COMMENT '主送人配置(支持固定邮箱/角色/部门/变量)',
    cc_recipients     TEXT COMMENT '抄送人',
    enabled           TINYINT DEFAULT 1 COMMENT '是否启用 0-禁用 1-启用',
    remark            VARCHAR(500) COMMENT '备注',
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_bmc_process (process_type),
    INDEX idx_bmc_node (process_type, node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='流程邮件配置';

-- ---------------------------------------------------------------------------
-- 2. bpm_mail_variable 邮件变量定义表
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bpm_mail_variable (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    var_key           VARCHAR(50) NOT NULL COMMENT '变量KEY',
    var_name          VARCHAR(100) COMMENT '变量名称',
    default_value     VARCHAR(200) COMMENT '默认值',
    remark            VARCHAR(500) COMMENT '备注',
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_bmv_key (var_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邮件变量定义';

-- ---------------------------------------------------------------------------
-- 3. 预置变量
-- ---------------------------------------------------------------------------
INSERT INTO bpm_mail_variable (var_key, var_name, default_value, remark) VALUES
('assetName',     '资产名称',     '资产名称',      '资产名称变量'),
('processNo',     '流程编号',     'PROC20240001', '流程/工单编号'),
('applicantName', '申请人姓名',   '申请人',        '流程发起人姓名'),
('approverName',  '审批人姓名',   '审批人',        '当前审批人姓名'),
('deptName',      '部门名称',     '部门名称',      '发起人所属部门'),
('amount',        '金额',         '0.00',         '涉及金额'),
('approvalUrl',   '审批链接',     'https://',     '审批跳转链接'),
('remark',        '备注',         '备注内容',     '备注信息')
ON DUPLICATE KEY UPDATE var_name = VALUES(var_name);

-- ---------------------------------------------------------------------------
-- 4. 预置流程邮件配置
-- ---------------------------------------------------------------------------
INSERT INTO bpm_mail_config (process_type, process_name, node_id, node_name, subject_template, content_template, to_recipients, cc_recipients, enabled, remark) VALUES
('RETIREMENT', '报废流程', NULL, '通用配置',
 '【资产管理】报废流程 - ${processNo}',
 '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>报废流程通知</title></head><body style="margin:0;padding:20px;font-family:&quot;Microsoft YaHei&quot;,sans-serif;background:#f5f5f5;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:30px;box-shadow:0 2px 8px rgba(0,0,0,.1);"><h2 style="color:#1a1a1a;border-bottom:2px solid #3b82f6;padding-bottom:12px;">报废流程通知</h2><p style="color:#555;line-height:1.8;">资产名称：<strong style="color:#1a1a1a;">${assetName}</strong></p><p style="color:#555;line-height:1.8;">流程编号：<strong style="color:#1a1a1a;">${processNo}</strong></p><p style="color:#555;line-height:1.8;">申请人：<strong style="color:#1a1a1a;">${applicantName}</strong></p><p style="color:#555;line-height:1.8;">部门：<strong style="color:#1a1a1a;">${deptName}</strong></p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;">本邮件由系统自动发送，请勿回复。</div></div></body></html>',
 '${applicantName}', '', 1, NULL),
('WORK_ORDER', '工单流程', NULL, '通用配置',
 '【资产管理】工单通知 - ${processNo}',
 '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>工单流程通知</title></head><body style="margin:0;padding:20px;font-family:&quot;Microsoft YaHei&quot;,sans-serif;background:#f5f5f5;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:30px;box-shadow:0 2px 8px rgba(0,0,0,.1);"><h2 style="color:#1a1a1a;border-bottom:2px solid #22c55e;padding-bottom:12px;">工单流程通知</h2><p style="color:#555;line-height:1.8;">资产名称：<strong style="color:#1a1a1a;">${assetName}</strong></p><p style="color:#555;line-height:1.8;">工单编号：<strong style="color:#1a1a1a;">${processNo}</strong></p><p style="color:#555;line-height:1.8;">申请人：<strong style="color:#1a1a1a;">${applicantName}</strong></p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;">本邮件由系统自动发送，请勿回复。</div></div></body></html>',
 '${applicantName}', '', 1, NULL),
('PURCHASE', '采购流程', NULL, '通用配置',
 '【资产管理】采购通知 - ${processNo}',
 '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>采购流程通知</title></head><body style="margin:0;padding:20px;font-family:&quot;Microsoft YaHei&quot;,sans-serif;background:#f5f5f5;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:30px;box-shadow:0 2px 8px rgba(0,0,0,.1);"><h2 style="color:#1a1a1a;border-bottom:2px solid #f59e0b;padding-bottom:12px;">采购流程通知</h2><p style="color:#555;line-height:1.8;">采购编号：<strong style="color:#1a1a1a;">${processNo}</strong></p><p style="color:#555;line-height:1.8;">资产名称：<strong style="color:#1a1a1a;">${assetName}</strong></p><p style="color:#555;line-height:1.8;">金额：<strong style="color:#1a1a1a;">${amount}</strong></p><p style="color:#555;line-height:1.8;">申请人：<strong style="color:#1a1a1a;">${applicantName}</strong></p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;">本邮件由系统自动发送，请勿回复。</div></div></body></html>',
 '${applicantName}', '', 1, NULL),
('MAINTENANCE', '维保流程', NULL, '通用配置',
 '【资产管理】维保通知 - ${processNo}',
 '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>维保流程通知</title></head><body style="margin:0;padding:20px;font-family:&quot;Microsoft YaHei&quot;,sans-serif;background:#f5f5f5;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:30px;box-shadow:0 2px 8px rgba(0,0,0,.1);"><h2 style="color:#1a1a1a;border-bottom:2px solid #8b5cf6;padding-bottom:12px;">维保流程通知</h2><p style="color:#555;line-height:1.8;">资产名称：<strong style="color:#1a1a1a;">${assetName}</strong></p><p style="color:#555;line-height:1.8;">工单编号：<strong style="color:#1a1a1a;">${processNo}</strong></p><p style="color:#555;line-height:1.8;">申请人：<strong style="color:#1a1a1a;">${applicantName}</strong></p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;">本邮件由系统自动发送，请勿回复。</div></div></body></html>',
 '${applicantName}', '', 1, NULL),
('INVENTORY', '盘点流程', NULL, '通用配置',
 '【资产管理】盘点通知 - ${processNo}',
 '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>盘点流程通知</title></head><body style="margin:0;padding:20px;font-family:&quot;Microsoft YaHei&quot;,sans-serif;background:#f5f5f5;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:30px;box-shadow:0 2px 8px rgba(0,0,0,.1);"><h2 style="color:#1a1a1a;border-bottom:2px solid #06b6d4;padding-bottom:12px;">盘点流程通知</h2><p style="color:#555;line-height:1.8;">盘点编号：<strong style="color:#1a1a1a;">${processNo}</strong></p><p style="color:#555;line-height:1.8;">资产名称：<strong style="color:#1a1a1a;">${assetName}</strong></p><p style="color:#555;line-height:1.8;">申请人：<strong style="color:#1a1a1a;">${applicantName}</strong></p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;">本邮件由系统自动发送，请勿回复。</div></div></body></html>',
 '${applicantName}', '', 1, NULL)
ON DUPLICATE KEY UPDATE process_name = VALUES(process_name);
