ALTER TABLE idle_asset_notice
    ADD COLUMN title VARCHAR(256) NULL AFTER idle_days,
    ADD COLUMN reason VARCHAR(1024) NULL AFTER title,
    ADD COLUMN claim_deadline DATE NULL AFTER notice_date,
    ADD COLUMN claim_status VARCHAR(32) NULL AFTER claim_date,
    ADD COLUMN claim_approved_by BIGINT NULL AFTER claim_status,
    ADD COLUMN claim_approved_time DATETIME NULL AFTER claim_approved_by,
    ADD COLUMN approval_opinion VARCHAR(1024) NULL AFTER claim_approved_time;

CREATE INDEX idx_idle_asset_status ON idle_asset_notice (status, claim_status);

INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, perms, icon, visible, status) VALUES
    (211, '认领审批', 130, 4, 'F', 'idle:approve', NULL, 1, 1)
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name), perms = VALUES(perms), sort_order = VALUES(sort_order);

INSERT INTO sys_role_menu (role_id, menu_id) VALUES (1, 211)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);
