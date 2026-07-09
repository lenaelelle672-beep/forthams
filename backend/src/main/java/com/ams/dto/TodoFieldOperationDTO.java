package com.ams.dto;

import lombok.Data;

@Data
public class TodoFieldOperationDTO {
    private Long operatorId;
    private Boolean confirmed;
    private String reason;
    private String auditEvidence;
    private String roleCode;
}
