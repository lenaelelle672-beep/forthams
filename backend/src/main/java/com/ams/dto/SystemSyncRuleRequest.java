package com.ams.dto;

import lombok.Data;

@Data
public class SystemSyncRuleRequest {

    private Long interfaceId;
    private String ruleName;
    private String triggerType;
    private String cronExpression;
    private Integer retryCount;
    private Boolean enabled;
}
