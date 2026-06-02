-- =============================================================================
-- Migration V2.7: 自定义字段系统 — Snipe-IT 风格
--
-- 1. sys_custom_field           — 自定义字段定义
-- 2. sys_custom_fieldset        — 字段集
-- 3. sys_custom_fieldset_field  — 字段集-字段关联
-- 4. sys_custom_field_value     — 资产自定义字段值
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. sys_custom_field 自定义字段定义表
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_custom_field (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    field_name      VARCHAR(128) NOT NULL COMMENT '字段名（英文标识）',
    field_label     VARCHAR(128) NOT NULL COMMENT '显示名',
    field_type      VARCHAR(32) NOT NULL DEFAULT 'TEXT' COMMENT '字段类型：TEXT/NUMBER/DATE/DROPDOWN/BOOLEAN/URL/EMAIL/REGEX',
    field_options   JSON DEFAULT NULL COMMENT '下拉选项（JSON 数组）',
    validation_pattern VARCHAR(256) DEFAULT NULL COMMENT '正则校验模式',
    field_order     INT DEFAULT 0 COMMENT '排序',
    required        TINYINT DEFAULT 0 COMMENT '是否必填（0-否 1-是）',
    encrypted       TINYINT DEFAULT 0 COMMENT '是否加密存储（0-否 1-是）',
    status          TINYINT DEFAULT 1 COMMENT '状态（0-停用 1-启用）',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_cf_status (status),
    INDEX idx_cf_order (field_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自定义字段定义表';

-- ---------------------------------------------------------------------------
-- 2. sys_custom_fieldset 字段集表
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_custom_fieldset (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(128) NOT NULL COMMENT '字段集名称',
    description     VARCHAR(512) DEFAULT NULL COMMENT '描述',
    status          TINYINT DEFAULT 1 COMMENT '状态（0-停用 1-启用）',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_cfs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自定义字段集表';

-- ---------------------------------------------------------------------------
-- 3. sys_custom_fieldset_field 字段集-字段关联表
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_custom_fieldset_field (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    fieldset_id     BIGINT NOT NULL COMMENT '字段集 ID',
    field_id        BIGINT NOT NULL COMMENT '字段 ID',
    field_order     INT DEFAULT 0 COMMENT '字段排序',
    UNIQUE KEY uk_fset_field (fieldset_id, field_id),
    INDEX idx_cfsf_fieldset (fieldset_id),
    INDEX idx_cfsf_field (field_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='字段集-字段关联表';

-- ---------------------------------------------------------------------------
-- 4. sys_custom_field_value 资产自定义字段值表
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_custom_field_value (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    asset_id        BIGINT NOT NULL COMMENT '资产 ID',
    field_id        BIGINT NOT NULL COMMENT '字段 ID',
    field_value     TEXT DEFAULT NULL COMMENT '字段值（统一文本存储）',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_asset_field (asset_id, field_id),
    INDEX idx_cfv_asset (asset_id),
    INDEX idx_cfv_field (field_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产自定义字段值表';

-- ---------------------------------------------------------------------------
-- 5. asset_category 增加 fieldset_id 字段
-- ---------------------------------------------------------------------------
ALTER TABLE asset_category
    ADD COLUMN fieldset_id BIGINT DEFAULT NULL COMMENT '关联字段集 ID' AFTER description,
    ADD INDEX idx_ac_fieldset (fieldset_id);
