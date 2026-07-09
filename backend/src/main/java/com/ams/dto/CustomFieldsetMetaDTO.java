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
public class CustomFieldsetMetaDTO {
    private List<Option> statuses;
    private PreviewPolicy previewPolicy;
    private List<String> allowedRoutes;
    private Boolean readOnly;
    private Boolean tenantScoped;
    private Boolean noPersistencePreview;
    private Boolean runtimeEffect;
    private Boolean categoryBindingDeferred;
    private Boolean assignmentMutationDeferred;
    private String readonlyBoundary;
    private List<String> deferredEffects;
    private List<String> nonGoals;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Option {
        private String value;
        private String label;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PreviewPolicy {
        private Boolean tenantScoped;
        private Boolean noPersistence;
        private Boolean runtimeEffect;
        private Boolean validatesFieldIds;
        private Boolean validatesCategoryId;
        private List<String> rejectedEffects;
    }
}
