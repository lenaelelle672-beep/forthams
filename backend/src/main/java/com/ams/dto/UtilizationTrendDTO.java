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
public class UtilizationTrendDTO {

    @JsonProperty("month")
    private String month;

    @JsonProperty("totalHours")
    private BigDecimal totalHours;

    @JsonProperty("usedHours")
    private BigDecimal usedHours;

    @JsonProperty("utilizationRate")
    private BigDecimal utilizationRate;

}
