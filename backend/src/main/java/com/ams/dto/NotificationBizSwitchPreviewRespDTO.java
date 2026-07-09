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
public class NotificationBizSwitchPreviewRespDTO {
    private Boolean wouldNotify;
    private Boolean blockedBySwitch;
    private List<NotificationBizSwitchDTO> matchedSwitches;
    private List<String> missingSwitches;
    private List<RejectedInput> rejectedInputs;
    private Boolean tenantScoped;
    private Boolean noPersistence;
    private Boolean noSend;
    private Boolean workflowRuntimeEffect;
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
