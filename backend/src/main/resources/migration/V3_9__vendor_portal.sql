-- 供应商门户扩展字段
ALTER TABLE vendor ADD COLUMN bank_account VARCHAR(50) COMMENT '银行账号' AFTER address;
ALTER TABLE vendor ADD COLUMN tax_id VARCHAR(50) COMMENT '税号' AFTER bank_account;
ALTER TABLE vendor ADD COLUMN password VARCHAR(200) COMMENT '门户登录密码(BCrypt)' AFTER tax_id;
ALTER TABLE vendor ADD COLUMN portal_enabled TINYINT DEFAULT 0 COMMENT '门户是否启用' AFTER password;
