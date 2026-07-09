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
public class CustomFieldMetaDTO {
    private List<Option> fieldTypes;
    private List<Option> statuses;
    private PreviewPolicy previewPolicy;
    private Boolean readOnly;
    private Boolean tenantScoped;
    private Boolean noPersistencePreview;
    private Boolean fieldsetsDeferred;
    private Boolean assetValuesDeferred;
    private Boolean runtimeEffect;
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
        private Boolean noPersistence;
        private Boolean tenantScoped;
        private Boolean safeDisplay;
        private Boolean encryptedSampleEcho;
        private Boolean regexSafetyBounded;
        private List<String> supportedTypes;
        private List<String> rejectedEffects;
    }
}
