package com.ams.dto;

import lombok.Data;

@Data
public class ApprovalRuleSaveDTO {
    private String processKey;
    private String businessType;
    private String nodeKey;
    private String ruleName;
    private Integer priority;
    private String conditionExpression;
    private String approverStrategy;
    private String status;
    private Long operatorId;
    private String reason;
    private String auditEvidence;
}
