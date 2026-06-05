-- V3_47__inspection_record.sql
-- T5.2: 检验记录表 (inspection_record)
-- 幂等设计（IF NOT EXISTS），可重复执行

CREATE TABLE IF NOT EXISTS inspection_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    record_no VARCHAR(128) NOT NULL COMMENT '检验记录编号',
    asset_id BIGINT NOT NULL COMMENT '关联资产ID',
    template_id BIGINT COMMENT '关联模板ID',
    inspection_type VARCHAR(32) NOT NULL COMMENT '检验类型（ANNUAL/PERIODIC/SPECIAL）',
    inspection_date DATE NOT NULL COMMENT '检验日期',
    next_inspection_date DATE COMMENT '下次检验日期',
    result VARCHAR(32) COMMENT '检验结果（PASS/FAIL/CONDITIONAL/PENDING/OVERDUE）',
    check_results TEXT COMMENT '检查结果（JSON数组）',
    attachments TEXT COMMENT '附件列表（JSON数组）',
    inspector_id BIGINT COMMENT '检验人ID',
    inspector_name VARCHAR(128) COMMENT '检验人姓名',
    notes TEXT COMMENT '备注',
    status VARCHAR(32) DEFAULT 'pending' COMMENT '状态（pending/in_progress/completed/cancelled）',
    created_by BIGINT COMMENT '创建人ID',
    created_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_by BIGINT COMMENT '更新人ID',
    updated_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记（0=未删除，1=已删除）',
    INDEX idx_ir_tenant (tenant_id, deleted),
    INDEX idx_ir_asset (asset_id),
    INDEX idx_ir_template (template_id),
    INDEX idx_ir_inspection_date (inspection_date),
    INDEX idx_ir_next_date (next_inspection_date),
    INDEX idx_ir_result (result),
    INDEX idx_ir_status (status),
    INDEX idx_ir_record_no (record_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检验记录表';