package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
public class FormDefinitionVersionDTO {
    private Long id;
    private Long definitionId;
    private String formKey;
    private Integer version;
    private String actionType;
    private String status;
    private String name;
    private String description;
    private Map<String, Object> schema;
    private String auditReason;
    private String impactScope;
    private String rollbackPlan;
    private Integer rollbackSourceVersion;
    private Long operatorId;
    private LocalDateTime publishedAt;
    private LocalDateTime createTime;
}
