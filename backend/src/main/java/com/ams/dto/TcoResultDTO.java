package com.ams.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record TcoResultDTO(
        Long assetId,
        String assetNo,
        String assetName,
        BigDecimal purchaseCost,
        BigDecimal maintenanceCost,
        BigDecimal workOrderCost,
        BigDecimal energyCost,
        BigDecimal insuranceCost,
        BigDecimal currentValue,
        BigDecimal totalCost,
        LocalDate calculationDate
) {
}
