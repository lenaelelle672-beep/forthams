package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 操作趋势统计响应 VO.
 * 对应 SWARM-P1-005-BE 规格文档中的 TrendResponse 结构.
 * 返回指定日期范围内按天/周/月聚合的操作数量时序数据.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrendVO {

    /**
     * 时间粒度: daily, weekly, monthly
     */
    private String granularity;

    /**
     * 查询开始日期 (ISO-8601 字符串, 如 "2025-01-01")
     */
    private String startDate;

    /**
     * 查询结束日期 (ISO-8601 字符串, 如 "2025-01-03")
     */
    private String endDate;

    /**
     * 趋势数据点列表, 无数据的时段已补零
     */
    private List<TrendDataPoint> data;

    /**
     * 单个时段的聚合数据点.
     * date 格式随 granularity 变化:
     * - daily: "yyyy-MM-dd"
     * - weekly: "yyyy-'W'ww"
     * - monthly: "yyyy-MM"
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrendDataPoint {

        /**
         * 时间标签
         */
        private String date;

        /**
         * 该时间段内的操作记录数
         */
        private Long count;
    }
}