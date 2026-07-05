package com.ams.dto;

import lombok.Data;

@Data
public class SystemWebhookConfigTestResponse {

    private Long configId;
    private Boolean valid;
    private Boolean configOnly;
    private String target;
    private String message;
}
