package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 资产汇总统计 DTO
 *
 * <p>用于封装 GET /api/reports/summary 接口的响应数据。
 * 包含资产总数、在用资产数、待审批数和近期退役数四项指标。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportSummaryDTO {

    /** 资产总数 */
    @JsonProperty("totalAssets")
    private long totalAssets;

    /** 在用资产数（status = IN_USE） */
    @JsonProperty("activeAssets")
    private long activeAssets;

    /** 待审批数（status = PENDING_APPROVAL） */
    @JsonProperty("pendingApproval")
    private long pendingApproval;

    /** 近期退役数（status = RETIRED） */
    @JsonProperty("recentlyRetired")
    private long recentlyRetired;
}
