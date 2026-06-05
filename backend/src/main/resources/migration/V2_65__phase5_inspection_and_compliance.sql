-- V3_50__phase5_inspection_and_compliance.sql
-- Phase 5: 盘点深化+合规管理 — T5.1~T5.4 全部表结构 + 权限种子 + 通知模板
-- 幂等设计（IF NOT EXISTS / ON DUPLICATE KEY UPDATE），可重复执行
-- Menu IDs: 224-247

-- ─────────────────────────────────────────────────────────────────────────────
-- T5.2: 检验/年检记录表
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspection (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    inspection_no VARCHAR(128) NOT NULL COMMENT '检验编号',
    asset_id BIGINT NOT NULL COMMENT '关联资产ID',
    inspection_type VARCHAR(32) NOT NULL COMMENT 'ANNUAL/PERIODIC/SPECIAL',
    inspection_date DATE NOT NULL COMMENT '检验日期',
    next_inspection_date DATE COMMENT '下次检验日期',
    inspection_agency VARCHAR(256) COMMENT '检验机构',
    inspector_name VARCHAR(128) COMMENT '检验人',
    result VARCHAR(32) NOT NULL COMMENT 'PASS/FAIL/CONDITIONAL',
    certificate_no VARCHAR(128) COMMENT '证书编号',
    certificate_expiry DATE COMMENT '证书到期日',
    report_attachment VARCHAR(512) COMMENT '报告附件路径',
    cost DECIMAL(12,2) DEFAULT 0.00 COMMENT '检验费用',
    tenant_id VARCHAR(64) NOT NULL,
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_insp_tenant (tenant_id, deleted),
    INDEX idx_insp_asset (asset_id),
    INDEX idx_insp_next_date (next_inspection_date),
    INDEX idx_insp_result (result)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检验/年检记录表';

-- ─────────────────────────────────────────────────────────────────────────────
-- T5.1: 循环盘点ABC分类规则表
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cycle_count_rule (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    classification VARCHAR(8) NOT NULL COMMENT 'A/B/C',
    frequency VARCHAR(16) NOT NULL COMMENT 'MONTHLY/QUARTERLY/YEARLY',
    category_ids TEXT COMMENT '适用分类ID(JSON数组)',
    min_value DECIMAL(14,2) COMMENT '最小价值',
    max_value DECIMAL(14,2) COMMENT '最大价值',
    tenant_id VARCHAR(64) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_ccr_tenant (tenant_id, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='循环盘点ABC分类规则表';

-- ─────────────────────────────────────────────────────────────────────────────
-- T5.4: 风险评估表
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_assessment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    asset_id BIGINT NOT NULL COMMENT '关联资产ID',
    probability INT NOT NULL COMMENT '可能性 1-5',
    impact INT NOT NULL COMMENT '影响程度 1-5',
    risk_level VARCHAR(16) NOT NULL COMMENT 'LOW/MEDIUM/HIGH/CRITICAL(自动计算)',
    mitigation_measures TEXT COMMENT '缓解措施',
    review_date DATE COMMENT '评审日期',
    assessor_id BIGINT COMMENT '评估人ID',
    status VARCHAR(16) DEFAULT 'PENDING' COMMENT 'PENDING/IN_PROGRESS/COMPLETED/CLOSED',
    tenant_id VARCHAR(64) NOT NULL,
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_ra_tenant (tenant_id, deleted),
    INDEX idx_ra_asset (asset_id),
    INDEX idx_ra_level (risk_level),
    INDEX idx_ra_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='风险评估表';

-- ─────────────────────────────────────────────────────────────────────────────
-- T5.3: 安全检查表模板表
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_checklist_template (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    template_name VARCHAR(256) NOT NULL COMMENT '模板名称',
    category_ids TEXT COMMENT '适用资产分类ID(JSON数组)',
    tenant_id VARCHAR(64) NOT NULL,
    status VARCHAR(16) DEFAULT 'ACTIVE' COMMENT 'ACTIVE/DISABLED',
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_sct_tenant (tenant_id, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='安全检查表模板表';

-- ─────────────────────────────────────────────────────────────────────────────
-- T5.3: 安全检查表模板项表
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_checklist_item (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT NOT NULL COMMENT '关联模板ID',
    item_name VARCHAR(512) NOT NULL COMMENT '检查项名称',
    item_type VARCHAR(32) NOT NULL COMMENT 'PASS_FAIL/READING/PHOTO/TEXT',
    sort_order INT DEFAULT 0 COMMENT '排序',
    required TINYINT DEFAULT 1 COMMENT '是否必填',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_sci_template (template_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='安全检查表模板项表';

-- ─────────────────────────────────────────────────────────────────────────────
-- T5.3: 安全检查表执行记录表
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_checklist_execution (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT NOT NULL COMMENT '关联模板ID',
    asset_id BIGINT NOT NULL COMMENT '被检资产ID',
    executor_id BIGINT NOT NULL COMMENT '执行人ID',
    execute_date DATE NOT NULL COMMENT '执行日期',
    status VARCHAR(32) DEFAULT 'IN_PROGRESS' COMMENT 'IN_PROGRESS/COMPLETED',
    overall_result VARCHAR(32) COMMENT 'PASS/FAIL/CONDITIONAL',
    tenant_id VARCHAR(64) NOT NULL,
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_sce_tenant (tenant_id, deleted),
    INDEX idx_sce_asset (asset_id),
    INDEX idx_sce_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='安全检查表执行记录表';

-- ─────────────────────────────────────────────────────────────────────────────
-- T5.3: 安全检查表执行结果明细表
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_checklist_result (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    execution_id BIGINT NOT NULL COMMENT '关联执行记录ID',
    item_id BIGINT NOT NULL COMMENT '关联检查项ID',
    result VARCHAR(32) COMMENT 'PASS/FAIL/NA',
    reading DECIMAL(12,2) COMMENT '读数（READING类型）',
    photo_url VARCHAR(512) COMMENT '照片路径（PHOTO类型）',
    note TEXT COMMENT '备注（TEXT类型）',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_scr_execution (execution_id),
    INDEX idx_scr_item (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='安全检查表执行结果明细表';

-- ─────────────────────────────────────────────────────────────────────────────
-- 通知模板种子数据
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO notification_template (template_code, title_template, content_template, category, status)
SELECT 'INS_INSPECTION_EXPIRING', '检验到期提醒', '检验单 ${inspectionNo}（资产：${assetName}，类型：${inspectionType}）将在 ${daysRemaining} 天后到期，到期日：${expiryDate}，请及时安排复检。', 'INSPECTION', 1
WHERE NOT EXISTS (SELECT 1 FROM notification_template WHERE template_code = 'INS_INSPECTION_EXPIRING');

-- ─────────────────────────────────────────────────────────────────────────────
-- sys_menu 权限种子数据 (IDs 224-247)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, perms, icon, visible, status) VALUES
    (224, '检验管理', 0, 23, 'M', 'inspection:query', 'check-circle', 1, 1),
    (225, '检验查询', 224, 1, 'F', 'inspection:query', NULL, 1, 1),
    (226, '检验新增', 224, 2, 'F', 'inspection:create', NULL, 1, 1),
    (227, '检验编辑', 224, 3, 'F', 'inspection:edit', NULL, 1, 1),
    (228, '检验删除', 224, 4, 'F', 'inspection:remove', NULL, 1, 1),
    (229, '检验报告', 224, 5, 'F', 'inspection:report', NULL, 1, 1),
    (230, '循环盘点', 0, 24, 'M', 'cycle-count:query', 'sync', 1, 1),
    (231, '盘点规则查询', 230, 1, 'F', 'cycle-count:query', NULL, 1, 1),
    (232, '盘点规则新增', 230, 2, 'F', 'cycle-count:create', NULL, 1, 1),
    (233, '盘点规则编辑', 230, 3, 'F', 'cycle-count:edit', NULL, 1, 1),
    (234, '风险评估', 0, 25, 'M', 'risk:query', 'exclamation-triangle', 1, 1),
    (235, '风险评估查询', 234, 1, 'F', 'risk:query', NULL, 1, 1),
    (236, '风险评估新增', 234, 2, 'F', 'risk:create', NULL, 1, 1),
    (237, '风险评估编辑', 234, 3, 'F', 'risk:edit', NULL, 1, 1),
    (238, '风险评估删除', 234, 4, 'F', 'risk:remove', NULL, 1, 1),
    (239, '风险热力图', 234, 5, 'F', 'risk:heatmap', NULL, 1, 1),
    (240, '安全检查表', 0, 26, 'M', 'safety:query', 'clipboard-check', 1, 1),
    (241, '检查表查询', 240, 1, 'F', 'safety:query', NULL, 1, 1),
    (242, '检查表新增', 240, 2, 'F', 'safety:create', NULL, 1, 1),
    (243, '检查表编辑', 240, 3, 'F', 'safety:edit', NULL, 1, 1),
    (244, '检查表删除', 240, 4, 'F', 'safety:remove', NULL, 1, 1),
    (245, '检查表执行', 240, 5, 'F', 'safety:execute', NULL, 1, 1),
    (246, '检查表历史', 240, 6, 'F', 'safety:history', NULL, 1, 1),
    (247, '整改工单', 240, 7, 'F', 'safety:remedy', NULL, 1, 1)
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 224), (1, 225), (1, 226), (1, 227), (1, 228), (1, 229),
    (1, 230), (1, 231), (1, 232), (1, 233),
    (1, 234), (1, 235), (1, 236), (1, 237), (1, 238), (1, 239),
    (1, 240), (1, 241), (1, 242), (1, 243), (1, 244), (1, 245), (1, 246), (1, 247)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);
