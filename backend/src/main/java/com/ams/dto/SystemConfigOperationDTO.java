package com.ams.dto;

import lombok.Data;

import java.util.List;

@Data
public class SystemConfigOperationDTO {

    private Long operatorId;
    private String reason;
    private String auditEvidence;
    private Boolean confirmed;
    private List<String> namespaces;
}
