package com.ams.dto;

import lombok.Data;

import java.util.Map;

@Data
public class SystemWebhookConfigRequest {

    private String configName;
    private String eventType;
    private String targetUrl;
    private Boolean enabled;
    private String signingStrategy;
    private String signingSecret;
    private String secret;
    private Map<String, String> headers;
}
