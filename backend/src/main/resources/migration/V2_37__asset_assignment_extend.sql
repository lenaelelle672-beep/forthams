-- V3_26: 资产领用归还表扩展 — 新增 4 个字段
-- 支持 T2.2 资产领用/归还/签收/流转完整流程
-- 多租户隔离（tenant_id）和软删除（deleted）不受影响

ALTER TABLE asset_assignment
    ADD COLUMN allocation_type VARCHAR(20) NOT NULL DEFAULT 'ASSIGNMENT' COMMENT '领用类型: ASSIGNMENT/BORROW/RETURN/TRANSFER',
    ADD COLUMN approver_id     BIGINT       NULL COMMENT '审批人 ID',
    ADD COLUMN approval_time   DATETIME     NULL COMMENT '审批时间',
    ADD COLUMN approval_remark VARCHAR(500) NULL COMMENT '审批备注/驳回原因';

-- 索引优化：allocation_type 单独索引便于筛选查询
ALTER TABLE asset_assignment
    ADD INDEX idx_allocation_type (allocation_type);
