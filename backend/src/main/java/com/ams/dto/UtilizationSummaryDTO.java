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
public class UtilizationSummaryDTO {

    @JsonProperty("name")
    private String name;

    @JsonProperty("usedHours")
    private BigDecimal usedHours;

    @JsonProperty("usedAssetCount")
    private Long usedAssetCount;

    @JsonProperty("totalAssetCount")
    private Long totalAssetCount;

    @JsonProperty("utilizationRate")
    private BigDecimal utilizationRate;

}
