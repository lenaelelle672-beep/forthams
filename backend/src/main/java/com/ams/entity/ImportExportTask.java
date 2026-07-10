package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("import_export_task")
public class ImportExportTask {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    /** IMPORT 或 EXPORT */
    private String taskType;
    /** 业务对象，如 asset/dept/user */
    private String businessObject;
    /** XLSX 或 CSV */
    private String fileFormat;
    /** PENDING/RUNNING/SUCCESS/FAILED/CANCELLED */
    private String status;
    private Integer totalRows;
    private Integer successRows;
    private Integer failedRows;
    private Long operatorId;
    private String operatorName;
    /** 错误摘要（脱敏后） */
    private String errorSummary;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
