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
public class MailTemplateMetaDTO {
    private List<Option> categories;
    private List<Option> contentTypes;
    private List<Option> statuses;
    private PreviewVariablePolicy previewVariablePolicy;
    private Boolean tenantScoped;
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
    public static class PreviewVariablePolicy {
        private Boolean htmlEscaped;
        private Boolean whitelistOnly;
        private Boolean nonPersistent;
        private List<String> sensitiveVariableNames;
        private List<String> examples;
    }
}
