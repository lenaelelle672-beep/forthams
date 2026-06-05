-- V3_29: 资产借用管理模块 — asset_borrow 表
-- 支持 CF-AC4 借用管理含 @Scheduled 到期提醒

CREATE TABLE IF NOT EXISTS asset_borrow (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键 ID',
    asset_id            BIGINT        NOT NULL COMMENT '资产 ID',
    borrower_id         BIGINT        NULL COMMENT '借用人 ID',
    borrower_dept_id    BIGINT        NULL COMMENT '借用部门 ID',
    borrow_date         DATE          NOT NULL COMMENT '借用日期',
    expected_return_date DATE         NOT NULL COMMENT '预计归还日期',
    actual_return_date   DATE         NULL COMMENT '实际归还日期',
    status              VARCHAR(32)   NOT NULL DEFAULT 'DRAFT' COMMENT '状态: DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/BORROWED/OVERDUE/RETURNED/CANCELLED',
    purpose             VARCHAR(500)  NULL COMMENT '借用用途',
    remark              VARCHAR(500)  NULL COMMENT '备注',
    notified            TINYINT       NOT NULL DEFAULT 0 COMMENT '到期已通知标记(0=未通知, 1=已通知)',
    tenant_id           VARCHAR(64)   NOT NULL COMMENT '租户 ID',
    create_by           BIGINT        NULL COMMENT '创建人',
    create_time         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time         DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted             TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除标志(0=正常, 1=删除)',
    INDEX idx_asset (asset_id),
    INDEX idx_status (status),
    INDEX idx_due_date (expected_return_date),
    INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产借用表';
