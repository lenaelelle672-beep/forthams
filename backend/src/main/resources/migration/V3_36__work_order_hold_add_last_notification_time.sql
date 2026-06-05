-- T3.3 维修挂起/恢复功能：补充字段与索引修复
-- 1. 添加 last_notification_time 字段用于通知去重
-- 2. 确保索引 idx_tenant_hold_end 字段顺序为 (tenant_id, hold_end_time, deleted)

ALTER TABLE work_order_hold_record
    ADD COLUMN last_notification_time DATETIME COMMENT '最近通知时间（用于定时任务去重）';

-- 删除现有索引（如果存在）
DROP INDEX IF EXISTS idx_tenant_hold_end ON work_order_hold_record;

-- 重建索引，字段顺序为 (tenant_id, hold_end_time, deleted)
CREATE INDEX idx_tenant_hold_end
ON work_order_hold_record (tenant_id, hold_end_time, deleted)
COMMENT '租户挂起超时扫描索引';