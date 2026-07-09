package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
public class FormDefinitionDTO {
    private Long id;
    private String formKey;
    private String name;
    private String description;
    private Map<String, Object> schema;
    private String status;
    private Integer version;
    private Long updatedBy;
    private Long publishedBy;
    private LocalDateTime publishedAt;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
