package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MailLogDTO {
    private Long id;
    private String tenantId;
    private String templateCode;
    private String maskedMailFrom;
    private String maskedMailTo;
    private String maskedMailCc;
    private String maskedMailBcc;
    private String maskedSubject;
    private String maskedBodySummary;
    private String sendStatus;
    private String diagnosticSummary;
    private Integer retryCount;
    private Integer maxRetry;
    private String bizType;
    private Long bizId;
    private LocalDateTime sendTime;
    private LocalDateTime createTime;
    private Boolean redacted;
    private Boolean tenantScoped;
    private Boolean readOnly;
    private String readonlyBoundary;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PageResult {
        private List<MailLogDTO> records;
        private long total;
        private int size;
        private int current;
        private long pages;
        private Boolean redacted;
        private Boolean tenantScoped;
        private Boolean readOnly;
        private String readonlyBoundary;
        private List<String> redactionPolicy;
    }
}
