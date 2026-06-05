-- 循环盘点周期表
CREATE TABLE IF NOT EXISTS stocktaking_cycle (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  cycle_name VARCHAR(128) NOT NULL COMMENT '周期名称',
  cycle_type VARCHAR(32) NOT NULL COMMENT '盘点类型: FULL-全盘点, ABC-ABC分类盘点, PARTIAL-部分盘点',
  start_date DATETIME COMMENT '开始时间',
  end_date DATETIME COMMENT '结束时间',
  status VARCHAR(32) NOT NULL DEFAULT 'PLANNED' COMMENT '状态: PLANNED-已计划, IN_PROGRESS-进行中, PAUSED-已暂停, COMPLETED-已完成, CANCELLED-已取消',
  creator_id BIGINT NOT NULL COMMENT '创建人ID',
  tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
  create_by VARCHAR(64) COMMENT '创建人',
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  deleted TINYINT DEFAULT 0 COMMENT '软删除标记',
  INDEX idx_tenant_deleted (tenant_id, deleted),
  INDEX idx_creator_id (creator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='循环盘点周期表';

-- 盘点任务表
CREATE TABLE IF NOT EXISTS stocktaking_task (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  cycle_id BIGINT NOT NULL COMMENT '所属周期ID',
  asset_id BIGINT NOT NULL COMMENT '资产ID',
  location_id BIGINT COMMENT '地点ID',
  actual_quantity INT DEFAULT 0 COMMENT '实际数量',
  expected_quantity INT DEFAULT 0 COMMENT '预期数量',
  variance INT DEFAULT 0 COMMENT '差异值',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING-待盘点, COUNTED-已盘点, ADJUSTED-已调整',
  counted_by BIGINT COMMENT '盘点人ID',
  count_time DATETIME COMMENT '盘点时间',
  photo_url VARCHAR(512) COMMENT '盘点照片URL',
  tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
  create_by VARCHAR(64) COMMENT '创建人',
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  deleted TINYINT DEFAULT 0 COMMENT '软删除标记',
  INDEX idx_tenant_deleted (tenant_id, deleted),
  INDEX idx_cycle_id (cycle_id),
  INDEX idx_asset_id (asset_id),
  INDEX idx_counted_by (counted_by),
  FOREIGN KEY (cycle_id) REFERENCES stocktaking_cycle(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='盘点任务表';

-- 为 asset 表新增 abc_classification 字段
ALTER TABLE asset ADD COLUMN IF NOT EXISTS abc_classification VARCHAR(32) DEFAULT 'C' COMMENT 'ABC分类: A-高价值, B-中价值, C-低价值' AFTER category_id;

-- 在 sys_config 表新增差异阈值配置
INSERT INTO sys_config (config_key, config_value, config_type, remark, create_time, update_time)
VALUES ('stocktaking_variance_approval_threshold', '1000', 'number', '盘点差异调整审批阈值（单位：元）', NOW(), NOW())
ON DUPLICATE KEY UPDATE config_value = '1000';

-- 插入权限种子（ID 244-249）
-- 循环盘点权限
INSERT INTO sys_menu (id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, update_by, update_time, remark)
VALUES
(244, '循环盘点管理', 0, 10, 'stocktaking', NULL, 1, 0, 'M', '0', '0', '', 'clipboard-list', 'admin', NOW(), '', NULL, '循环盘点管理目录'),
(245, '盘点周期', 244, 1, 'cycle', 'stocktaking/cycle/index', 1, 0, 'C', '0', '0', 'stocktaking:cycle:query', 'list', 'admin', NOW(), '', NULL, '盘点周期菜单'),
(246, '盘点周期查询', 245, 1, '', '', 1, 0, 'F', '0', '0', 'stocktaking:cycle:query', '#', 'admin', NOW(), '', NULL, ''),
(247, '盘点周期新增', 245, 2, '', '', 1, 0, 'F', '0', '0', 'stocktaking:cycle:add', '#', 'admin', NOW(), '', NULL, ''),
(248, '盘点周期修改', 245, 3, '', '', 1, 0, 'F', '0', '0', 'stocktaking:cycle:edit', '#', 'admin', NOW(), '', NULL, ''),
(249, '盘点周期删除', 245, 4, '', '', 1, 0, 'F', '0', '0', 'stocktaking:cycle:remove', '#', 'admin', NOW(), '', NULL, '')
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);