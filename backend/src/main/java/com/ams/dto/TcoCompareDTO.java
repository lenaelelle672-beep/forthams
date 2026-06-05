package com.ams.dto;

import java.math.BigDecimal;

public record TcoCompareDTO(
        Long assetId,
        String assetNo,
        String assetName,
        BigDecimal totalCost,
        BigDecimal avgCost
) {
}
