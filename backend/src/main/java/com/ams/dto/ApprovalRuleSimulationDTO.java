package com.ams.dto;

import lombok.Data;

import java.util.LinkedHashMap;
import java.util.Map;

@Data
public class ApprovalRuleSimulationDTO {
    private String processKey;
    private String businessType;
    private String nodeKey;
    private Map<String, Object> context = new LinkedHashMap<>();
    private Long operatorId;
    private String reason;
    private String auditEvidence;
}
