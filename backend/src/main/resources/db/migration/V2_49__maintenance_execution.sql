-- V3_36__maintenance_execution.sql
-- T3.1 维修执行跟踪：新建维保施工执行三张表 + maintenance_record 扩展列 + 权限种子数据
-- 注意：幂等设计（IF NOT EXISTS / ON DUPLICATE KEY UPDATE），可重复执行
-- IDs 212-217 未被占用

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. maintenance_execution — 维保执行主记录表
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_execution (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    maintenance_record_id BIGINT COMMENT '关联维保记录ID',
    work_order_id BIGINT COMMENT '关联工单ID（冗余，便于直接查询）',
    assignee_id BIGINT COMMENT '执行人ID',
    assignee_name VARCHAR(128) COMMENT '执行人姓名',
    status VARCHAR(32) NOT NULL DEFAULT 'IDLE' COMMENT '状态: IDLE/RUNNING/PAUSED/COMPLETED',
    total_labor_hours DECIMAL(10,2) DEFAULT 0.00 COMMENT '总人工工时',
    total_material_cost DECIMAL(12,2) DEFAULT 0.00 COMMENT '物料总费用',
    start_time DATETIME COMMENT '施工开始时间',
    pause_time DATETIME COMMENT '最近暂停时间',
    resume_time DATETIME COMMENT '最近恢复时间',
    end_time DATETIME COMMENT '施工完成时间',
    remark VARCHAR(500) COMMENT '备注',
    create_by BIGINT COMMENT '创建人ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_exec_tenant (tenant_id, deleted),
    INDEX idx_exec_mt_record (maintenance_record_id),
    INDEX idx_exec_work_order (work_order_id),
    INDEX idx_exec_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='维保执行主记录';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. maintenance_execution_step — 施工步骤表
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_execution_step (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    execution_id BIGINT NOT NULL COMMENT '关联执行ID',
    step_name VARCHAR(256) NOT NULL COMMENT '步骤名称',
    step_order INT DEFAULT 0 COMMENT '排序号',
    description TEXT COMMENT '步骤描述',
    operator_id BIGINT COMMENT '操作人ID',
    operator_name VARCHAR(128) COMMENT '操作人姓名',
    labor_hours DECIMAL(8,2) DEFAULT 0.00 COMMENT '人工工时',
    start_time DATETIME COMMENT '开始时间',
    end_time DATETIME COMMENT '完成时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_step_execution (execution_id),
    INDEX idx_step_tenant (tenant_id, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='施工步骤记录';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. maintenance_execution_material — 物料/备件使用记录表
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_execution_material (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    execution_id BIGINT NOT NULL COMMENT '关联执行ID',
    material_name VARCHAR(256) NOT NULL COMMENT '物料名称',
    specification VARCHAR(256) COMMENT '规格型号',
    quantity DECIMAL(12,2) NOT NULL COMMENT '数量',
    unit_price DECIMAL(12,2) DEFAULT 0.00 COMMENT '单价',
    total_price DECIMAL(12,2) DEFAULT 0.00 COMMENT '合计金额',
    source_warehouse VARCHAR(128) COMMENT '来源仓库',
    remark VARCHAR(500) COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_mat_execution (execution_id),
    INDEX idx_mat_tenant (tenant_id, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物料/备件使用记录';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. maintenance_record 扩展列
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE maintenance_record
    ADD COLUMN IF NOT EXISTS work_order_id BIGINT DEFAULT NULL COMMENT '关联工单ID' AFTER asset_id;

ALTER TABLE maintenance_record
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(16) DEFAULT 'MANUAL' COMMENT '来源: MANUAL/PLAN' AFTER maintenance_type;

ALTER TABLE maintenance_record
    ADD INDEX IF NOT EXISTS idx_record_work_order (work_order_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. sys_menu 权限种子数据
-- 父菜单 ID=111（维修管理），新增 施工执行 子菜单及功能权限
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, perms, icon, visible, status) VALUES
    (212, '施工执行', 111, 5, 'C', 'asset:maintenance:execution:query', 'play-circle', 1, 1),
    (213, '开始施工', 212, 1, 'F', 'asset:maintenance:execution:start', NULL, 1, 1),
    (214, '暂停施工', 212, 2, 'F', 'asset:maintenance:execution:pause', NULL, 1, 1),
    (215, '恢复施工', 212, 3, 'F', 'asset:maintenance:execution:resume', NULL, 1, 1),
    (216, '完成施工', 212, 4, 'F', 'asset:maintenance:execution:complete', NULL, 1, 1),
    (217, '物料管理', 212, 5, 'F', 'asset:maintenance:execution:material', NULL, 1, 1)
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- SUPER_ADMIN 角色绑定新菜单
INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 212), (1, 213), (1, 214), (1, 215), (1, 216), (1, 217)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);
