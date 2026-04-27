package com.ams.dto;

import lombok.*;

import java.util.ArrayList;
import java.util.List;

/**
 * 操作类型分布统计响应 VO。
 *
 * <p>用于操作日志仪表板的「操作类型分布」API 响应，
 * 包含各操作类型的次数及占比。</p>
 *
 * <p>对应 ATB-005 / ATB-006 验收测试基准。</p>
 *
 * @see com.ams.service.AuditDashboardService
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TypeDistributionVO {

    /** 操作总数 */
    private Long totalOperations;

    /** 各操作类型的分布明细，无数据时返回空列表 [] */
    @Builder.Default
    private List<DistributionItem> distribution = new ArrayList<>();

    /**
     * 单个操作类型的分布项。
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DistributionItem {

        /** 操作类型（如 LOGIN、CREATE、DELETE），对应 AuditLog.actionType */
        private String actionType;

        /** 该类型的操作次数 */
        private Long count;

        /** 占总操作数的百分比，保留两位小数（如 58.82 表示 58.82%） */
        private Double percentage;
    }
}