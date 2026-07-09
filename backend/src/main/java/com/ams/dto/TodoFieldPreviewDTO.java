package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class TodoFieldPreviewDTO {
    private String roleCode;
    private List<TodoFieldConfigDTO> visibleFields = new ArrayList<>();
    private List<TodoFieldConfigDTO> maskedFields = new ArrayList<>();
    private Integer totalVisible;
    private Boolean readOnly;
    private Boolean tenantScoped;
    private String auditSummary;
    private LocalDateTime previewedAt;
}
