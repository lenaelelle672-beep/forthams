package com.ams.dto;

import lombok.*;

import java.util.List;

/**
 * 操作类型分布统计响应 DTO。
 * 对应接口：GET /api/audit-dashboard/action-type-distribution
 * 返回按 action_type 聚合的各类型操作次数及占比百分比。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditDistResp {

    /**
     * 操作总数（所有 action_type 的 count 之和）
     */
    private Long totalOperations;

    /**
     * 按操作类型聚合的分布列表，按 count 降序排列。
     * 无数据时返回空列表 []。
     */
    private List<DistributionItem> distribution;

    /**
     * 单个操作类型的聚合条目
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DistributionItem {

        /**
         * 操作类型名称（对应 ActionType 枚举的 name）
         */
        private String actionType;

        /**
         * 该类型操作次数
         */
        private Long count;

        /**
         * 占比百分比，保留两位小数（如 58.82）
         */
        private Double percentage;
    }
}