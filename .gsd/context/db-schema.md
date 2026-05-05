# Database Schema (ams_db)
Tables: sys_user, sys_role, sys_user_role, sys_dept, sys_permission,
asset_category, asset, asset_change_log, asset_compensation,
idle_asset_notice, inventory_detail, inventory_task, maintenance_record,
sys_attachment, approval_process, approval_record, location, vendor

Key column mappings (Java != DB):
- Dept.name -> dept_name, Dept.orderNum -> sort_order
- Location.name -> location_name
- All tables use bigint auto_increment PK
