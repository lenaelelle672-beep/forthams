package com.ams.dto;

import lombok.Data;

import java.util.Map;

@Data
public class FormDefinitionSaveDTO {
    private String name;
    private String description;
    private Map<String, Object> schema;
    private Long operatorId;
}
