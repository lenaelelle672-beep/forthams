package com.ams.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.Map;

/**
 * Dashboard统计数据响应DTO
 */
@Data
public class DashboardStatsDTO {
    /**
     * 总资产数量
     */
    private Long totalAssets;

    /**
     * 在用资产数量
     */
    private Long inUseAssets;

    /**
     * 闲置资产数量
     */
    private Long idleAssets;

    /**
     * 维修中资产数量
     */
    private Long maintenanceAssets;

    /**
     * 报废资产数量
     */
    private Long scrapAssets;

    /**
     * 资产总价值
     */
    private BigDecimal totalValue;

    /**
     * 资产净值
     */
    private BigDecimal netValue;

    /**
     * 按分类统计数量 (categoryName -> count)
     */
    private Map<String, Long> categoryDistribution;

    /**
     * 待审批数量
     */
    private Long pendingApprovals;
}
