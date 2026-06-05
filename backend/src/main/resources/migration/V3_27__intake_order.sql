-- V3_27: 入库验收模块 — 创建验收单、检查项、入库资产临时表
-- 支持 CF-AC2 入库验收全流程（创建→质检→验收→自动创建 Asset）

-- ── 入库验收主单 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS intake_order (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键 ID',
    order_no        VARCHAR(64)   NOT NULL COMMENT '验收单号',
    vendor_id       BIGINT        NULL COMMENT '供应商 ID',
    order_date      DATE          NULL COMMENT '验收日期',
    status          VARCHAR(32)   NOT NULL DEFAULT 'DRAFT' COMMENT '状态: DRAFT/PENDING_INSPECT/INSPECTING/PARTIAL_ACCEPTED/ACCEPTED/REJECTED/CANCELLED',
    total_amount    DECIMAL(12,2) NULL COMMENT '总金额',
    remark          VARCHAR(500)  NULL COMMENT '备注',
    reject_reason   VARCHAR(500)  NULL COMMENT '驳回原因',
    tenant_id       VARCHAR(64)   NOT NULL COMMENT '租户 ID',
    create_by       BIGINT        NULL COMMENT '创建人 ID',
    create_time     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time     DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted         TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除标志(0=正常, 1=删除)',
    INDEX idx_tenant_status (tenant_id, status),
    INDEX idx_order_no (order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='入库验收主单';

-- ── 验收检查项 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS intake_check_item (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键 ID',
    intake_order_id BIGINT        NOT NULL COMMENT '验收单 ID',
    item_name       VARCHAR(128)  NOT NULL COMMENT '检查项名称',
    expected_value  VARCHAR(256)  NULL COMMENT '预期值',
    actual_value    VARCHAR(256)  NULL COMMENT '实际值',
    result          VARCHAR(16)   NULL DEFAULT 'PENDING' COMMENT '检查结果: PENDING/PASS/FAIL',
    remark          VARCHAR(500)  NULL COMMENT '备注',
    sort_order      INT           NULL DEFAULT 0 COMMENT '排序',
    tenant_id       VARCHAR(64)   NOT NULL COMMENT '租户 ID',
    create_time     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time     DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted         TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除标志(0=正常, 1=删除)',
    INDEX idx_intake_order (intake_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='验收检查项';

-- ── 入库资产（临时表 - 验收通过后自动转为正式 Asset） ──
CREATE TABLE IF NOT EXISTS intake_asset (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键 ID',
    intake_order_id BIGINT        NOT NULL COMMENT '验收单 ID',
    asset_no        VARCHAR(64)   NULL COMMENT '资产编号',
    asset_name      VARCHAR(256)  NOT NULL COMMENT '资产名称',
    model           VARCHAR(128)  NULL COMMENT '规格型号',
    brand           VARCHAR(128)  NULL COMMENT '品牌',
    serial_no       VARCHAR(128)  NULL COMMENT '序列号',
    supplier        VARCHAR(256)  NULL COMMENT '供应商',
    purchase_date   DATE          NULL COMMENT '购置日期',
    original_value  DECIMAL(12,2) NULL COMMENT '原值',
    warranty_period INT           NULL COMMENT '保修期(月)',
    category_id     BIGINT        NULL COMMENT '分类 ID',
    location_id     BIGINT        NULL COMMENT '存放地点 ID',
    remark          VARCHAR(500)  NULL COMMENT '备注',
    tenant_id       VARCHAR(64)   NOT NULL COMMENT '租户 ID',
    create_time     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time     DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted         TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除标志(0=正常, 1=删除)',
    INDEX idx_intake_order (intake_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='入库资产（临时表）';
