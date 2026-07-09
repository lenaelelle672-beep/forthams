package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChannelConfigDTO {
    private Long id;
    private String tenantId;
    private String channelType;
    private String configName;
    private String webhookUrlMasked;
    private Boolean webhookUrlConfigured;
    private Boolean signatureConfigured;
    private Integer enabled;
    private String description;
    private Boolean tenantScoped;
    private String readonlyBoundary;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PageResult {
        private List<ChannelConfigDTO> records;
        private long total;
        private int page;
        private int pageSize;
        private long pages;
        private Boolean tenantScoped;
        private String readonlyBoundary;
    }
}
