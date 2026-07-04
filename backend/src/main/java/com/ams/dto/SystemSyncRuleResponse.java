package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SystemSyncRuleResponse {

    private Long id;
    private String tenantId;
    private Long interfaceId;
    private String ruleName;
    private String triggerType;
    private String cronExpression;
    private Integer retryCount;
    private Boolean enabled;
    private String status;
    private String lastStatus;
    private LocalDateTime lastRunAt;
    private LocalDateTime nextRunAt;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
