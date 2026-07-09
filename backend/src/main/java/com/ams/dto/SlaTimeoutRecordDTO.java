package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SlaTimeoutRecordDTO {
    private Long id;
    private Long configId;
    private String processInstanceId;
    private String processKey;
    private String businessType;
    private String nodeKey;
    private String nodeName;
    private String priority;
    private LocalDateTime responseDueAt;
    private LocalDateTime resolveDueAt;
    private LocalDateTime timeoutAt;
    private Long timeoutMinutes;
    private String riskLevel;
    private String status;
    private String maskedBusinessSummary;
    private String applicantMasked;
    private String assigneeMasked;
    private String auditSummary;
    private Boolean masked;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
