package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SystemExternalSystemDTO {

    private Long id;
    private String tenantId;
    private String systemCode;
    private String systemName;
    private String systemType;
    private String maskedBaseUrl;
    private String authType;
    private String authConfigSummary;
    private Boolean authConfigured;
    private Boolean configMasked;
    private String maskedSecretSummary;
    private Boolean enabled;
    private String status;
    private String healthStatus;
    private String lastValidationStatus;
    private String lastValidationMessage;
    private LocalDateTime lastValidationAt;
    private Long lastOperatorId;
    private String lastOperation;
    private String lastOperationReason;
    private String auditEvidenceSummary;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
