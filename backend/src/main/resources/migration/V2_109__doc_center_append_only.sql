-- V2_109__doc_center_append_only
-- system-doc-center：文档中心只读 catalog 表，不触碰基线脚本或历史迁移。
-- 本批不写入 sys_menu、sys_role_menu、sys_permission 或任何权限/菜单数据。
-- 本轮只读 catalog，不实现文档编辑/版本发布/附件上传写操作。

CREATE TABLE IF NOT EXISTS doc_article (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL COMMENT '文档标题',
    category VARCHAR(64) NOT NULL DEFAULT 'GENERAL' COMMENT '文档分类',
    version INT NOT NULL DEFAULT 1 COMMENT '当前版本',
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/PUBLISHED/ARCHIVED',
    author_name VARCHAR(64) COMMENT '作者姓名（脱敏）',
    attachment_count INT NOT NULL DEFAULT 0 COMMENT '附件数量',
    summary VARCHAR(512) COMMENT '文档摘要（脱敏）',
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_doc_article_tenant_status (tenant_id, status),
    INDEX idx_doc_article_tenant_category (tenant_id, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf4mb4;
