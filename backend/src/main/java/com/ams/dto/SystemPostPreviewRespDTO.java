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
public class SystemPostPreviewRespDTO {
    private Boolean previewAccepted;
    private Boolean duplicateRisk;
    private String referenceImpact;
    private List<String> acceptedFields;
    private List<RejectedInput> rejectedInputs;
    private List<String> warnings;
    private Boolean tenantScoped;
    private Boolean readOnly;
    private Boolean noPersistence;
    private Boolean noAssignment;
    private Boolean noPermissionEffect;
    private Boolean runtimeEffect;
    private Boolean cacheRefreshed;
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
