package com.ams.dto;

import lombok.Data;

@Data
public class FormStorageOperationDTO {
    private Long operatorId;
    private Boolean confirmed;
    private String reason;
    private String auditEvidence;
    private String impactScope;
    private FormStorageQueryDTO query;
}
