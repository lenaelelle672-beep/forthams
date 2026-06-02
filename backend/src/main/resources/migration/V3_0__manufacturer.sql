-- V3_0: 制造商管理
CREATE TABLE IF NOT EXISTS manufacturer (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(200) NOT NULL COMMENT '制造商名称',
    code        VARCHAR(50)  UNIQUE COMMENT '编码',
    contact     VARCHAR(100) COMMENT '联系人',
    phone       VARCHAR(30) COMMENT '电话',
    email       VARCHAR(100) COMMENT '邮箱',
    website     VARCHAR(200) COMMENT '官网',
    country     VARCHAR(50) COMMENT '国家',
    address     VARCHAR(300) COMMENT '地址',
    status      TINYINT NOT NULL DEFAULT 0 COMMENT '状态 0正常 1停用',
    remark      VARCHAR(500) COMMENT '备注',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted     TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='制造商';

-- V3_1: 合同管理
CREATE TABLE IF NOT EXISTS contract (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    contract_no     VARCHAR(50) NOT NULL UNIQUE COMMENT '合同编号',
    contract_name   VARCHAR(200) NOT NULL COMMENT '合同名称',
    contract_type   VARCHAR(30) NOT NULL COMMENT '类型: MAINTENANCE/PURCHASE/LEASE/SERVICE',
    vendor_id       BIGINT COMMENT '供应商ID',
    asset_id        BIGINT COMMENT '关联资产ID',
    amount          DECIMAL(15,2) COMMENT '金额',
    currency        VARCHAR(10) NOT NULL DEFAULT 'CNY' COMMENT '货币',
    start_date      DATE COMMENT '开始日期',
    end_date        DATE COMMENT '到期日期',
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/ACTIVE/EXPIRED/CANCELLED',
    auto_renew      TINYINT NOT NULL DEFAULT 0 COMMENT '自动续约',
    renew_days      INT DEFAULT 30 COMMENT '提前续约提醒天数',
    file_url        VARCHAR(500) COMMENT '合同文件URL',
    remark          VARCHAR(500) COMMENT '备注',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT NOT NULL DEFAULT 0,
    INDEX idx_vendor(vendor_id),
    INDEX idx_asset(asset_id),
    INDEX idx_end_date(end_date),
    INDEX idx_status(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='合同';

-- V3_2: 软件许可证管理
CREATE TABLE IF NOT EXISTS software_license (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    license_name     VARCHAR(200) NOT NULL COMMENT '软件名称',
    license_key      VARCHAR(500) COMMENT '授权码(加密存储)',
    software_type    VARCHAR(50) COMMENT '软件类型',
    manufacturer     VARCHAR(100) COMMENT '厂商',
    version          VARCHAR(50) COMMENT '版本',
    license_type     VARCHAR(30) NOT NULL DEFAULT 'SINGLE_USER' COMMENT 'SINGLE_USER/VOLUME/CONCURRENT/SUBSCRIPTION',
    total_seats      INT NOT NULL DEFAULT 1 COMMENT '总授权数',
    purchase_date    DATE COMMENT '购买日期',
    expiry_date      DATE COMMENT '到期日期',
    purchase_price   DECIMAL(15,2) COMMENT '购买价格',
    purchase_order_no VARCHAR(50) COMMENT '采购单号',
    status           VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE/EXPIRED/SUSPENDED',
    file_url         VARCHAR(500) COMMENT '授权文件URL',
    remark           VARCHAR(500) COMMENT '备注',
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted          TINYINT NOT NULL DEFAULT 0,
    INDEX idx_status(status),
    INDEX idx_expiry(expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='软件许可证';

CREATE TABLE IF NOT EXISTS license_assignment (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    license_id    BIGINT NOT NULL COMMENT '许可证ID',
    asset_id      BIGINT COMMENT '分配到的资产',
    user_id       BIGINT COMMENT '分配给的用户',
    assigned_date DATE COMMENT '分配日期',
    returned_date DATE COMMENT '归还日期',
    notes         VARCHAR(300) COMMENT '备注',
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_license(license_id),
    INDEX idx_asset(asset_id),
    INDEX idx_user(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='许可证分配记录';
