-- 资产父子关系表迁移
-- 支持多租户隔离、软删除、并发保护

CREATE TABLE IF NOT EXISTS asset_parent_child (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    tenant_id BIGINT NOT NULL COMMENT '租户ID',
    parent_asset_id BIGINT NOT NULL COMMENT '父资产ID',
    child_asset_id BIGINT NOT NULL COMMENT '子资产ID',
    relation_type VARCHAR(50) NOT NULL COMMENT '关系类型：PARENT_CHILD(父子关系)、DEPENDENCY(依赖关系)、GROUP_MEMBER(组成员)',
    sort_order INT DEFAULT 0 COMMENT '排序顺序',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '删除时间（软删除）',
    UNIQUE KEY uk_relation (parent_asset_id, child_asset_id, deleted_at) COMMENT '防止同一对资产重复创建关系',
    KEY idx_tenant (tenant_id) COMMENT '租户索引',
    KEY idx_parent (parent_asset_id) COMMENT '父资产索引',
    KEY idx_child (child_asset_id) COMMENT '子资产索引',
    KEY idx_deleted (deleted_at) COMMENT '软删除索引',
    KEY idx_parent_child_unique (parent_asset_id, child_asset_id, deleted) COMMENT '防止同一对资产重复关联',
    KEY idx_parent_tenant (parent_asset_id, tenant_id) COMMENT '优化父资产查询性能',
    KEY idx_child_tenant (child_asset_id, tenant_id) COMMENT '优化子资产查询性能'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资产父子关系表';