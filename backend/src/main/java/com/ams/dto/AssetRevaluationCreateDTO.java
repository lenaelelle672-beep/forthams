package com.ams.dto;

import java.math.BigDecimal;

public record AssetRevaluationCreateDTO(
        Long assetId,
        String revaluationType,
        BigDecimal newValue,
        String reason,
        String evidence
) {
}
