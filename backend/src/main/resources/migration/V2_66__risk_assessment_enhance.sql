-- V3_52__risk_assessment_enhance.sql
-- Phase 5 T5.4: 风险评估增强 — 矩阵配置 + 控制措施独立表
-- 幂等设计（IF NOT EXISTS），可重复执行

-- ─────────────────────────────────────────────────────────────────────────────
-- 风险矩阵配置表
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_matrix (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    matrix_name VARCHAR(128) NOT NULL COMMENT '矩阵名称',
    probability_dimension JSON NOT NULL COMMENT '概率维度配置 [{"value":1,"label":"极低"},{"value":5,"label":"极高"}]',
    severity_dimension JSON NOT NULL COMMENT '严重度维度配置 [{"value":1,"label":"轻微"},{"value":5,"label":"灾难性"}]',
    level_mapping JSON NOT NULL COMMENT '风险等级映射 [{"minScore":20,"level":"CRITICAL"},{"minScore":10,"level":"HIGH"}]',
    is_active TINYINT DEFAULT 1 COMMENT '是否启用：0禁用/1启用',
    tenant_id VARCHAR(64) NOT NULL,
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_rm_tenant_active (tenant_id, deleted, is_active),
    INDEX idx_rm_tenant (tenant_id, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='风险矩阵配置表';

-- ─────────────────────────────────────────────────────────────────────────────
-- 风险控制措施表（独立表）
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_control_measure (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    risk_assessment_id BIGINT NOT NULL COMMENT '关联风险评估ID',
    measure_type VARCHAR(32) DEFAULT 'MITIGATION' COMMENT '控制类型：MITIGATION/CONTINGENCY/TRANSFER/ACCEPT',
    measure_description TEXT NOT NULL COMMENT '控制措施描述',
    priority INT DEFAULT 3 COMMENT '优先级 1-5（1最高）',
    status VARCHAR(32) DEFAULT 'PENDING' COMMENT 'PENDING/IN_PROGRESS/COMPLETED/CANCELLED',
    assigned_to BIGINT COMMENT '负责人ID',
    due_date DATE COMMENT '计划完成日期',
    actual_completion_date DATE COMMENT '实际完成日期',
    effectiveness VARCHAR(32) COMMENT 'HIGH/MEDIUM/LOW/UNKNOWN',
    notes TEXT COMMENT '备注',
    tenant_id VARCHAR(64) NOT NULL,
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_rcm_assessment (risk_assessment_id),
    INDEX idx_rcm_tenant (tenant_id, deleted),
    INDEX idx_rcm_status (status),
    INDEX idx_rcm_due_date (due_date),
    FOREIGN KEY (risk_assessment_id) REFERENCES risk_assessment(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='风险控制措施表';

-- ─────────────────────────────────────────────────────────────────────────────
-- 通知模板种子数据（风险评审提醒）
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO notification_template (template_code, title_template, content_template, category, status)
SELECT 'RISK_REVIEW_DUE', '风险评估评审提醒', '风险评估（ID: ${assessmentId}）将在 ${daysRemaining} 天后需要评审，风险等级: ${riskLevel}，概率: ${probability}，严重度: ${severity}，请及时安排评审。', 'RISK', 1
WHERE NOT EXISTS (SELECT 1 FROM notification_template WHERE template_code = 'RISK_REVIEW_DUE');

-- ─────────────────────────────────────────────────────────────────────────────
-- sys_menu 权限种子数据 (IDs 248-253) — 风险矩阵配置
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, perms, icon, visible, status) VALUES
    (248, '风险矩阵配置', 234, 6, 'M', 'risk:matrix:query', 'grid', 1, 1),
    (249, '矩阵配置查询', 248, 1, 'F', 'risk:matrix:query', NULL, 1, 1),
    (250, '矩阵配置新增', 248, 2, 'F', 'risk:matrix:create', NULL, 1, 1),
    (251, '矩阵配置编辑', 248, 3, 'F', 'risk:matrix:edit', NULL, 1, 1),
    (252, '矩阵配置删除', 248, 4, 'F', 'risk:matrix:remove', NULL, 1, 1),
    (253, '矩阵配置启用', 248, 5, 'F', 'risk:matrix:active', NULL, 1, 1)
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 248), (1, 249), (1, 250), (1, 251), (1, 252), (1, 253)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);