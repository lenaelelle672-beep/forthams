package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SystemSyncQueueSummaryResponse {

    private Long pending;
    private Long running;
    private Long failed;
    private Long nextRetry;
    private LocalDateTime nextRetryAt;
    private Boolean queueConsumptionEnabled;
    private String mode;
}
