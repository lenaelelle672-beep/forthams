package com.ams.dto;

import lombok.Data;

import java.util.Map;

@Data
public class SystemExternalSystemSaveDTO {

    private String tenantId;
    private String systemCode;
    private String systemName;
    private String systemType;
    private String baseUrl;
    private String authType;
    private Map<String, String> authConfig;
    private Boolean enabled;
    private Long operatorId;
    private String reason;
    private String auditEvidence;
}
