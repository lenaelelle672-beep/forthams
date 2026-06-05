-- V3_24: 盘点任务审批支持
-- 1. inventory_task 表增加 approved_by 和 approved_at 字段（已存在，仅做补充）
-- 2. 调整 status 列注释说明 PENDING_APPROVAL / APPROVED 状态（当前为 VARCHAR，无需 DDL 变更）
-- 3. 创建调账日志表

-- ── 调账日志表 ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_adjustment_log (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id         BIGINT       NOT NULL COMMENT '盘点任务 ID',
    detail_id       BIGINT       COMMENT '盘点明细 ID（盘盈时为空）',
    asset_id        BIGINT       COMMENT '资产 ID（盘亏/损坏时记录原始资产）',
    asset_no        VARCHAR(128) COMMENT '资产编号（盘盈时为新生成）',
    asset_name      VARCHAR(256) COMMENT '资产名称',
    adjustment_type VARCHAR(32)  NOT NULL COMMENT '调账类型: SURPLUS/DEFICIT/DAMAGE',
    status_before   VARCHAR(32)  COMMENT '变更前状态',
    status_after    VARCHAR(32)  COMMENT '变更后状态',
    remark          VARCHAR(500) COMMENT '备注',
    created_by      BIGINT       COMMENT '操作人',
    create_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_task (task_id),
    INDEX idx_asset (asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='盘点调账日志表';
