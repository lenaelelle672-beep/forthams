package com.ams.dto;

import com.ams.entity.WebhookConfig;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class WebhookConfigResponse {
    private Long id;
    private String name;
    private String url;
    private Boolean signatureConfigured;
    private List<String> events;
    private Integer enabled;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static WebhookConfigResponse from(WebhookConfig config) {
        return WebhookConfigResponse.builder()
                .id(config.getId())
                .name(config.getName())
                .url(config.getUrl())
                .signatureConfigured(config.getSecret() != null && !config.getSecret().isBlank())
                .events(config.getEvents())
                .enabled(config.getEnabled())
                .description(config.getDescription())
                .createdAt(config.getCreatedAt())
                .updatedAt(config.getUpdatedAt())
                .build();
    }
}
