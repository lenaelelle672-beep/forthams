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
public class AssetUtilizationDTO {

    @JsonProperty("assetId")
    private Long assetId;

    @JsonProperty("assetName")
    private String assetName;

    @JsonProperty("assetNo")
    private String assetNo;

    @JsonProperty("status")
    private String status;

    @JsonProperty("usedHours")
    private BigDecimal usedHours;

    @JsonProperty("totalHours")
    private BigDecimal totalHours;

    @JsonProperty("utilizationRate")
    private BigDecimal utilizationRate;

    @JsonProperty("idleDays")
    private Integer idleDays;

    @JsonProperty("lastUsedDate")
    private String lastUsedDate;

}
