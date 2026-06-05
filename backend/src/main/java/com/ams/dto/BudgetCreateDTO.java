package com.ams.dto;

import java.math.BigDecimal;

public record BudgetCreateDTO(
        Integer budgetYear,
        Long deptId,
        Long categoryId,
        String budgetType,
        BigDecimal totalAmount
) {
}
