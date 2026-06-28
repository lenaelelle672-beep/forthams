package com.ams.dto;

import lombok.Data;

@Data
public class WorkflowRollbackRequest {
    private String reason;
    private String impactScope;
    private String rollbackPlan;
    private Long operatorId;
}
