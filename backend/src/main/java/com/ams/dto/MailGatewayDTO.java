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
public class MailGatewayDTO {
    private Long id;
    private String gatewayCode;
    private String gatewayName;
    private String hostMasked;
    private Integer port;
    private String tlsMode;
    private Boolean authConfigured;
    private String senderMasked;
    private Integer priority;
    private Boolean enabled;
    private String lastTestStatus;
    private LocalDateTime lastTestAt;
    private Boolean tenantScoped;
    private Boolean readOnly;
    private String readonlyBoundary;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PageResult {
        private List<MailGatewayDTO> records;
        private long total;
        private int page;
        private int pageSize;
        private long pages;
        private Boolean tenantScoped;
        private Boolean readOnly;
        private String readonlyBoundary;
    }
}
