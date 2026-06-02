-- V3_3: 资产模型管理

CREATE TABLE IF NOT EXISTS asset_model (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(200) NOT NULL COMMENT '模型名称',
    model_no        VARCHAR(100) COMMENT '型号',
    category_id     BIGINT COMMENT '分类ID',
    manufacturer_id BIGINT COMMENT '制造商ID',
    fieldset_id     BIGINT COMMENT '自定义字段集ID',
    specifications  JSON COMMENT '规格参数模板',
    description     VARCHAR(500) COMMENT '描述',
    status          TINYINT NOT NULL DEFAULT 0 COMMENT '状态 0正常 1停用',
    remark          VARCHAR(500) COMMENT '备注',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT NOT NULL DEFAULT 0,
    UNIQUE KEY uk_name (name),
    INDEX idx_category (category_id),
    INDEX idx_manufacturer (manufacturer_id),
    INDEX idx_fieldset (fieldset_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产模型';
