package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 租户主数据 DTO。
 *
 * 字段与前端 TenantRecord 对齐（id/name/plan/maxUsers/maxAssets/status/contact*）。
 * 只读 catalog：不暴露 create/update/suspend/activate 写操作。
 */
@Data
public class SysTenantDTO {
    private String id;
    private String name;
    private String plan;
    private Integer maxUsers;
    private Integer maxAssets;
    private String status;
    private String contactName;
    private String contactPhone;
    private String contactEmail;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /** 分页结果，与前端 TenantList 对齐 */
    @Data
    public static class PageResult {
        private List<SysTenantDTO> records = new ArrayList<>();
        private long total;
    }

    /** 只读元数据：可用计划、状态、只读边界提示 */
    @Data
    public static class Meta {
        private List<String> plans = new ArrayList<>();
        private List<String> statuses = new ArrayList<>();
        private String readOnlyNotice;
    }
}
