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
public class NotificationPreferencePreviewRespDTO {
    private Boolean wouldReceive;
    private Boolean inAppEnabled;
    private Boolean emailEnabled;
    private Boolean quietWindowMatched;
    private List<String> missingPreferences;
    private List<RejectedInput> rejectedInputs;
    private Boolean tenantScoped;
    private Boolean noPersistence;
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
