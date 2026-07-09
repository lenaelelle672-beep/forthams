package com.ams.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class SystemConfigRefreshResultDTO {

    private String overallStatus;
    private List<NamespaceResult> namespaceResults;
    private Integer refreshedCount;
    private Integer degradedCount;
    private Map<String, String> beforeMasked;
    private Map<String, String> afterMasked;
    private String auditEvidenceSummary;
    private String message;

    @Data
    public static class NamespaceResult {
        private String namespace;
        private String status;
        private Integer itemCount;
        private String message;
        private String remediation;
    }
}
