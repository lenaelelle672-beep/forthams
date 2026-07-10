-- V2_106__import_export_task_append_only
-- system-import-export：导入导出任务记录只读 catalog 表，不触碰基线脚本或历史迁移。
-- 本批不写入 sys_menu、sys_role_menu、sys_permission 或任何权限/菜单数据。
-- 按 PRD：ImportTask/ExportTask 异步任务、错误报告、导出脱敏。本轮只读 catalog，不实现导入导出执行。

CREATE TABLE IF NOT EXISTS import_export_task (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    task_type VARCHAR(16) NOT NULL COMMENT 'IMPORT 或 EXPORT',
    business_object VARCHAR(64) NOT NULL COMMENT '业务对象，如 asset/dept/user',
    file_format VARCHAR(16) NOT NULL DEFAULT 'XLSX' COMMENT 'XLSX 或 CSV',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/RUNNING/SUCCESS/FAILED/CANCELLED',
    total_rows INT NOT NULL DEFAULT 0,
    success_rows INT NOT NULL DEFAULT 0,
    failed_rows INT NOT NULL DEFAULT 0,
    operator_id BIGINT,
    operator_name VARCHAR(64),
    error_summary VARCHAR(512) COMMENT '错误摘要（脱敏后）',
    started_at DATETIME,
    finished_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_import_export_task_tenant_status (tenant_id, status),
    INDEX idx_import_export_task_tenant_object (tenant_id, business_object),
    INDEX idx_import_export_task_tenant_type (tenant_id, task_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf4mb4;
