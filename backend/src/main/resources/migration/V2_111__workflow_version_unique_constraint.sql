-- V2_111__workflow_version_unique_constraint
-- 为 workflow_definition_version 补 (tenant_id, business_type, version) 唯一约束，
-- 防止并发 publish 产生重复版本号（并发审计代理发现的 TOCTOU race）。
-- 此前只有普通 INDEX，两个并发 publish 会读到相同 version、写入相同 version+1。

ALTER TABLE workflow_definition_version
ADD UNIQUE INDEX uk_workflow_def_version_tenant_bt_ver (tenant_id, business_type, version);
