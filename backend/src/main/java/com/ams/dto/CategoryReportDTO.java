package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 按分类统计的资产数据 DTO
 *
 * <p>用于封装 GET /api/reports/by-category 接口中每个分类的统计数据。
 * 包含分类名称、资产数量和资产总价值三项指标。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CategoryReportDTO {

    /** 分类名称 */
    @JsonProperty("categoryName")
    private String categoryName;

    /** 该分类下的资产数量 */
    @JsonProperty("assetCount")
    private long assetCount;

    /** 该分类下的资产总价值 */
    @JsonProperty("totalValue")
    private double totalValue;
}
