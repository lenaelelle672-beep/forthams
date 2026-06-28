package com.ams.dto;

import lombok.Data;

@Data
public class WorkflowPublishRequest {
    private String publishNote;
    private String impactScope;
    private String rollbackPlan;
    private Long operatorId;
}
