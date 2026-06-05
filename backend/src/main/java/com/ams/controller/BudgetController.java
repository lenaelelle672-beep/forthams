package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.Budget;
import com.ams.service.BudgetService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/budgets")
@RequiredArgsConstructor
public class BudgetController {

    private final BudgetService budgetService;

    @PreAuthorize("@ss.hasPermi('budget:query')")
    @GetMapping
    public Result<Page<Budget>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) Integer budgetYear,
            @RequestParam(required = false) Long deptId,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String budgetType,
            @RequestParam(required = false) String status) {
        return Result.success(budgetService.getPage(page, size, budgetYear, deptId, categoryId, budgetType, status));
    }

    @PreAuthorize("@ss.hasPermi('budget:query')")
    @GetMapping("/{id}")
    public Result<Budget> getById(@PathVariable Long id) {
        return Result.success(budgetService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('budget:create')")
    @PostMapping
    public Result<Budget> create(@Valid @RequestBody Budget budget) {
        return Result.success(budgetService.create(budget));
    }

    @PreAuthorize("@ss.hasPermi('budget:edit')")
    @PutMapping("/{id}")
    public Result<Budget> update(@PathVariable Long id, @Valid @RequestBody Budget budget) {
        return Result.success(budgetService.update(id, budget));
    }

    @PreAuthorize("@ss.hasPermi('budget:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        budgetService.delete(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('budget:query')")
    @PostMapping("/check")
    public Result<Map<String, Object>> checkBudget(@RequestBody Map<String, Object> params) {
        Long deptId = Long.valueOf(params.get("deptId").toString());
        Long categoryId = Long.valueOf(params.get("categoryId").toString());
        String budgetType = (String) params.get("budgetType");
        BigDecimal amount = new BigDecimal(params.get("amount").toString());
        return Result.success(budgetService.checkBudget(deptId, categoryId, budgetType, amount));
    }

    @PreAuthorize("@ss.hasPermi('budget:query')")
    @GetMapping("/execution-rate")
    public Result<List<Map<String, Object>>> executionRate(
            @RequestParam(required = false) Integer budgetYear) {
        return Result.success(budgetService.getExecutionRate(budgetYear));
    }

    @PreAuthorize("@ss.hasPermi('budget:query')")
    @GetMapping("/over-budget-alerts")
    public Result<List<Map<String, Object>>> overBudgetAlerts() {
        return Result.success(budgetService.getOverBudgetAlerts());
    }
}
