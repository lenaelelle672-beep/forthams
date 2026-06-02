package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UtilizationOverviewDTO {

    @JsonProperty("overallUtilizationRate")
    private BigDecimal overallUtilizationRate;

    @JsonProperty("idleAssetCount")
    private Long idleAssetCount;

    @JsonProperty("inUseAssetCount")
    private Long inUseAssetCount;

    @JsonProperty("highUtilizationCount")
    private Long highUtilizationCount;

}
