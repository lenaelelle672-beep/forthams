package com.ams.dto;

public record BudgetQueryDTO(
        Integer budgetYear,
        Long deptId,
        Long categoryId,
        String budgetType,
        String status
) {
}
