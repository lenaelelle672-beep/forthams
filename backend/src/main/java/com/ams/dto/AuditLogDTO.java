package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AuditLogDTO {

    private Long id;
    private String traceId;
    private String operationType;
    private Long operatorId;
    private String operatorName;
    private String resourceType;
    private String resourceId;
    private String description;
    private String httpMethod;
    private String requestUri;
    private String ipAddress;
    private String userAgent;
    private String beforeRecordSummary;
    private String afterRecordSummary;
    private String rawPayloadSummary;
    private String errorSummary;
    private String status;
    private LocalDateTime createdAt;
    private Boolean masked;
    private Boolean tenantScoped;
    private String readonlyBoundary;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PageResult {
        @Builder.Default
        private List<AuditLogDTO> records = new ArrayList<>();
        private long total;
        private long size;
        private long current;
        private long pages;
        private Boolean tenantScoped;
        private Boolean masked;
        private String readonlyBoundary;
    }
}
