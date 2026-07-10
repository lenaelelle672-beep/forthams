package com.ams.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/** 技术支持工单只读 catalog DTO。诊断包强制脱敏，禁止导出敏感配置原值。 */
@Data
public class SupportTicketDTO {
    private Long id;
    private String title;
    private String category;
    private String priority;
    private String priorityLabel;
    private String status;
    private String statusLabel;
    private String requesterName;
    private String assigneeName;
    private Boolean diagnosticPackageAttached;
    private Boolean diagnosticPackageMasked;
    private String summary;
    private String createdAt;
    private String updatedAt;

    @Data
    public static class PageResult {
        private List<SupportTicketDTO> records = new ArrayList<>();
        private long total;
    }

    @Data
    public static class Meta {
        private List<String> priorities = new ArrayList<>();
        private List<String> statuses = new ArrayList<>();
        private String readOnlyNotice;
    }
}
