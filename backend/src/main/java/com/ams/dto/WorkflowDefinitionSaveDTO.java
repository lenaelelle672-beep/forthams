package com.ams.dto;

import lombok.Data;

import java.util.Map;

@Data
public class WorkflowDefinitionSaveDTO {
    private String name;
    private String description;
    private Map<String, Object> definition;
    private Long operatorId;
}
