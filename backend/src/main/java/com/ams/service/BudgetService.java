package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.BudgetCreateDTO;
import com.ams.entity.Budget;
import com.ams.mapper.BudgetMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BudgetService {

    private final BudgetMapper budgetMapper;

    // ── CRUD ─────────────────────────────────────────────────────────────

    public Page<Budget> getPage(int page, int size, Integer budgetYear, Long deptId,
                                 Long categoryId, String budgetType, String status) {
        String tenantId = TenantContext.requireTenantId();
        QueryWrapper<Budget> wrapper = new QueryWrapper<Budget>()
                .eq("tenant_id", tenantId)
                .orderByDesc("budget_year", "id");
        if (budgetYear != null) wrapper.eq("budget_year", budgetYear);
        if (deptId != null) wrapper.eq("dept_id", deptId);
        if (categoryId != null) wrapper.eq("category_id", categoryId);
        if (budgetType != null && !budgetType.isBlank()) wrapper.eq("budget_type", budgetType);
        if (status != null && !status.isBlank()) wrapper.eq("status", status);
        return budgetMapper.selectPage(new Page<>(page, size), wrapper);
    }

    public Budget getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        Budget budget = budgetMapper.selectOne(new QueryWrapper<Budget>()
                .eq("tenant_id", tenantId).eq("id", id));
        if (budget == null) throw new BusinessException("预算不存在");
        return budget;
    }

    @Transactional(rollbackFor = Exception.class)
    public Budget create(Budget budget) {
        budget.setTenantId(TenantContext.requireTenantId());
        if (budget.getStatus() == null) budget.setStatus("DRAFT");
        if (budget.getUsedAmount() == null) budget.setUsedAmount(BigDecimal.ZERO);
        if (budget.getCommittedAmount() == null) budget.setCommittedAmount(BigDecimal.ZERO);
        budgetMapper.insert(budget);
        return budget;
    }

    @Transactional(rollbackFor = Exception.class)
    public Budget update(Long id, Budget budget) {
        Budget existing = getById(id);
        budget.setId(id);
        budget.setTenantId(existing.getTenantId());
        budgetMapper.updateById(budget);
        return budgetMapper.selectById(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        getById(id);
        budgetMapper.deleteById(id);
    }

    // ── 预算检查 ─────────────────────────────────────────────────────────

    /**
     * 检查预算是否充足
     */
    public Map<String, Object> checkBudget(Long deptId, Long categoryId, String budgetType, BigDecimal amount) {
        String tenantId = TenantContext.requireTenantId();
        int currentYear = java.time.LocalDate.now().getYear();

        // 查找匹配的预算
        List<Budget> budgets = budgetMapper.selectList(new QueryWrapper<Budget>()
                .eq("tenant_id", tenantId)
                .eq("budget_year", currentYear)
                .eq("dept_id", deptId)
                .eq("category_id", categoryId)
                .eq("budget_type", budgetType)
                .eq("status", "APPROVED"));

        if (budgets.isEmpty()) {
            Budget draftBudget = budgetMapper.selectOne(new QueryWrapper<Budget>()
                    .eq("tenant_id", tenantId)
                    .eq("budget_year", currentYear)
                    .eq("dept_id", deptId)
                    .eq("category_id", categoryId)
                    .eq("budget_type", budgetType)
                    .last("LIMIT 1"));
            if (draftBudget != null) {
                return Map.of("available", false, "budgetId", draftBudget.getId(),
                        "remaining", BigDecimal.ZERO, "reason", "预算未审批");
            }
            return Map.of("available", false, "budgetId", null,
                    "remaining", BigDecimal.ZERO, "reason", "未找到对应预算");
        }

        Budget budget = budgets.get(0);
        BigDecimal used = valueOrZero(budget.getUsedAmount());
        BigDecimal committed = valueOrZero(budget.getCommittedAmount());
        BigDecimal total = valueOrZero(budget.getTotalAmount());

        BigDecimal remaining = total.subtract(used).subtract(committed);
        boolean available = remaining.compareTo(amount) >= 0;

        Map<String, Object> result = new HashMap<>();
        result.put("available", available);
        result.put("budgetId", budget.getId());
        result.put("remaining", remaining.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
        result.put("totalAmount", total);
        result.put("usedAmount", used);
        result.put("committedAmount", committed);
        return result;
    }

    // ── 使用量更新 ───────────────────────────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public void updateUsage(Long budgetId, BigDecimal amount, String operation) {
        Budget budget = getById(budgetId);
        switch (operation.toUpperCase()) {
            case "COMMIT" -> budget.setCommittedAmount(
                    valueOrZero(budget.getCommittedAmount()).add(amount));
            case "USE" -> {
                budget.setUsedAmount(valueOrZero(budget.getUsedAmount()).add(amount));
                // 使用后释放承诺
                BigDecimal committed = valueOrZero(budget.getCommittedAmount()).subtract(amount).max(BigDecimal.ZERO);
                budget.setCommittedAmount(committed);
            }
            case "RELEASE" -> budget.setCommittedAmount(
                    valueOrZero(budget.getCommittedAmount()).subtract(amount).max(BigDecimal.ZERO));
            default -> throw new BusinessException("不支持的操作: " + operation);
        }
        budgetMapper.updateById(budget);
    }

    // ── 执行率与超支告警 ─────────────────────────────────────────────────

    /**
     * 获取指定年度的预算执行率
     */
    public List<Map<String, Object>> getExecutionRate(Integer budgetYear) {
        String tenantId = TenantContext.requireTenantId();
        if (budgetYear == null) budgetYear = java.time.LocalDate.now().getYear();

        List<Budget> budgets = budgetMapper.selectList(new QueryWrapper<Budget>()
                .eq("tenant_id", tenantId)
                .eq("budget_year", budgetYear));

        return budgets.stream().map(b -> {
            BigDecimal total = valueOrZero(b.getTotalAmount());
            BigDecimal used = valueOrZero(b.getUsedAmount());
            BigDecimal rate = total.compareTo(BigDecimal.ZERO) > 0
                    ? used.divide(total, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"))
                    : BigDecimal.ZERO;
            Map<String, Object> m = new HashMap<>();
            m.put("budgetId", b.getId());
            m.put("budgetYear", b.getBudgetYear());
            m.put("budgetType", b.getBudgetType());
            m.put("totalAmount", total);
            m.put("usedAmount", used);
            m.put("committedAmount", valueOrZero(b.getCommittedAmount()));
            m.put("executionRate", rate.setScale(2, RoundingMode.HALF_UP));
            m.put("status", b.getStatus());
            return m;
        }).collect(Collectors.toList());
    }

    /**
     * 获取超支告警列表
     */
    public List<Map<String, Object>> getOverBudgetAlerts() {
        String tenantId = TenantContext.requireTenantId();
        int currentYear = java.time.LocalDate.now().getYear();

        List<Budget> budgets = budgetMapper.selectList(new QueryWrapper<Budget>()
                .eq("tenant_id", tenantId)
                .eq("budget_year", currentYear));

        return budgets.stream()
                .filter(b -> valueOrZero(b.getUsedAmount()).compareTo(valueOrZero(b.getTotalAmount())) > 0)
                .map(b -> {
                    BigDecimal overshoot = valueOrZero(b.getUsedAmount()).subtract(valueOrZero(b.getTotalAmount()));
                    Map<String, Object> m = new HashMap<>();
                    m.put("budgetId", b.getId());
                    m.put("budgetYear", b.getBudgetYear());
                    m.put("budgetType", b.getBudgetType());
                    m.put("totalAmount", valueOrZero(b.getTotalAmount()));
                    m.put("usedAmount", valueOrZero(b.getUsedAmount()));
                    m.put("overshoot", overshoot.setScale(2, RoundingMode.HALF_UP));
                    m.put("status", b.getStatus());
                    return m;
                })
                .collect(Collectors.toList());
    }

    private BigDecimal valueOrZero(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
