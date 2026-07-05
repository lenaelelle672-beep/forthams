package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
public class SystemWebhookConfigResponse {

    private Long id;
    private String tenantId;
    private String configName;
    private String eventType;
    private String maskedTargetUrl;
    private Boolean enabled;
    private String status;
    private String signingStrategy;
    private Boolean secretConfigured;
    private Boolean signatureConfigured;
    private Map<String, String> maskedHeaders;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
