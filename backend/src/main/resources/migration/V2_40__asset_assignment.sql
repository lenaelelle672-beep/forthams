-- V3_28: 资产领用归还模块 — asset_assignment 表
-- 支持 CF-AC3 领用归还全流程（申请→审批→签收→归还）

CREATE TABLE IF NOT EXISTS asset_assignment (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键 ID',
    asset_id            BIGINT        NOT NULL COMMENT '资产 ID',
    applicant_id        BIGINT        NULL COMMENT '申请人 ID',
    applicant_dept_id   BIGINT        NULL COMMENT '申请部门 ID',
    assigned_to_user_id BIGINT        NULL COMMENT '签收人 ID（领用目标人）',
    assigned_to_dept_id BIGINT        NULL COMMENT '签收部门 ID',
    expected_return_date DATE         NULL COMMENT '预计归还日期',
    actual_return_date   DATE         NULL COMMENT '实际归还日期',
    status              VARCHAR(32)   NOT NULL DEFAULT 'DRAFT' COMMENT '状态: DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CHECKED_OUT/RETURN_REQUESTED/RETURNED/CANCELLED',
    assignment_date     DATE          NULL COMMENT '签收（领用）日期',
    return_condition    VARCHAR(500)  NULL COMMENT '归还时状况说明',
    remark              VARCHAR(500)  NULL COMMENT '备注',
    tenant_id           VARCHAR(64)   NOT NULL COMMENT '租户 ID',
    create_by           BIGINT        NULL COMMENT '创建人',
    create_time         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time         DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted             TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除标志(0=正常, 1=删除)',
    INDEX idx_asset (asset_id),
    INDEX idx_status (status),
    INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产领用归还表';
