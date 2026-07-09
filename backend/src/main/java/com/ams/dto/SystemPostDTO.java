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
public class SystemPostDTO {
    private Long id;
    private String postCode;
    private String postName;
    private Integer sortOrder;
    private String status;
    private String remark;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Boolean tenantScoped;
    private Boolean readOnly;
    private String readonlyBoundary;
    private String referenceCountMasked;
    private String impactSummary;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PageResult {
        private List<SystemPostDTO> records;
        private long total;
        private int page;
        private int pageSize;
        private long pages;
        private Boolean tenantScoped;
        private Boolean readOnly;
        private String readonlyBoundary;
    }
}
