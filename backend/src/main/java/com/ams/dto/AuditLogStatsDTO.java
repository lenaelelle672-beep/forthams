package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AuditLogStatsDTO {

    private Long totalCount;
    @Builder.Default
    private List<AuditTrendResp.DataPoint> trendData = new ArrayList<>();
    @Builder.Default
    private List<AuditDistResp.DistributionItem> typeDistribution = new ArrayList<>();
    @Builder.Default
    private List<OperatorRankingVO> topOperators = new ArrayList<>();
    @Builder.Default
    private Map<String, Object> meta = new LinkedHashMap<>();
    private Boolean tenantScoped;
    private Boolean masked;
    private String readonlyBoundary;
}
