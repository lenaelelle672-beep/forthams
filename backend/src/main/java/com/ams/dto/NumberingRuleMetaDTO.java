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
public class NumberingRuleMetaDTO {
    private List<NumberingRuleDTO> defaultRules;
    private List<VariableOption> allowedVariables;
    private PreviewPolicy previewPolicy;
    private Boolean tenantScoped;
    private Boolean readOnly;
    private Boolean noPersistencePreview;
    private Boolean noSequenceReserved;
    private Boolean runtimeEffect;
    private Boolean cacheRefreshed;
    private Boolean sequenceAllocated;
    private Boolean persistent;
    private String authority;
    private String readonlyBoundary;
    private List<String> nonGoals;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VariableOption {
        private String value;
        private String label;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PreviewPolicy {
        private Boolean deterministic;
        private Boolean noPersistence;
        private Boolean noSequenceReserved;
        private Boolean runtimeEffect;
        private Boolean cacheRefreshed;
        private Boolean sequenceAllocated;
        private Boolean persistent;
        private String readonlyBoundary;
        private List<String> rejectedInputFields;
    }
}
