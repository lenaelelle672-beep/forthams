package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class ApprovalRuleSimulationResultDTO {
    private String processKey;
    private String businessType;
    private String nodeKey;
    private List<Long> matchedRuleIds = new ArrayList<>();
    private List<ApprovalRuleDTO> matchedRules = new ArrayList<>();
    private String safeExplanation;
    private String approverSummary;
    private List<String> warnings = new ArrayList<>();
    private String auditSummary;
    private Boolean tenantScoped;
    private LocalDateTime simulatedAt;
}
