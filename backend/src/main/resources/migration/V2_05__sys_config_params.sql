-- =============================================================================
-- Migration V2.5: 系统参数扩展 — sys_config 表追加 RuoYi 风格字段
--
-- 1. 新增 config_name / config_type / remark / status 列
-- 2. 为 config_key 添加索引
-- 3. 插入系统初始化种子数据
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. 追加字段（IF NOT EXISTS 防护，兼容重复执行）
-- ---------------------------------------------------------------------------
SET @col_config_name = (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'sys_config' AND column_name = 'config_name');
SET @sql1 = IF(@col_config_name = 0,
    'ALTER TABLE sys_config ADD COLUMN config_name VARCHAR(256) DEFAULT NULL COMMENT ''参数名称'' AFTER config_value',
    'SELECT 1');
PREPARE stmt1 FROM @sql1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @col_config_type = (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'sys_config' AND column_name = 'config_type');
SET @sql2 = IF(@col_config_type = 0,
    'ALTER TABLE sys_config ADD COLUMN config_type CHAR(1) DEFAULT ''N'' COMMENT ''系统内置(Y)/自定义(N)'' AFTER config_name',
    'SELECT 1');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

SET @col_remark = (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'sys_config' AND column_name = 'remark');
SET @sql3 = IF(@col_remark = 0,
    'ALTER TABLE sys_config ADD COLUMN remark TEXT COMMENT ''备注'' AFTER config_type',
    'SELECT 1');
PREPARE stmt3 FROM @sql3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;

SET @col_status = (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'sys_config' AND column_name = 'status');
SET @sql4 = IF(@col_status = 0,
    'ALTER TABLE sys_config ADD COLUMN status TINYINT DEFAULT 0 COMMENT ''状态(0正常/1停用)'' AFTER remark',
    'SELECT 1');
PREPARE stmt4 FROM @sql4; EXECUTE stmt4; DEALLOCATE PREPARE stmt4;

-- ---------------------------------------------------------------------------
-- 2. 为已有数据设置默认值：已有配置视为系统内置 (Y)
-- ---------------------------------------------------------------------------
UPDATE sys_config SET config_type = 'Y', config_name = config_key, status = 0 WHERE config_type IS NULL;

-- ---------------------------------------------------------------------------
-- 3. 为 config_key 添加索引（幂等）
-- ---------------------------------------------------------------------------
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'sys_config' AND index_name = 'idx_config_key');
SET @sql5 = IF(@idx_exists = 0,
    'ALTER TABLE sys_config ADD INDEX idx_config_key (config_key)',
    'SELECT 1');
PREPARE stmt5 FROM @sql5; EXECUTE stmt5; DEALLOCATE PREPARE stmt5;

-- ---------------------------------------------------------------------------
-- 4. 种子数据（幂等插入：根据 config_key 防重）
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO sys_config (tenant_id, config_group, config_key, config_value, config_name, config_type, remark, status)
VALUES
('GLOBAL', 'SYSTEM', 'ams.email.enabled',       'true',  '邮件发送启用',       'Y', '全局邮件发送开关',   0),
('GLOBAL', 'SYSTEM', 'ams.sms.enabled',         'false', '短信发送启用',       'Y', '全局短信发送开关',   0),
('GLOBAL', 'SYSTEM', 'ams.dingtalk.enabled',    'true',  '钉钉通知启用',       'Y', '全局钉钉通知开关',   0),
('GLOBAL', 'SYSTEM', 'ams.wechat.enabled',      'false', '企业微信通知启用',   'Y', '全局企业微信通知开关', 0),
('GLOBAL', 'SYSTEM', 'ams.utilization.period',  '30',    '资产利用率计算周期(天)', 'Y', '利用率统计周期',   0),
('GLOBAL', 'SYSTEM', 'ams.maintenance.advance.days', '7', '维保提前预警天数', 'Y', '维保到期前提前通知天数', 0),
('GLOBAL', 'SYSTEM', 'ams.approval.timeout.hours', '48', '审批超时提醒(小时)', 'Y', '审批超时未处理自动提醒', 0),
('GLOBAL', 'SYSTEM', 'ams.system.name',         'forthAMS', '系统名称',      'Y', '系统显示名称',       0);

-- 同时向 KV 配置组合插入便于业务方查询
INSERT IGNORE INTO sys_config (tenant_id, config_group, config_key, config_value, config_name, config_type, remark, status)
VALUES
('GLOBAL', 'SYSTEM', 'ams.maintenance.advance.days.v2', '7', '维保提前预警天数', 'Y', '维保到期前提前通知天数(新版)', 0);
