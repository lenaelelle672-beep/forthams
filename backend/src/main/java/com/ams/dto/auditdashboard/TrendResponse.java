package com.ams.dto.auditdashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 审计日志仪表板趋势统计响应 DTO。
 * 用于返回按天、周、月聚合的操作次数趋势数据。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrendResponse {

    /**
     * 聚合粒度: daily, weekly, monthly
     */
    private String granularity;

    /**
     * 查询起始日期 (yyyy-MM-dd)
     */
    private String startDate;

    /**
     * 查询结束日期 (yyyy-MM-dd)
     */
    private String endDate;

    /**
     * 趋势数据点列表
     */
    private List<TrendDataPoint> data;

    /**
     * 单个时间点的统计结果。
     * 定义为内部静态类以保持 TrendResponse 的自包含性，
     * 避免对尚未创建的 TrendDataPoint.java 产生编译依赖。
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrendDataPoint {

        /**
         * 时间标签。
         * 格式取决于 granularity:
         *   daily   → "2025-01-01"
         *   weekly  → "2025-W02"
         *   monthly → "2025-01"
         */
        private String date;

        /**
         * 该时间段内的操作记录总数
         */
        private Long count;
    }
}