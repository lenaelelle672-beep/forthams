package com.ams.dto;

import lombok.Data;

@Data
public class SystemFieldMappingRequest {

    private Long interfaceId;
    private String mappingName;
    private String sourceField;
    private String targetField;
    private String transformExpression;
    private String defaultValue;
    private Boolean enabled;
}
