package com.ams.dto;

import lombok.Data;

@Data
public class ApprovalRuleConflictDTO {
    private Long ruleId;
    private Long conflictRuleId;
    private String processKey;
    private String nodeKey;
    private Integer priority;
    private String conditionSummary;
    private String conflictSummary;
    private String severity;
    private String auditSummary;
}
