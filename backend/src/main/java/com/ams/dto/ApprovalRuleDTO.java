package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ApprovalRuleDTO {
    private Long id;
    private String processKey;
    private String businessType;
    private String nodeKey;
    private String ruleName;
    private Integer priority;
    private String conditionExpression;
    private String conditionSummary;
    private String approverStrategy;
    private String approverSummary;
    private String status;
    private String auditSummary;
    private Long createdBy;
    private Long updatedBy;
    private Long enabledBy;
    private LocalDateTime enabledAt;
    private Long disabledBy;
    private LocalDateTime disabledAt;
    private String disabledReason;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
