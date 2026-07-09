package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class TodoFieldConfigDTO {
    private Long id;
    private String fieldKey;
    private String fieldLabel;
    private Boolean visible;
    private Integer sortOrder;
    private Boolean sensitive;
    private Boolean defaultField;
    private String roleCode;
    private Boolean overrideVisible;
    private Integer overrideSortOrder;
    private String source;
    private String explanation;
    private String maskedLabel;
    private String maskedValue;
    private String auditSummary;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
