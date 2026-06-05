-- T3.4 work_order 表增加 fault_code_id 字段
ALTER TABLE work_order
    ADD COLUMN fault_code_id BIGINT NULL COMMENT '关联故障代码ID',
    ADD INDEX idx_fault_code (fault_code_id);
