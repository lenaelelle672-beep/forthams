package com.ams.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
public class FormDefinitionSchemaValidationResultDTO {
    private boolean valid;
    private List<String> errors = new ArrayList<>();
    private List<String> warnings = new ArrayList<>();
    private Integer fieldCount;
    private Integer sensitiveFieldCount;
    private Map<String, Object> sanitizedSchema;
}
