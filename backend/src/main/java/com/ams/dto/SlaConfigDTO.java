package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
public class SlaConfigDTO {
    private Long id;
    private String processKey;
    private String businessType;
    private String nodeKey;
    private String priority;
    private Integer responseHours;
    private Integer resolveHours;
    private Double warningRatio;
    private Double escalationRatio;
    private Integer status;
    private String statusText;
    private Boolean enabled;
    private List<Map<String, String>> notificationTargets = new ArrayList<>();
    private String notificationTargetSummary;
    private String contactMasked;
    private String variablePreviewMasked;
    private String applicableProcessSummary;
    private String auditSummary;
    private Long updatedBy;
    private LocalDateTime enabledAt;
    private LocalDateTime disabledAt;
    private String disabledReason;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
