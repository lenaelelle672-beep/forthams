package com.ams.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class FormDefinitionPreviewDTO {
    private String formKey;
    private String name;
    private String status;
    private Integer version;
    private Integer fieldCount;
    private Integer sensitiveFieldCount;
    private Map<String, Object> schema;
    private List<String> warnings;
}
