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
public class CustomFieldsetDTO {
    private Long id;
    private String tenantId;
    private String name;
    private String description;
    private Long categoryId;
    private Integer sortOrder;
    private Integer status;
    private Integer fieldCount;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    private Boolean tenantScoped;
    private Boolean noPersistence;
    private Boolean runtimeEffect;
    private String readonlyBoundary;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PageResult {
        private List<CustomFieldsetDTO> records;
        private long total;
        private int size;
        private int current;
        private long pages;
        private Boolean tenantScoped;
        private String readonlyBoundary;
    }
}
