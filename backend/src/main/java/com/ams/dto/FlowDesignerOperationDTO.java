package com.ams.dto;

import lombok.Data;

@Data
public class FlowDesignerOperationDTO {
    private Long operatorId;
    private String reason;
    private String publishNote;
    private String impactScope;
    private String rollbackPlan;
    private Boolean confirmed;
}
