package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 月度统计报表 DTO。
 *
 * <p>用于封装按月份聚合的统计数据（折旧、维保、退役处置等）。
 * 包含月份标签和对应数值，适用于前端图表展示。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportMonthlyDTO {

    /** 月份（格式：M月，如 "1月"、"12月"） */
    @JsonProperty("month")
    private String month;

    /** 当月统计数值（折旧金额/维保次数/退役数量等） */
    @JsonProperty("value")
    private double value;
}
