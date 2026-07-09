package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChannelConfigPreviewRespDTO {
    private String channelType;
    private String configName;
    private Boolean configured;
    private Boolean webhookUrlConfigured;
    private String webhookUrlMasked;
    private Boolean signatureConfigured;
    private Integer enabled;
    private Boolean sampleEndpointAccepted;
    private Boolean previewAccepted;
    private List<RejectedInput> rejectedInputs;
    private Boolean tenantScoped;
    private Boolean noPersistence;
    private Boolean noSend;
    private Boolean runtimeEffect;
    private String readonlyBoundary;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RejectedInput {
        private String field;
        private String reason;
    }
}
