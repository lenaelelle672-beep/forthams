-- V3_43__inspection_template_and_record.sql
-- Phase 5: 盘点深化+合规管理 — T5.2 检验/年检管理
-- 创建 inspection_template、inspection_record 和 inspection_task 三张表
-- 幂等设计（IF NOT EXISTS），可重复执行

-- ─────────────────────────────────────────────────────────────────────────────
-- 检验模板表 (inspection_template)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspection_template (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    tenant_id BIGINT NOT NULL COMMENT '租户ID',
    name VARCHAR(200) NOT NULL COMMENT '模板名称',
    type VARCHAR(50) NOT NULL COMMENT '检验类型：ANNUAL/PERIODIC/SPECIAL',
    check_items JSON COMMENT '检查项配置（JSON数组）',
    cycle_days INT COMMENT '检验周期（天数）',
    warning_days INT DEFAULT 30 COMMENT '提前预警天数',
    status TINYINT DEFAULT 1 COMMENT '状态：1-启用 0-禁用',
    created_by BIGINT COMMENT '创建人ID',
    created_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_by BIGINT COMMENT '更新人ID',
    updated_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除：0-未删除 1-已删除',
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_tenant_deleted (tenant_id, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检验模板表';

-- ─────────────────────────────────────────────────────────────────────────────
-- 检验记录表 (inspection_record)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspection_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    tenant_id BIGINT NOT NULL COMMENT '租户ID',
    record_no VARCHAR(50) UNIQUE NOT NULL COMMENT '检验记录编号',
    asset_id BIGINT NOT NULL COMMENT '关联资产ID',
    template_id BIGINT COMMENT '关联检验模板ID',
    inspection_type VARCHAR(50) COMMENT '检验类型',
    inspection_date DATE NOT NULL COMMENT '检验日期',
    next_inspection_date DATE COMMENT '下次检验日期',
    result VARCHAR(50) COMMENT '检验结果：PASS/FAIL/CONDITIONAL/PENDING/OVERDUE',
    check_results JSON COMMENT '检查结果（JSON数组）',
    attachments JSON COMMENT '附件列表（JSON数组）',
    inspector_id BIGINT COMMENT '检验人ID',
    inspector_name VARCHAR(100) COMMENT '检验人姓名',
    notes TEXT COMMENT '备注',
    status VARCHAR(50) DEFAULT 'pending' COMMENT '状态：pending/in_progress/completed/cancelled',
    created_by BIGINT COMMENT '创建人ID',
    created_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_by BIGINT COMMENT '更新人ID',
    updated_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除：0-未删除 1-已删除',
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_asset_id (asset_id),
    INDEX idx_template_id (template_id),
    INDEX idx_inspection_date (inspection_date),
    INDEX idx_status (status),
    INDEX idx_tenant_deleted (tenant_id, deleted),
    CONSTRAINT fk_inspection_record_asset FOREIGN KEY (asset_id) REFERENCES asset(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inspection_record_template FOREIGN KEY (template_id) REFERENCES inspection_template(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检验记录表';

-- ─────────────────────────────────────────────────────────────────────────────
-- 通知模板种子数据
-- ─────────────────────────────────────────────────────────────────────────────
-- 检验到期提醒通知模板
INSERT INTO notification_template (template_code, title_template, content_template, category, status)
SELECT 'INS_INSPECTION_EXPIRING',
       '检验到期提醒',
       '检验单 ${inspectionNo}（资产：${assetName}，类型：${inspectionType}）将在 ${daysRemaining} 天后到期，到期日：${expiryDate}，请及时安排复检。',
       'INSPECTION',
       1
WHERE NOT EXISTS (SELECT 1 FROM notification_template WHERE template_code = 'INS_INSPECTION_EXPIRING');

-- 检验逾期提醒通知模板
INSERT INTO notification_template (template_code, title_template, content_template, category, status)
SELECT 'INS_INSPECTION_OVERDUE',
       '检验逾期提醒',
       '检验单 ${inspectionNo}（资产：${assetName}）已逾期 ${overdueDays} 天，请尽快处理。',
       'INSPECTION',
       1
WHERE NOT EXISTS (SELECT 1 FROM notification_template WHERE template_code = 'INS_INSPECTION_OVERDUE');

-- 检验统计月报通知模板
INSERT INTO notification_template (template_code, title_template, content_template, category, status)
SELECT 'INS_INSPECTION_SUMMARY',
       '检验统计月报',
       '${yearMonth} 检验统计报告：总计 ${totalCount} 条，已完成 ${completedCount} 条，逾期 ${overdueCount} 条。完成率 ${completionRate}%，逾期率 ${overdueRate}%。',
       'INSPECTION',
       1
WHERE NOT EXISTS (SELECT 1 FROM notification_template WHERE template_code = 'INS_INSPECTION_SUMMARY');

-- ─────────────────────────────────────────────────────────────────────────────
-- 检验任务表 (inspection_task)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspection_task (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_no VARCHAR(64) NOT NULL UNIQUE COMMENT '任务编号',
    template_id BIGINT COMMENT '检验模板ID',
    task_name VARCHAR(256) NOT NULL COMMENT '任务名称',
    task_type VARCHAR(32) DEFAULT 'PERIODIC' COMMENT 'ANNUAL/PERIODIC/SPECIAL',
    planned_date DATE NOT NULL COMMENT '计划检验日期',
    actual_date DATE COMMENT '实际检验日期',
    status VARCHAR(32) DEFAULT 'PENDING' COMMENT 'PENDING/IN_PROGRESS/COMPLETED/CANCELLED/OVERDUE',
    assigned_to BIGINT COMMENT '分配给（用户ID）',
    remarks TEXT COMMENT '备注',
    tenant_id BIGINT NOT NULL COMMENT '租户ID',
    create_by BIGINT COMMENT '创建人ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '软删除标记（0=正常，1=已删除）',
    INDEX idx_task_tenant (tenant_id, deleted),
    INDEX idx_task_template (template_id),
    INDEX idx_task_status (status),
    INDEX idx_task_planned_date (planned_date),
    INDEX idx_task_assigned (assigned_to),
    CONSTRAINT fk_task_template FOREIGN KEY (template_id) REFERENCES inspection_template(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检验任务表';

-- ─────────────────────────────────────────────────────────────────────────────
-- sys_menu 权限种子数据
-- ─────────────────────────────────────────────────────────────────────────────
-- 检验任务管理权限
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, perms, icon, visible, status) VALUES
    (255, '检验任务管理', 224, 9, 'C', 'inspection:task:list', '#', 0, 0),
    (256, '检验任务查询', 255, 1, 'F', 'inspection:task:query', '#', 1, 0),
    (257, '检验任务新增', 255, 2, 'F', 'inspection:task:create', '#', 1, 0),
    (258, '检验任务修改', 255, 3, 'F', 'inspection:task:edit', '#', 1, 0),
    (259, '检验任务删除', 255, 4, 'F', 'inspection:task:remove', '#', 1, 0),
    (260, '检验任务批量创建', 255, 5, 'F', 'inspection:task:batch-create', '#', 1, 0),
    (261, '检验任务状态更新', 255, 6, 'F', 'inspection:task:update-status', '#', 1, 0)
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 给管理员角色分配新权限
INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 255), (1, 256), (1, 257), (1, 258), (1, 259), (1, 260), (1, 261)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);