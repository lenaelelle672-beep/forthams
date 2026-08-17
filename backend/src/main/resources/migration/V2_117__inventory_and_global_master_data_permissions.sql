-- V2_117__inventory_and_global_master_data_permissions
-- 仅追加服务端动作权限库存。角色绑定必须由受控角色权限配置显式完成；不为 tenant-admin、
-- 普通角色或任何平台写入权限自动授予绑定。
INSERT IGNORE INTO sys_permission (permission_name, permission_code, description, status)
VALUES
    ('盘点查询', 'inventory:query', '盘点任务及明细查询动作权限', 1),
    ('盘点新建', 'inventory:create', '盘点任务新建动作权限', 1),
    ('盘点状态更新', 'inventory:update', '盘点任务状态更新动作权限', 1),
    ('盘点扫描', 'inventory:scan', '盘点扫描录入动作权限', 1),
    ('资产分类查询', 'asset:category:query', '平台全局资产分类查询动作权限', 1),
    ('供应商查询', 'vendor:vendor:query', '平台全局供应商查询动作权限', 1),
    ('位置查询', 'location:query', '平台全局位置查询动作权限', 1);
