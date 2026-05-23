package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 资产月度趋势 DTO
 *
 * <p>用于封装 GET /api/reports/trend 接口的响应数据，
 * 描述某个月份的资产总价值和净值。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportTrendDTO {

    /** 月份（YYYY-MM 格式） */
    @JsonProperty("month")
    private String month;

    /** 该月资产总价值 */
    @JsonProperty("totalValue")
    private double totalValue;

    /** 该月资产净值 */
    @JsonProperty("netValue")
    private double netValue;
}
