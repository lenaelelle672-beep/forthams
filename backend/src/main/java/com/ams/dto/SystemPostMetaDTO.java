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
public class SystemPostMetaDTO {
    private List<Option> statuses;
    private List<String> allowedPreviewFields;
    private PreviewPolicy previewPolicy;
    private Boolean tenantScoped;
    private Boolean readOnly;
    private Boolean noPersistencePreview;
    private Boolean noAssignment;
    private Boolean noPermissionEffect;
    private Boolean runtimeEffect;
    private Boolean cacheRefreshed;
    private String readonlyBoundary;
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
        private Boolean noAssignment;
        private Boolean noPermissionEffect;
        private Boolean runtimeEffect;
        private Boolean cacheRefreshed;
        private String readonlyBoundary;
        private List<String> rejectedInputFields;
    }
}
