-- V3_4: 采购订单管理
CREATE TABLE IF NOT EXISTS purchase_order (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_no        VARCHAR(50)  NOT NULL UNIQUE COMMENT '采购单号',
    order_name      VARCHAR(200) NOT NULL COMMENT '采购名称',
    vendor_id       BIGINT       COMMENT '供应商ID',
    total_amount    DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT '总金额',
    status          VARCHAR(32)  NOT NULL DEFAULT 'DRAFT' COMMENT '状态:DRAFT/PENDING/APPROVED/PARTIAL/RECEIVED/CANCELLED',
    order_date      DATE         COMMENT '采购日期',
    expected_date   DATE         COMMENT '预计到货日期',
    remark          VARCHAR(500) COMMENT '备注',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT      NOT NULL DEFAULT 0,
    INDEX idx_status(status),
    INDEX idx_vendor(vendor_id),
    INDEX idx_order_date(order_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购订单';

CREATE TABLE IF NOT EXISTS purchase_order_item (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id        BIGINT       NOT NULL COMMENT '关联采购单ID',
    asset_name      VARCHAR(200) NOT NULL COMMENT '资产名称',
    category_id     BIGINT       COMMENT '分类ID',
    quantity        INT          NOT NULL DEFAULT 1 COMMENT '数量',
    unit_price      DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT '单价',
    amount          DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT '金额',
    specification   VARCHAR(500) COMMENT '规格型号',
    remark          VARCHAR(500) COMMENT '备注',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order(order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购订单明细';
