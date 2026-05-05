package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
public class WorkflowDefinitionDTO {
    private Long id;
    private String businessType;
    private String name;
    private String description;
    private Map<String, Object> definition;
    private String status;
    private Integer version;
    private Long updatedBy;
    private Long publishedBy;
    private LocalDateTime publishedAt;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
