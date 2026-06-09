-- Align the tenant registry with the canonical business tenant id used by JWT
-- claims, business seed data, and tenant-scoped tables.
UPDATE sys_tenant
SET id = 'dept:1'
WHERE id = 'default'
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT id FROM sys_tenant WHERE id = 'dept:1') existing_tenant
  );

DELETE FROM sys_tenant
WHERE id = 'default'
  AND EXISTS (
      SELECT 1 FROM (SELECT id FROM sys_tenant WHERE id = 'dept:1') existing_tenant
  );

INSERT IGNORE INTO sys_tenant (id, name, plan, status, max_users, max_assets)
VALUES ('dept:1', '默认租户', 'ENTERPRISE', 'ACTIVE', 9999, 999999);

UPDATE approval_record
SET tenant_id = 'dept:1'
WHERE tenant_id = 'T001';

UPDATE notification_template
SET tenant_id = 'dept:1'
WHERE tenant_id IN ('default', 'T001');
