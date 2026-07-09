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
public class MailLogMetaDTO {
    private List<Option> sendStatuses;
    private List<Option> bizTypes;
    private List<Option> templateCodes;
    private List<String> redactionPolicy;
    private List<String> nonGoals;
    private Boolean redacted;
    private Boolean tenantScoped;
    private Boolean readOnly;
    private Boolean collectionGuaranteed;
    private String readonlyBoundary;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Option {
        private String value;
        private String label;
    }
}
