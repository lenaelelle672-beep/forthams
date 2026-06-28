package com.ams.dto;

import com.ams.entity.ChannelConfig;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class ChannelConfigResponse {
    private Long id;
    private String channelType;
    private String configName;
    private String webhookUrlMasked;
    private Boolean webhookUrlConfigured;
    private Boolean signatureConfigured;
    private Integer enabled;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static ChannelConfigResponse from(ChannelConfig config) {
        return ChannelConfigResponse.builder()
                .id(config.getId())
                .channelType(config.getChannelType())
                .configName(config.getConfigName())
                .webhookUrlMasked(maskWebhookUrl(config.getWebhookUrl()))
                .webhookUrlConfigured(config.getWebhookUrl() != null && !config.getWebhookUrl().isBlank())
                .signatureConfigured(config.getSecret() != null && !config.getSecret().isBlank())
                .enabled(config.getEnabled())
                .description(config.getDescription())
                .createdAt(config.getCreatedAt())
                .updatedAt(config.getUpdatedAt())
                .build();
    }

    private static String maskWebhookUrl(String value) {
        if (value == null || value.isBlank()) {
            return "未配置";
        }
        try {
            java.net.URI uri = java.net.URI.create(value.trim());
            String host = uri.getHost();
            if (host == null || host.isBlank()) {
                return "已配置（已脱敏）";
            }
            return uri.getScheme() + "://" + host + "/***";
        } catch (IllegalArgumentException ex) {
            return "已配置（已脱敏）";
        }
    }
}
