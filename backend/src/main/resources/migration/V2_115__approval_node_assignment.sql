-- V2_115__approval_node_assignment
-- 冻结提交时的流程节点处理人，审批时以 process/step/assignee/status 原子条件校验。
CREATE TABLE IF NOT EXISTS approval_node_assignment (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    process_id BIGINT NOT NULL,
    step_no INT NOT NULL,
    assignee_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    workflow_definition_id BIGINT NOT NULL,
    workflow_version INT NOT NULL,
    decided_at DATETIME NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_approval_assignment_tenant_process_step_assignee (tenant_id, process_id, step_no, assignee_id),
    KEY idx_approval_assignment_tenant_assignee_status (tenant_id, assignee_id, status, process_id, step_no),
    KEY idx_approval_assignment_tenant_process_step (tenant_id, process_id, step_no, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
