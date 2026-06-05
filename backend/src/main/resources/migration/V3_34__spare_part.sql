-- T3.6 备品备件表（含乐观锁版本号）
CREATE TABLE IF NOT EXISTS spare_part (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    part_no VARCHAR(64) NOT NULL COMMENT '备件编码',
    part_name VARCHAR(200) NOT NULL COMMENT '备件名称',
    specification VARCHAR(500) COMMENT '规格型号',
    category_id BIGINT COMMENT '分类ID',
    current_stock DECIMAL(12,2) DEFAULT 0 COMMENT '当前库存',
    safety_stock DECIMAL(12,2) DEFAULT 0 COMMENT '安全库存',
    unit VARCHAR(20) COMMENT '计量单位',
    unit_price DECIMAL(12,2) COMMENT '单价',
    location_id BIGINT COMMENT '存放位置ID',
    vendor_id BIGINT COMMENT '供应商ID',
    status VARCHAR(16) DEFAULT 'ENABLED' COMMENT '状态：ENABLED/DISABLED',
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    version INT DEFAULT 0 COMMENT '乐观锁版本号',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标志',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_part_no_tenant (part_no, tenant_id, deleted),
    INDEX idx_category (category_id),
    INDEX idx_stock (current_stock),
    INDEX idx_tenant_deleted (tenant_id, deleted)
) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='备品备件表';
