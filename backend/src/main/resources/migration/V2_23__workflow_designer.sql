-- 流程节点定义表
CREATE TABLE IF NOT EXISTS workflow_node (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    definition_id BIGINT NOT NULL COMMENT '流程定义ID',
    node_id VARCHAR(50) NOT NULL COMMENT '节点ID(前端生成)',
    node_name VARCHAR(100) NOT NULL COMMENT '节点名称',
    node_type VARCHAR(20) NOT NULL COMMENT '节点类型 START/APPROVAL/CC/CONDITION/END',
    assignee_type VARCHAR(20) COMMENT '审批人类型 ROLE/USER/DEPT_LEADER/INITIATOR',
    assignee_value VARCHAR(200) COMMENT '审批人值(角色编码/用户ID等)',
    position_x DECIMAL(10,2) COMMENT '画布X坐标',
    position_y DECIMAL(10,2) COMMENT '画布Y坐标',
    config JSON COMMENT '节点配置(条件表达式/超时等)',
    sort_order INT DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_wn_def (definition_id),
    UNIQUE INDEX idx_wn_def_node (definition_id, node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='流程节点定义';

-- 流程连线定义表
CREATE TABLE IF NOT EXISTS workflow_edge (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    definition_id BIGINT NOT NULL COMMENT '流程定义ID',
    edge_id VARCHAR(50) NOT NULL COMMENT '连线ID',
    source_node_id VARCHAR(50) NOT NULL COMMENT '源节点ID',
    target_node_id VARCHAR(50) NOT NULL COMMENT '目标节点ID',
    condition_expr VARCHAR(500) COMMENT '条件表达式',
    label VARCHAR(100) COMMENT '连线标签',
    sort_order INT DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_we_def (definition_id),
    UNIQUE INDEX idx_we_def_edge (definition_id, edge_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='流程连线定义';
