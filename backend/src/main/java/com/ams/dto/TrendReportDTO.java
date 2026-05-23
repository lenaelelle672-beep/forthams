package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 月度趋势报表 DTO。
 *
 * <p>用于封装 GET /api/reports/trend 接口中每个月的趋势数据。
 * 包含月份、资产数量和资产总价值。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrendReportDTO {

    /** 月份（格式：yyyy-MM） */
    @JsonProperty("month")
    private String month;

    /** 当月新增资产数量 */
    @JsonProperty("assetCount")
    private long assetCount;

    /** 当月新增资产总价值 */
    @JsonProperty("totalValue")
    private double totalValue;
}
