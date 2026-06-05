-- V3_43__phase6_business_comment.sql
-- Phase 6: T6.1 评论/协作系统 — business_comment 表 + 权限种子 + 通知模板
-- 幂等设计（IF NOT EXISTS / ON DUPLICATE KEY UPDATE），可重复执行
-- Menu IDs: 248-253

CREATE TABLE IF NOT EXISTS business_comment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    business_type VARCHAR(32) NOT NULL COMMENT '业务类型: ASSET/WORK_ORDER/RETIREMENT/INSPECTION',
    business_id BIGINT NOT NULL COMMENT '业务记录ID',
    user_id BIGINT NOT NULL COMMENT '评论用户ID',
    user_name VARCHAR(128) NOT NULL COMMENT '评论用户名称',
    content TEXT NOT NULL COMMENT '评论内容(支持@mention标记)',
    parent_comment_id BIGINT DEFAULT NULL COMMENT '父评论ID(回复时填充)',
    tenant_id VARCHAR(64) NOT NULL,
    deleted TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_bc_business (business_type, business_id, tenant_id, deleted),
    INDEX idx_bc_user (user_id),
    INDEX idx_bc_parent (parent_comment_id),
    INDEX idx_bc_tenant (tenant_id, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='业务评论/协作表';

-- 通知模板种子数据
INSERT INTO notification_template (template_code, title_template, content_template, category, status)
SELECT 'COMMENT_MENTION', '有人@了你', '${userName} 在 ${businessType} 中@了你：${content}',
       'COMMENT', 1
WHERE NOT EXISTS (SELECT 1 FROM notification_template WHERE template_code = 'COMMENT_MENTION');

INSERT INTO notification_template (template_code, title_template, content_template, category, status)
SELECT 'COMMENT_REPLY', '回复通知', '${userName} 回复了你的评论：${content}',
       'COMMENT', 1
WHERE NOT EXISTS (SELECT 1 FROM notification_template WHERE template_code = 'COMMENT_REPLY');

-- 权限种子
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, perms, icon, visible, status) VALUES
    (248, '评论管理', 0, 27, 'M', 'comment:query', 'message-square', 0, 1),
    (249, '评论查询', 248, 1, 'F', 'comment:query', NULL, 1, 1),
    (250, '评论新增', 248, 2, 'F', 'comment:create', NULL, 1, 1),
    (251, '评论删除', 248, 3, 'F', 'comment:remove', NULL, 1, 1)
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 248), (1, 249), (1, 250), (1, 251)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);
