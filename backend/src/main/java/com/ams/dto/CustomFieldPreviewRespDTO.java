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
public class CustomFieldPreviewRespDTO {
    private Boolean valid;
    private List<FieldIssue> missing;
    private List<FieldIssue> rejected;
    private List<String> errors;
    private List<UsedField> usedFields;
    private Boolean tenantScoped;
    private Boolean noPersistence;
    private Boolean runtimeEffect;
    private String readonlyBoundary;

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
        private String validationPattern;
        private List<String> options;
    }
}
