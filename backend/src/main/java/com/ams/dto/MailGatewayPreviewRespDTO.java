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
public class MailGatewayPreviewRespDTO {
    private Boolean previewAccepted;
    private Boolean configured;
    private List<String> acceptedFields;
    private List<RejectedInput> rejectedInputs;
    private List<String> warnings;
    private Boolean tenantScoped;
    private Boolean readOnly;
    private Boolean noPersistence;
    private Boolean noSend;
    private Boolean noNetwork;
    private Boolean runtimeEffect;
    private Boolean cacheRefreshed;
    private Boolean credentialExposed;
    private Boolean smtpConnect;
    private Boolean javaMailSenderUsed;
    private Boolean mailSenderProviderUsed;
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
