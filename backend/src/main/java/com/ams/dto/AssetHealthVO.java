package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 资产健康评分结果 VO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssetHealthVO {
    private Long assetId;
    private String assetName;
    private String assetCode;

    /** 综合健康评分 0-100 */
    private Integer score;

    /** 评分等级: HEALTHY(>80) / WARNING(50-80) / CRITICAL(<50) */
    private String scoreLevel;

    /** 各维度细分分数 */
    private Integer ageScore;        // 年龄评分(占比20%)
    private Integer maintenanceScore; // 维修频率评分(占比25%)
    private Integer faultRateScore;  // 故障率评分(占比20%)
    private Integer utilizationScore; // 利用率评分(占比20%)
    private Integer depreciationScore; // 折旧进度评分(占比15%)

    /** 各维度权重 */
    @Builder.Default
    private BigDecimal ageWeight = new BigDecimal("0.20");
    @Builder.Default
    private BigDecimal maintenanceWeight = new BigDecimal("0.25");
    @Builder.Default
    private BigDecimal faultRateWeight = new BigDecimal("0.20");
    @Builder.Default
    private BigDecimal utilizationWeight = new BigDecimal("0.20");
    @Builder.Default
    private BigDecimal depreciationWeight = new BigDecimal("0.15");
}
