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
public class NotificationPreferenceMetaDTO {
    private List<Option> categories;
    private List<Option> channelTypes;
    private List<Option> statuses;
    private QuietWindowPolicy quietWindowPolicy;
    private PreviewPolicy previewPolicy;
    private List<String> reservedCategoryWords;
    private Boolean tenantScoped;
    private Boolean readOnly;
    private Boolean noPersistencePreview;
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
    public static class QuietWindowPolicy {
        private String format;
        private Boolean crossMidnightSupported;
        private List<String> examples;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PreviewPolicy {
        private Boolean tenantScoped;
        private Boolean noPersistence;
        private Boolean noSend;
        private Boolean runtimeEffect;
        private List<String> rejectedInputFields;
    }
}
