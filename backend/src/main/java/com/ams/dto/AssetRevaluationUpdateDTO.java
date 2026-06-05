package com.ams.dto;

import java.math.BigDecimal;

public record AssetRevaluationUpdateDTO(
        String revaluationType,
        BigDecimal newValue,
        String reason,
        String evidence
) {
}