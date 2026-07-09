package com.ams.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class SlaConfigSaveDTO {
    private String processKey;
    private String businessType;
    private String nodeKey;
    private String priority;
    private Integer responseHours;
    private Integer resolveHours;
    private Double warningRatio;
    private Double escalationRatio;
    private Integer status;
    private Boolean enabled;
    private List<Map<String, String>> notificationTargets;
    private Map<String, Object> variablePreview;
    private Long operatorId;
    private Boolean confirmed;
    private String reason;
    private String auditEvidence;
}
