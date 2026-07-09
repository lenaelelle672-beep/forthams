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
public class CustomFieldsetPreviewRespDTO {
    private Boolean valid;
    private List<FieldIssue> missingFields;
    private List<FieldIssue> rejectedFields;
    private List<UsedField> usedFields;
    private Boolean wouldBindCategory;
    private Boolean tenantScoped;
    private Boolean noPersistence;
    private Boolean runtimeEffect;
    private String readonlyBoundary;
    private List<String> errors;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FieldIssue {
        private Long fieldId;
        private String fieldName;
        private String fieldLabel;
        private String reason;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UsedField {
        private Long fieldId;
        private String fieldName;
        private String fieldLabel;
        private String fieldType;
        private Boolean required;
        private Boolean encrypted;
    }
}
