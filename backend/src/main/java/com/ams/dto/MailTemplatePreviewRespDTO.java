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
public class MailTemplatePreviewRespDTO {
    private String renderedSubject;
    private String renderedContent;
    private List<String> missingVariables;
    private List<RejectedVariable> rejectedVariables;
    private List<String> usedVariables;
    private Boolean nonPersistent;
    private Boolean htmlEscaped;
    private Boolean tenantScoped;
    private String readonlyBoundary;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RejectedVariable {
        private String name;
        private String reason;
    }
}
