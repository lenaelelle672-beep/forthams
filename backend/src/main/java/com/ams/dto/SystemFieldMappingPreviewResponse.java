package com.ams.dto;

import lombok.Data;

@Data
public class SystemFieldMappingPreviewResponse {

    private String sourceField;
    private String targetField;
    private String sampleValue;
    private String transformedValue;
    private Boolean valid;
    private String message;
}
