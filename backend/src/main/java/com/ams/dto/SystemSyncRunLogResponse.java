package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SystemSyncRunLogResponse {

    private Long id;
    private String tenantId;
    private Long ruleId;
    private String status;
    private String triggerSource;
    private String executionMode;
    private Boolean dryRun;
    private String requestId;
    private String idempotencyKey;
    private Integer attempt;
    private Integer maxAttempt;
    private String targetSummary;
    private String message;
    private String errorMessage;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private LocalDateTime nextRetryAt;
}
