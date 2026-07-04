package com.ams.dto;

import lombok.Data;

@Data
public class SystemFieldMappingPreviewRequest {

    private String sourceField;
    private String targetField;
    private String sampleValue;
    private String transformExpression;
}
