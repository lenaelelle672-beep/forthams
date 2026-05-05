package com.ams.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class CompensationValuationDTO {
    private Long assetId;
    private String compensationType;
    private BigDecimal estimatedAmount;
    private BigDecimal baseAmount;
    private String valuationBasis;
}
