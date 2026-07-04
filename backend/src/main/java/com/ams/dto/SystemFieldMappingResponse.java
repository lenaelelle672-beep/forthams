package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SystemFieldMappingResponse {

    private Long id;
    private String tenantId;
    private Long interfaceId;
    private String mappingName;
    private String sourceField;
    private String targetField;
    private String transformExpression;
    private String defaultValue;
    private Boolean enabled;
    private String status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
