-- V3_23: 工单附件支持（轻量 JSON 方案）
-- work_order 表增加 attachments TEXT 列，JSON 数组存储文件 URL 列表
-- 与 collaborators 字段采用相同的 JSON 策略（JacksonTypeHandler）

ALTER TABLE work_order
    ADD COLUMN attachments TEXT NULL COMMENT '附件 URL 列表（JSON 数组，如 ["url1","url2"]）';
