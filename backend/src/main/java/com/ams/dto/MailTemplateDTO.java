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
public class MailTemplateDTO {
    private Long id;
    private String tenantId;
    private String templateCode;
    private String templateName;
    private String category;
    private String subjectTemplate;
    private String contentTemplate;
    private String contentType;
    private String variables;
    private Integer isBuiltin;
    private Integer status;
    private String createBy;
    private LocalDateTime createTime;
    private String updateBy;
    private LocalDateTime updateTime;
    private Boolean tenantScoped;
    private String readonlyBoundary;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PageResult {
        private List<MailTemplateDTO> records;
        private long total;
        private int size;
        private int current;
        private long pages;
        private Boolean tenantScoped;
        private String readonlyBoundary;
    }
}
