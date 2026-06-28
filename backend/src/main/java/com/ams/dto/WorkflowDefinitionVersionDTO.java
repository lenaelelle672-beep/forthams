package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
public class WorkflowDefinitionVersionDTO {
    private Long id;
    private Long definitionId;
    private String businessType;
    private Integer version;
    private String actionType;
    private String status;
    private String name;
    private String description;
    private Map<String, Object> definition;
    private String publishNote;
    private String impactScope;
    private String rollbackPlan;
    private Long rollbackSourceVersion;
    private Long operatorId;
    private LocalDateTime publishedAt;
    private LocalDateTime createTime;
}
