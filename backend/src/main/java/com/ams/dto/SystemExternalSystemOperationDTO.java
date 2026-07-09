package com.ams.dto;

import lombok.Data;

@Data
public class SystemExternalSystemOperationDTO {

    private Boolean confirmed;
    private Long operatorId;
    private String reason;
    private String auditEvidence;
}
