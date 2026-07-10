-- V2_107__handover_append_only
-- system-handover：交接任务记录只读 catalog 表，不触碰基线脚本或历史迁移。
-- 本批不写入 sys_menu、sys_role_menu、sys_permission 或任何权限/菜单数据。
-- 状态机：PENDING/IN_PROGRESS/COMPLETED/CANCELLED。
-- 本轮只读 catalog，不实现真实资产/工单/审批对象转移（P2 专项）。

CREATE TABLE IF NOT EXISTS handover (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    title VARCHAR(128) NOT NULL COMMENT '交接任务标题',
    outgoing_user_id BIGINT COMMENT '交接人 ID',
    outgoing_user_name VARCHAR(64) COMMENT '交接人姓名（脱敏）',
    incoming_user_id BIGINT COMMENT '接收人 ID',
    incoming_user_name VARCHAR(64) COMMENT '接收人姓名（脱敏）',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/IN_PROGRESS/COMPLETED/CANCELLED',
    asset_count INT NOT NULL DEFAULT 0 COMMENT '待交接资产数量',
    workorder_count INT NOT NULL DEFAULT 0 COMMENT '待交接工单数量',
    approval_count INT NOT NULL DEFAULT 0 COMMENT '待交接审批数量',
    summary VARCHAR(512) COMMENT '交接摘要（脱敏）',
    risk_note VARCHAR(512) COMMENT '风险提示（真实转移未闭环）',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_handover_tenant_status (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf4mb4;
