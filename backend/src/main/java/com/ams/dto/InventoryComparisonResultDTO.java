package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 盘点差异比对结果传输对象。
 * <p>
 * 用于返回 POST /api/v1/inventories/{id}/compare 的响应内容。
 * 符合 SWARM-P3-010-BE 规格要求，包含盘盈、盘亏、状态不一致三类差异列表
 * 及汇总统计信息。
 *
 * @see com.ams.service.InventoryService
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryComparisonResultDTO {

    /** 盘点任务ID */
    private Long inventoryId;

    /** 盘点单编号 */
    private String inventoryCode;

    /** 比对执行时间 */
    private LocalDateTime comparisonTime;

    /**
     * 盘盈资产列表：实盘有但账面无（surplus_assets）
     */
    @JsonProperty("surplus_assets")
    private List<SurplusAssetDTO> surplusAssets;

    /**
     * 盘亏资产列表：账面有但实盘无/缺失（deficit_assets）
     */
    @JsonProperty("deficit_assets")
    private List<DeficitAssetDTO> deficitAssets;

    /**
     * 状态不一致资产列表：账实状态不符（inconsistent_assets）
     */
    @JsonProperty("inconsistent_assets")
    private List<InconsistentAssetDTO> inconsistentAssets;

    /**
     * 差异汇总统计信息，辅助前端展示盘点概况
     */
    private ComparisonSummaryDTO summary;

    // ======================== 内部静态 DTO ========================

    /**
     * 盘盈资产明细：实盘中发现但账面无记录的资产
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SurplusAssetDTO {

        /** 资产ID（如可通过扫码识别） */
        private Long assetId;

        /** 资产编码 */
        private String assetCode;

        /** 资产名称 */
        private String assetName;

        /** 资产分类名称 */
        private String categoryName;

        /** 实盘发现位置 */
        private String locationName;

        /** 实盘状态 */
        private String actualStatus;

        /** 估算单价 */
        private BigDecimal estimatedUnitPrice;

        /** 备注 */
        private String remark;
    }

    /**
     * 盘亏资产明细：账面有记录但实盘未发现或缺失的资产
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DeficitAssetDTO {

        /** 资产ID */
        private Long assetId;

        /** 资产编码 */
        private String assetCode;

        /** 资产名称 */
        private String assetName;

        /** 资产分类名称 */
        private String categoryName;

        /** 账面所在位置 */
        private String locationName;

        /** 账面（预期）状态 */
        private String expectedStatus;

        /** 资产单价（用于计算盘亏金额） */
        private BigDecimal unitPrice;

        /** 备注 */
        private String remark;
    }

    /**
     * 状态不一致资产明细：资产同时存在于账面与实盘，但状态不符
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InconsistentAssetDTO {

        /** 资产ID */
        private Long assetId;

        /** 资产编码 */
        private String assetCode;

        /** 资产名称 */
        private String assetName;

        /** 资产分类名称 */
        private String categoryName;

        /** 所在位置 */
        private String locationName;

        /** 账面（预期）状态 */
        private String expectedStatus;

        /** 实盘状态 */
        private String actualStatus;

        /** 备注 */
        private String remark;
    }

    /**
     * 盘点差异汇总统计数据
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ComparisonSummaryDTO {

        /** 账面资产总数 */
        private int totalBookedAssets;

        /** 实盘发现资产总数 */
        private int totalPhysicalAssets;

        /** 盘盈数量 */
        private int surplusCount;

        /** 盘亏数量 */
        private int deficitCount;

        /** 状态不一致数量 */
        private int inconsistentCount;

        /** 盘盈价值合计 */
        private BigDecimal surplusValue;

        /** 盘亏价值合计（绝对值） */
        private BigDecimal deficitValue;

        /** 差异率 = deficitCount / totalBookedAssets */
        private BigDecimal discrepancyRate;
    }
}