package com.ams.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 导入导出任务记录只读 catalog DTO。
 *
 * 只读：不提供执行导入/导出的写操作（V3 只读边界）。
 * errorSummary 已在后端脱敏，前端只读展示。
 */
@Data
public class ImportExportTaskDTO {
    private Long id;
    private String taskType;
    private String businessObject;
    private String fileFormat;
    private String status;
    private Integer totalRows;
    private Integer successRows;
    private Integer failedRows;
    private Long operatorId;
    private String operatorName;
    private String errorSummary;
    private String startedAt;
    private String finishedAt;
    private String createdAt;

    @Data
    public static class PageResult {
        private List<ImportExportTaskDTO> records = new ArrayList<>();
        private long total;
    }

    @Data
    public static class Meta {
        private List<String> supportedObjects = new ArrayList<>();
        private List<String> supportedFormats = new ArrayList<>();
        private List<String> statuses = new ArrayList<>();
        private int importRowLimit;
        private int exportRowLimit;
        private String readOnlyNotice;
    }
}
