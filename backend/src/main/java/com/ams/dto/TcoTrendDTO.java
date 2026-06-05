package com.ams.dto;

import java.math.BigDecimal;

public record TcoTrendDTO(
        String period,
        BigDecimal totalCost,
        BigDecimal purchaseCost,
        BigDecimal maintenanceCost,
        BigDecimal workOrderCost,
        BigDecimal energyCost,
        BigDecimal insuranceCost
) {
}
