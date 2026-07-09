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
public class CustomFieldDTO {
    private Long id;
    private String tenantId;
    private String fieldName;
    private String fieldLabel;
    private String fieldType;
    private String fieldOptions;
    private String validationPattern;
    private Integer fieldOrder;
    private Integer required;
    private Integer encrypted;
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
        private List<CustomFieldDTO> records;
        private long total;
        private int size;
        private int current;
        private long pages;
        private Boolean tenantScoped;
        private String readonlyBoundary;
    }
}
